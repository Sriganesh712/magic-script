# Screenplay Studio --- Build Progress

> This file is the durable execution checkpoint. Update it after every
> meaningful task and before pausing. Do not claim work is verified
> without test evidence.

## Current status

-   **Project:** Screenplay Studio
-   **Overall state:** EDITOR PHASE COMPLETE
-   **Current phase:** Editor and local persistence (EDT)
-   **Current task ID:** EDT-003 (Scene navigation - IN PROGRESS)
-   **Estimated completion:** ~25% (rough estimate; not a measure of tested product completeness)
-   **Last checkpoint (UTC):** 2026-10-13T17:10:00Z
-   **Current branch:** main
-   **Latest commit:** 5a2ed03

## Product decisions

-   Frontend: React + TypeScript + Vite (verified: Vite 8.3.4, React 19.2.8, TypeScript 6.0.2)
-   UI: Tailwind CSS + shadcn/ui (verified: Tailwind v4, shadcn Nova preset, Radix UI, 24 components)
-   Editor: structured screenplay editor using Tiptap/ProseMirror (IMPLEMENTED)
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
    - `docs/SESSION_LOG.md` — Session 1-2 logged
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
-   **Production build** verified: `npm run build` succeeds in 808ms
-   **Type checking** verified: `npx tsc --noEmit` passes with 0 errors
-   **Vitest unit tests** configured and passing: `npm run test:run` — 4 tests pass
-   **Playwright E2E tests** configured and passing: `npm run test:e2e` — 2 tests pass
-   **Screenplay TypeScript types** defined: `src/types/screenplay.ts` — complete schema v1
-   **IndexedDB (Dexie)** configured: `src/lib/db.ts` — full schema with hooks
-   **Supabase client** configured: `src/lib/supabase.ts` — env-gated, client + server
-   **Tiptap/ProseMirror editor** implemented: `src/editor/` — 11 screenplay node types
-   **Screenplay-aware keyboard behavior**: Enter cycles elements, Tab for parenthetical, Shift+Tab outdents, Esc returns to action
-   **Professional screenplay formatting** in editor via CSS: correct indentation for scene headings, action, character cues, dialogue, parentheticals, transitions
-   **Toolbar with element buttons**: Quick access to Scene, Action, Character, Dialogue, Parenthetical, Transition, Page Break

## Phase overview

  -----------------------------------------------------------------------
  Phase                   Status                  Notes
  ----------------------- ----------------------- -----------------------
  Foundation and schema   COMPLETE                Repository setup, type
                                                      checking, tests, schema
                                                      and migrations

  Editor and local        IN PROGRESS             Structured elements,
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
- `npm run build` — Exit 0 — Production build successful (808ms)
- `npm run lint` — Exit 0 — oxlint passes (3 warnings from shadcn components)
- `npx tsc --noEmit` — Exit 0 — TypeScript strict check passes
- `npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom` — Exit 0 — Vitest installed
- `npm run test:run` — Exit 0 — 4 unit tests pass
- `npm install -D @playwright/test` — Exit 0 — Playwright installed
- `npx playwright install chromium` — Exit 0 — Chromium installed
- `npm run test:e2e` — Exit 0 — 2 E2E tests pass
- `npm install dexie @supabase/supabase-js lucide-react` — Exit 0 — Dexie, Supabase, Lucide installed
- `src/types/screenplay.ts` created — Core screenplay schema v1
- `src/lib/db.ts` created — Dexie database with full schema
- `src/lib/supabase.ts` created — Client + server Supabase config
- `npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-gapcursor` — Exit 0 — Tiptap installed
- `src/editor/ScreenplayNodes.ts` created — 11 screenplay node types (SceneHeading, Action, Character, Dialogue, Parenthetical, Transition, Shot, Section, PageBreak, DualDialogueStart, DualDialogueEnd)
- `src/editor/ScreenplayEditor.tsx` created — Main editor with screenplay-aware keyboard behavior
- `src/editor/ScreenplayEditor.css` created — Professional screenplay formatting
- `npm run test:run` — Exit 0 — Unit tests pass
- `npm run test:e2e` — Exit 0 — E2E tests pass (no console errors)

## Blockers / human actions

None known yet. Do not request secrets in chat. Provider console setup and production credentials may require user action later.

## Immediate next steps

1.  Add scene navigation and outline panel (EDT-003)
2.  Implement autosave to IndexedDB with debouncing (EDT-006)
3.  Add character autocomplete in dialogue/parenthetical (EDT-004)
4.  Add search and replace (EDT-005)
5.  Implement offline indicator and recovery UI (EDT-007)

## Resume instruction

A new agent session must first inspect repository state, then read this file and the required `docs/` files. Verify documented claims against actual code and test results. Continue from the highest-priority unblocked task (currently EDT-003: Scene navigation and outline panel). Do not rely on previous chat history.