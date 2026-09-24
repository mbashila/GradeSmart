import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import storage from '../utils/storage';
import { supabase, isSupabaseConfigured, withRequestTimeout } from '../lib/supabase';
import { useAuth } from './AuthContext';

const GUEST_TEST_LIMIT = 1;
const DEVICE_GUEST_COUNT_KEY = '@gradesmart:device_guest_test_count';

const ScansContext = createContext({
  scans: [],
  addScan: () => {},
  deleteScan: () => {},
  syncing: false,
  syncError: null,
  guestTestsRemaining: GUEST_TEST_LIMIT,
});

export { GUEST_TEST_LIMIT };

export function ScansProvider({ children }) {
  const [scans, setScans] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const { user, isGuest } = useAuth();

  const STORAGE_KEY = isGuest ? '@gradesmart:scans:guest' : '@gradesmart:scans';
  const [deviceGuestCount, setDeviceGuestCount] = useState(0);
  const guestTestsRemaining = isGuest ? Math.max(0, GUEST_TEST_LIMIT - deviceGuestCount) : -1;

  // Load device-persistent guest test count on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(DEVICE_GUEST_COUNT_KEY);
        if (raw) setDeviceGuestCount(parseInt(raw, 10) || 0);
      } catch {}
    })();
  }, []);

  // Hydrate: local cache first, then Supabase
  useEffect(() => {
    let mounted = true;
    setScans([]);
    setHydrated(false);
    (async () => {
      // Load local cache for instant display
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (mounted && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setScans(parsed);
          } catch {}
        }
      } catch {}

      // Sync from Supabase (not for guests)
      if (!isGuest && isSupabaseConfigured && user?.id) {
        console.log('[DASHBOARD] Fetching scans...');
        setSyncing(true);
        setSyncError(null);
        try {
          const { data, error } = await withRequestTimeout((signal) => supabase
            .from('scans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .abortSignal(signal));
          if (error) throw error;

          if (data && mounted) {
            console.log('[DASHBOARD] Scans loaded:', data.length);
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
        } catch (e) {
          console.log('[DASHBOARD] Scans request failed:', e?.message || e);
          if (mounted) setSyncError(e);
        } finally {
          if (mounted) setSyncing(false);
        }
      }

      if (mounted) setHydrated(true);
    })();
    return () => { mounted = false; };
  }, [user?.id, isGuest]);

  // Persist to local cache
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(scans));
  }, [scans, hydrated, STORAGE_KEY]);

  const addScan = useCallback(async (scan) => {
    // Enforce device-persistent guest test limit
    if (isGuest && deviceGuestCount >= GUEST_TEST_LIMIT) {
      return { error: `Guest accounts are limited to ${GUEST_TEST_LIMIT} tests per device. Sign up for unlimited access!` };
    }

    const id = scan?.id || Date.now().toString();
    const createdAt = scan?.createdAt || new Date().toISOString();
    const normalized = { id, createdAt, ...scan };
    setScans((prev) => [...prev, normalized]);

    // Increment device-persistent guest count
    if (isGuest) {
      const newCount = deviceGuestCount + 1;
      setDeviceGuestCount(newCount);
      storage.setItem(DEVICE_GUEST_COUNT_KEY, String(newCount));
    }

    // Sync to Supabase (not for guests)
    if (!isGuest && isSupabaseConfigured && user?.id) {
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
    return { error: null };
  }, [user, isGuest, scans.length]);

  const deleteScan = useCallback(async (id) => {
    setScans((prev) => prev.filter((s) => s.id !== id));

    if (!isGuest && isSupabaseConfigured && user?.id) {
      try {
        await supabase.from('scans').delete().eq('id', id).eq('user_id', user.id);
      } catch {}
    }
  }, [user, isGuest]);

  const value = useMemo(() => ({ scans, addScan, deleteScan, syncing, syncError, guestTestsRemaining }), [scans, addScan, deleteScan, syncing, syncError, guestTestsRemaining]);

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
