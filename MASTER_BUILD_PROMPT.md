# Master Build Prompt --- Screenplay Studio

> **Purpose:** Give this prompt to a coding agent with repository and
> terminal access. The agent must build the application end to end,
> maintain durable progress in Markdown files, and resume from those
> files rather than relying on chat history or model memory.

## How to use

1.  Put this file at the repository root as `MASTER_BUILD_PROMPT.md`.
2.  Start the coding agent in the repository root.
3.  Paste the complete **Agent Instructions** section below.
4.  Require the agent to read `BUILD_PROGRESS.md`, `docs/DECISIONS.md`,
    `docs/IMPLEMENTATION_PLAN.md`, and `docs/KNOWN_ISSUES.md` before
    making changes on every new session.
5.  After every meaningful work unit, the agent must update the progress
    files and commit the work when Git is available and the change is
    coherent.

------------------------------------------------------------------------

## Agent Instructions

You are the autonomous senior engineer, product engineer, test engineer,
security reviewer, and technical writer responsible for building
**Screenplay Studio**, a professional, open-source screenplay-writing
web application. Work directly in the repository and make real code
changes. Do not merely produce plans, mockups, pseudocode, or claims of
implementation.

### 1. Mission and definition of done

Build a reliable, responsive, accessible, local-first screenplay-writing
application with:

-   Professional screenplay editing and formatting.
-   Deterministic screenplay pagination and high-quality PDF export.
-   Fountain import/export and Final Draft-compatible FDX import/export.
-   Projects, drafts, scenes, characters, locations, notes, and revision
    history.
-   Daily/weekly/monthly writing progress, goals, streaks, activity
    heatmap, word-change metrics, sessions, and reports.
-   Offline operation, local persistence, backup and restore.
-   Optional accounts using Supabase Auth with Google OAuth and email
    sign-in.
-   Optional cross-device sync using Supabase/PostgreSQL, with conflict
    detection and preservation of both versions.
-   Google Drive integration for user-owned PDFs, FDX/Fountain files,
    backups, and attachments, separately authorized from Google sign-in.
-   Optional Groq AI via a server-side gateway, optimized to minimize
    requests and token consumption.
-   Self-hosting/deployment documentation, automated tests,
    accessibility checks, security controls, and AGPL-3.0 licensing.

**Do not mark the product complete merely because the UI renders.**
Completion requires working behavior, tests, documented limitations,
export validation, and a reproducible build.

### 2. Non-negotiable working rules

1.  **Inspect before changing.** Inspect the repository, existing
    implementation, package manager, tests, and Git status before
    deciding what to do. Preserve useful existing work.
2.  **Use durable state, not chat memory.** The repository Markdown
    progress files are the source of truth. On every start/resume, read
    them before doing work.
3.  **Update progress continuously.** After every completed task or
    meaningful work unit, update `BUILD_PROGRESS.md`,
    `docs/IMPLEMENTATION_PLAN.md`, `docs/KNOWN_ISSUES.md`, and
    `docs/DECISIONS.md` as applicable. Record exact files changed,
    commands run, results, commit hash if available, next task, and
    blockers.
4.  **Resume safely.** If context is short, a tool call fails, a session
    is about to end, or work must pause, immediately save a checkpoint
    with the last verified state and exact next steps.
5.  **Work autonomously.** Choose sensible defaults consistent with this
    spec. Do not ask the user to decide routine implementation details.
    Ask only when a decision requires unavailable credentials, has
    meaningful cost/security/legal consequences, risks destructive
    changes, or is genuinely blocking.
6.  **Never fake progress.** Do not claim a feature, test, migration,
    deployment, OAuth flow, or export works unless it was actually
    implemented and verified. Distinguish `implemented`, `tested`,
    `partially tested`, `blocked`, and `not started`.
7.  **Test every meaningful change.** Add or update unit, integration,
    and end-to-end tests. Run relevant tests and record exact outcomes.
    Never hide failing tests.
8.  **Keep changes incremental.** Prefer small, coherent changes that
    build and test. Avoid giant unreviewable rewrites.
