# Screenplay Studio --- Setup and Deployment Guide

> **Screenplay Studio** is a professional, local-first screenplay editor and production suite built with React 19, TypeScript 6, Vite, Tailwind CSS v4, Tiptap/ProseMirror, and IndexedDB (Dexie.js).

---

## 1. Quick Start (Local Development)

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **Modern Browser**: Chrome, Edge, Firefox, or Safari (IndexedDB required)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd screenplay-studio

# Install dependencies
npm install

# Start local development server
npm run dev
```

The application will be live at `http://localhost:5173`.

---

## 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_APP_URL` | No | `http://localhost:5173` | Application base URL |
| `VITE_SUPABASE_URL` | Optional | `https://xyz.supabase.co` | Supabase Cloud Sync endpoint |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional | `sbp_...` | Supabase client publishable key |
| `VITE_GOOGLE_CLIENT_ID` | Optional | `123...apps.googleusercontent.com` | Google Drive OAuth Client ID |
| `VITE_GROQ_API_KEY` | Optional | `gsk_...` | Groq AI Script Doctor API key |

> **Local-First Guarantee**: Screenplay Studio is **100% functional without any cloud environment variables**. All writing, outline tools, revision snapshots, deterministic pagination, PDF exports, and analytics run completely offline in the browser.

---

## 3. Database & Persistence Model

### Local Storage (IndexedDB via Dexie.js)
All active writing happens locally in browser IndexedDB database `ScreenplayStudioDB`:
- **`projects`**: Screenplay projects with metadata, target length, and status.
- **`drafts`**: Draft iterations and active screenplay references.
- **`screenplays`**: Screenplay documents with typed semantic elements.
- **`characters`**: Character database with dialogue frequency and scene tracking.
- **`locations`**: Location database with `INT` / `EXT` / `INT/EXT` classifications.
- **`notes`**: Project and scene notes categorized by general, to-do, research, and idea.
- **`revisions`**: Historical snapshots with element diffing and 1-click restore.
- **`sceneCards`**: Ordered scene outline cards with beat summaries and act colors.
- **`writingSessions` & `dailyStats`**: Pure local analytics and streak tracking.

### Workspace Backups & Restores
- In **Settings > Workspace Data & JSON Backups**, users can click **Export Backup** to download a single JSON archive of all tables.
- Clicking **Import Data** restores the full database state with schema validation.

---

## 4. Optional Supabase Cloud Sync

To enable optional multi-device synchronization:

### 1. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Under **Project Settings > API**, copy the Project URL and anon publishable key.
3. Paste them into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

### 2. Apply Database Migrations
Run the SQL migration script located at `supabase/migrations/20261013000000_initial_schema.sql` in the Supabase SQL Editor.

This script sets up:
- `profiles`, `projects`, `drafts`, `screenplays`, `revisions`, `sync_metadata`, and `analytics_events`.
- Strict Row Level Security (RLS) policies ensuring users can only read, insert, update, and delete their own data.

### 3. Authentication Configuration
Under **Authentication > Providers**:
- Enable **Email** (Magic Link or Password).
- Enable **Google** (OAuth client with callback URL `https://your-project.supabase.co/auth/v1/callback`).

---

## 5. Optional Google Drive Backups

Screenplay Studio connects to Google Drive using the restricted `drive.file` scope. It can **only** access files created by Screenplay Studio and creates a dedicated `Screenplay Studio/` folder in the user's Drive.

1. Create a project in [Google Cloud Console](https://console.cloud.google.com).
2. Enable the **Google Drive API**.
3. Create an **OAuth 2.0 Client ID** (Web application) with Authorized JavaScript Origins matching your app domain (`http://localhost:5173` or your production domain).
4. Add `VITE_GOOGLE_CLIENT_ID` to `.env`.

---

## 6. Optional Groq AI Script Doctor

Screenplay Studio includes optional script assistance powered by Groq:
- **Dialogue Punch-Up**: 3 stylistic variations (Sharper, Richer Subtext, Raw/Gritty).
- **Scene Feedback**: Actionable pacing and dramatic tension advice.
- **Continuity Checker**: Cross-references character actions with the story bible.
- **Logline Generator**: High-concept loglines based on story bible elements.

To use:
1. Obtain an API key from [console.groq.com](https://console.groq.com).
2. Enter the key in **Settings > AI Script Doctor (Groq Gateway)** or set `VITE_GROQ_API_KEY` in `.env`.
3. Token usage and estimated costs are tracked with configurable daily caps.

---

## 7. Testing & Quality Assurance

### Run Unit Tests (Vitest)
```bash
# Run unit test suite (110 tests across 8 test suites)
npm run test:run

# Run with interactive watch mode
npm run test
```

### Run End-to-End Tests (Playwright)
```bash
# Run E2E tests in headless browser
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui
```

### Run Linter
```bash
# High-speed oxlint inspection
npm run lint
```

---

## 8. Production Build & Deployment

### Building for Production
```bash
npm run build
```
Build output is generated in `dist/`.

### Deployment Options

#### 1. Vercel (Recommended)
Deploy directly with Vercel CLI or Git integration:
```bash
npx vercel
```
Vercel automatically detects Vite. Set SPA routing to `index.html`.

#### 2. Docker
A lightweight Nginx container can serve the static build:

```dockerfile
# Build stage
FROM node:22-alpine AS builder
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

`nginx.conf` for SPA routing:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 9. License

Screenplay Studio is open-source software licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for details.
