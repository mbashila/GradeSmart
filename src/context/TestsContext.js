import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import storage from '../utils/storage';

const TestsContext = createContext({
  tests: [],
  addTest: () => {},
  updateTest: () => {},
});

export function TestsProvider({ children }) {
  const [tests, setTests] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await storage.getItem('@gradesmart:tests');
        if (mounted && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setTests(parsed);
          } catch {}
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const addTest = useCallback((test) => {
    setTests((prev) => {
      const id = test?.id || Date.now().toString();
      const createdAt = test?.createdAt || new Date().toISOString();
      const normalized = { id, createdAt, ...test };
      const existingIndex = prev.findIndex((t) => t.id === id);
      if (existingIndex !== -1) {
        const next = prev.slice();
        next[existingIndex] = { ...prev[existingIndex], ...normalized };
        return next;
      }
      return [...prev, normalized];
    });
  }, []);

  const updateTest = useCallback((id, patch) => {
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const value = useMemo(() => ({ tests, addTest, updateTest }), [tests, addTest, updateTest]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem('@gradesmart:tests', JSON.stringify(tests));
  }, [tests, hydrated]);

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
