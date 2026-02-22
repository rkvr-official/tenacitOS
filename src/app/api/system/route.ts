import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

import { OPENCLAW_WORKSPACE, WORKSPACE_IDENTITY } from '@/lib/paths';

const WORKSPACE_PATH = OPENCLAW_WORKSPACE;
const IDENTITY_PATH = WORKSPACE_IDENTITY;
const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');

function parseIdentityMd(): { name: string; creature: string; emoji: string } {
  try {
    const content = fs.readFileSync(IDENTITY_PATH, 'utf-8');
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    const creatureMatch = content.match(/\*\*Creature:\*\*\s*(.+)/);
    const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);
    
    return {
      name: nameMatch?.[1]?.trim() || 'Unknown',
      creature: creatureMatch?.[1]?.trim() || 'AI Agent',
      emoji: emojiMatch?.[1]?.match(/./u)?.[0] || '🤖',
    };
  } catch {
    return { name: 'OpenClaw Agent', creature: 'AI Agent', emoji: '🤖' };
  }
}

function getIntegrationStatus(openclawStatus: any = null) {
  const integrations = [];
  let openclawConfig: any = {};

  try {
    const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    openclawConfig = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf-8'));
  } catch {}

  const recent = Array.isArray(openclawStatus?.sessions?.recent) ? openclawStatus.sessions.recent : [];
  const lastByNeedle = (needle: string): string | null => {
    const row = recent.find((s: any) => String(s?.key || '').includes(needle));
    if (!row?.updatedAt) return null;
    return new Date(row.updatedAt).toISOString();
  };

  // Telegram
  const telegramConfig = openclawConfig?.channels?.telegram;
  const telegramEnabled = !!telegramConfig?.enabled;
  const telegramAccounts = telegramConfig?.accounts ? Object.keys(telegramConfig.accounts).length : 0;
  integrations.push({
    id: 'telegram',
    name: 'Telegram',
    status: telegramEnabled ? 'connected' : 'disconnected',
    icon: 'MessageCircle',
    lastActivity: lastByNeedle(':telegram:') || null,
    detail: telegramEnabled ? `${telegramAccounts} bots configured` : null,
  });

  // Slack
  const slackConfig = openclawConfig?.channels?.slack;
  const slackEnabled = !!slackConfig?.enabled;
  const slackAccounts = slackConfig?.accounts ? Object.keys(slackConfig.accounts).length : 0;
  integrations.push({
    id: 'slack',
    name: 'Slack',
    status: slackEnabled ? 'connected' : 'disconnected',
    icon: 'Slack',
    lastActivity: lastByNeedle(':slack:') || null,
    detail: slackEnabled ? `${slackAccounts} account(s)` : null,
  });

  // GitHub (gh auth)
  let githubConnected = false;
  try {
    execSync('gh auth status >/dev/null 2>&1', { timeout: 4000 });
    githubConnected = true;
  } catch {}
  integrations.push({
    id: 'github',
    name: 'GitHub',
    status: githubConnected ? 'connected' : 'disconnected',
    icon: 'Github',
    lastActivity: null,
    detail: githubConnected ? 'gh CLI authenticated' : 'gh auth required',
  });

  // Brave search
  const braveConfigured = !!openclawConfig?.tools?.web?.search?.enabled && !!openclawConfig?.tools?.web?.search?.apiKey;
  integrations.push({
    id: 'brave',
    name: 'Brave Search',
    status: braveConfigured ? 'configured' : 'not_configured',
    icon: 'Search',
    lastActivity: null,
    detail: braveConfigured ? 'API key configured' : null,
  });

  // Google/Gemini
  const googleConfigured = !!openclawConfig?.auth?.profiles?.['google:default'] || !!openclawConfig?.skills?.entries?.['nano-banana-pro']?.apiKey;
  integrations.push({
    id: 'google',
    name: 'Google / Gemini',
    status: googleConfigured ? 'configured' : 'not_configured',
    icon: 'Mail',
    lastActivity: null,
    detail: googleConfigured ? 'Google profile/API key configured' : 'No Google profile detected',
  });

  return integrations;
}

