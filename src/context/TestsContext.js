import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import storage from '../utils/storage';
import { supabase, isSupabaseConfigured, withRequestTimeout } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { logError } from '../utils/errors';

const TestsContext = createContext({
  tests: [],
  addTest: async () => ({ error: null }),
  updateTest: async () => ({ error: null }),
  deleteTest: async () => ({ error: null }),
  syncing: false,
  syncError: null,
  hydrated: false,
  refresh: async () => {},
});

function mapTestRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title || '',
    subject: row.subject || '',
    grade: row.grade || '',
    questionType: row.question_type || 'mcq',
    numberOfQuestions: row.number_of_questions || 0,
    totalPoints: row.total_points || 0,
    markingKey: row.marking_key || '',
    mcqCount: row.mcq_count || 0,
    numberOfStudents: row.data?.numberOfStudents || 0,
    ...(row.data || {}),
  };
}

export function TestsProvider({ children }) {
  const [tests, setTests] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const testsRef = useRef(tests);
  testsRef.current = tests;
  const { user, isGuest } = useAuth();

  const STORAGE_KEY = isGuest ? '@gradesmart:tests:guest' : '@gradesmart:tests';

  const fetchRemote = useCallback(async (isCurrent = () => true) => {
    if (isGuest || !isSupabaseConfigured || !user?.id) return;
    console.log('[DASHBOARD] Fetching tests...');
    setSyncing(true);
    setSyncError(null);
    try {
      const { data, error } = await withRequestTimeout((signal) => supabase
        .from('tests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .abortSignal(signal));
      if (error) throw error;

      if (data && isCurrent()) {
        console.log('[DASHBOARD] Tests loaded:', data.length);
        setTests(data.map(mapTestRow));
      }
    } catch (e) {
      logError('TESTS', e, { operation: 'fetch tests' });
      if (isCurrent()) setSyncError(e);
    } finally {
      if (isCurrent()) setSyncing(false);
    }
  }, [user?.id, isGuest]);

  const refresh = useCallback(() => fetchRemote(), [fetchRemote]);

  // Hydrate: try Supabase first, fall back to local cache
  useEffect(() => {
    let mounted = true;
    setTests([]);
    setHydrated(false);
    (async () => {
      // Always load local cache first for instant display
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (mounted && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setTests(parsed);
          } catch {}
        }
      } catch {}

      // Then sync from Supabase if available (not for guests)
      await fetchRemote(() => mounted);

      if (mounted) setHydrated(true);
    })();
    return () => { mounted = false; };
  }, [user?.id, isGuest]);

  // Persist to local cache whenever tests change
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(tests));
  }, [tests, hydrated, STORAGE_KEY]);

  const addTest = useCallback(async (test) => {
    const id = test?.id || Date.now().toString();
    const createdAt = test?.createdAt || new Date().toISOString();
    const normalized = { id, createdAt, ...test };

    setTests((prev) => {
      const existingIndex = prev.findIndex((t) => t.id === id);
      if (existingIndex !== -1) {
        const next = prev.slice();
        next[existingIndex] = { ...prev[existingIndex], ...normalized };
        return next;
      }
      return [...prev, normalized];
    });

    // Sync to Supabase (not for guests). The local copy is kept either way;
    // callers get `{ error }` so they can tell the user it didn't sync.
    if (!isGuest && isSupabaseConfigured && user?.id) {
      try {
        const { questionType, numberOfQuestions, totalPoints, markingKey, mcqCount, ...rest } = normalized;
        const { error } = await withRequestTimeout((signal) => supabase.from('tests').upsert({
          id,
          user_id: user.id,
          title: normalized.title || '',
          subject: normalized.subject || '',
          grade: normalized.grade || '',
          question_type: questionType || 'mcq',
          number_of_questions: parseInt(numberOfQuestions, 10) || 0,
          total_points: parseInt(totalPoints, 10) || 0,
          marking_key: markingKey || '',
          mcq_count: parseInt(mcqCount, 10) || 0,
          data: rest,
          created_at: createdAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }).abortSignal(signal));
        if (error) throw error;
      } catch (e) {
        logError('TESTS', e, { operation: 'save test' });
        return { error: e };
      }
    }
    return { error: null };
  }, [user, isGuest]);

  const updateTest = useCallback(async (id, patch) => {
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

    if (!isGuest && isSupabaseConfigured && user?.id) {
      try {
        const updates = { updated_at: new Date().toISOString() };
        if (patch.title !== undefined) updates.title = patch.title;
        if (patch.subject !== undefined) updates.subject = patch.subject;
        if (patch.grade !== undefined) updates.grade = patch.grade;
        if (patch.questionType !== undefined) updates.question_type = patch.questionType;
        if (patch.numberOfQuestions !== undefined) updates.number_of_questions = parseInt(patch.numberOfQuestions, 10) || 0;
        if (patch.totalPoints !== undefined) updates.total_points = parseInt(patch.totalPoints, 10) || 0;
        if (patch.markingKey !== undefined) updates.marking_key = patch.markingKey;
        if (patch.mcqCount !== undefined) updates.mcq_count = parseInt(patch.mcqCount, 10) || 0;
        const { error } = await withRequestTimeout((signal) => supabase
          .from('tests').update(updates).eq('id', id).eq('user_id', user.id).abortSignal(signal));
        if (error) throw error;
      } catch (e) {
        logError('TESTS', e, { operation: 'update test' });
        return { error: e };
      }
    }
    return { error: null };
  }, [user, isGuest]);

  const deleteTest = useCallback(async (id) => {
    const removedIndex = testsRef.current.findIndex((t) => t.id === id);
    const removed = removedIndex === -1 ? null : testsRef.current[removedIndex];
    setTests((prev) => prev.filter((t) => t.id !== id));

    if (!isGuest && isSupabaseConfigured && user?.id) {
      try {
        const { error } = await withRequestTimeout((signal) => supabase
          .from('tests').delete().eq('id', id).eq('user_id', user.id).abortSignal(signal));
        if (error) throw error;
      } catch (e) {
        logError('TESTS', e, { operation: 'delete test' });
        // Put the test back so the list matches the server.
        if (removed) {
          setTests((prev) => {
            if (prev.some((t) => t.id === id)) return prev;
            const next = prev.slice();
            next.splice(Math.min(removedIndex, next.length), 0, removed);
            return next;
          });
        }
        return { error: e };
      }
    }
    return { error: null };
  }, [user, isGuest]);

  const value = useMemo(() => ({ tests, addTest, updateTest, deleteTest, syncing, syncError, hydrated, refresh }), [tests, addTest, updateTest, deleteTest, syncing, syncError, hydrated, refresh]);

  return (
    <TestsContext.Provider value={value}>
      {children}
    </TestsContext.Provider>
  );
}

export function useTests() {
  return useContext(TestsContext);
}

export default TestsContext;
