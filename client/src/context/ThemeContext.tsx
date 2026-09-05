import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export type ThemeMode = 'dark' | 'light' | 'system' | 'custom';

interface ThemeContextType {
  themeMode: ThemeMode;
  effectiveTheme: 'dark' | 'light';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateUser } = useAuth();
  const [themeMode, setLocalThemeMode] = useState<ThemeMode>(() => {
    return (
      (user?.preferences?.themeMode as ThemeMode) ||
      (localStorage.getItem('gatekeeper_theme') as ThemeMode) ||
      'dark'
    );
  });
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (user?.preferences?.themeMode) {
      setLocalThemeMode(user.preferences.themeMode as ThemeMode);
    }
  }, [user?.preferences?.themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (mode: ThemeMode) => {
      let resolved: 'dark' | 'light' = 'dark';
      if (mode === 'system') {
        resolved = mediaQuery.matches ? 'dark' : 'light';
      } else if (mode === 'light') {
        resolved = 'light';
      } else {
        resolved = 'dark';
      }

      setEffectiveTheme(resolved);
      root.setAttribute('data-theme', resolved);
      if (resolved === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    };

    applyTheme(themeMode);

    if (themeMode === 'system') {
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const setThemeMode = async (mode: ThemeMode) => {
    setLocalThemeMode(mode);
    try {
      localStorage.setItem('gatekeeper_theme', mode);
    } catch {
      // Ignore localStorage exceptions
    }

    if (user) {
      try {
        const res = await fetch('/api/v1/users/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ themeMode: mode }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) updateUser(data.user);
        }
      } catch {
        // Silently keep local state
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ themeMode, effectiveTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
