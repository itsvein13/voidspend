// Preference logic without React or storage, so every rule is unit tested.
import type { Scheme } from "@/design/tokens";

export type ThemeMode = "system" | "dark" | "light";
export type LanguagePref = "system" | "id" | "en";
export type Language = "id" | "en";

export type Prefs = {
  themeMode: ThemeMode;
  language: LanguagePref;
  reduceMotion: boolean;
  haptics: boolean;
  /** Ask for the phone's screen lock when the app opens and after it has been away. Per device, so it is not in a backup. */
  appLock: boolean;
};

// Dark is the brand default. v1 users keep the theme they chose: the old
// "theme" key is read once when no v2 preferences exist yet.
export const defaultPrefs: Prefs = {
  themeMode: "dark",
  language: "system",
  reduceMotion: false,
  haptics: true,
  appLock: false,
};

export const PREFS_KEY = "v2.prefs";
export const LEGACY_THEME_KEY = "theme";

const THEME_MODES: readonly string[] = ["system", "dark", "light"];
const LANGUAGES: readonly string[] = ["system", "id", "en"];

export function parsePrefs(raw: string | null, legacyTheme: string | null): Prefs {
  const base: Prefs = { ...defaultPrefs };
  if (legacyTheme === "light" || legacyTheme === "dark") {
    base.themeMode = legacyTheme;
  }
  if (!raw) return base;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof data !== "object" || data === null) return base;
  const record = data as Record<string, unknown>;

  // Unknown or malformed fields fall back to the default instead of failing.
  if (typeof record.themeMode === "string" && THEME_MODES.includes(record.themeMode)) {
    base.themeMode = record.themeMode as ThemeMode;
  }
  if (typeof record.language === "string" && LANGUAGES.includes(record.language)) {
    base.language = record.language as LanguagePref;
  }
  if (typeof record.reduceMotion === "boolean") base.reduceMotion = record.reduceMotion;
  if (typeof record.haptics === "boolean") base.haptics = record.haptics;
  if (typeof record.appLock === "boolean") base.appLock = record.appLock;
  return base;
}

export function serializePrefs(prefs: Prefs): string {
  return JSON.stringify(prefs);
}

/** "system" follows the device, and falls back to dark when the device says nothing. */
export function resolveScheme(
  mode: ThemeMode,
  system: string | null | undefined,
): Scheme {
  if (mode === "dark" || mode === "light") return mode;
  return system === "light" ? "light" : "dark";
}

/** Indonesian devices get Indonesian. Everything else gets English. */
export function resolveLanguage(
  pref: LanguagePref,
  deviceLanguageCode: string | null | undefined,
): Language {
  if (pref === "id" || pref === "en") return pref;
  return deviceLanguageCode === "id" || deviceLanguageCode === "in" ? "id" : "en";
}

/** Motion is reduced when either the system setting or the in-app switch asks for it. */
export function resolveReducedMotion(pref: boolean, system: boolean): boolean {
  return pref || system;
}
