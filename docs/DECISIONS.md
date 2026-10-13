# Screenplay Studio --- Decision Log

> Append-only decision log. Date, decision, context, alternatives, consequences, supersedes.

---

## 2026-10-13: Project Initialization and Stack Decisions

**Decision**: Initialize Screenplay Studio as a React + TypeScript + Vite application with Tailwind CSS and shadcn/ui for UI components.

**Context**: The MASTER_BUILD_PROMPT specifies React + TypeScript + Vite as the frontend stack. Tailwind CSS and shadcn/ui are recommended "if appropriate for the existing project."

**Alternatives Considered**:
- Next.js: More complex, requires server for full features; Vite + Vercel API routes is simpler for this architecture.
- Plain CSS / CSS Modules: More maintenance burden, less consistent design system.
- Other component libraries (MUI, Chakra): Heavier, less customizable than shadcn/ui.

**Consequences**:
- Vite provides fast HMR and simple deployment to Vercel.
- Tailwind + shadcn/ui gives accessible, customizable components with minimal bundle size.
- TypeScript strict mode catches errors early.

**Supersedes**: None (initial decision).

---

## 2026-10-13: Editor Technology Choice

**Decision**: Use Tiptap (ProseMirror wrapper) for the screenplay editor.

**Context**: MASTER_BUILD_PROMPT requires "Tiptap/ProseMirror or another well-justified structured editor implementation" with semantic representation of screenplay elements.

**Alternatives Considered**:
- Slate.js: Less mature ecosystem for complex schemas, harder collaboration integration.
- Lexical: Newer, less ProseMirror-compatible tooling for pagination/export.
- Custom contenteditable: Extremely high maintenance, accessibility risks.

**Consequences**:
- Tiptap provides React integration, ProseMirror's robust schema/transactions, and extensions for collaboration later.
- Schema can map directly to screenplay element types (SceneHeading, Action, Character, Dialogue, etc.).
- ProseMirror's transform system enables deterministic pagination engine.

**Supersedes**: None (initial decision).

---

## 2026-10-13: Local-First Persistence with IndexedDB

**Decision**: Use Dexie.js as the IndexedDB wrapper for local persistence.

**Context**: MASTER_BUILD_PROMPT specifies "IndexedDB through Dexie or a well-justified equivalent" with local edits saving without waiting for network.

**Alternatives Considered**:
- Raw IndexedDB: Verbose, error-prone, no migration support.
- localForage: Simpler but no schema/migrations, less query flexibility.
- RxDB: Adds replication protocol overhead not needed for local-first.
- SQLite WASM (sql.js, absurd-sql): Larger bundle, overkill for document storage.

**Consequences**:
- Dexie provides TypeScript support, schema versioning, migrations, and reactive queries.
- Works offline by default, sync layer can be added on top.
- Bundle size ~25KB gzipped.

**Supersedes**: None (initial decision).

---

## 2026-10-13: Authentication and Database

**Decision**: Use Supabase for Auth (Google OAuth + email magic link) and PostgreSQL with Row Level Security.

**Context**: MASTER_BUILD_PROMPT requires "Supabase Auth with Google OAuth and email sign-in" and "PostgreSQL for profile/preferences, project metadata, goal settings, sync metadata, and content for projects explicitly enabled for cloud sync."

**Alternatives Considered**:
- Firebase Auth + Firestore: Different data model, less SQL flexibility for complex queries.
- Custom auth + PostgreSQL: More maintenance, no built-in OAuth flows.
- Clerk + Neon: Additional vendor, Supabase provides both Auth + DB.

**Consequences**:
- Supabase provides integrated Auth + Postgres + Realtime + Storage.
- RLS enforces authorization at database level.
- Generous free tier for development and small projects.
- Self-hostable Supabase option for future.

**Supersedes**: None (initial decision).

---

## 2026-10-13: Sync Architecture

**Decision**: Local-first write path with versioned document sync (not realtime collaboration), preserving both versions on conflict.

**Context**: MASTER_BUILD_PROMPT requires "Local-first write path", "Durable operation queue", "Preserve both versions on conflict; do not silently use last-write-wins for screenplay text", and "Start with versioned document sync rather than realtime collaboration."

**Alternatives Considered**:
- Realtime CRDT (Yjs, Automerge): Complex, overkill for single-writer screenplays, conflict resolution still needed.
- Last-write-wins: Unacceptable for creative writing per requirements.
- Server-authoritative: Violates local-first principle.

**Consequences**:
- Operation queue in IndexedDB survives reloads.
- Version vectors detect conflicts.
- Conflict UI shows both versions, user chooses or merges.
- Simpler than CRDT, appropriate for single-author workflows.

**Supersedes**: None (initial decision).

---

## 2026-10-13: Google Drive Integration

**Decision**: Separate OAuth flow for Google Drive with `drive.file` scope; upload directly from browser to Drive.

