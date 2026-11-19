// Date text for the screens, from the language files. No Intl: month and
// weekday names come from `strings.dates`, so Hermes behaves like Node.
import type { Strings } from "@/i18n/id";

import { localDateOf, localTimeOf, monthOf, parseLocalDate, weekdayOf, type LocalDate, type YearMonth } from "./dates";

type DateStrings = Pick<Strings, "dates">;

/** "November 2026". */
export function formatMonthLabel(month: YearMonth, strings: DateStrings): string {
  return `${strings.dates.monthsLong[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** "25 Nov", with the year when it is not the current one. */
export function formatShortDate(date: LocalDate, strings: DateStrings, today?: LocalDate): string {
  const { year, month, day } = parseLocalDate(date);
  const base = `${day} ${strings.dates.monthsShort[month - 1]}`;
  return today && parseLocalDate(today).year !== year ? `${base} ${year}` : base;
}

/** "Today", "Yesterday", or "Wed, 18 Nov". */
export function formatDayLabel(date: LocalDate, today: LocalDate, strings: DateStrings): string {
  if (date === today) return strings.dates.today;
  const { year, month, day } = parseLocalDate(date);
  const yesterday = localDateOf(Date.UTC(parseLocalDate(today).year, parseLocalDate(today).month - 1, parseLocalDate(today).day) - 86_400_000, 0);
  if (date === yesterday) return strings.dates.yesterday;
  const label = `${strings.dates.weekdaysShort[weekdayOf(date)]}, ${day} ${strings.dates.monthsShort[month - 1]}`;
  return parseLocalDate(today).year === year ? label : `${label} ${year}`;
}

/** "Wed, 18 November 2026". */
export function formatFullDate(date: LocalDate, strings: DateStrings): string {
  const { year, month, day } = parseLocalDate(date);
  return `${strings.dates.weekdaysShort[weekdayOf(date)]}, ${day} ${strings.dates.monthsLong[month - 1]} ${year}`;
}

/** The moment a row was recorded or edited, in the phone's own zone: "18 Nov 21:03". */
export function formatStamp(epochMs: number, offsetMin: number, strings: DateStrings): string {
  const date = localDateOf(epochMs, offsetMin);
  const { day, month } = parseLocalDate(date);
  return `${day} ${strings.dates.monthsShort[month - 1]} ${localTimeOf(epochMs, offsetMin)}`;
}

export { monthOf };
