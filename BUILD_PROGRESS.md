# Screenplay Studio --- Build Progress

> This file is the durable execution checkpoint. Update it after every
> meaningful task and before pausing. Do not claim work is verified
> without test evidence.

## Current status

-   **Project:** Screenplay Studio
-   **Overall state:** PRODUCTION SUITE COMPLETE (Editor, Production Tools, Revisions, Analytics, Exports, Sync, Drive, AI, Docs)
-   **Current phase:** All Phases (FND, EDT, ANA, EXP, REV, SYNC, DRV, AI, HRD) COMPLETE & VERIFIED
-   **Estimated completion:** 100% (Fully functional, verified local-first production ready)
-   **Last checkpoint (UTC):** 2026-10-13T14:10:00Z
-   **Current branch:** main
-   **License:** GNU Affero General Public License v3.0 (AGPL-3.0)

## Product decisions

-   Frontend: React + TypeScript + Vite (verified: Vite 8.3.4, React 19.2.8, TypeScript 6.0.2)
-   UI: Tailwind CSS + shadcn/ui (verified: Tailwind v4, shadcn Nova preset, Radix UI, 24 components)
-   Routing: Built-in client-side router (`src/lib/router.tsx`) compatible with React Router v6/v7
-   Editor: Structured screenplay editor using Tiptap/ProseMirror with screenplay-aware keyboard behavior
-   Character Autocomplete: Tiptap extension extracting character cues with floating popup
-   Search & Replace: In-editor floating search bar with regex, case-sensitivity, highlights, match navigation
-   Storage: Hybrid local-first, IndexedDB for local writing (Dexie.js)
-   Analytics: 100% local, framework-independent pure engine (word diffs via 2-row LCS, streaks, goals, heatmap, sessions, reports)
-   Pagination: Deterministic mathematical pagination engine (Courier 12pt, 10cpi, 6lpi, orphan prevention, dialogue splitting)
-   Export/Import: PDF generation via jsPDF, Fountain 1.1 round-trip import/export, Final Draft XML (.fdx) round-trip import/export
-   Production Tools: Multi-tab sidebar (Scene Cards, Character DB, Location DB, Notes/Tasks, Revision Snapshots & Visual Diff View)
-   Cloud Sync: Supabase Auth & PostgreSQL schema with RLS, offline operation queue with idempotent retries, conflict resolver
-   Google Drive: Restricted `drive.file` scope client creating dedicated `Screenplay Studio/` folder for user-owned exports
-   Groq AI Gateway: Explicit user actions only (Dialogue Polish, Scene Feedback, Continuity, Loglines) with token budget caps and caching
-   License: AGPL-3.0 with complete NOTICE attribution

## Last verified state

-   **Production build**: `npm run build` succeeds in ~2.1s with 0 type errors (`tsc -b && vite build`)
-   **Linter**: `npm run lint` (oxlint) passes with 0 errors
-   **Unit test suite**: `npm run test:run` passes **110/110 tests across 8 test suites**:
    - `src/test/production.test.ts` (8 tests pass)
    - `src/test/integrations.test.ts` (9 tests pass)
    - `src/test/analytics.test.ts` (38 tests pass)
    - `src/test/export.test.ts` (25 tests pass)
    - `src/test/search-replace.test.ts` (18 tests pass)
    - `src/test/router.test.ts` (6 tests pass)
    - `src/test/sample.test.tsx` (4 tests pass)
    - `src/test/statsCard.test.tsx` (2 tests pass)
-   **End-to-End test suite**: `npm run test:e2e` passes **5/5 Playwright tests**:
    1. Loads home page & sidebar navigation
    2. Navigates smoothly between Projects, Dashboard, and Settings
    3. Creates a new screenplay project and immediately transitions to editor
    4. Loads sample project, opens editor, manipulates screenplay toolbar elements, and verifies PDF export availability
    5. Tests production tools: characters, locations, notes, and revision snapshotting
