# Open Source Release Checklist

Before pushing to GitHub or making the repository public, verify all items:

## ✅ Security & Privacy

- [x] `.gitignore` excludes sensitive files:
  - [x] `.env.local` (passwords, secrets)
  - [x] `data/*.json` (operational data)
  - [x] `data/*.db` (usage databases)
- [x] `.env.example` created with placeholder values
- [x] All `.example.json` files created in `data/`
- [x] No hardcoded credentials in source code
- [x] No hardcoded personal data (usernames, emails, tokens)
- [x] Branding config (`src/config/branding.ts`) uses env vars
- [x] All personal references use `BRANDING` constants
- [x] Pre-commit security check script created

## ✅ Documentation

- [x] `README.md` comprehensive and up-to-date
  - [x] Features list
  - [x] Installation instructions
  - [x] Configuration guide
  - [x] Deployment guide
  - [x] Troubleshooting section
- [x] `CONTRIBUTING.md` created with guidelines
- [x] `SECURITY.md` created with security policy
- [x] `LICENSE` file created (MIT)
- [x] `ROADMAP.md` exists and is current
- [x] `IMPLEMENTATION-STATUS.md` is up-to-date
- [x] API endpoints documented (in README or separate file)
- [x] Cost tracking system documented (`docs/COST-TRACKING.md`)

## ✅ Code Quality

- [x] Build passes: `npm run build`
- [x] No TypeScript errors: `tsc --noEmit`
- [x] ESLint configured and passing: `npm run lint`
- [x] No console.log statements in production code (use console.error/warn for errors)
- [x] All components have proper types
- [x] API routes handle errors gracefully

## ✅ Configuration

- [x] `.gitattributes` created (line endings, binary files)
- [x] `.env.example` complete with all variables
- [x] Default config values are reasonable
- [x] Branding is configurable via env vars
- [x] No hardcoded paths (use process.env or config)

## ✅ Assets

- [x] Placeholder/example images for sprites (if needed)
- [x] No copyrighted material without permission
- [x] Icons are properly licensed (Lucide is MIT)
- [x] Fonts are properly licensed

## ✅ Dependencies

- [x] All dependencies in `package.json`
- [x] No unnecessary dependencies
- [x] License compatibility checked
- [x] `npm audit` reviewed (no critical vulnerabilities)

## ✅ Repository Setup

- [ ] Create GitHub repository (private first)
- [ ] Add `.gitignore` and commit
- [ ] Push initial commit
- [ ] Add topics/tags (nextjs, react, ai, openclaw, dashboard)
- [ ] Add repository description
- [ ] Add repository URL to `package.json`
- [ ] Enable GitHub Discussions (optional)
- [ ] Create issue templates (bug, feature request)
- [ ] Add CODEOWNERS file (optional)

## ✅ Final Verification

Run these commands before going public:

```bash
# 1. Clean build
rm -rf .next node_modules
npm install
npm run build

# 2. Security check
./scripts/pre-commit-check.sh

# 3. Check for leaks
grep -r "TODO" . --exclude-dir=node_modules --exclude-dir=.next
grep -r "FIXME" . --exclude-dir=node_modules --exclude-dir=.next

# 4. Verify .gitignore is working
git status
# Should NOT show .env.local or data/*.json
```

## 🚀 Going Public

1. **Review everything one last time**
2. **Run pre-commit check**: `./scripts/pre-commit-check.sh`
3. **Make repository public** (GitHub Settings → Danger Zone → Change visibility)
4. **Create first release** (GitHub Releases → Draft a new release)
   - Tag: `v0.1.0`
   - Title: "Initial Public Release"
   - Description: Link to README and key features
5. **Share announcement** (Discord, Twitter, Reddit, etc.)

## 📋 Post-Release

- [ ] Monitor GitHub issues
- [ ] Respond to pull requests
- [ ] Update ROADMAP.md as features are completed
- [ ] Create releases for major versions
- [ ] Keep dependencies updated
- [ ] Maintain SECURITY.md with security advisories

---

**Status**: Ready for review ✅

**Last Updated**: 2026-02-20

**Verified By**: Tenacitas 🦞
