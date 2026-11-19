// The filters of the History screen that do not come from a link: an amount range, receipt, place. Pure and free
// of React so the rules (what counts as a filter, how a range is read, what a date preset means) have unit tests.
import type { TransactionFilter } from "@/db/repo/transactions";
import { addDays, addMonths, monthEndExclusive, monthOf, monthStart, type LocalDate } from "@/lib/dates";
import { parseFormattedNumber } from "@/utils/format";

export type ExtraFilters = {
  /** The minimum amount as typed (digits grouped by dots), blank for none. */
  min: string;
  max: string;
  hasReceipt: boolean;
  hasLocation: boolean;
  /** Part of the name of a saved place. */
  place: string;
};

export const NO_EXTRA: ExtraFilters = { min: "", max: "", hasReceipt: false, hasLocation: false, place: "" };

/**
 * The repository filter for these. A blank amount is no limit. A minimum above the maximum is swapped, so a range
 * typed the wrong way round still finds what the person meant.
 */
export function extraToFilter(extra: ExtraFilters): Pick<TransactionFilter, "minAmount" | "maxAmount" | "hasReceipt" | "hasLocation" | "place"> {
  let min = extra.min.trim() === "" ? undefined : parseFormattedNumber(extra.min);
  let max = extra.max.trim() === "" ? undefined : parseFormattedNumber(extra.max);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  return {
    minAmount: min,
    maxAmount: max,
    hasReceipt: extra.hasReceipt || undefined,
    hasLocation: extra.hasLocation || undefined,
    place: extra.place.trim() || undefined,
  };
}

/** How many of these filters are on. A range counts once however many ends it has. */
export function extraCount(extra: ExtraFilters): number {
  return (extra.min.trim() !== "" || extra.max.trim() !== "" ? 1 : 0) + (extra.hasReceipt ? 1 : 0) + (extra.hasLocation ? 1 : 0) + (extra.place.trim() !== "" ? 1 : 0);
}

export type DatePreset = "thisMonth" | "lastMonth" | "last30" | "thisYear";
export const DATE_PRESETS: readonly DatePreset[] = ["thisMonth", "lastMonth", "last30", "thisYear"];

/** The first and last day, both included. */
export function presetRange(preset: DatePreset, today: LocalDate): { from: LocalDate; to: LocalDate } {
  const month = monthOf(today);
  switch (preset) {
    case "thisMonth":
      return { from: monthStart(month), to: addDays(monthEndExclusive(month), -1) };
    case "lastMonth": {
      const last = addMonths(month, -1);
      return { from: monthStart(last), to: addDays(monthEndExclusive(last), -1) };
    }
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "thisYear":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
}

/** The preset a range equals, so its chip can show as selected. Null for any other range. */
export function presetOf(from: LocalDate | undefined, to: LocalDate | undefined, today: LocalDate): DatePreset | null {
  if (!from || !to) return null;
  return DATE_PRESETS.find((preset) => {
    const range = presetRange(preset, today);
    return range.from === from && range.to === to;
  }) ?? null;
}
