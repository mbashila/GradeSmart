import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { colorThemes } from '../theme/colors';
import storage from '../utils/storage';

const THEME_KEY = '@gradesmart:theme';
const COLOR_THEME_KEY = '@gradesmart:colorTheme';

const ThemeContext = createContext({
  theme: 'light',
  colors: colorThemes.green.light,
  isDark: false,
  colorTheme: 'green',
  toggleTheme: () => {},
  setTheme: () => {},
  setColorTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');
  const [colorTheme, setColorThemeState] = useState('green');
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedColor] = await Promise.all([
          storage.getItem(THEME_KEY),
          storage.getItem(COLOR_THEME_KEY),
        ]);
        if (savedMode === 'dark' || savedMode === 'light') {
          setThemeState(savedMode);
        }
        if (savedColor && colorThemes[savedColor]) {
          setColorThemeState(savedColor);
        }
      } catch {}
      setThemeLoaded(true);
    })();
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    storage.setItem(THEME_KEY, t).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      storage.setItem(THEME_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const setColorTheme = useCallback((name) => {
    if (colorThemes[name]) {
      setColorThemeState(name);
      storage.setItem(COLOR_THEME_KEY, name).catch(() => {});
    }
  }, []);

  const isDark = theme === 'dark';
  const colors = useMemo(() => {
    const ct = colorThemes[colorTheme] || colorThemes.green;
    return isDark ? ct.dark : ct.light;
  }, [theme, colorTheme, isDark]);

  const value = useMemo(() => ({
    theme,
    colors,
    isDark,
    colorTheme,
    toggleTheme,
    setTheme,
    setColorTheme,
  }), [theme, colors, isDark, colorTheme, toggleTheme, setTheme, setColorTheme]);

  if (!themeLoaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  const { colors } = useContext(ThemeContext);
  return colors;
}

export default ThemeContext;
