import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import storage from '../utils/storage';

const HapticsContext = createContext({
  enabled: false,
  setEnabled: () => {},
});

export function HapticsProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await storage.getItem('@gradesmart:haptics');
        if (mounted && v != null) {
          if (v === '1' || v === 'true') setEnabled(true);
          if (v === '0' || v === 'false') setEnabled(false);
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem('@gradesmart:haptics', enabled ? '1' : '0');
  }, [enabled, hydrated]);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled]);

  return (
    <HapticsContext.Provider value={value}>
      {children}
    </HapticsContext.Provider>
  );
}

export function useHaptics() {
  return useContext(HapticsContext);
}

export default HapticsContext;
