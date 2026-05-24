-- ============================================================
-- GradeSmart Admin System — Profiles, Roles & RLS
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Helper function to check role without triggering RLS (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. RLS Policies

-- Anyone can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Admins can update any profile (role, ban status, etc.)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, is_banned)
  VALUES (NEW.id, 'user', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Helper RPC: Check if current user is admin (callable from client)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin RPC: Get all users with profile info
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,
  is_banned BOOLEAN,
  ban_reason TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Only allow admins
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::TEXT AS full_name,
    COALESCE(u.raw_user_meta_data->>'avatar_url', '')::TEXT AS avatar_url,
    p.role,
    p.is_banned,
    p.ban_reason,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Admin RPC: Update user role
CREATE OR REPLACE FUNCTION public.admin_update_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF new_role NOT IN ('user', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  UPDATE public.profiles SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Admin RPC: Ban/unban user
CREATE OR REPLACE FUNCTION public.admin_toggle_ban(target_user_id UUID, should_ban BOOLEAN, reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.profiles
  SET is_banned = should_ban, ban_reason = reason, updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Admin RPC: Get app-wide stats
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
    'users_this_month', (SELECT COUNT(*) FROM auth.users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- IMPORTANT: To make yourself an admin, run this after signup:
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-id>';
-- ============================================================
