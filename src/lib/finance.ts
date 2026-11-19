// The money math of VOIDSPEND. Pure functions over numbers and rows, no database
// and no React, so every rule is covered by a unit test. The v1 rules are kept:
// remaining is income minus spending and saving, the change against last month
// is null when there is nothing to compare with, and a budget is "near" from
// 80 percent and "over" above 100 percent.
import { addDays, addMonths, clampDay, daysBetween, monthOf, monthsBetween, parseLocalDate, type LocalDate, type YearMonth } from "./dates";

export type MonthTotals = {
  income: number;
  expense: number;
  savingDeposit: number;
  savingWithdrawal: number;
};

export const emptyTotals: MonthTotals = { income: 0, expense: 0, savingDeposit: 0, savingWithdrawal: 0 };

/** Money left in a month. Transfers between wallets never change it. */
export function remaining(totals: MonthTotals): number {
  return totals.income - totals.expense - totals.savingDeposit + totals.savingWithdrawal;
}

/** Share of income that was spent or saved, 0 to 1. Null when there is no income. */
export function spentShare(totals: MonthTotals): number | null {
  if (totals.income <= 0) return null;
  return (totals.expense + totals.savingDeposit - totals.savingWithdrawal) / totals.income;
}

/** Savings rate: net saved over income, null when there is no income. */
export function savingsRate(totals: MonthTotals): number | null {
  if (totals.income <= 0) return null;
  return (totals.savingDeposit - totals.savingWithdrawal) / totals.income;
}

/**
 * Change against the previous period in percent. Both zero is 0. A zero
 * baseline with a value has nothing to compare with, so it is null (v1 rule).
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export type BudgetStatus = "ok" | "near" | "over";

export type BudgetUsage = {
  /** Used share in percent, capped at 100 so a bar never overflows. */
  pct: number;
  status: BudgetStatus;
  left: number;
};

export const DEFAULT_ALERT_PCT = 80;

export function budgetUsage(spent: number, limit: number, alertPct: number = DEFAULT_ALERT_PCT): BudgetUsage {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const over = spent > limit;
  const near = !over && pct >= alertPct;
  return { pct, status: over ? "over" : near ? "near" : "ok", left: limit - spent };
}

export type BudgetRule = {
  categoryId: string;
  /** "YYYY-MM": the rule applies from this month until a later rule replaces it. */
  effectiveFrom: YearMonth;
  /** Null means no budget from that month on. */
  amount: number | null;
  alertPct: number;
};

/** The rule that applies to a category in a month, or null when there is none. */
export function effectiveBudget(rules: readonly BudgetRule[], categoryId: string, month: YearMonth): BudgetRule | null {
  let best: BudgetRule | null = null;
  for (const rule of rules) {
    if (rule.categoryId !== categoryId || rule.effectiveFrom > month) continue;
    if (!best || rule.effectiveFrom > best.effectiveFrom) best = rule;
  }
  return best && best.amount !== null ? best : null;
}

export type GoalProgress = {
  saved: number;
  target: number | null;
  /** 0 to 100, null when the goal has no target. */
  pct: number | null;
  left: number | null;
  reached: boolean;
};

export function goalProgress(saved: number, target: number | null): GoalProgress {
  if (target === null || target <= 0) return { saved, target: null, pct: null, left: null, reached: false };
  const pct = Math.max(0, Math.min((saved / target) * 100, 100));
  return { saved, target, pct, left: Math.max(0, target - saved), reached: saved >= target };
}

/**
 * What to put aside each month to reach a goal by its target date. The current
 * month counts as one of the months. Null when there is no target date, 0 when
 * the goal is already reached.
 */
export function monthlyNeed(left: number | null, targetDate: LocalDate | null, today: LocalDate): number | null {
  if (left === null || targetDate === null) return null;
  if (left <= 0) return 0;
  const months = monthsBetween(monthOf(today), monthOf(targetDate));
  return Math.ceil(left / Math.max(1, months));
}

/** The next payday strictly after `today`. A payday that is today means the next one. */
export function nextPayday(today: LocalDate, paydayDay: number): LocalDate {
  const { year, month, day } = parseLocalDate(today);
  const thisMonth = clampDay(year, month, paydayDay);
  if (day < thisMonth) return `${monthOf(today)}-${String(thisMonth).padStart(2, "0")}`;
  const next = addMonths(monthOf(today), 1);
  const [ny, nm] = [Number(next.slice(0, 4)), Number(next.slice(5, 7))];
  return `${next}-${String(clampDay(ny, nm, paydayDay)).padStart(2, "0")}`;
}

/**
 * What can be spent each day until the next payday without going below zero.
 * Today counts as a day. Rounded down so the number is never optimistic.
 */
export function safePerDay(remainingMoney: number, today: LocalDate, paydayDay: number): number {
  if (remainingMoney <= 0) return 0;
  const days = Math.max(1, daysBetween(today, nextPayday(today, paydayDay)));
  return Math.floor(remainingMoney / days);
}

/** The day before the next payday, the last day the money has to last. */
export function lastDayBeforePayday(today: LocalDate, paydayDay: number): LocalDate {
  return addDays(nextPayday(today, paydayDay), -1);
}

/**
 * Which budget line a new expense just crossed, if any: "near" when it went
 * from on track to the alert level, "over" when it went past the limit. An
 * expense that was already past a line does not alert again.
 */
export function budgetCrossing(spentBefore: number, spentAfter: number, limit: number, alertPct: number = DEFAULT_ALERT_PCT): "near" | "over" | null {
  const before = budgetUsage(spentBefore, limit, alertPct).status;
  const after = budgetUsage(spentAfter, limit, alertPct).status;
  if (before === after || before === "over") return null;
  return after === "over" ? "over" : "near";
}
