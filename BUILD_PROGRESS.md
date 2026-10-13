# Screenplay Studio --- Build Progress

> This file is the durable execution checkpoint. Update it after every
> meaningful task and before pausing. Do not claim work is verified
> without test evidence.

## Current status

-   **Project:** Screenplay Studio
-   **Overall state:** CORE SUITE COMPLETE (Editor, Analytics, Exports, Dashboard, Projects, Layout)
-   **Current phase:** Revision Snapshots & Production Tools (REV) / Hardening
-   **Current task ID:** REV-001 (Scene cards / production breakdown)
-   **Estimated completion:** ~65% (robust, tested, local-first production ready)
-   **Last checkpoint (UTC):** 2026-10-13T13:25:00Z
-   **Current branch:** main
-   **Latest commit:** 5fcf859

## Product decisions

-   Frontend: React + TypeScript + Vite (verified: Vite 8.3.4, React 19.2.8, TypeScript 6.0.2)
-   UI: Tailwind CSS + shadcn/ui (verified: Tailwind v4, shadcn Nova preset, Radix UI, 24 components)
-   Routing: Built-in client-side router (`src/lib/router.tsx`) compatible with React Router v6/v7
-   Editor: structured screenplay editor using Tiptap/ProseMirror with screenplay-aware keyboard behavior
-   Character Autocomplete: Tiptap extension extracting character cues with floating popup
-   Search & Replace: In-editor floating search bar with regex, case-sensitivity, highlights, match navigation
-   Storage: hybrid local-first, IndexedDB for local writing (Dexie.js)
-   Analytics: 100% local, framework-independent pure engine (word diffs via 2-row LCS, streaks, goals, heatmap, sessions, reports)
-   Pagination: deterministic mathematical pagination engine (Courier 12pt, 10cpi, 6lpi, orphan prevention, dialogue splitting)
-   Export/Import: PDF generation via jsPDF, Fountain 1.1 round-trip import/export, Final Draft XML (.fdx) round-trip import/export
-   License: AGPL-3.0

## Last verified state

-   **Production build**: `npm run build` succeeds in ~750ms with 0 type errors (`tsc -b && vite build`)
-   **Linter**: `npm run lint` (oxlint) passes with 0 errors
-   **Unit test suite**: `npm run test:run` passes **93/93 tests across 6 test suites**:
    - `src/test/router.test.ts` (6 tests pass)
    - `src/test/analytics.test.ts` (38 tests pass)
    - `src/test/search-replace.test.ts` (18 tests pass)
    - `src/test/export.test.ts` (25 tests pass)
    - `src/test/sample.test.tsx` (4 tests pass)
    - `src/test/statsCard.test.tsx` (2 tests pass)
-   **End-to-End test suite**: `npm run test:e2e` passes **4/4 Playwright tests**:
    1. Loads home page & sidebar navigation
    2. Navigates smoothly between Projects, Dashboard, and Settings
    3. Creates a new screenplay project and immediately transitions to editor
    4. Loads sample project, opens editor, manipulates screenplay toolbar elements, and verifies PDF export availability
-   **Writing Analytics Engine (ANA-001 through ANA-008)**:
    - `src/lib/analytics/word-diff.ts`: Prefix/suffix trimming, 2-row LCS dynamic programming, `Intl.Segmenter` Unicode extraction
    - `src/lib/analytics/goals.ts`: Daily, weekly, monthly, project goals, timezone-aware boundaries (`Intl.DateTimeFormat`)
    - `src/lib/analytics/streaks.ts`: Calendar epoch day calculation, writing day validation (`wordsAdded > 0`), `atRisk` flag
    - `src/lib/analytics/sessions.ts`: Idle start (5 min) and idle timeout (15 min) tracking, net word calculation
    - `src/lib/analytics/reports.ts`: Full local metrics aggregation, consistency %, most productive day and hour
    - `src/lib/analytics/events.ts`: Idempotent UUID event store, background autosave/sync event rejection
-   **Pagination and Export Engine (EXP-001 through EXP-008)**:
    - `src/lib/export/page-layout.ts`: Courier 12pt deterministic line counting, US Letter/A4 margin geometry, orphan protection, `(MORE)`/`(CONT'D)` dialogue splitting
    - `src/lib/export/pdf-export.ts`: Industry-standard PDF export with page numbers, title page, margins
    - `src/lib/export/fountain-export.ts` & `fountain-import.ts`: Official Fountain 1.1 syntax parser and serializer
    - `src/lib/export/fdx-export.ts` & `fdx-import.ts`: Final Draft 8+ XML parser and serializer
    - `src/lib/export/html-converter.ts`: Lossless Tiptap HTML & ScreenplayElement schema converter
-   **Editor Enhancements (EDT-004 & EDT-005)**:
    - `src/editor/extensions/CharacterAutocomplete.ts`: Document character cue scan, uppercase auto-format, keyboard suggestion popup
    - `src/editor/extensions/SearchReplace.ts`: Search, replace one, replace all, regex, case sensitive, highlight decorations
    - `src/components/SearchReplaceBar.tsx`: Floating top bar with match counts and shortcuts
    - `src/components/CharacterAutocompletePopup.tsx`: Dropdown at cursor position
-   **Workspace & Navigation (Layout, Projects, Dashboard, Settings)**:
    - `src/components/Layout.tsx`: Responsive desktop sidebar / mobile bottom nav, theme toggle, online status
    - `src/pages/ProjectsPage.tsx`: IndexedDB screenplay grid, search/filter, create dialog, delete dialog, demo seed
    - `src/pages/EditorPage.tsx`: Full screenplay editor workspace with real PDF/Fountain/FDX export triggers
    - `src/pages/DashboardPage.tsx`: Stats cards, GitHub-style 52-week `CalendarHeatmap`, goals progress, session log
    - `src/pages/SettingsPage.tsx`: Page format settings, autosave delay, theme selector, database quota estimator, JSON backup/restore

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

  Revisions and           IN PROGRESS             Scene cards outline,
  production tools                                character/location notes,
                                                  JSON backup/restore

  Supabase auth and sync  NOT STARTED             Google/email auth, RLS,
                                                  conflict-safe sync

  Google Drive            NOT STARTED             Separate OAuth, user
                                                  owned file backups

  Groq AI gateway         NOT STARTED             Explicit actions only,
                                                  caching, token budgets

  Hardening and           VERIFIED LOCAL          Accessibility, zero lint
  deployment                                      errors, 93 unit tests,
                                                  4 E2E tests, prod build
  -----------------------------------------------------------------------

## Immediate next steps

1. Add revision snapshots table & UI diff view (REV-005)
2. Character and Location database cards (REV-002, REV-003)
3. Prepare Supabase Auth integration (SYNC-001)
4. Prepare Google Drive export integration (DRV-001)

## Resume instruction

All core editing, analytics, export, and workspace pages are built, integrated, and passing 100% of tests. Continue to REV phase (Revision snapshots and Production tools) or Cloud Sync. Run `npm run test:run` and `npm run test:e2e` to verify.