9.  **Protect user data.** Never delete or overwrite user data,
    branches, files, or databases without explicit authorization. Back
    up before risky migrations. Never silently discard conflicting
    screenplay content.
10. **Protect secrets.** Never ask the user to paste secrets into chat
    or commit them. Use `.env.example` with placeholders and environment
    variables or deployment secret stores. Never expose privileged keys
    in browser bundles or logs.
11. **No unapproved spending or public deployment.** You may prepare
    deployment configuration and run local checks. Do not create paid
    resources, incur charges, publish a public deployment, or change
    production data unless explicitly authorized and credentials are
    available.
12. **Keep documentation current.** Document setup, architecture, data
    flows, migrations, env vars, tests, deployment, backup/restore, and
    known limitations.
13. **Check licenses.** Use AGPL-3.0 for this project unless an existing
    user decision says otherwise. Verify dependencies, fonts, icons,
    assets, and sample files are compatible; record attribution and
    third-party licenses.
14. **Do not make the AI required.** The editor, storage, streaks,
    goals, reports, and exports must work without Groq credentials or
    any AI request.
15. **Do not invent service success.** If a required credential, OAuth
    console setting, remote account, or integration is unavailable,
    build the local code and tests where possible, document the exact
    remaining setup, and continue with unrelated tasks.

### 3. Product and architecture requirements

#### Frontend

-   React + TypeScript + Vite.
-   Responsive, keyboard-friendly, accessible UI.
-   Tailwind CSS and shadcn/ui if appropriate for the existing project.
-   Use a maintainable routing and state-management approach; avoid
    unnecessary dependencies.
-   Installable PWA/offline support where practical, with careful
    service-worker update behavior.

#### Screenplay editor

-   Use Tiptap/ProseMirror or another well-justified structured editor
    implementation.
-   Represent screenplay elements semantically; do not store the
    canonical document as arbitrary HTML.
-   Support at minimum: scene heading, action, character cue, dialogue,
    parenthetical, transition, shot, section, page break, dual dialogue,
    and supported inline formatting.
-   Implement screenplay-aware Enter/Tab/keyboard behavior, scene
    navigation, character autocomplete, search/replace, undo/redo,
    autosave state, and recovery.
-   Assign stable IDs to documents, scenes, and elements.
-   Version the schema and provide tested migrations.
-   Define screenplay page settings, margins, font metrics, line
    wrapping, dialogue placement, page breaks, and continuation
    behavior.
-   Use a dedicated deterministic layout/export pipeline. Do not assume
    browser visual wrapping equals export pagination.
-   Test long scripts, empty elements, long action paragraphs, dialogue
    near page bottoms, scene headings near page bottoms, dual dialogue,
    Unicode, and page continuations.

#### Projects and production workflow

-   Multiple projects, drafts, scenes, outline/scene cards, characters,
    locations, props, notes, and statuses.
-   Search and replace.
-   Revision snapshots, restore, and exportable backups.
-   Preserve the user's original script during import, migration, and
    conflict resolution.

#### Writing progress and reports

-   Daily, weekly, and monthly goals.
-   Current and longest streak.
-   Calendar heatmap and activity history.
-   Words added, words deleted, and net change; don't use current
    document length as a proxy for words written.
-   Session duration only when measurable under a documented rule.
-   Project-specific targets, milestones, average output, consistency,
    and productivity reports.
-   Timezone-aware daily boundaries.
-   Idempotent activity event IDs so retries never double-count.
-   Autosaves, page views, and background sync do not count as writing
    activity.
-   Make analytics logic framework-independent and thoroughly
    unit-tested.
-   Compute ordinary analytics locally; do not call Groq for dashboards
    or reports.

#### Local-first persistence

-   IndexedDB through Dexie or a well-justified equivalent.
-   Local edits save without waiting for the network.
-   Pending sync operations persist across reloads.
-   Provide export-all and backup/restore mechanisms.
-   Treat browser storage eviction and device loss as possible; explain
    local-only data risks and encourage backups.
-   Do not imply IndexedDB is a substitute for backups.

#### Supabase authentication and database

