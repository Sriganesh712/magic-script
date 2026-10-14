# Build Prompt: Screenplay Studio

Build a beautiful, polished, fully functional screenplay-writing web app called **Screenplay Studio**. Work directly in the current repository. Focus on making the app work end to end, with outstanding UI and no fake buttons or placeholder functionality.

## Main goal

Create a simple, modern writing app for screenwriters. It should feel premium, calm, focused, and intuitive—not like an admin dashboard. Use excellent typography, generous spacing, thoughtful dark/light themes, smooth but subtle interactions, responsive layouts, and clear empty/loading/error states.

**Do not over-engineer this project.** Build a straightforward application with a clean structure. Do not spend time on microservices, elaborate architecture, enterprise scaling, complicated licensing workflows, or excessive documentation. Make sensible decisions yourself and prioritize working features.

## Tech stack

- React + TypeScript + Vite.
- Tailwind CSS and shadcn/ui (or equivalent polished accessible components).
- Tiptap/ProseMirror for the screenplay editor.
- IndexedDB (Dexie is fine) for local-first storage and offline use.
- Supabase for optional Google/email authentication and PostgreSQL data.
- Vercel for deployment and small server-side API routes.
- Google Drive integration for user-owned exports and backups.
- Groq API for optional AI features, called only from a server-side endpoint.

If the repository already contains a reasonable stack, reuse it rather than rewriting it unnecessarily.

## Build these features

### 1. Beautiful home dashboard
- Show the user's active projects as attractive cards.
- Create, rename, duplicate, archive, and delete projects, with confirmation before destructive actions.
- Display project title, format, last edited date, word count, and progress.
- Include a prominent “New Screenplay” action and recent projects.
- Add a sidebar or clear navigation for Dashboard, Projects, Writing Stats, and Settings.
- Include useful empty states for new users.

### 2. Professional screenplay editor
- Use screenplay-specific elements: scene heading, action, character cue, dialogue, parenthetical, transition, shot, section, page break, and dual dialogue if practical.
- Provide correct screenplay indentation and readable screenplay typography.
- Enter/Tab keyboard behavior should help writers move between screenplay elements.
- Support scene navigation, character suggestions/autocomplete, search and replace, undo/redo, and autosave status.
- Save locally automatically; reloading must not lose saved work.
- Support multiple projects and drafts.
- Provide a clean writing-focused editor view with minimal distractions.
- Include a screenplay outline or scene list that jumps to the selected scene.
- Avoid making a generic rich-text editor and merely styling it to look like a screenplay.

### 3. Real screenplay exports
- Export PDF with screenplay page size, margins, fonts, indentation, wrapping, and page breaks.
- Import/export Fountain text.
- Export and import Final Draft-compatible FDX where practical.
- Preserve all text during import/export; show helpful errors for unsupported content.
- Test exports using representative sample scripts.
- Do not claim professional pagination is complete if the exported pages have not been tested.

### 4. Writing progress and streaks
- Daily, weekly, and monthly word counts.
- Daily and weekly writing goals with percentage progress.
- Current streak and longest streak.
- Calendar heatmap showing writing activity.
- Words added, words deleted, and net growth.
- Writing sessions/time spent, using a clearly defined and sensible rule.
- Weekly/monthly reports, averages, goal completion, and most productive days.
- Project-specific goals and progress.
- Persist data across reloads.
- Do not count autosaves or simply opening a document as writing.
- Use local dates/timezone consistently.
- Calculate analytics locally. These features must never call the AI API.

### 5. Optional sign-in and cloud sync
- Supabase Auth with Google sign-in and email sign-in.
- The app must remain usable without an account.
- Keep writing local-first; users should explicitly choose which projects to sync.
- Use Supabase PostgreSQL for user profiles, project metadata, writing goals, and opted-in synchronized screenplay content.
- Add appropriate Row Level Security so users can access only their own data.
- Sync local changes when online and retain pending changes while offline.
- Detect conflicting edits and preserve both versions instead of silently overwriting a screenplay.
- If Supabase environment variables are missing, the app should still run in local-only mode and explain that cloud features are not configured.

