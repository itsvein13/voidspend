// Date helpers that never touch Intl or the device time zone.
//
// A moment is stored as a UTC epoch (milliseconds) plus the UTC offset in
// minutes that applied where the person was. Everything shown or grouped by
// day is computed by shifting the epoch by that stored offset, so a 23:30 coffee
// in Jakarta stays on its date after a trip to Bali, and Hermes needs no time
// zone database (M0 spike).

/** "YYYY-MM-DD" in the zone stored with the record. */
export type LocalDate = string;
/** "YYYY-MM". */
export type YearMonth = string;

const DAY_MS = 86_400_000;
const pad = (value: number, width = 2) => String(value).padStart(width, "0");

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  if (!isValidLocalDate(value)) throw new RangeError(`Not a date: ${value}`);
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) };
}

export function isValidYearMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The UTC offset in minutes the device uses right now, for example 420 in Jakarta. */
export function currentOffsetMinutes(at: Date = new Date()): number {
  const minutes = -at.getTimezoneOffset();
  return minutes === 0 ? 0 : minutes; // avoids -0
}

export function localDateOf(epochMs: number, offsetMin: number): LocalDate {
  const shifted = new Date(epochMs + offsetMin * 60_000);
  return formatLocalDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** "HH:mm" in the stored zone. */
export function localTimeOf(epochMs: number, offsetMin: number): string {
  const shifted = new Date(epochMs + offsetMin * 60_000);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** The epoch of a wall-clock moment in a zone given by its offset. */
export function epochFromLocal(date: LocalDate, hour: number, minute: number, offsetMin: number): number {
  const { year, month, day } = parseLocalDate(date);
  return Date.UTC(year, month - 1, day, hour, minute) - offsetMin * 60_000;
}

export function monthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7);
}

export function monthStart(month: YearMonth): LocalDate {
  return `${month}-01`;
}

/** First day of the month after `month`, so ranges can use `>= start AND < end`. */
export function monthEndExclusive(month: YearMonth): LocalDate {
  return monthStart(addMonths(month, 1));
}

export function addMonths(month: YearMonth, delta: number): YearMonth {
  const year = Number(month.slice(0, 4));
  const index = year * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

/** v1 stored months 0-based ("2026-6" is July). Converts to "2026-07". */
export function fromV1Month(year: number, zeroBasedMonth: number): YearMonth {
  return `${pad(year, 4)}-${pad(zeroBasedMonth + 1)}`;
}

export function addDays(date: LocalDate, delta: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const moved = new Date(Date.UTC(year, month - 1, day) + delta * DAY_MS);
  return formatLocalDate(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

/** 0 is Sunday. */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** A day of month that may not exist (31 in April) moves back to the last day. */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/** Months from `a` to `b`, negative when `b` is earlier. */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  return (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)));
}
