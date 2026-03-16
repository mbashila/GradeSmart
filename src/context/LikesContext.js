import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import storage from '../utils/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

const LikesContext = createContext({
  isLiked: (_id) => false,
  toggleLike: (_id) => {},
  likedIds: {},
});

export function LikesProvider({ children }) {
  const { user } = useAuth();
  const [likedIds, setLikedIds] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Load local cache first
      try {
        const raw = await storage.getItem('@gradesmart:likes');
        if (mounted && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') setLikedIds(parsed);
          } catch {}
        }
      } catch {}

      // Sync from Supabase
      if (isSupabaseConfigured && user?.id) {
        try {
          const { data, error } = await supabase
            .from('likes')
            .select('scan_id')
            .eq('user_id', user.id);

          if (!error && data && mounted) {
            const remote = {};
            for (const row of data) {
              if (row.scan_id) remote[row.scan_id] = true;
            }
            setLikedIds(remote);
          }
        } catch {}
      }

      if (mounted) setHydrated(true);
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem('@gradesmart:likes', JSON.stringify(likedIds));
  }, [likedIds, hydrated]);

  const isLiked = useCallback((id) => {
    if (!id) return false;
    return !!likedIds[id];
  }, [likedIds]);

  const toggleLike = useCallback(async (id) => {
    if (!id) return;
    setLikedIds((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
    try {
      if (isSupabaseConfigured && user?.id) {
        if (!likedIds[id]) {
          await supabase.from('likes').insert({ scan_id: id, user_id: user.id });
          await supabase.from('activities').insert({ type: 'scan_liked', user_id: user.id, meta: { scan_id: id } });
        } else {
          await supabase.from('likes').delete().eq('scan_id', id).eq('user_id', user.id);
          await supabase.from('activities').insert({ type: 'scan_unliked', user_id: user.id, meta: { scan_id: id } });
        }
      }
    } catch {}
  }, [user, likedIds]);

  const value = useMemo(() => ({ likedIds, isLiked, toggleLike }), [likedIds, isLiked, toggleLike]);

  return (
    <LikesContext.Provider value={value}>
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  return useContext(LikesContext);
}
