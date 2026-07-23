import { createContext, useContext } from 'react';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: 'dark' | 'light';
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  resolved: 'dark',
});

export const useTheme = () => useContext(ThemeContext);
