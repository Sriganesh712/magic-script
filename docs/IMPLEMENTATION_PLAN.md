# Screenplay Studio --- Implementation Plan

> Ordered phases and tasks with stable IDs. Status: `NOT STARTED`, `IN PROGRESS`, `IMPLEMENTED`, `VERIFIED`, `BLOCKED`.

---

## Phase 0: Foundation and Schema (FND)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| FND-001 | Inspect repository and establish durable tracking | NOT STARTED | Repo inspected, Git status recorded, all 5 docs files created/updated, package manager identified | None |
| FND-002 | Initialize React + TypeScript + Vite project | NOT STARTED | `npm create vite@latest` runs, TypeScript template selected, dev server starts | FND-001 |
| FND-003 | Add Tailwind CSS and shadcn/ui | NOT STARTED | Tailwind configured, shadcn/ui initialized, sample component renders | FND-002 |
| FND-004 | Configure ESLint, Prettier, TypeScript strict mode | NOT STARTED | `npm run lint`, `npm run format`, `npm run typecheck` all pass | FND-003 |
| FND-005 | Set up Vitest for unit tests | NOT STARTED | `npm run test` runs Vitest, sample test passes | FND-004 |
| FND-006 | Set up Playwright for E2E tests | NOT STARTED | `npm run test:e2e` runs Playwright, sample test passes | FND-004 |
| FND-007 | Initialize Git repository and .gitignore | NOT STARTED | `git init`, .gitignore excludes node_modules, dist, .env, local DBs | FND-001 |
| FND-008 | Define core TypeScript types for screenplay elements | NOT STARTED | Types for SceneHeading, Action, Character, Dialogue, Parenthetical, Transition, Shot, Section, PageBreak, DualDialogue; stable IDs; versioned schema | FND-002 |
| FND-009 | Set up IndexedDB with Dexie for local persistence | NOT STARTED | Dexie schema for projects, drafts, scenes, elements, revisions, settings, analytics events; migrations work | FND-002 |
| FND-010 | Create Supabase client config (optional, env-gated) | NOT STARTED | Client initializes only when env vars present; no errors without credentials | FND-002 |
| FND-011 | Create .env.example with all required variables | NOT STARTED | All variables from MASTER_BUILD_PROMPT §9 documented with placeholders | FND-001 |

---

## Phase 1: Editor and Local Persistence (EDT)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| EDT-001 | Initialize Tiptap/ProseMirror editor with screenplay schema | NOT STARTED | Editor loads, schema matches FND-008 types, basic editing works | FND-008 |
| EDT-002 | Implement screenplay-aware keyboard behavior (Enter/Tab) | NOT STARTED | Enter cycles element types correctly, Tab indents/outdents per spec, undo/redo works | EDT-001 |
| EDT-003 | Add scene navigation and outline panel | NOT STARTED | Scenes list updates in real-time, click navigates, drag-to-reorder works | EDT-001 |
| EDT-004 | Implement character autocomplete in dialogue/parenthetical | NOT STARTED | `@` or tab triggers autocomplete, shows project characters, inserts correctly | EDT-001 |
| EDT-005 | Add search and replace (find, find/replace, regex) | NOT STARTED | Modal/search panel works, highlights matches, replaces correctly | EDT-001 |
| EDT-006 | Implement autosave to IndexedDB with debouncing | NOT STARTED | Changes persist within 2s, recovery on reload works, no data loss on crash | EDT-001, FND-009 |
| EDT-007 | Add offline indicator and recovery UI | NOT STARTED | Shows online/offline state, "recover unsaved changes" banner on reload | EDT-006 |
| EDT-008 | Implement dual dialogue editing | NOT STARTED | Side-by-side columns, synchronized scrolling, correct export | EDT-001 |
| EDT-009 | Add revision snapshot system (manual + periodic) | NOT STARTED | Snapshots stored in IndexedDB, list view with timestamps, restore works | EDT-006, FND-009 |
| EDT-010 | Implement export/import of full project backup (JSON) | NOT STARTED | Export downloads .json, import restores fully, validates schema version | FND-009 |

---

