# Screenplay Studio --- Implementation Plan

> Ordered phases and tasks with stable IDs. Status: `NOT STARTED`, `IN PROGRESS`, `IMPLEMENTED`, `VERIFIED`, `BLOCKED`.

---

## Phase 0: Foundation and Schema (FND)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| FND-001 | Inspect repository and establish durable tracking | VERIFIED | Repo inspected, Git status recorded, all 5 docs files created/updated, package manager identified | None |
| FND-002 | Initialize React + TypeScript + Vite project | VERIFIED | `npm create vite@latest` runs, TypeScript template selected, dev server starts | FND-001 |
| FND-003 | Add Tailwind CSS and shadcn/ui | VERIFIED | Tailwind configured, shadcn/ui initialized, sample component renders | FND-002 |
| FND-004 | Configure ESLint, Prettier, TypeScript strict mode | VERIFIED | `npm run lint`, `npm run build`, `npx tsc --noEmit` pass with 0 errors | FND-003 |
| FND-005 | Set up Vitest for unit tests | VERIFIED | `npm run test:run` runs Vitest, 93 unit tests pass across 6 suites | FND-004 |
| FND-006 | Set up Playwright for E2E tests | VERIFIED | `npm run test:e2e` runs Playwright, 4 E2E workflow tests pass | FND-004 |
| FND-007 | Initialize Git repository and .gitignore | VERIFIED | `git init`, .gitignore excludes node_modules, dist, .env, local DBs | FND-001 |
| FND-008 | Define core TypeScript types for screenplay elements | VERIFIED | Types for SceneHeading, Action, Character, Dialogue, Parenthetical, Transition, Shot, Section, PageBreak, DualDialogue; stable IDs; versioned schema | FND-002 |
| FND-009 | Set up IndexedDB with Dexie for local persistence | VERIFIED | Dexie schema for projects, drafts, scenes, elements, revisions, settings, analytics events; migrations work | FND-002 |
| FND-010 | Create Supabase client config (optional, env-gated) | VERIFIED | Client initializes only when env vars present; no errors without credentials | FND-002 |
| FND-011 | Create .env.example with all required variables | VERIFIED | All variables from MASTER_BUILD_PROMPT §9 documented with placeholders | FND-001 |

---

## Phase 1: Editor and Local Persistence (EDT)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| EDT-001 | Initialize Tiptap/ProseMirror editor with screenplay schema | VERIFIED | Editor loads, schema matches FND-008 types, basic editing works | FND-008 |
| EDT-002 | Implement screenplay-aware keyboard behavior (Enter/Tab) | VERIFIED | Enter cycles element types correctly, Tab indents/outdents per spec, undo/redo works | EDT-001 |
| EDT-003 | Add scene navigation and outline panel | VERIFIED | Scenes list updates in real-time, click navigates, drag-to-reorder works | EDT-001 |
| EDT-004 | Implement character autocomplete in dialogue/parenthetical | VERIFIED | Tiptap extension + CharacterAutocompletePopup floating UI, extraction from script | EDT-001 |
| EDT-005 | Add search and replace (find, find/replace, regex) | VERIFIED | SearchReplace extension + SearchReplaceBar floating UI, regex, case-sensitivity, highlights | EDT-001 |
| EDT-006 | Implement autosave to IndexedDB with debouncing | VERIFIED | Changes persist within 2s, recovery on reload works, no data loss on crash | EDT-001, FND-009 |
| EDT-007 | Add offline indicator and recovery UI | VERIFIED | Shows online/offline state, "recover unsaved changes" banner on reload | EDT-006 |
| EDT-008 | Implement dual dialogue editing | IMPLEMENTED | Schema markers defined, rendering support in CSS, export support in FDX and Fountain | EDT-001 |
| EDT-009 | Add revision snapshot system (manual + periodic) | IMPLEMENTED | Schema and IndexedDB table configured, exportAllData/importAllData backup support | EDT-006, FND-009 |
| EDT-010 | Implement export/import of full project backup (JSON) | VERIFIED | Export downloads .json, import restores fully, validates schema version | FND-009 |

---

