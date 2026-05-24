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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Timeout so the splash screen never hangs indefinitely
    const timeout = setTimeout(() => {
      if (mounted && loading) setLoading(false);
    }, 5000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
        // Fetch role from profiles table
        if (data?.session?.user?.id) {
          try {
            const { data: profile, error: roleErr } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', data.session.user.id)
              .maybeSingle();
            if (roleErr) console.log('Role fetch error:', roleErr);
            if (mounted && profile?.role) setUserRole(profile.role);
          } catch (e) {
            console.log('Role fetch exception:', e);
          }
        }
      } catch (e) {
        console.log('Auth getSession error:', e);
      } finally {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user?.id) {
        try {
          const { data: profile, error: roleErr } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', sess.user.id)
            .maybeSingle();
          if (roleErr) console.log('Role fetch error (auth change):', roleErr);
          if (profile?.role) setUserRole(profile.role);
        } catch (e) {
          console.log('Role fetch exception (auth change):', e);
        }
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
    return await supabase.auth.signInWithPassword({ email, password });
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
  }), [user, session, loading, isGuest, isAdmin, userRole, signIn, signUp, signInWithPhone, signInAsGuest, signOut, updateProfile, changePassword, resetPassword, deleteAccount]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