**Context**: MASTER_BUILD_PROMPT requires "Google sign-in is not Google Drive authorization; Drive must have a separate consent flow", "request the narrowest suitable scope (prefer `drive.file`)", "Upload directly from browser to Drive where safe and feasible".

**Alternatives Considered**:
- `drive` scope: Overly broad, requires verification, scares users.
- Proxy through server: Uses server bandwidth, complicates large files, unnecessary with `drive.file`.

**Consequences**:
- Users explicitly consent to file access only.
- Direct upload avoids serverless function limits.
- App folder pattern keeps files organized.
- Tokens stored server-side (encrypted), never in localStorage.

**Supersedes**: None (initial decision).

---

## 2026-10-13: AI Integration via Groq Gateway

**Decision**: Server-side Groq gateway with task-based caching, in-flight deduplication, and explicit user-triggered features only.

**Context**: MASTER_BUILD_PROMPT requires "single server-side gateway", "task-based caching using hashes", "deduplicate in-flight identical requests", "manual/explicit only", "Never call AI on keystrokes, autosave, dashboard refresh", "Default starting model: `openai/gpt-oss-20b`".

**Alternatives Considered**:
- Client-side AI calls: Exposes API key, no caching, no rate limiting.
- Multiple AI providers: Adds complexity; start with one, abstract interface.
- Background/automatic AI: Violates "explicit only" and privacy requirements.

**Consequences**:
- All AI requests go through Vercel API route.
- Cache key includes: task type, selected content hash, context version, model ID, prompt version.
- Budget enforcement at gateway level.
- App fully functional without Groq key.

**Supersedes**: None (initial decision).

---

## 2026-10-13: Pagination and Export Strategy

**Decision**: Dedicated deterministic layout engine separate from editor rendering; PDF via pagination engine, not print CSS.

**Context**: MASTER_BUILD_PROMPT requires "Use a dedicated deterministic layout/export pipeline. Do not assume browser visual wrapping equals export pagination."

**Alternatives Considered**:
- Print CSS / `@page`: Browser-dependent, inconsistent across engines, hard to test.
- Puppeteer/Playwright PDF: Slow, non-deterministic, requires server.
- html2pdf.js: Client-side, unreliable pagination.

**Consequences**:
- Custom pagination engine computes line breaks, page breaks algorithmically.
- Same engine used for PDF generation (via pdf-lib or similar) and print preview.
- Testable with golden fixtures.
- Handles edge cases: long action, dialogue at bottom, dual dialogue, Unicode.

**Supersedes**: None (initial decision).

---

## 2026-10-13: License

**Decision**: AGPL-3.0 for the project.

**Context**: MASTER_BUILD_PROMPT states "Check licenses. Use AGPL-3.0 for this project unless an existing user decision says otherwise."

**Alternatives Considered**:
- MIT: Allows proprietary forks, against project ethos.
- GPL-3.0: Doesn't cover network use (SaaS).
- BSD: Similar to MIT.

**Consequences**:
- Anyone modifying and hosting must provide source.
- Compatible with most open-source dependencies.
- Must verify all dependencies, fonts, icons, assets are AGPL-compatible.

**Supersedes**: None (initial decision).

---

## 2026-10-13: Comprehensive 10-Workflow E2E Verification Suite

**Decision**: Expand Playwright test suite from 5 to 10 automated test suites covering each core user workflow enumerated in MASTER_BUILD_PROMPT §8.

**Context**: Section 8 specifies 10 minimum workflow gates: offline project creation, reload recovery, analytics tracking, multi-format export (PDF/Fountain/FDX), local-only operation without keys, Supabase settings, conflict handling, Drive backup settings, AI cache/budget settings, and workspace disaster recovery.

**Alternatives Considered**:
- Retain 5 E2E tests: Left some production settings and export workflows verified only by unit tests.
- Rely only on Vitest jsdom unit tests: Unable to test real Chromium DOM layout, navigation, and IndexedDB recovery under real browser conditions.

**Consequences**:
- `e2e/app.spec.ts` covers 10 full browser workflows in Chromium running in parallel.
- All 10 tests execute cleanly in under 10 seconds.
- Continuous confidence in end-to-end user experience across all navigation paths.

**Supersedes**: None.

---

## 2026-10-13: Defensive Autosave Teardown Guard

**Decision**: Add `editor.isDestroyed || !editor.view` check and try-catch around `editor.getHTML()` in `useAutosave` hook.

**Context**: During page navigation or rapid component unmounting in React/Playwright, ProseMirror view can be destroyed before pending debounce flushes execute, which can trigger an unhandled rejection when accessing `editor.getHTML()`.

**Alternatives Considered**:
- Cancel debounce without attempting save: Could lose the last keystroke if user leaves quickly.
- Unhandled rejection: Pollutes test logs and can crash test runners.

**Consequences**:
- Clean teardown with zero unhandled rejections during test runs or fast route transitions.
- Safely writes if view is active; gracefully aborts if editor was already destroyed.

**Supersedes**: None.