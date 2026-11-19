import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setHapticsEnabled } from "./haptics";
import {
  defaultPrefs,
  LEGACY_THEME_KEY,
  parsePrefs,
  PREFS_KEY,
  serializePrefs,
  type Prefs,
} from "./prefs";

type PrefsContextValue = {
  prefs: Prefs;
  /** False until storage has been read. Gate the first paint on it in the root layout. */
  loaded: boolean;
  setPrefs: (patch: Partial<Prefs>) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.multiGet([PREFS_KEY, LEGACY_THEME_KEY])
      .then((entries) => {
        if (cancelled) return;
        const raw = entries.find(([key]) => key === PREFS_KEY)?.[1] ?? null;
        const legacy = entries.find(([key]) => key === LEGACY_THEME_KEY)?.[1] ?? null;
        setPrefsState(parsePrefs(raw, legacy));
      })
      .catch(() => {
        // Unreadable storage: keep the defaults and carry on.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Write only after the first read, so defaults never overwrite saved choices.
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(PREFS_KEY, serializePrefs(prefs)).catch(() => {});
  }, [prefs, loaded]);

  useEffect(() => {
    setHapticsEnabled(prefs.haptics);
  }, [prefs.haptics]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(() => ({ prefs, loaded, setPrefs }), [prefs, loaded, setPrefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
