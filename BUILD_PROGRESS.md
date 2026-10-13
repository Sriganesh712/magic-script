# Screenplay Studio --- Build Progress

> This file is the durable execution checkpoint. Update it after every
> meaningful task and before pausing. Do not claim work is verified
> without test evidence.

## Current status

-   **Project:** Screenplay Studio
-   **Overall state:** FOUNDATION ESTABLISHED
-   **Current phase:** Foundation and schema (FND)
-   **Current task ID:** FND-005 (Vitest unit test setup)
-   **Estimated completion:** ~8% (rough estimate; not a measure of tested product completeness)
-   **Last checkpoint (UTC):** 2026-10-13T15:30:00Z
-   **Current branch:** main
-   **Latest commit:** Pending (staged changes ready)

## Product decisions

-   Frontend: React + TypeScript + Vite (verified: Vite 8.3.4, React 19.2.8, TypeScript 6.0.2)
-   UI: Tailwind CSS + shadcn/ui (verified: Tailwind v4, shadcn Nova preset, Radix UI, 24 components)
-   Editor: structured screenplay editor using Tiptap/ProseMirror
-   Storage: hybrid local-first, IndexedDB for local writing (Dexie.js)
-   Accounts: optional Supabase Auth, Google OAuth plus email magic link
-   Database: Supabase PostgreSQL with migrations and Row Level Security
-   Sync: optional, project-level opt-in; preserve conflicts rather than silently discarding screenplay content
-   Files: Google Drive for user-owned exports, backups, and attachments; Drive authorization is separate from Google sign-in
-   Hosting: Vercel frontend and small API routes by default; Render only if a demonstrated worker/runtime need emerges
-   AI: optional Groq server-side gateway; default starting model `openai/gpt-oss-20b`, configurable and verified against current provider availability
-   AI efficiency: explicit actions only, content-hash cache, in-flight deduplication, bounded context/output, limited retries, and enforceable budgets
-   License: AGPL-3.0 with dependency, font, asset, and notice review

## Last verified state

-   Repository inspected: empty directory with MASTER_BUILD_PROMPT.md and BUILD_PROGRESS.md
-   Git repository initialized (`git init`)
-   All 5 required docs files created:
    - `docs/IMPLEMENTATION_PLAN.md` — Full phase/task breakdown with 8 phases, 50+ tasks
    - `docs/DECISIONS.md` — 8 initial architecture decisions recorded
    - `docs/KNOWN_ISSUES.md` — Template + no issues yet
    - `docs/SESSION_LOG.md` — Session 1 logged
    - `docs/SETUP_AND_DEPLOYMENT.md` — Complete setup guide
-   React + TypeScript + Vite project scaffolded at repository root
-   Dependencies installed (`npm install` — 28 packages, 0 vulnerabilities)
-   Dev server verified: `npm run dev` starts Vite 8.3.4 on http://localhost:5173 in ~1.6s
-   `.env.example` created with all required variables documented
-   `.gitignore` created for Node.js/Vite project
-   **Tailwind CSS v4 configured** with Vite plugin, custom theme, dark mode support
-   **shadcn/ui initialized** with Nova preset, Radix UI, CSS variables, 24 components added
-   **TypeScript strict mode** configured with path aliases, ignoreDeprecations for TS 6.0
-   **oxlint** configured and passing (3 warnings from shadcn components only)
-   **Production build** verified: `npm run build` succeeds in 714ms
-   **Type checking** verified: `npx tsc --noEmit` passes with 0 errors

## Current task

### FND-005 --- Set up Vitest for unit tests

**Acceptance criteria** - Vitest installed and configured - Sample test passes - `npm run test` command works - Coverage reporting configured

**Status:** NOT STARTED

### FND-006 --- Set up Playwright for E2E tests

**Acceptance criteria** - Playwright installed and configured - Sample E2E test passes - `npm run test:e2e` command works - CI-ready configuration

**Status:** NOT STARTED

## Phase overview

  -----------------------------------------------------------------------
  Phase                   Status                  Notes
  ----------------------- ----------------------- -----------------------
  Foundation and schema   IN PROGRESS             Repository setup, type
                                                      checking, tests, schema
                                                      and migrations

  Editor and local        NOT STARTED             Structured elements,
  persistence                                     offline saving,
                                                      recovery

  Writing analytics       NOT STARTED             Goals, streaks,
                                                      heatmap, reports,
                                                      sessions

  Pagination and exports  NOT STARTED             PDF, Fountain, FDX
                                                      compatibility

  Revisions and           NOT STARTED             History, characters,
  production tools                                locations, props,
                                                      backups

  Supabase auth and sync  NOT STARTED             Google/email auth, RLS,
                                                      conflict-safe
                                                      synchronization

  Google Drive            NOT STARTED             Separate OAuth,
                                                      uploads, file metadata

  Groq AI gateway         NOT STARTED             Cache, request budgets,
                                                      privacy, structured
                                                      output

  Hardening and           NOT STARTED             Accessibility,
  deployment                                      security, performance,
                                                      docs, production build
  -----------------------------------------------------------------------

## Test and command log

- `git init` — Exit 0 — Repository initialized
- `mkdir docs` — Exit 0 — Docs directory created
- `npx create-vite@latest screenplay-studio --template react-ts` — Exit 0 — Project scaffolded (moved to root)
- `npm install` — Exit 0 — 28 packages installed, 0 vulnerabilities
- `npm run dev` — Exit 0 (running) — Vite 8.3.4 ready in 1633ms, serving on localhost:5173
- `npm install -D tailwindcss @tailwindcss/vite` — Exit 0 — Tailwind v4 installed
- `npx shadcn@latest init --template vite --base radix --css-variables --preset nova --yes --force` — Exit 0 — shadcn/ui initialized
- `npx shadcn@latest add button input label dialog dropdown-menu scroll-area separator sheet textarea select tabs avatar badge card sonner command popover tooltip checkbox radio-group switch progress skeleton --yes` — Exit 0 — 24 components added
- `npm run build` — Exit 0 — Production build successful (714ms)
- `npm run lint` — Exit 0 — oxlint passes (3 warnings from shadcn components)
- `npx tsc --noEmit` — Exit 0 — TypeScript strict check passes

## Blockers / human actions

None known yet. Do not request secrets in chat. Provider console setup and production credentials may require user action later.

## Immediate next steps

1.  Set up Vitest for unit tests (FND-005)
2.  Set up Playwright for E2E tests (FND-006)
3.  Define core TypeScript types for screenplay elements (FND-008)
4.  Set up IndexedDB with Dexie for local persistence (FND-009)
5.  Create Supabase client config (FND-010)
6.  Commit all changes to Git

## Resume instruction

A new agent session must first inspect repository state, then read this file and the required `docs/` files. Verify documented claims against actual code and test results. Continue from the highest-priority unblocked task (currently FND-005: Vitest setup). Do not rely on previous chat history.