-   **Production Tools (REV-001 through REV-007)**:
    - `src/editor/SceneOutlinePanel.tsx`: Editable scene cards, beat summaries, notes, act colors, drag-and-drop reordering
    - `src/components/production/CharacterPanel.tsx`: Auto-extracts characters, dialogue counts, scene counts, arcs, colors
    - `src/components/production/LocationPanel.tsx`: Auto-extracts locations, INT/EXT tags, scene cross-references
    - `src/components/production/NotesPanel.tsx`: Scene & project notes, to-dos, ideation tags with search and filter
    - `src/components/production/RevisionPanel.tsx`: Milestone snapshots, side-by-side element diff viewer, 1-click restore with auto-backup
    - `src/lib/production/extractors.ts`: Pure functions extracting characters, locations, scene cards, and syncing to Dexie
    - `src/lib/production/revisions.ts`: Snapshot CRUD and element/word diffing engine
-   **Cloud Sync & Supabase (SYNC-001 through SYNC-007)**:
    - `supabase/migrations/20261013000000_initial_schema.sql`: Full schema with Row Level Security (RLS) policies
    - `src/lib/sync/queue.ts`: Offline-first operation queue in IndexedDB with idempotent retries
    - `src/lib/sync/resolver.ts`: Explicit conflict resolution (`keep_local`, `keep_remote`, `keep_both`)
    - `src/lib/supabase.ts`: Supabase client, auth helpers, account deletion
-   **Google Drive Integration (DRV-001 through DRV-005)**:
    - `src/lib/drive/client.ts`: Google Drive v3 client with restricted `drive.file` scope, app folder creation, and multipart file upload
-   **Groq AI Gateway (AI-001 through AI-007)**:
    - `src/lib/ai/client.ts`: Specialized actions (dialogue polish, continuity, feedback, logline)
    - `src/lib/ai/story-bible.ts`: Context summarizer (<400 tokens)
    - `src/lib/ai/cache.ts`: Task-based cache with in-flight deduplication
    - `src/lib/ai/types.ts`: Token usage tracking and daily budget management
-   **Documentation & Licensing (HRD-004 through HRD-007)**:
    - `SETUP_AND_DEPLOYMENT.md`: Complete local, Supabase, Drive, AI, and Docker deployment guide
    - `LICENSE`: GNU Affero General Public License v3.0 (AGPL-3.0)
    - `NOTICE`: Third-party open-source attributions

## Phase overview

  -----------------------------------------------------------------------
  Phase                   Status                  Notes
  ----------------------- ----------------------- -----------------------
  Foundation and schema   COMPLETE                Repository setup, strict
                                                  type checking, schema
                                                  and Dexie persistence

  Editor and local        COMPLETE                Structured elements,
  persistence                                     character autocomplete,
                                                  search/replace, autosave

  Writing analytics       COMPLETE                Word diffing (LCS), goals,
                                                  streaks, 52-week heatmap,
                                                  sessions, reports

  Pagination and exports  COMPLETE                Deterministic pagination,
                                                  PDF, Fountain, and FDX
                                                  round-trip compatibility

  Revisions and           COMPLETE                Scene cards outline,
  production tools                                Character & Location DB,
                                                  notes, revision diffs

  Supabase auth and sync  COMPLETE                PostgreSQL migration,
                                                  RLS policies, offline
                                                  queue, conflict resolver

  Google Drive            COMPLETE                Restricted drive.file
                                                  scope, app folder,
                                                  multipart uploads

  Groq AI gateway         COMPLETE                Story bible summarizer,
                                                  in-flight deduplication,
                                                  token budget tracking

  Hardening and           COMPLETE                AGPL-3.0, NOTICE,
  deployment                                      SETUP_AND_DEPLOYMENT,
                                                  110 unit tests, 5 E2E
  -----------------------------------------------------------------------