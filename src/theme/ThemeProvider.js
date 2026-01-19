import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { setTheme } from './colors';

const ThemeContext = createContext({ scheme: 'light', setScheme: () => {} });

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme() || 'light';
  const [scheme, setScheme] = useState(systemScheme);

  useEffect(() => {
    setTheme(scheme);
  }, [scheme]);

  useEffect(() => {
    setScheme(systemScheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemScheme]);

  const value = useMemo(() => ({ scheme, setScheme }), [scheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
