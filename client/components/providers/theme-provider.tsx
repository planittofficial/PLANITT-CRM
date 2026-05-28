"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  CRM_THEME_STORAGE_KEY,
  DEFAULT_CRM_THEME,
  type CRMThemeMode,
  readStoredTheme,
  persistTheme,
  applyDocumentTheme,
} from "@/lib/theme-storage";

type ThemeContextValue = {
  theme: CRMThemeMode;
  setTheme: (theme: CRMThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_CRM_THEME,
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<CRMThemeMode>(DEFAULT_CRM_THEME);

  useLayoutEffect(() => {
    const stored = readStoredTheme();
    const next = stored ?? DEFAULT_CRM_THEME;
    setThemeState(next);
    applyDocumentTheme(next);
  }, []);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== CRM_THEME_STORAGE_KEY) {
        return;
      }
      const next = readStoredTheme() ?? DEFAULT_CRM_THEME;
      setThemeState(next);
      applyDocumentTheme(next);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((nextTheme: CRMThemeMode) => {
    setThemeState(nextTheme);
    applyDocumentTheme(nextTheme);
    persistTheme(nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
