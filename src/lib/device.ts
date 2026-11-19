// What the device says about the person's language and time zone. Both can be
// missing (web, odd emulators), so callers get null instead of an exception.
import { getCalendars, getLocales } from "expo-localization";

export function deviceLanguageCode(): string | null {
  try {
    return getLocales()[0]?.languageCode ?? null;
  } catch {
    return null;
  }
}

export function deviceTimeZone(): string | null {
  try {
    return getCalendars()[0]?.timeZone ?? null;
  } catch {
    return null;
  }
}