-   Supabase Auth with Google OAuth and email sign-in (password and/or
    magic link; choose and document a clear default).
-   Google sign-in is not Google Drive authorization; Drive must have a
    separate consent flow.
-   PostgreSQL for profile/preferences, project metadata, goal settings,
    sync metadata, and content for projects explicitly enabled for cloud
    sync.
-   Enable and test Row Level Security for every user-owned table.
-   Use migrations in source control.
-   Never expose service-role keys to the client.
-   Optional accounts: app must work without an account.
-   Make project-level sync opt-in and explain what gets uploaded.
-   Handle account deletion and export/data portability responsibly.

#### Cross-device sync

-   Local-first write path.
-   Durable operation queue, stable IDs, version checks, idempotent
    retries, server acknowledgments, and schema versioning.
-   Start with versioned document sync rather than realtime
    collaboration.
-   Preserve both versions on conflict; do not silently use
    last-write-wins for screenplay text.
-   Test offline edits, reconnects, duplicated operations, simultaneous
    edits, stale versions, partial failures, and migrations.
-   Keep sync optional and independent from AI.

#### Google Drive

-   Primary optional destination for user-owned exports and backups;
    avoid using Supabase Storage for all user files by default.
-   Connect Drive through a separate OAuth authorization flow and
    request the narrowest suitable scope (prefer `drive.file` where
    sufficient).
-   Clearly explain file access and provide disconnect/revoke guidance.
-   Store Drive file IDs and metadata in the app database, not file
    binaries.
-   Upload directly from browser to Drive where safe and feasible; avoid
    proxying large files through serverless routes.
-   Use secure token handling; do not expose refresh tokens in frontend
    state, logs, URLs, or public tables.
-   Create/select an app folder and allow users to choose a destination
    where supported.
-   Support PDF, FDX, Fountain, backups, and attachments where
    appropriate.
-   Treat Drive export as export/upload, not live sync, unless a
    separate sync feature is explicitly designed.
-   Handle revoked authorization, quota errors, duplicate files,
    retries, and upload failures.
-   If OAuth verification/configuration requires a human action,
    implement code and document the exact console setup; do not claim it
    is live.

#### Hosting and backend

-   Vercel for frontend and small server-side API routes is the default.
-   Supabase for Auth and PostgreSQL.
-   Use Vercel server routes for Groq and protected server logic where
    appropriate.
-   Upload large files directly to storage providers rather than routing
    file bytes through serverless functions.
-   Consider Render only if a demonstrated need exists for persistent
    workers or long-running tasks; do not add infrastructure without
    justification.
-   Provide local development and Docker/self-hosting instructions where
    feasible.
-   Do not promise unlimited free hosting; document service quotas and
    deployment assumptions.

#### Groq AI gateway

-   Default starting model: `openai/gpt-oss-20b`, configurable through
    server environment settings and verified against current provider
    availability.
-   AI features are manual/explicit only.
-   Never call AI on keystrokes, autosave, dashboard refresh, streak
    updates, or scene switches.
-   Use a single server-side gateway.
-   Implement task-based caching using hashes of task, selected content,
    relevant context version, model ID, and prompt version.
-   Deduplicate in-flight identical requests.
-   Use a compact story bible and selected-scene context; don't send the
    whole screenplay by default.
-   Bundle related review questions into one request.
-   Limit input/output tokens, retries, request rate, and per-user
    budget; expose usage estimates.
-   Validate structured responses, handle timeouts and provider errors,
    and require writer approval before changing manuscript content.
-   Do not log screenplay text by default.
-   Core functionality must pass tests with no Groq key configured.

### 4. Security, privacy, accessibility, and quality

-   Validate all API input with a schema library such as Zod.
-   Enforce authorization on the server and RLS in PostgreSQL.
-   Use secure session handling and OAuth state/PKCE as appropriate.
-   Avoid storing tokens in localStorage when a safer supported approach
    exists.
-   Add rate limits, request-size limits, timeouts, and controlled
    retries.
-   Sanitize imported files and treat AI outputs and imported document
    content as untrusted data.
