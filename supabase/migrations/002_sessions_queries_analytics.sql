-- ============================================================
-- GradeSmart — Sessions, Queries & Analytics
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Active device sessions table (single-device enforcement)
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON public.device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_active ON public.device_sessions(user_id, is_active);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON public.device_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.device_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.device_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.device_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all sessions"
  ON public.device_sessions FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- 2. Support queries table (user -> admin communication)
CREATE TABLE IF NOT EXISTS public.support_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  admin_id UUID REFERENCES auth.users(id),
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_queries_user ON public.support_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_support_queries_status ON public.support_queries(status);

ALTER TABLE public.support_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own queries"
  ON public.support_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create queries"
  ON public.support_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all queries"
  ON public.support_queries FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all queries"
  ON public.support_queries FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'admin');

-- 3. User activity log (login time tracking)
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  duration_minutes INT DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.user_activity_log(action);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own activity"
  ON public.user_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all activity"
  ON public.user_activity_log FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- 4. RPC: Register device session and check for conflicts
CREATE OR REPLACE FUNCTION public.register_device_session(
  p_device_id TEXT,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  existing_count INT;
  result JSON;
BEGIN
  -- Count active sessions on OTHER devices
  SELECT COUNT(*) INTO existing_count
  FROM public.device_sessions
  WHERE user_id = auth.uid()
    AND device_id != p_device_id
    AND is_active = true
    AND last_seen_at > now() - INTERVAL '5 minutes';

  IF existing_count > 0 THEN
    -- Return conflict info
    SELECT json_build_object(
      'conflict', true,
      'active_devices', (
        SELECT json_agg(json_build_object(
          'id', ds.id,
          'device_name', ds.device_name,
          'last_seen_at', ds.last_seen_at
        ))
        FROM public.device_sessions ds
        WHERE ds.user_id = auth.uid()
          AND ds.device_id != p_device_id
          AND ds.is_active = true
          AND ds.last_seen_at > now() - INTERVAL '5 minutes'
      )
    ) INTO result;
    RETURN result;
  END IF;

  -- Deactivate old sessions for this device
  UPDATE public.device_sessions
  SET is_active = false
  WHERE user_id = auth.uid() AND device_id = p_device_id;

  -- Insert new session
  INSERT INTO public.device_sessions (user_id, device_id, device_name, is_active)
  VALUES (auth.uid(), p_device_id, p_device_name, true);

  SELECT json_build_object('conflict', false) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Force logout other devices
CREATE OR REPLACE FUNCTION public.force_logout_other_devices(p_device_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.device_sessions
  SET is_active = false
  WHERE user_id = auth.uid() AND device_id != p_device_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Heartbeat to keep session alive
CREATE OR REPLACE FUNCTION public.device_heartbeat(p_device_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.device_sessions
  SET last_seen_at = now()
  WHERE user_id = auth.uid() AND device_id = p_device_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enhanced admin stats with time-based analytics
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_admins', (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin'),
    'total_banned', (SELECT COUNT(*) FROM public.profiles WHERE is_banned = true),
    'total_tests', (SELECT COUNT(*) FROM public.tests),
    'total_scans', (SELECT COUNT(*) FROM public.scans),
    'users_today', (SELECT COUNT(*) FROM auth.users WHERE created_at >= CURRENT_DATE),
    'users_this_week', (SELECT COUNT(*) FROM auth.users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'users_this_month', (SELECT COUNT(*) FROM auth.users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'users_this_year', (SELECT COUNT(*) FROM auth.users WHERE created_at >= date_trunc('year', CURRENT_DATE)),
    'scans_today', (SELECT COUNT(*) FROM public.scans WHERE created_at >= CURRENT_DATE),
    'scans_this_week', (SELECT COUNT(*) FROM public.scans WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'scans_this_month', (SELECT COUNT(*) FROM public.scans WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'scans_this_year', (SELECT COUNT(*) FROM public.scans WHERE created_at >= date_trunc('year', CURRENT_DATE)),
    'tests_today', (SELECT COUNT(*) FROM public.tests WHERE created_at >= CURRENT_DATE),
    'tests_this_week', (SELECT COUNT(*) FROM public.tests WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'tests_this_month', (SELECT COUNT(*) FROM public.tests WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'tests_this_year', (SELECT COUNT(*) FROM public.tests WHERE created_at >= date_trunc('year', CURRENT_DATE)),
    'open_queries', (SELECT COUNT(*) FROM public.support_queries WHERE status IN ('open', 'in_progress')),
    'active_sessions', (SELECT COUNT(DISTINCT user_id) FROM public.device_sessions WHERE is_active = true AND last_seen_at > now() - INTERVAL '5 minutes')
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Get most active users (by login frequency + session duration)
CREATE OR REPLACE FUNCTION public.admin_get_active_users(p_period TEXT DEFAULT 'week')
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  login_count BIGINT,
  total_minutes BIGINT,
  last_active TIMESTAMPTZ
) AS $$
DECLARE
  since_date TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  since_date := CASE p_period
    WHEN 'day' THEN CURRENT_DATE
    WHEN 'week' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN 'month' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN 'year' THEN date_trunc('year', CURRENT_DATE)
    ELSE CURRENT_DATE - INTERVAL '7 days'
  END;

  RETURN QUERY
  SELECT
    a.user_id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::TEXT AS full_name,
    COUNT(*) FILTER (WHERE a.action = 'login') AS login_count,
    COALESCE(SUM(a.duration_minutes), 0)::BIGINT AS total_minutes,
    MAX(a.created_at) AS last_active
  FROM public.user_activity_log a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= since_date
  GROUP BY a.user_id, u.email, u.raw_user_meta_data
  ORDER BY login_count DESC, total_minutes DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Admin get support queries
CREATE OR REPLACE FUNCTION public.admin_get_queries(p_status TEXT DEFAULT 'all')
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  full_name TEXT,
  subject TEXT,
  message TEXT,
  status TEXT,
  priority TEXT,
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.user_id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::TEXT AS full_name,
    q.subject,
    q.message,
    q.status,
    q.priority,
    q.admin_reply,
    q.replied_at,
    q.created_at
  FROM public.support_queries q
  JOIN auth.users u ON u.id = q.user_id
  WHERE (p_status = 'all' OR q.status = p_status)
  ORDER BY
    CASE q.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    q.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: Admin reply to query
CREATE OR REPLACE FUNCTION public.admin_reply_query(
  p_query_id UUID,
  p_reply TEXT,
  p_status TEXT DEFAULT 'resolved'
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.support_queries
  SET admin_reply = p_reply,
      admin_id = auth.uid(),
      replied_at = now(),
      status = p_status,
      updated_at = now()
  WHERE id = p_query_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Run this after the initial 001 migration
-- ============================================================
