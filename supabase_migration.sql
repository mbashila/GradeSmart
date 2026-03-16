-- ============================================================
-- GradeSmart Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. TESTS TABLE
-- Stores test configurations created by teachers
CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  subject TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  question_type TEXT DEFAULT 'mcq',
  number_of_questions INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  marking_key TEXT DEFAULT '',
  mcq_count INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SCANS TABLE
-- Stores scan results linked to tests and users
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id TEXT REFERENCES tests(id) ON DELETE SET NULL,
  student_name TEXT DEFAULT '',
  score NUMERIC DEFAULT 0,
  max_score NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ACTIVITIES TABLE (ensure it exists with user_id)
CREATE TABLE IF NOT EXISTS activities (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. LIKES TABLE (ensure it exists with user_id)
CREATE TABLE IF NOT EXISTS likes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, scan_id)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Each user can only see/modify their own data
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own tests" ON tests;
DROP POLICY IF EXISTS "Users can insert own tests" ON tests;
DROP POLICY IF EXISTS "Users can update own tests" ON tests;
DROP POLICY IF EXISTS "Users can delete own tests" ON tests;

DROP POLICY IF EXISTS "Users can view own scans" ON scans;
DROP POLICY IF EXISTS "Users can insert own scans" ON scans;
DROP POLICY IF EXISTS "Users can update own scans" ON scans;
DROP POLICY IF EXISTS "Users can delete own scans" ON scans;

DROP POLICY IF EXISTS "Users can view own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON activities;

DROP POLICY IF EXISTS "Users can view own likes" ON likes;
DROP POLICY IF EXISTS "Users can insert own likes" ON likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON likes;

-- TESTS policies
CREATE POLICY "Users can view own tests" ON tests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tests" ON tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tests" ON tests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tests" ON tests
  FOR DELETE USING (auth.uid() = user_id);

-- SCANS policies
CREATE POLICY "Users can view own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans" ON scans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans" ON scans
  FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITIES policies
CREATE POLICY "Users can view own activities" ON activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities" ON activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- LIKES policies
CREATE POLICY "Users can view own likes" ON likes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tests_user_id ON tests(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_test_id ON scans(test_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_scan_id ON likes(scan_id);

-- ============================================================
-- STORAGE: avatars bucket (if not already created)
-- ============================================================
-- Run this only if the 'avatars' bucket doesn't exist yet:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;