function getOpenclawRuntime(): { model: string; agentName?: string; workspacePath?: string; status?: any } {
  try {
    const raw = execSync('openclaw status --json 2>/dev/null', { encoding: 'utf-8', timeout: 8000 });
    const status = JSON.parse(raw);

    const model =
      status?.sessions?.recent?.[0]?.model ||
      status?.sessions?.defaults?.model ||
      status?.models?.active?.[0]?.id ||
      status?.agents?.defaults?.model?.primary ||
      status?.config?.agents?.defaults?.model?.primary ||
      null;

    let agentName: string | undefined;
    let workspacePath: string | undefined;

    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.openclaw', 'openclaw.json'), 'utf-8'));
      const first = cfg?.agents?.list?.[0];
      agentName = first?.name || cfg?.agents?.defaults?.name;
      workspacePath = first?.workspace || cfg?.agents?.defaults?.workspace;
    } catch {}

    return {
      model: model || process.env.OPENCLAW_MODEL || process.env.DEFAULT_MODEL || 'unknown',
      agentName,
      workspacePath,
      status,
    };
  } catch {
    return {
      model: process.env.OPENCLAW_MODEL || process.env.DEFAULT_MODEL || 'unknown',
    };
  }
}

export async function GET() {
  const identity = parseIdentityMd();
  const uptime = os.uptime();
  const nodeVersion = process.version;
  const runtime = getOpenclawRuntime();

  const systemInfo = {
    agent: {
      name: runtime.agentName || identity.name,
      creature: identity.creature,
      emoji: identity.emoji,
    },
    system: {
      uptime: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      nodeVersion,
      model: runtime.model,
      workspacePath: runtime.workspacePath || WORKSPACE_PATH,
      platform: os.platform(),
      hostname: os.hostname(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
    },
    integrations: getIntegrationStatus(runtime.status),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(systemInfo);
}

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();
    
    if (action === 'change_password') {
      const { currentPassword, newPassword } = data;
      
      // Read current .env.local
      let envContent = '';
      try {
        envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
      } catch {
        return NextResponse.json({ error: 'Could not read configuration' }, { status: 500 });
      }
      
      // Verify current password (ADMIN_PASSWORD is canonical; AUTH_PASSWORD legacy)
      const currentPassMatch = envContent.match(/ADMIN_PASSWORD=(.+)/) || envContent.match(/AUTH_PASSWORD=(.+)/);
      const storedPassword = currentPassMatch?.[1]?.trim();
      
      if (storedPassword !== currentPassword) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }
      
      // Update password (prefer ADMIN_PASSWORD; write if missing)
      let newEnvContent = envContent;
      if (/ADMIN_PASSWORD=.*/.test(newEnvContent)) {
        newEnvContent = newEnvContent.replace(/ADMIN_PASSWORD=.*/, `ADMIN_PASSWORD=${newPassword}`);
      } else if (/AUTH_PASSWORD=.*/.test(newEnvContent)) {
        newEnvContent = newEnvContent.replace(/AUTH_PASSWORD=.*/, `AUTH_PASSWORD=${newPassword}`);
      } else {
        newEnvContent = `${newEnvContent.trim()}\nADMIN_PASSWORD=${newPassword}\n`;
      }

      fs.writeFileSync(ENV_LOCAL_PATH, newEnvContent);
      
      return NextResponse.json({ success: true, message: 'Password updated successfully (restart tenacitos to apply)' });
    }
    
    if (action === 'clear_activity_log') {
      const activitiesPath = path.join(process.cwd(), 'data', 'activities.json');
      fs.writeFileSync(activitiesPath, '[]');
      return NextResponse.json({ success: true, message: 'Activity log cleared' });
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${Math.floor(seconds)}s`);
  
  return parts.join(' ');
}
