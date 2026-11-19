// The month as a grid of days for the spending calendar. Pure: the same numbers feed the picture, the readout
// under it and the tests. Weeks start on Monday, as they do in Indonesia.
import type { DailyTotal } from "@/db/repo/transactions";
import { daysInMonth, weekdayOf, type LocalDate, type YearMonth } from "@/lib/dates";

/** 0 is a day with no spending. 1 to 5 grow with the amount. */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;
export const HEAT_STEPS = 5;

/**
 * Which step an amount falls in, against the busiest day of the month. The square root spreads the days out:
 * on a straight scale one large purchase would turn every ordinary day into the faintest step.
 */
export function heatStep(total: number, max: number): HeatStep {
  if (total <= 0 || max <= 0) return 0;
  return Math.min(HEAT_STEPS, Math.max(1, Math.ceil(Math.sqrt(total / max) * HEAT_STEPS))) as HeatStep;
}

export type DayCell = { date: LocalDate; day: number; total: number; step: HeatStep };

export type MonthGrid = {
  /** Rows of seven. A null is a blank before the 1st or after the last day. */
  weeks: (DayCell | null)[][];
  /** The most spent on one day. Zero when nothing was spent. */
  max: number;
  /** The day with the most spending, the earliest when two tie. Null when nothing was spent. */
  busiest: DayCell | null;
  total: number;
};

/** Monday first. 0 is Monday and 6 is Sunday. */
export const mondayIndex = (date: LocalDate): number => (weekdayOf(date) + 6) % 7;

/** The `weekdaysShort` of the strings, which start on Sunday, put in Monday-first order. */
export const mondayFirst = <T,>(sundayFirst: readonly T[]): T[] => [1, 2, 3, 4, 5, 6, 0].map((index) => sundayFirst[index]);

export function buildMonthGrid(month: YearMonth, daily: readonly DailyTotal[]): MonthGrid {
  const byDate = new Map(daily.map((entry) => [entry.date, entry.total]));
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const days = daysInMonth(year, monthNumber);
  const max = Math.max(0, ...daily.map((entry) => entry.total));

  const cells: (DayCell | null)[] = Array.from({ length: mondayIndex(`${month}-01`) }, () => null);
  let busiest: DayCell | null = null;
  let total = 0;
  for (let day = 1; day <= days; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const spent = byDate.get(date) ?? 0;
    const cell: DayCell = { date, day, total: spent, step: heatStep(spent, max) };
    total += spent;
    if (spent > 0 && (busiest === null || spent > busiest.total)) busiest = cell;
    cells.push(cell);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DayCell | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7));
  return { weeks, max, busiest, total };
}
