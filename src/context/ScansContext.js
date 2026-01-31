import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import storage from '../utils/storage';

const ScansContext = createContext({
  scans: [],
  addScan: () => {},
});

export function ScansProvider({ children }) {
  const [scans, setScans] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await storage.getItem('@gradesmart:scans');
        if (mounted && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setScans(parsed);
          } catch {}
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const addScan = useCallback((scan) => {
    setScans((prev) => {
      const id = scan?.id || Date.now().toString();
      const createdAt = scan?.createdAt || new Date().toISOString();
      const normalized = { id, createdAt, ...scan };
      return [...prev, normalized];
    });
  }, []);

  const value = useMemo(() => ({ scans, addScan }), [scans, addScan]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem('@gradesmart:scans', JSON.stringify(scans));
  }, [scans, hydrated]);

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
