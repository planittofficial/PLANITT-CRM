export const CRM_THEME_STORAGE_KEY = "crm-theme";

export type CRMThemeMode = "light" | "dark";

export const DEFAULT_CRM_THEME: CRMThemeMode = "light";

export function readStoredTheme(): CRMThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(CRM_THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark") {
    return raw;
  }

  return null;
}

/** Migrate legacy per-user keys so theme is consistent across login and app. */
export function migrateLegacyThemeKeys(userId?: string) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  const legacy = window.localStorage.getItem(`crm-theme:${userId}`) as CRMThemeMode | null;
  if (legacy === "light" || legacy === "dark") {
    if (!window.localStorage.getItem(CRM_THEME_STORAGE_KEY)) {
      window.localStorage.setItem(CRM_THEME_STORAGE_KEY, legacy);
    }
    window.localStorage.removeItem(`crm-theme:${userId}`);
  }
}

export function persistTheme(mode: CRMThemeMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CRM_THEME_STORAGE_KEY, mode);
}

export function applyDocumentTheme(mode: CRMThemeMode) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
}