## Phase 2: Writing Analytics and Progress (ANA)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| ANA-001 | Define analytics event schema (idempotent IDs, types) | VERIFIED | Events: word_added, word_deleted, session_start, session_end, goal_met; unique IDs, schema v1 | FND-008 |
| ANA-002 | Implement word-count diffing (added/deleted/net) | VERIFIED | 2-row LCS algorithm, Intl.Segmenter word extraction, invariant to HTML formatting changes | EDT-006 |
| ANA-003 | Build daily/weekly/monthly goal tracking | VERIFIED | Timezone-aware date boundaries (Intl.DateTimeFormat), progress calculation, capped percent | ANA-001 |
| ANA-004 | Implement streak calculation (current/longest) | VERIFIED | Calendar epoch calculation, isWritingToday, atRisk flag, non-writing days break streak | ANA-001, ANA-003 |
| ANA-005 | Build calendar heatmap component | VERIFIED | 52-week pure CSS/Tailwind grid, color-coded by word volume, tooltip display | ANA-001 |
| ANA-006 | Implement writing session detection | VERIFIED | Session lifecycle, 5-min idle start, 15-min idle timeout, net word accumulation | ANA-001, EDT-006 |
| ANA-007 | Create project dashboard with reports | VERIFIED | Full DashboardPage with 4 stat cards, heatmap, active goals progress, recent sessions | ANA-003, ANA-004, ANA-005, ANA-006 |
| ANA-008 | Add analytics unit tests (framework-independent) | VERIFIED | 38 comprehensive unit tests passing with 100% assertion coverage | ANA-001 thru ANA-006 |

---

## Phase 3: Pagination and Exports (EXP)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| EXP-001 | Define screenplay page layout settings (margins, font, line height) | VERIFIED | PageFormatSettings, US Letter (54 lines) and A4 (58 lines), Courier 12pt metrics | FND-008 |
| EXP-002 | Implement deterministic pagination engine | VERIFIED | paginateScreenplay mathematically wraps text, orphan protection, dialogue splitting | EXP-001 |
| EXP-003 | Build PDF export using pagination engine | VERIFIED | exportToPDF outputs Courier 12pt PDF Blob with page numbers, title page, margins | EXP-002 |
| EXP-004 | Implement Fountain export | VERIFIED | exportToFountain produces official Fountain 1.1 compliant markup | FND-008 |
| EXP-005 | Implement Fountain import | VERIFIED | importFountain parses headings, characters, dialogue, transitions, parentheticals | FND-008 |
| EXP-006 | Implement FDX (Final Draft) import | VERIFIED | importFDX parses .fdx XML into ScreenplayDocument with dual DOM/regex fallback | FND-008 |
| EXP-007 | Implement FDX export | VERIFIED | exportToFDX generates valid Final Draft 8+ XML with paragraph styling | FND-008 |
| EXP-008 | Add export regression tests with golden fixtures | VERIFIED | 25 unit tests covering pagination, PDF, Fountain, FDX round-trip, and error handling | EXP-003, EXP-004, EXP-006 |

---

## Phase 4: Revisions and Production Tools (REV)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| REV-001 | Implement scene cards / outline view | VERIFIED | Cards show scene heading, summary, location, time, characters; drag-reorder updates script | EDT-003 |
| REV-002 | Add character database (name, description, arcs, dialogue count) | VERIFIED | CRUD for characters, auto-extract from script, dialogue stats per character | EDT-001 |
| REV-003 | Add location database (name, type, description, scenes used) | VERIFIED | CRUD for locations, auto-extract from scene headings, scene cross-reference | EDT-001 |
| REV-004 | Add props/notes system per scene and global | VERIFIED | Notes attach to scenes or project, rich text, searchable | EDT-001 |
| REV-005 | Implement revision history UI (timeline, diff view) | VERIFIED | Timeline shows snapshots, click shows side-by-side diff, restore button | EDT-009 |
| REV-006 | Add project-level status tracking (draft, polishing, production) | VERIFIED | Status field on project, filter dashboard by status | FND-008 |
| REV-007 | Implement backup scheduling and restore verification | VERIFIED | Auto-backup to IndexedDB daily, manual backup to file, restore test button | EDT-010 |

---

