import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { deviceLanguageCode } from "@/lib/device";
import { usePrefs } from "@/lib/PrefsProvider";
import { resolveLanguage, type Language, type LanguagePref } from "@/lib/prefs";

import { en } from "./en";
import { id, type Strings } from "./id";

const dictionaries: Record<Language, Strings> = { id, en };

type I18nValue = {
  t: Strings;
  language: Language;
  pref: LanguagePref;
  setPref: (pref: LanguagePref) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { prefs, setPrefs } = usePrefs();
  const language = resolveLanguage(prefs.language, deviceLanguageCode());
  const setPref = useCallback((pref: LanguagePref) => setPrefs({ language: pref }), [setPrefs]);

  const value = useMemo<I18nValue>(
    () => ({ t: dictionaries[language], language, pref: prefs.language, setPref }),
    [language, prefs.language, setPref],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside I18nProvider");
  return ctx;
}

/** The strings for the current language: `const t = useT(); t.common.save`. */
export function useT(): Strings {
  return useI18n().t;
}

export function useLanguage() {
  const { language, pref, setPref } = useI18n();
  return { language, pref, setPref };
}

export type { Strings };

/** The label of a category: a system key is translated, a category the person made keeps its own name. */
export function categoryLabel(category: { systemKey: string | null; name: string | null }, strings: Strings): string {
  if (category.name) return category.name;
  const labels = strings.categories as Record<string, string>;
  return (category.systemKey && labels[category.systemKey]) || category.systemKey || "";
}