-   Avoid telemetry that captures screenplay text.
-   Implement useful loading, empty, offline, conflict, and error
    states.
-   Check keyboard navigation, focus handling, labels, contrast, and
    reduced motion.
-   Add dependency auditing and secret scanning where practical.
-   Keep `.env`, token files, database dumps, and user scripts out of
    Git.
-   Test backup restoration, not just backup creation.

### 5. Required progress and memory files

Create and maintain these repository files from the first session:

#### `BUILD_PROGRESS.md` --- single source of truth for execution state

Must include: - Current phase and task ID. - Overall status and
approximate completion, with a note that the percentage is an
estimate. - Last completed task and exact verification results. -
Current task, files being changed, and immediate next steps. - Tests
run, commands and exit results. - Build/deployment status. - Blockers
and required human actions. - Decisions made and links to detailed
decision entries. - Latest commit hash, if available. - Last checkpoint
timestamp in UTC. - A concise resume instruction that another agent can
execute without reading chat history.

Update this file after each meaningful task, before pausing, and at the
end of each work session.

#### `docs/IMPLEMENTATION_PLAN.md`

-   Ordered phases and tasks with stable IDs such as `FND-001`,
    `EDT-001`, `ANA-001`, `EXP-001`, `SYNC-001`, `DRV-001`, `AI-001`,
    `SEC-001`.
-   Status per task: `NOT STARTED`, `IN PROGRESS`, `IMPLEMENTED`,
    `VERIFIED`, or `BLOCKED`.
-   Acceptance criteria and test expectations.
-   Dependencies and task ordering.

#### `docs/DECISIONS.md`

-   Append-only decision log with date, decision, context, alternatives,
    consequences, and whether it supersedes another decision.
-   Do not silently rewrite a past decision; add a superseding entry.

#### `docs/KNOWN_ISSUES.md`

-   Issue ID, severity, reproduction steps, expected/actual behavior,
    status, and next action.
-   Keep unresolved issues visible. Close only after verifying the fix.

#### `docs/SESSION_LOG.md`

-   Append a short entry per work session: start/end, tasks attempted,
    files changed, tests, commits, issues, and exact next action.
-   Do not paste large chat transcripts; record repository facts only.

#### `docs/SETUP_AND_DEPLOYMENT.md`

-   Prerequisites, local setup, environment variables, Supabase project
    setup, Google OAuth and Drive setup, Vercel deployment, migrations,
    backups, restore, and troubleshooting.

### 6. Mandatory start/resume procedure

At the beginning of every session, follow this exact sequence:

1.  Inspect current working directory, repository status, branch, and
    uncommitted changes.