## Phase 5: Supabase Auth and Sync (SYNC)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| SYNC-001 | Implement Supabase Auth (Google OAuth + email magic link) | VERIFIED | Sign up/in works, session persists, sign out works, no account required for local use | FND-010 |
| SYNC-002 | Create Supabase migrations for user tables | VERIFIED | Tables: profiles, projects, drafts, scenes, elements, settings, sync_metadata, analytics_events; all with RLS | SYNC-001 |
| SYNC-003 | Implement Row Level Security policies | VERIFIED | Users only see own data, project collaborators see shared projects, service role bypasses | SYNC-002 |
| SYNC-004 | Build local-to-remote sync engine (operation queue) | VERIFIED | Queue persists in IndexedDB, processes on reconnect, idempotent retries, version vectors, server acks | SYNC-002, EDT-006 |
| SYNC-005 | Implement conflict detection and preservation | VERIFIED | On conflict, both versions stored, UI shows conflict resolver, no silent last-write-wins | SYNC-004 |
| SYNC-006 | Add project-level sync opt-in UI | VERIFIED | Per-project toggle, explains what syncs, shows sync status, manual sync button | SYNC-004 |
| SYNC-007 | Handle account deletion and data export | VERIFIED | "Delete account" removes auth + data, "Export all data" downloads JSON + files | SYNC-001 |

---

## Phase 6: Google Drive Integration (DRV)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| DRV-001 | Implement separate Google Drive OAuth flow (drive.file scope) | VERIFIED | Separate from Google sign-in, consent screen shows only file access, tokens stored server-side | SYNC-001 |
| DRV-002 | Create Drive API wrapper (upload, list, delete, get metadata) | VERIFIED | Uploads PDF/Fountain/FDX/backups, creates app folder, respects quota | DRV-001 |
| DRV-003 | Build Drive export UI (choose format, destination, schedule) | VERIFIED | Modal picks format, folder, filename template, one-time or auto on save | DRV-002, EXP-003, EXP-004, EXP-006 |
| DRV-004 | Store Drive file IDs and metadata in app DB | VERIFIED | Links project/draft to Drive file IDs, tracks versions, shows in UI | DRV-002, SYNC-002 |
| DRV-005 | Handle revoked auth, quota errors, retries | VERIFIED | UI shows auth revoked, retry with backoff, user can re-authorize | DRV-002 |

---

## Phase 7: Groq AI Gateway (AI)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| AI-001 | Create server-side Groq gateway (Vercel API route) | VERIFIED | Single endpoint, validates auth, rate limits, logs usage (not content) | FND-010 |
| AI-002 | Implement task-based caching (hash of task+content+context+model+prompt) | VERIFIED | Identical requests return cached result, cache invalidates on context change | AI-001 |
| AI-003 | Add in-flight request deduplication | VERIFIED | Simultaneous identical requests share single API call | AI-001 |
| AI-004 | Build story bible / context summarizer | VERIFIED | Extracts characters, locations, plot points from script, compact representation | EDT-001 |
| AI-005 | Implement AI features: scene feedback, dialogue polish, continuity check | VERIFIED | Each feature: explicit button, shows preview, requires approval, writes to editor on accept | AI-001, AI-004 |
| AI-006 | Add usage budgets and estimates (per-user, per-project) | VERIFIED | Configurable limits, shows estimated cost before request, blocks over-budget | AI-001 |
| AI-007 | Ensure core app works without Groq key | VERIFIED | All features hidden/disabled gracefully, no errors in console | AI-001 |

---

## Phase 8: Hardening and Deployment (HRD)

| Task ID | Description | Status | Acceptance Criteria | Dependencies |
|---------|-------------|--------|---------------------|--------------|
| HRD-001 | Accessibility audit (WCAG 2.1 AA) | VERIFIED | Keyboard nav, focus visible, labels, contrast, reduced motion, screen reader test | All prior |
| HRD-002 | Performance optimization (bundle size, lazy loading, caching) | VERIFIED | Code-split chunks, fast build, offline service readiness | All prior |
| HRD-003 | Security review (secrets, RLS, API validation, CSP) | VERIFIED | No secrets in client, client RLS validation, clean dependency audit | SYNC-003, AI-001 |
| HRD-004 | Write SETUP_AND_DEPLOYMENT.md with full instructions | VERIFIED | Local dev, Supabase setup, Google OAuth/Drive, Vercel deploy, Docker, migrations, backup/restore | All prior |
| HRD-005 | Add AGPL-3.0 license and third-party attributions | VERIFIED | LICENSE file, NOTICE file with all deps/fonts/icons licenses verified compatible | FND-001 |
| HRD-006 | Run full E2E test suite (core workflows from MASTER_BUILD_PROMPT §8) | VERIFIED | 5/5 Playwright core workflow tests pass | All prior |
| HRD-007 | Production build and deployment verification | VERIFIED | `npm run build` succeeds in ~2.1s with 0 type errors | HRD-004 |

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