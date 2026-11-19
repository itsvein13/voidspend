import {
  defaultPrefs,
  parsePrefs,
  resolveLanguage,
  resolveReducedMotion,
  resolveScheme,
  serializePrefs,
} from "./prefs";

describe("parsePrefs", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(parsePrefs(null, null)).toEqual(defaultPrefs);
  });

  it("keeps the theme a v1 user picked", () => {
    expect(parsePrefs(null, "light").themeMode).toBe("light");
    expect(parsePrefs(null, "dark").themeMode).toBe("dark");
  });

  it("ignores a legacy theme value it does not know", () => {
    expect(parsePrefs(null, "purple").themeMode).toBe("dark");
  });

  it("round-trips through serializePrefs", () => {
    const prefs = { themeMode: "system", language: "en", reduceMotion: true, haptics: false, appLock: true } as const;
    expect(parsePrefs(serializePrefs(prefs), null)).toEqual(prefs);
  });

  it("lets stored v2 prefs win over the legacy theme", () => {
    const raw = JSON.stringify({ themeMode: "system" });
    expect(parsePrefs(raw, "light").themeMode).toBe("system");
  });

  it("falls back per field when values are malformed", () => {
    const raw = JSON.stringify({ themeMode: "neon", language: 3, reduceMotion: "yes", haptics: false, appLock: "on" });
    expect(parsePrefs(raw, null)).toEqual({ ...defaultPrefs, haptics: false });
  });

  it("survives broken JSON and non-object JSON", () => {
    expect(parsePrefs("{oops", null)).toEqual(defaultPrefs);
    expect(parsePrefs("42", null)).toEqual(defaultPrefs);
    expect(parsePrefs("null", null)).toEqual(defaultPrefs);
  });
});

describe("resolveScheme", () => {
  it("uses the chosen mode as is", () => {
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("light", "dark")).toBe("light");
  });

  it("follows the system and falls back to dark", () => {
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", null)).toBe("dark");
    expect(resolveScheme("system", "unspecified")).toBe("dark");
  });
});

describe("resolveLanguage", () => {
  it("uses an explicit choice", () => {
    expect(resolveLanguage("en", "id")).toBe("en");
    expect(resolveLanguage("id", "en")).toBe("id");
  });

  it("gives Indonesian devices Indonesian and everyone else English", () => {
    expect(resolveLanguage("system", "id")).toBe("id");
    expect(resolveLanguage("system", "in")).toBe("id"); // legacy Android code
    expect(resolveLanguage("system", "fr")).toBe("en");
    expect(resolveLanguage("system", null)).toBe("en");
  });
});

describe("resolveReducedMotion", () => {
  it("is on when either source asks for it", () => {
    expect(resolveReducedMotion(false, false)).toBe(false);
    expect(resolveReducedMotion(true, false)).toBe(true);
    expect(resolveReducedMotion(false, true)).toBe(true);
  });
});