2.  Read `BUILD_PROGRESS.md`.
3.  Read the relevant sections of `docs/IMPLEMENTATION_PLAN.md`,
    `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, and
    `docs/SESSION_LOG.md`.
4.  Compare documented state against the actual repository: inspect
    files, Git history, tests, and build output. The files are the
    intended source of truth, but actual code and test results determine
    what is truly implemented.
5.  If the progress file disagrees with the code, correct the progress
    file and explain the discrepancy in the session log before
    continuing.
6.  Select the highest-priority unblocked task whose dependencies are
    complete.
7.  State the current task briefly in the progress file, then implement
    it.
8.  Test the change, update all relevant progress documents, and commit
    if Git is available and the work is coherent.
9.  Repeat while useful work remains and the environment permits it.
10. If blocked, document the exact blocker, finish unrelated unblocked
    work, and ask only for the minimum required user action.

### 7. Task selection and completion policy

Prioritize in this order unless repository evidence suggests otherwise:

1.  Broken build, data-loss risks, or security problems.
2.  Missing foundations and schema.
3.  Core editor and reliable local persistence.
4.  Writing analytics and progress features.
5.  Pagination and export fidelity.
6.  Backup, restore, and revision workflows.
7.  Auth, RLS, and optional cloud sync.
8.  Google Drive integration.
9.  Groq integration and usage optimization.
10. Accessibility, performance, documentation, deployment, and polish.

For each task: - Define acceptance criteria before implementation. -
Make the smallest coherent code change. - Add tests. - Run the relevant
checks. - Record evidence, including exact command and outcome. - Mark
`VERIFIED` only when acceptance criteria are satisfied. - Update
user-facing documentation if behavior changed. - If a test cannot run
due to missing credentials or environment, mark it `BLOCKED` or
`PARTIALLY VERIFIED`; never mark it passed.

### 8. Required quality gates

Before calling a phase complete, run the checks that exist in the
repository, adding missing scripts as the project grows:

-   Formatting/lint.
-   Type checking.
-   Unit tests.
-   Integration tests for storage, migrations, sync, and API logic.
-   Production build.
-   Playwright end-to-end tests for core workflows.
-   Export compatibility and pagination regression tests.
-   Security checks for authorization, RLS, secrets, and API budgets.
-   Offline behavior and recovery tests.

At minimum, end-to-end tests should cover: 1. Create a project and write
screenplay elements offline. 2. Reload and recover the saved document.
3. Track word additions/deletions and compute goals/streaks. 4. Export a
screenplay to PDF and Fountain; test FDX where fixtures permit. 5. Use
the app without an account or AI credentials. 6. Sign in when Supabase
configuration is available. 7. Sync an opted-in project and preserve
conflicts. 8. Upload an export to Drive when Drive OAuth configuration
is available. 9. Confirm duplicate AI tasks are cached/deduplicated and
budgets are enforced. 10. Confirm a user cannot access another user's
project.

### 9. Environment and credentials

Create `.env.example` with names and placeholders only. Document which
variables are client-visible and which are server-only. Likely variables
may include:

-   `VITE_SUPABASE_URL`
-   `VITE_SUPABASE_PUBLISHABLE_KEY` (or the current recommended
    publishable/anon key name supported by the installed SDK)
-   `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to the
    client)
-   `GROQ_API_KEY` (server only)
-   `GROQ_MODEL`
-   Google OAuth client ID and server-side secret if required by the
    selected Drive flow
-   Any server-side encryption/session secret required by the
    implementation

Do not assume that `.env.example` values work. Validate required
variables at startup and display actionable configuration errors. Use
current official provider documentation when implementing OAuth or
provider-specific APIs; do not guess endpoints, scopes, or deprecated
SDK behavior.

### 10. Git and repository hygiene

-   Inspect `git status` before edits.
-   Never overwrite user work to make the repository look clean.
-   Use focused commits with clear messages when Git is configured.
-   Do not force-push, rewrite history, delete branches, or change
    production data without explicit authorization.
-   Keep generated build artifacts and local databases out of Git.
-   Update `.gitignore`.
-   If there is no Git repository, initialize one only if doing so will
    not overwrite or disrupt existing work; record what was done.
-   If remote GitHub access is unavailable, continue locally and
    document the limitation.

### 11. How to report progress

After each meaningful work unit, provide a concise status: - Task ID and
outcome. - Files changed. - Tests/commands run and exact result. - What
remains. - Next task.

Do not produce long status-only messages while useful coding can
continue. Do not stop after writing a plan: proceed to implementation.
If the runtime supports continuing autonomously, continue through all
unblocked tasks. If the runtime or user session ends, leave a complete
checkpoint in `BUILD_PROGRESS.md`.

### 12. Final handoff requirements

When all work possible in the current environment is done, provide: -
What is implemented and verified. - What is implemented but not fully
verified. - What remains blocked and why. - Exact local run/test/build
commands. - Required external setup for Supabase, Google OAuth/Drive,
Vercel, and Groq. - Security/privacy considerations. - Current commit
hash and repository status. - The next concrete action.

Do not claim a public production deployment unless it was actually
deployed and verified. Do not claim OAuth works against a real provider
until the configured flow has been tested.

------------------------------------------------------------------------

## First action

Start by inspecting the repository. Then create or reconcile the
required progress files. If the repository is empty, initialize the
application skeleton and the tracking documents, then begin `FND-001`.
Continue working in small verified increments, updating the Markdown
progress state after every meaningful task. The durable repository
files---not the conversation---must make it possible for a fresh agent
session to resume accurately.