### 6. Google Drive files
- Let users separately connect Google Drive; Google sign-in alone does not authorize Drive access.
- Upload screenplay PDF, FDX, Fountain exports, backups, and attachments to the user's own Drive.
- Let users choose a folder where supported, or create an app folder.
- Store Drive file IDs and basic metadata in Supabase, not copies of the files.
- Use the narrowest suitable Drive OAuth scope (prefer `drive.file` when sufficient).
- Handle upload failures, revoked access, and missing configuration with clear messages.
- Upload large files directly to Drive when feasible.
- If Google OAuth setup needs manual configuration, implement the integration as far as possible and clearly show the exact required settings.

### 7. Optional Groq AI assistant
- Keep AI optional; the rest of the app must work without a Groq key.
- Use Groq through a server-side API route only. Never expose the API key in browser code.
- Start with `openai/gpt-oss-20b` if available in the configured Groq account; make the model configurable.
- Include useful actions such as scene feedback, dialogue improvement suggestions, story summaries, and continuity/character consistency checks.
- AI calls must happen only when the user explicitly clicks an AI action—never while typing, autosaving, switching scenes, or opening the dashboard.
- Reduce request count: cache results by task/content/context/model, deduplicate identical in-flight requests, send only the selected scene and relevant context, and combine related review questions into one request.
- Keep responses concise and limit input/output tokens and retries.
- Add a configurable request/token budget and display basic usage.
- Never silently change the script; show suggestions and let the writer apply them.
- If no Groq key is configured, show a friendly “AI not configured” message rather than breaking the app.

### 8. Settings
- Profile and sign-in status.
- Light/dark theme.
- Daily/weekly word goals.
- AI usage budget and model setting.
- Google Drive connection status.
- Cloud sync preference.
- Export all data and restore from a backup.
- Clear confirmation before deleting a project or account data.

## UI direction

Create an outstanding, cohesive interface:
- Premium writing studio aesthetic; not a generic SaaS template.
- Beautiful typography and carefully chosen colors.
- A writing-focused editor with a screenplay page preview.
- Dashboard cards for current streak, words today, weekly progress, and active projects.
- A tasteful activity heatmap and clear progress charts.
- Responsive desktop/tablet/mobile behavior.
- Accessible keyboard navigation, visible focus, proper labels, and readable contrast.
- Subtle motion only where it improves feedback.
- Thoughtful empty states, loading indicators, toasts, and error messages.
- No dead buttons, fake charts, fake data presented as real, or placeholder pages.

Use sensible demo/sample data only when clearly labeled as demo content. Prefer a useful first-run empty state plus an option to create a sample screenplay.

## Keep progress tracking simple

Create a single root file named `PROGRESS.md`. This is the only required project-progress document.

Update it as you work with:
- What is working.
- What you just implemented.
- What tests/build commands you ran and whether they passed.
- What remains.
- The exact next task.

At the start of every session, read `PROGRESS.md` and inspect the current code. Before pausing, update it so another session can resume. Do not create a large documentation system. Keep the file concise and accurate. Never claim a feature is working unless you have actually tested it.

## Implementation approach

1. Inspect the repository and current code.
2. Create a polished app shell and working project dashboard.
3. Implement the screenplay document model, editor, and reliable local autosave.
4. Implement writing activity, goals, streaks, calendar, and reports.
5. Implement and test PDF/Fountain/FDX import/export.
6. Add Supabase sign-in, database policies, and optional sync.
7. Add Google Drive integration.
8. Add the Groq gateway, caching, request limits, and AI UI.
9. Finish responsive behavior, accessibility, error states, and tests.
10. Update `PROGRESS.md` after each meaningful step.

Work in small steps, but continue implementing instead of stopping after a plan. Run the available lint, typecheck, tests, and production build. Fix errors you introduce. If external credentials are missing, finish all work that can be done without them and list the exact setup still needed.

## Important behavior

- Never overwrite or delete existing user work without permission.
- Never commit API keys or secrets.
- Never put privileged Supabase keys or the Groq API key in frontend code.
- Never pretend an OAuth flow, cloud sync, export, or deployment was verified if credentials or tests were unavailable.
- Prioritize a real, usable app over extra abstractions or excessive documentation.

## Start now

Inspect the repository, read `PROGRESS.md` if it exists, and start building the application. Do not respond with only another plan. Make actual code changes and verify them.
