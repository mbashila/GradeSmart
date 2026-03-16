import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import storage from '../utils/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ScansContext = createContext({
  scans: [],
  addScan: () => {},
  deleteScan: () => {},
  syncing: false,
});

export function ScansProvider({ children }) {
  const [scans, setScans] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuth();

  // Hydrate: local cache first, then Supabase
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Load local cache for instant display
      try {
        const raw = await storage.getItem('@gradesmart:scans');
        if (mounted && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setScans(parsed);
          } catch {}
        }
      } catch {}

      // Sync from Supabase
      if (isSupabaseConfigured && user?.id) {
        try {
          setSyncing(true);
          const { data, error } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (!error && data && mounted) {
            const remoteScans = data.map((row) => ({
              id: row.id,
              createdAt: row.created_at,
              testId: row.test_id || '',
              studentName: row.student_name || '',
              score: row.score || 0,
              maxScore: row.max_score || 0,
              percentage: row.percentage || 0,
              ...(row.data || {}),
            }));
            setScans(remoteScans);
          }
        } catch {} finally {
          if (mounted) setSyncing(false);
        }
      }

      if (mounted) setHydrated(true);
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // Persist to local cache
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem('@gradesmart:scans', JSON.stringify(scans));
  }, [scans, hydrated]);

  const addScan = useCallback(async (scan) => {
    const id = scan?.id || Date.now().toString();
    const createdAt = scan?.createdAt || new Date().toISOString();
    const normalized = { id, createdAt, ...scan };
    setScans((prev) => [...prev, normalized]);

    // Sync to Supabase
    if (isSupabaseConfigured && user?.id) {
      try {
        const { testId, studentName, score, maxScore, percentage, ...rest } = normalized;
        await supabase.from('scans').upsert({
          id,
          user_id: user.id,
          test_id: testId || null,
          student_name: studentName || '',
          score: parseFloat(score) || 0,
          max_score: parseFloat(maxScore) || 0,
          percentage: parseFloat(percentage) || 0,
          data: rest,
          created_at: createdAt,
        }, { onConflict: 'id' });

        // Log activity
        await supabase.from('activities').insert({
          user_id: user.id,
          type: 'scan_created',
          meta: { scan_id: id, test_id: testId || null, student_name: studentName || null },
        });
      } catch {}
    }
  }, [user]);

  const deleteScan = useCallback(async (id) => {
    setScans((prev) => prev.filter((s) => s.id !== id));

    if (isSupabaseConfigured && user?.id) {
      try {
        await supabase.from('scans').delete().eq('id', id).eq('user_id', user.id);
      } catch {}
    }
  }, [user]);

  const value = useMemo(() => ({ scans, addScan, deleteScan, syncing }), [scans, addScan, deleteScan, syncing]);

  return (
    <ScansContext.Provider value={value}>
      {children}
    </ScansContext.Provider>
  );
}

export function useScans() {
  return useContext(ScansContext);
}

export default ScansContext;
