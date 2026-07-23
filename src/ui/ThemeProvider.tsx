import React, { useEffect, useState } from 'react';
import { ThemeContext, type ThemeContextValue, type ThemeMode } from './useTheme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('morphiq_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return 'system';
  });

  const [resolved, setResolved] = useState<'dark' | 'light'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedTheme: 'dark' | 'light' =
        mode === 'system' ? (mq.matches ? 'dark' : 'light') : mode;
      setResolved(resolvedTheme);
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    };

    applyTheme();
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('morphiq_theme', newMode);
  };

  const ctx: ThemeContextValue = { mode, setMode, resolved };

  return (
    <ThemeContext.Provider value={ctx}>
      {children}
    </ThemeContext.Provider>
  );
};
