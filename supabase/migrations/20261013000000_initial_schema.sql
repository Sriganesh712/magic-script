-- Screenplay Studio Database Schema (SYNC-002, SYNC-003)
-- Full PostgreSQL migration with Row Level Security (RLS) policies

-- ============================================================================
-- Profiles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Projects Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafting',
  logline TEXT,
  genre TEXT,
  target_length INTEGER,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Drafts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  screenplay_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_project_id ON public.drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON public.drafts(user_id);

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts"
  ON public.drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON public.drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON public.drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON public.drafts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Screenplays Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.screenplays (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screenplays_project_id ON public.screenplays(project_id);
CREATE INDEX IF NOT EXISTS idx_screenplays_draft_id ON public.screenplays(draft_id);
CREATE INDEX IF NOT EXISTS idx_screenplays_user_id ON public.screenplays(user_id);

ALTER TABLE public.screenplays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screenplays"
  ON public.screenplays FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own screenplays"
  ON public.screenplays FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own screenplays"
  ON public.screenplays FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own screenplays"
  ON public.screenplays FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Revisions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL,
  screenplay_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  document JSONB NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revisions_project_id ON public.revisions(project_id);
CREATE INDEX IF NOT EXISTS idx_revisions_user_id ON public.revisions(user_id);

ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own revisions"
  ON public.revisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own revisions"
  ON public.revisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own revisions"
  ON public.revisions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Sync Metadata Table (Version Tracking & Conflict Detection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sync_metadata (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_version INTEGER NOT NULL DEFAULT 1,
  remote_version INTEGER NOT NULL DEFAULT 1,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_meta_user ON public.sync_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_meta_project ON public.sync_metadata(project_id);

ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sync metadata"
  ON public.sync_metadata FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Analytics Events Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON public.analytics_events(project_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own analytics events"
  ON public.analytics_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
