# 🦞 Mission Control

A real-time dashboard and control center for [OpenClaw](https://openclaw.ai) AI agents. Built with Next.js 16, React 19, and Tailwind CSS v4.

![Mission Control Dashboard](./docs/screenshot.png)

## Features

### ✅ Implemented
- **📊 System Monitor** - Real-time VPS metrics (CPU, RAM, Disk, Network)
- **🤖 Agent Status** - View all agents, their sessions, token usage, and activity
- **💰 Cost Tracking** - Real cost analytics from OpenClaw sessions with SQLite storage
- **⏰ Cron Jobs** - Visual cron manager with weekly timeline, run history, and manual triggers
- **📋 Activity Feed** - Real-time activity log of agent actions
- **🧠 Memory Browser** - Explore and search agent memory files
- **📁 File Browser** - Navigate workspace files with preview
- **🔔 Notifications** - Real-time notifications with unread counts
- **🎮 Office 3D** - 2D top-down office visualization (3D in progress)
- **⚙️ Settings** - Admin controls and configuration

### 🚧 Roadmap
See [ROADMAP.md](./ROADMAP.md) for planned features including:
- 3D Office with React Three Fiber
- Advanced analytics and ML-powered insights
- Multi-agent orchestration tools
- WebSocket real-time updates

## Prerequisites

- **Node.js** 18+ (tested with v22)
- **OpenClaw** installed and running
- **SQLite** (for cost tracking)
- **PM2** or **systemd** (for production deployment)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd mission-control
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Generate a strong password
ADMIN_PASSWORD=your-secure-password-here

# Generate with: openssl rand -base64 32
AUTH_SECRET=your-random-32-char-secret-here

# Customize branding
NEXT_PUBLIC_AGENT_NAME=Your Agent Name
NEXT_PUBLIC_AGENT_EMOJI=🤖
NEXT_PUBLIC_OWNER_USERNAME=your-github-username
NEXT_PUBLIC_TWITTER_HANDLE=@yourusername
```

### 3. Initialize Data Files

```bash
# Create data files from examples
cp data/cron-jobs.example.json data/cron-jobs.json
cp data/activities.example.json data/activities.json
cp data/notifications.example.json data/notifications.json
cp data/configured-skills.example.json data/configured-skills.json
cp data/tasks.example.json data/tasks.json
```

### 4. Set Up Cost Tracking (Optional)

Collect initial usage data:

```bash
npx tsx scripts/collect-usage.ts
```

Set up automatic hourly collection:

```bash
./scripts/setup-cron.sh
```

See [docs/COST-TRACKING.md](./docs/COST-TRACKING.md) for details.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Default login: admin / (your ADMIN_PASSWORD)

## Production Deployment

### Option A: PM2

```bash
npm run build
pm2 start npm --name "mission-control" -- start
pm2 save
```

### Option B: systemd

Create `/etc/systemd/system/mission-control.service`:

```ini
[Unit]
Description=Mission Control - AI Agent Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/mission-control
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mission-control
sudo systemctl start mission-control
```

### Reverse Proxy (Caddy example)

```caddy
mission-control.yourdomain.com {
    reverse_proxy localhost:3000
}
```

## Project Structure

```
mission-control/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── TenacitOS/   # OS-like UI shell
│   │   └── Office3D/    # 3D office components
│   ├── config/          # Configuration (branding, etc.)
│   └── lib/             # Utilities (pricing, queries, etc.)
├── data/                # JSON data files (gitignored)
├── docs/                # Documentation
├── public/              # Static assets
└── scripts/             # Utility scripts
```

## Configuration

### Branding

Edit `src/config/branding.ts` or use environment variables to customize:
- Agent name and emoji
- Owner username and social handles
- Company name (shown in Office 3D)
- App title

### Data Files

All operational data is stored in `data/` as JSON files:
- `cron-jobs.json` - Cron job definitions
- `activities.json` - Activity feed entries
- `notifications.json` - Notification queue
- `usage-tracking.db` - Cost tracking database (SQLite)

These files are **gitignored** by default. Use `.example` versions as templates.

## API Endpoints

- `GET /api/agents` - List all agents and sessions
- `GET /api/costs` - Cost analytics and trends
- `GET /api/cron` - List cron jobs
- `POST /api/cron/run` - Trigger cron job manually
- `GET /api/cron/runs` - Get run history for a job
- `GET /api/notifications` - Fetch notifications
- `GET /api/system/stats` - System metrics (status bar)
- `GET /api/system/monitor` - Detailed system info (PM2, Docker, etc.)

See individual route files in `src/app/api/` for details.

## Development

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Database**: SQLite (better-sqlite3)
- **Deployment**: PM2 / systemd
- **Reverse Proxy**: Caddy

### Code Quality

```bash
npm run lint       # ESLint
npm run build      # TypeScript check + build
```

### Adding Features

1. Check [ROADMAP.md](./ROADMAP.md) and [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md)
2. Create feature branch
3. Implement and test
4. Update `IMPLEMENTATION-STATUS.md`
5. Submit PR

## Troubleshooting

### "Database not found" error

Run the usage collector to create initial data:

```bash
npx tsx scripts/collect-usage.ts
```

### "Gateway not reachable" errors

Ensure OpenClaw gateway is running:

```bash
openclaw status
# or
openclaw gateway start
```

### Build errors

```bash
rm -rf .next node_modules
npm install
npm run build
```

### Permission denied errors

Ensure files are executable:

```bash
chmod +x scripts/*.sh
```

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Keep personal data out of commits (use `.env.local`)
4. Write clear commit messages
5. Test thoroughly
6. Submit a PR

## Security

- **Never commit `.env.local`** - contains credentials
- **Never commit `data/*.json`** - contains operational data
- **Never commit `data/*.db`** - contains usage metrics
- Use strong passwords for `ADMIN_PASSWORD`
- Regenerate `AUTH_SECRET` for your instance

Generate secrets:

```bash
# Random password
openssl rand -base64 24

# Auth secret
openssl rand -base64 32
```

## License

MIT License - see [LICENSE](./LICENSE)

## Credits

Built for [OpenClaw](https://openclaw.ai) by the community.

Inspired by the need for a beautiful, functional control center for AI agents.

---

**Status**: Alpha (v0.1.0) - Actively developed

**Docs**: [docs/](./docs/)

**Roadmap**: [ROADMAP.md](./ROADMAP.md)

**Support**: [Discord](https://discord.com/invite/clawd) | [GitHub Issues](../../issues)
