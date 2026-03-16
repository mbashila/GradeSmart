import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  signIn: async () => ({ data: null, error: null }),
  signUp: async () => ({ data: null, error: null }),
  signOut: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  changePassword: async () => ({ error: null }),
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });
    return () => {
      sub?.subscription?.unsubscribe?.();
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    return await supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signUp = useCallback(async ({ email, password, name }) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name || '',
        },
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const updateProfile = useCallback(async ({ fullName, school }) => {
    const updates = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (school !== undefined) updates.school = school;
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (!error && data?.user) setUser(data.user);
    return { data, error };
  }, []);

  const changePassword = useCallback(async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isConfigured: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
    updateProfile,
    changePassword,
  }), [user, session, loading, signIn, signUp, signOut, updateProfile, changePassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
