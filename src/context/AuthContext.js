import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import storage from '../utils/storage';
import { makeRedirectUri } from 'expo-auth-session';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  isGuest: false,
  signIn: async () => ({ data: null, error: null }),
  signUp: async () => ({ data: null, error: null }),
  signInWithPhone: async () => ({ data: null, error: null }),
  signInAsGuest: () => {},
  signOut: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  changePassword: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  deleteAccount: async () => ({ error: null }),
});

const SESSION_RESTORE_TIMEOUT_MS = 5000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      console.log('[AUTH] Supabase not configured, skipping session restore');
      setLoading(false);
      return;
    }

    const fetchRole = async (userId, source) => {
      try {
        const { data: profile, error: roleErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        if (roleErr) {
          console.log(`[AUTH] Role fetch failed (${source}):`, roleErr.message);
          return;
        }
        if (mounted) setUserRole(profile?.role || 'user');
        console.log(`[AUTH] Role loaded (${source}):`, profile?.role || 'user');
      } catch (e) {
        console.log(`[AUTH] Role fetch exception (${source}):`, e?.message || e);
      }
    };

    const timeout = setTimeout(() => {
      if (!mounted) return;
      console.log('[AUTH] Session restoration timed out');
      setError(new Error('Session restoration timed out'));
      setLoading(false);
    }, SESSION_RESTORE_TIMEOUT_MS);

    (async () => {
      console.log('[AUTH] Restoring session...');
      try {
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sessionErr) throw sessionErr;
        const restored = data?.session ?? null;
        setSession(restored);
        setUser(restored?.user ?? null);
        setError(null);
        console.log(restored ? '[AUTH] Session found' : '[AUTH] No session found');
        if (restored?.user?.id) await fetchRole(restored.user.id, 'restore');
      } catch (e) {
        console.log('[AUTH] Session restoration failed:', e?.message || e);
        if (mounted) setError(e);
      } finally {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    })();

    // The callback must stay synchronous: supabase-js invokes it while holding
    // its internal auth lock, and awaiting a Supabase query in here deadlocks
    // every later request (the query itself needs that lock for its token).
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      console.log('[AUTH] Auth state changed:', event, sess?.user ? 'with session' : 'no session');
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user?.id) {
        const userId = sess.user.id;
        setTimeout(() => { if (mounted) fetchRole(userId, event); }, 0);
      } else {
        setUserRole('user');
      }
    });
    return () => {
      sub?.subscription?.unsubscribe?.();
      clearTimeout(timeout);
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    console.log('[LOGIN] Attempting login...');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) console.log('[LOGIN] Login failed:', result.error.message);
    else console.log('[LOGIN] Login successful');
    return result;
  }, []);

  const signUp = useCallback(async ({ email, password, name, phone }) => {
    const params = { password };
    if (email) params.email = email;
    if (phone) params.phone = phone;
    params.options = { data: { full_name: name || '' } };
    return await supabase.auth.signUp(params);
  }, []);

  const signInWithPhone = useCallback(async (phone) => {
    return await supabase.auth.signInWithOtp({ phone });
  }, []);

  const signInAsGuest = useCallback(() => {
    // Clear any cached data from previous users so guest starts fresh
    storage.removeItem('@gradesmart:tests');
    storage.removeItem('@gradesmart:scans');
    storage.removeItem('@gradesmart:subscription');
    setUser(null);
    setSession(null);
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    if (isGuest) {
      // Clear guest local data
      storage.removeItem('@gradesmart:tests');
      storage.removeItem('@gradesmart:scans');
      storage.removeItem('@gradesmart:subscription');
      setIsGuest(false);
      setUser(null);
      setSession(null);
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  }, [isGuest]);

  const updateProfile = useCallback(async ({ fullName, school, phone, location, bio }) => {
    const updates = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (school !== undefined) updates.school = school;
    if (phone !== undefined) updates.phone = phone;
    if (location !== undefined) updates.location = location;
    if (bio !== undefined) updates.bio = bio;
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (!error && data?.user) setUser(data.user);
    return { data, error };
  }, []);

  const changePassword = useCallback(async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!email) return { error: { message: 'Please enter your email address.' } };
    const redirectUrl = makeRedirectUri({ scheme: 'gradesmart', path: 'reset-password' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  }, []);

  const deleteAccount = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return { error: { message: 'No user session found.' } };

    try {
      // Clean up user data from all tables
      if (isSupabaseConfigured) {
        await Promise.allSettled([
          supabase.from('scans').delete().eq('user_id', uid),
          supabase.from('tests').delete().eq('user_id', uid),
          supabase.from('subscriptions').delete().eq('user_id', uid),
          supabase.from('activities').delete().eq('user_id', uid),
          supabase.from('likes').delete().eq('user_id', uid),
        ]);

        // Delete avatar files
        try {
          const { data: files } = await supabase.storage.from('avatars').list(uid);
          if (files?.length) {
            await supabase.storage.from('avatars').remove(files.map(f => `${uid}/${f.name}`));
          }
        } catch {}
      }

      // Delete the auth user via RPC (requires a Supabase edge function or
      // service_role key). If RPC is not available, sign out and mark as deleted.
      // Try the admin delete RPC first:
      const { error: rpcError } = await supabase.rpc('delete_user');
      if (rpcError) {
        // Fallback: sign out (account stays but data is wiped)
        await supabase.auth.signOut();
        return { error: null, partial: true };
      }

      setUser(null);
      setSession(null);
      return { error: null };
    } catch (e) {
      return { error: { message: e?.message || 'Failed to delete account.' } };
    }
  }, [user]);

  const isAdmin = userRole === 'admin';

  const value = useMemo(() => ({
    user,
    session,
    loading,
    error,
    isConfigured: isSupabaseConfigured,
    isGuest,
    isAdmin,
    userRole,
    signIn,
    signUp,
    signInWithPhone,
    signInAsGuest,
    signOut,
    updateProfile,
    changePassword,
    resetPassword,
    deleteAccount,
  }), [user, session, loading, error, isGuest, isAdmin, userRole, signIn, signUp, signInWithPhone, signInAsGuest, signOut, updateProfile, changePassword, resetPassword, deleteAccount]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