## Phase 2: Writing Analytics and Progress (ANA)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| ANA-001 | Define analytics event schema (idempotent IDs, types) | NOT STARTED | Events: word_added, word_deleted, session_start, session_end, goal_met; each has unique ID, timestamp, projectId, draftId | FND-008 |
| ANA-002 | Implement word-count diffing (added/deleted/net) | NOT STARTED | Compares previous vs current content, computes accurate diffs, ignores formatting-only changes | EDT-006 |
| ANA-003 | Build daily/weekly/monthly goal tracking | NOT STARTED | Goals stored per project, progress updates in real-time, timezone-aware daily boundaries | ANA-001 |
| ANA-004 | Implement streak calculation (current/longest) | NOT STARTED | Streak increments on writing days, resets on missed days, persists across reloads | ANA-001, ANA-003 |
| ANA-005 | Build calendar heatmap component | NOT STARTED | Renders year view, color-coded by word count, tooltips show details, responsive | ANA-001 |
| ANA-006 | Implement writing session detection | NOT STARTED | Session starts on first edit after idle >5min, ends on idle >15min or explicit close, duration recorded | ANA-001, EDT-006 |
| ANA-007 | Create project dashboard with reports | NOT STARTED | Shows goals, streaks, heatmap, avg words/day, consistency %, milestones | ANA-003, ANA-004, ANA-005, ANA-006 |
| ANA-008 | Add analytics unit tests (framework-independent) | NOT STARTED | Pure functions for diffing, streak, goals tested with fixtures, 100% coverage | ANA-001 thru ANA-006 |

---

## Phase 3: Pagination and Exports (EXP)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| EXP-001 | Define screenplay page layout settings (margins, font, line height) | NOT STARTED | Configurable: page size, margins, Courier 12pt, line height, dialogue offset, character cue width | FND-008 |
| EXP-002 | Implement deterministic pagination engine | NOT STARTED | Given document + settings, produces identical page breaks every run; handles long action, dialogue at bottom, scene headings at bottom, dual dialogue, Unicode | EXP-001 |
| EXP-003 | Build PDF export using pagination engine | NOT STARTED | PDF matches pagination exactly, includes page numbers, title page option, scene numbers option | EXP-002 |
| EXP-004 | Implement Fountain export | NOT STARTED | Exports valid Fountain markup, round-trips through import, handles all element types | FND-008 |
| EXP-005 | Implement Fountain import | NOT STARTED | Parses Fountain to internal schema, preserves elements, reports parse warnings | FND-008 |
| EXP-006 | Implement FDX (Final Draft) import | NOT STARTED | Parses .fdx XML to internal schema, handles common Final Draft features, reports unsupported elements | FND-008 |
| EXP-007 | Implement FDX export | NOT STARTED | Exports valid .fdx XML, round-trips through Final Draft where possible | FND-008 |
| EXP-008 | Add export regression tests with golden fixtures | NOT STARTED | Test suite compares output against golden files for PDF, Fountain, FDX | EXP-003, EXP-004, EXP-006 |

---

## Phase 4: Revisions and Production Tools (REV)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| REV-001 | Implement scene cards / outline view | NOT STARTED | Cards show scene heading, summary, location, time, characters; drag-reorder updates script | EDT-003 |
| REV-002 | Add character database (name, description, arcs, dialogue count) | NOT STARTED | CRUD for characters, auto-extract from script, dialogue stats per character | EDT-001 |
| REV-003 | Add location database (name, type, description, scenes used) | NOT STARTED | CRUD for locations, auto-extract from scene headings, scene cross-reference | EDT-001 |
| REV-004 | Add props/notes system per scene and global | NOT STARTED | Notes attach to scenes or project, rich text, searchable | EDT-001 |
| REV-005 | Implement revision history UI (timeline, diff view) | NOT STARTED | Timeline shows snapshots, click shows side-by-side diff, restore button | EDT-009 |
| REV-006 | Add project-level status tracking (draft, polishing, production) | NOT STARTED | Status field on project, filter dashboard by status | FND-008 |
| REV-007 | Implement backup scheduling and restore verification | NOT STARTED | Auto-backup to IndexedDB daily, manual backup to file, restore test button | EDT-010 |

---

## Phase 5: Supabase Auth and Sync (SYNC)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| SYNC-001 | Implement Supabase Auth (Google OAuth + email magic link) | NOT STARTED | Sign up/in works, session persists, sign out works, no account required for local use | FND-010 |
| SYNC-002 | Create Supabase migrations for user tables | NOT STARTED | Tables: profiles, projects, drafts, scenes, elements, settings, sync_metadata, analytics_events; all with RLS | SYNC-001 |
| SYNC-003 | Implement Row Level Security policies | NOT STARTED | Users only see own data, project collaborators see shared projects, service role bypasses | SYNC-002 |
| SYNC-004 | Build local-to-remote sync engine (operation queue) | NOT STARTED | Queue persists in IndexedDB, processes on reconnect, idempotent retries, version vectors, server acks | SYNC-002, EDT-006 |
| SYNC-005 | Implement conflict detection and preservation | NOT STARTED | On conflict, both versions stored, UI shows conflict resolver, no silent last-write-wins | SYNC-004 |
| SYNC-006 | Add project-level sync opt-in UI | NOT STARTED | Per-project toggle, explains what syncs, shows sync status, manual sync button | SYNC-004 |
| SYNC-007 | Handle account deletion and data export | NOT STARTED | "Delete account" removes auth + data, "Export all data" downloads JSON + files | SYNC-001 |

