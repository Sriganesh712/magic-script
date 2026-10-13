# Screenplay Studio --- Setup and Deployment Guide

> Prerequisites, local setup, environment variables, Supabase project setup, Google OAuth and Drive setup, Vercel deployment, migrations, backups, restore, and troubleshooting.

---

## Prerequisites

### Required Software
- **Node.js** >= 20.x (LTS recommended)
- **npm** >= 10.x (comes with Node.js)
- **Git** >= 2.40
- **VS Code** (recommended) with extensions: ESLint, Prettier, Tailwind CSS IntelliSense

### Required Accounts (for full functionality)
- **Supabase** account (free tier sufficient for development)
- **Google Cloud Console** project (for OAuth and Drive API)
- **Vercel** account (for deployment)
- **Groq** account (optional, for AI features)

---

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd screenplay-studio
npm install
```

### 2. Environment Configuration

Copy the example environment file and fill in values:

```bash
cp .env.example .env.local
```

**Required for local development (minimum):**
```env
# App
VITE_APP_NAME="Screenplay Studio"
VITE_APP_URL="http://localhost:5173"

# Supabase (optional for local-only mode)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"

# Groq (optional, for AI features)
GROQ_API_KEY="your-groq-key"
GROQ_MODEL="openai/gpt-oss-20b"

# Google OAuth (optional, for auth)
VITE_GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-secret"

# Google Drive (optional, for Drive integration)
GOOGLE_DRIVE_CLIENT_ID="your-drive-client-id"
GOOGLE_DRIVE_CLIENT_SECRET="your-drive-secret"
```

### 3. Start Development Server

```bash
npm run dev
```

Open http://localhost:5173

### 4. Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

## Supabase Project Setup

### 1. Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization, name project "screenplay-studio", set database password
4. Wait for provisioning (~2 minutes)

### 2. Configure Authentication

1. Go to **Authentication > Providers**
2. Enable **Google** provider:
   - Add Authorized Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Enter Google Client ID and Secret (from Google Cloud Console)
3. Enable **Email** provider:
   - Choose "Magic Link" or "OTP" (magic link recommended)
   - Configure email templates in **Authentication > Email Templates**
4. Set **Site URL** to your local dev URL (`http://localhost:5173`) and production URL

### 3. Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### 4. Configure Row Level Security

Migrations include RLS policies. Verify in **Authentication > Policies** that all user-owned tables have RLS enabled.

### 5. Get API Keys

1. Go to **Project Settings > API**
2. Copy **Project URL** → `VITE_SUPABASE_URL`
3. Copy **Publishable Key** (anon) → `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Copy **Service Role Key** (secret) → `SUPABASE_SERVICE_ROLE_KEY` (server-only!)

---

## Google OAuth and Drive Setup

### 1. Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create new project or select existing: "screenplay-studio"
3. Enable APIs: **Google Drive API**, **Google OAuth2 API**

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth Consent Screen**
2. Choose **External** user type
3. Fill required fields:
   - App name: "Screenplay Studio"
   - User support email: your email
   - Developer contact: your email
4. **Scopes**: Add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `.../auth/drive.file`
5. **Test Users**: Add your email for development
6. Save and publish (or keep in testing mode)

### 3. Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. **Create Credentials > OAuth Client ID**
3. **Application Type**: Web Application
4. **Name**: "Screenplay Studio Web"
5. **Authorized Redirect URIs**:
   - `http://localhost:5173/auth/callback` (local)
   - `https://your-app.vercel.app/auth/callback` (production)
   - `https://your-project.supabase.co/auth/v1/callback` (Supabase Auth)
6. Save → Copy **Client ID** and **Client Secret**

### 4. Separate Drive Authorization

Drive uses a **separate** OAuth flow from Google Sign-In:

1. Create a **second** OAuth Client ID (or reuse with additional scope)
2. Scope: `https://www.googleapis.com/auth/drive.file` only
3. Redirect URI: `http://localhost:5173/drive/callback` (local)
4. Store Drive Client ID/Secret in server env vars only

---

## Vercel Deployment

### 1. Connect Repository

1. Go to https://vercel.com/dashboard
2. **Add New > Project** > Import Git Repository
3. Select your repository
4. Framework Preset: **Vite**
5. Build Command: `npm run build`
6. Output Directory: `dist`

### 2. Configure Environment Variables

In Vercel Project Settings > Environment Variables, add all from `.env.example`:

