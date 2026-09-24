import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The three selectable modes exposed to the user. */
export type ThemeMode = 'dark' | 'light' | 'system';

/** The resolved visual appearance (never "system"). */
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  /** The mode the user explicitly chose (dark | light | system). */
  theme: ThemeMode;
  /** The actual rendered visual theme, after resolving "system". */
  resolvedTheme: ResolvedTheme;
  /** Set a specific mode and persist it. */
  setTheme: (theme: ThemeMode) => void;
  /** Cycles through the 3 modes: dark → light → system → dark */
  cycleTheme: () => void;
  /** Legacy alias for cycleTheme (backwards compatibility). */
  toggleTheme: () => void;
  /** True when the resolved visual is dark. */
  isDark: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'superbot_theme_mode_v1';
const CYCLE_ORDER: ThemeMode[] = ['dark', 'light', 'system'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSystemPreference(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark'; // safe fallback for SSR / no matchMedia
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return getSystemPreference();
  return mode;
}

function applyThemeToDOM(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'light') {
    root.classList.remove('theme-dark');
    root.classList.add('theme-light');
    root.setAttribute('data-theme', 'light');
  } else {
    root.classList.remove('theme-light');
    root.classList.add('theme-dark');
    root.setAttribute('data-theme', 'dark');
  }
}

function readStoredMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch {
    // ignore — private browsing / storage blocked
  }
  return 'dark'; // institutional dark as default
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredMode);

  // Derived: the actual visual resolution (system → dark or light)
  const resolvedTheme: ResolvedTheme = resolveTheme(theme);

  // ── Apply DOM class whenever the resolved theme changes ──────────────────
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, [resolvedTheme]);

  // ── Real-time OS preference listener (only active in "system" mode) ───────
  useEffect(() => {
    if (theme !== 'system') return; // No listener needed in explicit modes

    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      applyThemeToDOM(e.matches ? 'dark' : 'light');
    };

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [theme]);

  // ── Public API ────────────────────────────────────────────────────────────

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
  }, []);

  const cycleTheme = useCallback(() => {
    const currentIndex = CYCLE_ORDER.indexOf(theme);
    const nextIndex = (currentIndex + 1) % CYCLE_ORDER.length;
    setTheme(CYCLE_ORDER[nextIndex]);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        cycleTheme,
        toggleTheme: cycleTheme, // legacy alias — keeps all call-sites working
        isDark: resolvedTheme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
