import { setStatusBarStyle, StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { usePrefs } from "@/lib/PrefsProvider";
import { resolveScheme, type ThemeMode } from "@/lib/prefs";

import { elevation, palettes, type Palette, type Scheme } from "./tokens";

export type Theme = {
  scheme: Scheme;
  color: Palette;
  elevation: ReturnType<typeof elevation>;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { prefs, setPrefs } = usePrefs();
  const system = useColorScheme();
  const scheme = resolveScheme(prefs.themeMode, system);
  const setMode = useCallback((mode: ThemeMode) => setPrefs({ themeMode: mode }), [setPrefs]);

  const value = useMemo<Theme>(
    () => ({
      scheme,
      color: palettes[scheme],
      elevation: elevation(scheme),
      mode: prefs.themeMode,
      setMode,
    }),
    [scheme, prefs.themeMode, setMode],
  );

  // The strip behind the status bar is the window background. Paint it with the
  // canvas so its icons are visible in both themes (dark icons on a black strip
  // vanish).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palettes[scheme].canvas).catch(() => {});
  }, [scheme]);

  // Screens outside the new design system are still dark-only: put the status
  // bar and the window back the way they were when this provider goes away.
  useEffect(
    () => () => {
      setStatusBarStyle("light");
      SystemUI.setBackgroundColorAsync("#000000").catch(() => {});
    },
    [],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={palettes[scheme].statusBar} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