**Client-visible (prefixed with `VITE_`):**
- `VITE_APP_NAME`
- `VITE_APP_URL` (production URL)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_GOOGLE_CLIENT_ID`

**Server-only (never prefixed with `VITE_`):**
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- Any session/encryption secrets

### 3. Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from local (preview)
vercel

# Deploy to production
vercel --prod
```

Or push to main branch for automatic deployment.

---

## Docker / Self-Hosting

### Dockerfile (Multi-stage)

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API routes proxy to backend (if separate)
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker Compose (with Supabase local)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:80"
    environment:
      - VITE_SUPABASE_URL=http://supabase:8000
      - VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key

  supabase:
    image: supabase/supabase:latest
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_PASSWORD=postgres
      - JWT_SECRET=your-jwt-secret
```

---

## Database Migrations

### Creating Migrations

```bash
# Create new migration
supabase migration new migration_name

# Edit the generated file in supabase/migrations/
# Then test locally
supabase db reset
```

### Migration Guidelines

- Always include `DOWN` migration (or document irreversible changes)
- Use `IF NOT EXISTS` for idempotency where possible
- Test migration on copy of production data before applying
- Never drop columns/tables without backup strategy

### Applying Migrations

```bash
# Local
supabase db push

# Production (via Supabase Dashboard or CLI)
supabase db push --linked
```

---

## Backup and Restore

### Local Backup (IndexedDB)

**Export:**
1. Open app → Settings → Backup
2. Click "Export All Data" → downloads `screenplay-studio-backup-YYYY-MM-DD.json`

**Import:**
1. Settings → Backup → "Import Backup"
2. Select JSON file → confirms restore

### Cloud Backup (Supabase)

```bash
# Full database dump
supabase db dump --schema public > backup-$(date +%F).sql

# Restore
psql -h your-db-host -U postgres -d postgres < backup-2026-10-13.sql
```

### Google Drive Backup

1. Settings → Google Drive → "Connect"
2. Authorize with `drive.file` scope
3. Enable "Auto-backup on save" or manual "Backup Now"
4. Files stored in "Screenplay Studio" app folder

### Restore Verification

**Always test restore after backup:**
1. Create test project with known content
2. Backup
3. Clear local storage / use incognito
4. Restore
5. Verify all projects, drafts, scenes, analytics intact

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `npm run dev` fails | Node version mismatch | Use Node 20+ (`nvm use 20`) |
| Supabase connection error | Wrong URL/key in `.env.local` | Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Google OAuth "redirect_uri_mismatch" | Redirect URI not in Google Console | Add exact URI to OAuth client |
| Drive upload fails | Scope not granted | Re-authorize with `drive.file` scope |
| PDF export blank | Pagination engine error | Check browser console, verify font loading |
| TypeScript errors | Missing types | Run `npm run typecheck` for details |
| E2E tests timeout | Dev server not running | Start `npm run dev` in separate terminal |

### Debugging Tips

- **Local storage**: Open DevTools → Application → IndexedDB → `screenplay-studio`
- **Network requests**: Filter by "supabase.co" or "groq.com" in Network tab
- **Auth state**: Check `localStorage.getItem('sb-...-auth-token')`
- **Service worker**: Application → Service Workers → "Unregister" to force update

### Logs

- **Vercel**: Dashboard > Functions > View Logs
- **Supabase**: Dashboard > Logs > Database / Auth / Edge Functions
- **Local**: Browser console + terminal running `npm run dev`

---

## Security Checklist

- [ ] `.env.local` not committed (in `.gitignore`)
- [ ] Service role key only in server env vars
- [ ] RLS enabled on all user tables
- [ ] CSP headers configured in `vercel.json` or nginx
- [ ] Dependencies audited (`npm audit`)
- [ ] No console.log of sensitive data
- [ ] OAuth state parameter used for CSRF protection

---

## Useful Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm run test             # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run test:ui          # Vitest UI

# Code Quality
npm run lint             # ESLint
npm run format           # Prettier
npm run typecheck        # TypeScript strict check

# Database
supabase db push         # Apply migrations
supabase db reset        # Reset local DB with migrations
supabase migration new   # Create migration
supabase db dump         # Backup database

# Deployment
vercel                   # Preview deploy
vercel --prod            # Production deploy
vercel env ls            # List env vars
vercel logs              # View function logs
```

---

## Support

- **Documentation**: This file + inline code comments
- **Issues**: GitHub Issues for bugs/features
- **Discussions**: GitHub Discussions for questions
- **Security**: Email security@screenplay-studio.dev (when configured)