---

## Phase 6: Google Drive Integration (DRV)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| DRV-001 | Implement separate Google Drive OAuth flow (drive.file scope) | NOT STARTED | Separate from Google sign-in, consent screen shows only file access, tokens stored server-side | SYNC-001 |
| DRV-002 | Create Drive API wrapper (upload, list, delete, get metadata) | NOT STARTED | Uploads PDF/Fountain/FDX/backups, creates app folder, respects quota | DRV-001 |
| DRV-003 | Build Drive export UI (choose format, destination, schedule) | NOT STARTED | Modal picks format, folder, filename template, one-time or auto on save | DRV-002, EXP-003, EXP-004, EXP-006 |
| DRV-004 | Store Drive file IDs and metadata in app DB | NOT STARTED | Links project/draft to Drive file IDs, tracks versions, shows in UI | DRV-002, SYNC-002 |
| DRV-005 | Handle revoked auth, quota errors, retries | NOT STARTED | UI shows auth revoked, retry with backoff, user can re-authorize | DRV-002 |

---

## Phase 7: Groq AI Gateway (AI)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| AI-001 | Create server-side Groq gateway (Vercel API route) | NOT STARTED | Single endpoint, validates auth, rate limits, logs usage (not content) | FND-010 |
| AI-002 | Implement task-based caching (hash of task+content+context+model+prompt) | NOT STARTED | Identical requests return cached result, cache invalidates on context change | AI-001 |
| AI-003 | Add in-flight request deduplication | NOT STARTED | Simultaneous identical requests share single API call | AI-001 |
| AI-004 | Build story bible / context summarizer | NOT STARTED | Extracts characters, locations, plot points from script, compact representation | EDT-001 |
| AI-005 | Implement AI features: scene feedback, dialogue polish, continuity check | NOT STARTED | Each feature: explicit button, shows preview, requires approval, writes to editor on accept | AI-001, AI-004 |
| AI-006 | Add usage budgets and estimates (per-user, per-project) | NOT STARTED | Configurable limits, shows estimated cost before request, blocks over-budget | AI-001 |
| AI-007 | Ensure core app works without Groq key | NOT STARTED | All features hidden/disabled gracefully, no errors in console | AI-001 |

---

## Phase 8: Hardening and Deployment (HRD)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| HRD-001 | Accessibility audit (WCAG 2.1 AA) | NOT STARTED | Keyboard nav, focus visible, labels, contrast, reduced motion, screen reader test | All prior |
| HRD-002 | Performance optimization (bundle size, lazy loading, caching) | NOT STARTED | Lighthouse >90, code-split routes, service worker for offline | All prior |
| HRD-003 | Security review (secrets, RLS, API validation, CSP) | NOT STARTED | No secrets in client, Zod validation on all APIs, CSP headers, dependency audit | SYNC-003, AI-001 |
| HRD-004 | Write SETUP_AND_DEPLOYMENT.md with full instructions | NOT STARTED | Local dev, Supabase setup, Google OAuth/Drive, Vercel deploy, Docker, migrations, backup/restore | All prior |
| HRD-005 | Add AGPL-3.0 license and third-party attributions | NOT STARTED | LICENSE file, NOTICE file with all deps/fonts/icons licenses verified compatible | FND-001 |
| HRD-006 | Run full E2E test suite (10 core workflows from MASTER_BUILD_PROMPT §8) | NOT STARTED | All 10 workflows pass in CI/local | All prior |
| HRD-007 | Production build and deployment verification | NOT STARTED | `npm run build` succeeds, Vercel deploy preview works, env vars validated | HRD-004 |

---

## Task Selection Priority

Per MASTER_BUILD_PROMPT §7:
1. Broken build, data-loss risks, security problems
2. Missing foundations and schema (FND phase)
3. Core editor and reliable local persistence (EDT phase)
4. Writing analytics and progress features (ANA phase)
5. Pagination and export fidelity (EXP phase)
6. Backup, restore, and revision workflows (REV phase)
7. Auth, RLS, and optional cloud sync (SYNC phase)
8. Google Drive integration (DRV phase)
9. Groq integration and usage optimization (AI phase)
10. Accessibility, performance, documentation, deployment, polish (HRD phase)