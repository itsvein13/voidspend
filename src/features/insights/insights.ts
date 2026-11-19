// What the Insights screen shows, worked out from the database for a month or a
// year. The change against the previous period keeps the v1 rule: no baseline
// means null, not infinity.
import { categoryTotalsRange, dailyExpenseTotals, merchantTotals, monthlyBars, rangeTotals, type CategoryTotal, type DailyTotal, type MerchantTotal, type MonthBar } from "@/db/repo/transactions";
import type { Db } from "@/db/types";
import { addMonths, monthEndExclusive, monthStart, type LocalDate, type YearMonth } from "@/lib/dates";
import { pctChange, remaining, savingsRate, type MonthTotals } from "@/lib/finance";

export type Period = { kind: "month"; month: YearMonth } | { kind: "year"; year: number };

export function periodRange(period: Period): { from: LocalDate; endExclusive: LocalDate } {
  if (period.kind === "month") return { from: monthStart(period.month), endExclusive: monthEndExclusive(period.month) };
  return { from: `${String(period.year).padStart(4, "0")}-01-01`, endExclusive: `${String(period.year + 1).padStart(4, "0")}-01-01` };
}

export function previousPeriod(period: Period): Period {
  return period.kind === "month" ? { kind: "month", month: addMonths(period.month, -1) } : { kind: "year", year: period.year - 1 };
}

export function shiftPeriod(period: Period, delta: number): Period {
  return period.kind === "month" ? { kind: "month", month: addMonths(period.month, delta) } : { kind: "year", year: period.year + delta };
}

/** The months drawn as bars: the six ending at a month, or all twelve of a year. */
export function barMonths(period: Period): { from: YearMonth; to: YearMonth } {
  if (period.kind === "year") return { from: `${String(period.year).padStart(4, "0")}-01`, to: `${String(period.year).padStart(4, "0")}-12` };
  return { from: addMonths(period.month, -5), to: period.month };
}

export type Change = { income: number | null; expense: number | null; saving: number | null };

export type InsightsData = {
  period: Period;
  /** The wallet the numbers are for, or null for all of them. */
  walletId: string | null;
  totals: MonthTotals;
  previous: MonthTotals;
  left: number;
  savingsRate: number | null;
  changes: Change;
  categories: CategoryTotal[];
  bars: MonthBar[];
  merchants: MerchantTotal[];
  /** Spending per day, for the calendar. Only a month has one, so a year leaves it empty. */
  daily: DailyTotal[];
  hasData: boolean;
};

const netSaved = (totals: MonthTotals) => totals.savingDeposit - totals.savingWithdrawal;

/** The numbers for a period, for all wallets or for one. Transfers are in neither: moving money is not earning or spending it. */
export async function loadInsights(db: Db, period: Period, walletId: string | null = null): Promise<InsightsData> {
  const { from, endExclusive } = periodRange(period);
  const before = periodRange(previousPeriod(period));
  const { from: barFrom, to: barTo } = barMonths(period);
  const wallet = walletId ?? undefined;
  const [totals, previous, categories, bars, merchants, daily] = await Promise.all([
    rangeTotals(db, from, endExclusive, wallet),
    rangeTotals(db, before.from, before.endExclusive, wallet),
    categoryTotalsRange(db, from, endExclusive, "expense", wallet),
    monthlyBars(db, barFrom, barTo, wallet),
    merchantTotals(db, from, endExclusive, 5, wallet),
    period.kind === "month" ? dailyExpenseTotals(db, period.month, wallet) : Promise.resolve([]),
  ]);
  return {
    period,
    walletId,
    totals,
    previous,
    left: remaining(totals),
    savingsRate: savingsRate(totals),
    changes: {
      income: pctChange(totals.income, previous.income),
      expense: pctChange(totals.expense, previous.expense),
      saving: pctChange(netSaved(totals), netSaved(previous)),
    },
    categories,
    bars,
    merchants,
    daily,
    hasData: totals.income + totals.expense + totals.savingDeposit + totals.savingWithdrawal > 0,
  };
}
