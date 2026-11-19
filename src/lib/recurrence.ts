// When a recurring item (salary, rent, a subscription) falls due. Pure date
// math over "YYYY-MM-DD" strings, so it is the same on every device.
import { addDays, addMonths, clampDay, formatLocalDate, parseLocalDate, weekdayOf, type LocalDate } from "./dates";

export type Frequency = "weekly" | "monthly" | "yearly";

export type Schedule = {
  frequency: Frequency;
  /** Monthly and yearly: the day of the month. Falls back to the start date's day. */
  dayOfMonth: number | null;
  /** Weekly: 0 is Sunday. Falls back to the start date's weekday. */
  weekday: number | null;
  startDate: LocalDate;
};

function dayIn(year: number, month: number, schedule: Schedule): LocalDate {
  const wanted = schedule.dayOfMonth ?? parseLocalDate(schedule.startDate).day;
  return formatLocalDate(year, month, clampDay(year, month, wanted));
}

/** The first occurrence on or after the start date. */
export function firstOccurrence(schedule: Schedule): LocalDate {
  const start = parseLocalDate(schedule.startDate);
  switch (schedule.frequency) {
    case "monthly": {
      const candidate = dayIn(start.year, start.month, schedule);
      return candidate >= schedule.startDate ? candidate : stepOccurrence(schedule, candidate);
    }
    case "yearly": {
      const candidate = formatLocalDate(start.year, start.month, clampDay(start.year, start.month, schedule.dayOfMonth ?? start.day));
      return candidate >= schedule.startDate ? candidate : stepOccurrence(schedule, candidate);
    }
    case "weekly": {
      const wanted = schedule.weekday ?? weekdayOf(schedule.startDate);
      const ahead = (wanted - weekdayOf(schedule.startDate) + 7) % 7;
      return addDays(schedule.startDate, ahead);
    }
  }
}

/** The occurrence after `current`. Monthly and yearly use the wanted day, so 31 does not drift to 28. */
export function stepOccurrence(schedule: Schedule, current: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(current);
  switch (schedule.frequency) {
    case "weekly":
      return addDays(current, 7);
    case "monthly": {
      const next = addMonths(current.slice(0, 7), 1);
      return dayIn(Number(next.slice(0, 4)), Number(next.slice(5, 7)), schedule);
    }
    case "yearly": {
      const wanted = schedule.dayOfMonth ?? parseLocalDate(schedule.startDate).day;
      return formatLocalDate(year + 1, month, clampDay(year + 1, month, wanted));
    }
  }
}

/** The first occurrence strictly after `after`. */
export function nextOccurrenceAfter(schedule: Schedule, after: LocalDate): LocalDate {
  let candidate = firstOccurrence(schedule);
  // A guard instead of a formula: at most one step per period since the start.
  for (let guard = 0; candidate <= after && guard < 20_000; guard++) candidate = stepOccurrence(schedule, candidate);
  return candidate;
}

/**
 * Occurrences from `nextDue` (inclusive) up to `today` (inclusive), oldest first.
 * `limit` caps a long catch-up, for example a phone that was off for a year.
 */
export function dueOccurrences(schedule: Schedule, nextDue: LocalDate, today: LocalDate, limit = 12): LocalDate[] {
  const result: LocalDate[] = [];
  let current = nextDue;
  while (current <= today && result.length < limit) {
    result.push(current);
    current = stepOccurrence(schedule, current);
  }
  return result;
}
