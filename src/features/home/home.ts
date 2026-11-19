import { budgetStatuses, type BudgetStatusRow } from "@/db/repo/budgets";
import { listRecurringRules, pendingOccurrences, type PendingOccurrence } from "@/db/repo/recurring";
import { listTransactions, monthTotals, type Transaction } from "@/db/repo/transactions";
import type { Db } from "@/db/types";
import { monthOf, parseLocalDate, type LocalDate, type YearMonth } from "@/lib/dates";
import { remaining, safePerDay, type MonthTotals } from "@/lib/finance";

export type HomeData = {
  month: YearMonth;
  today: LocalDate;
  totals: MonthTotals;
  left: number;
  /** The day of the month the salary arrives, from the salary rule. Null without one. */
  paydayDay: number | null;
  /** Only for the current month, and only when something is left. */
  safePerDay: number | null;
  /** Recurring items waiting for Record or Skip. */
  pending: PendingOccurrence[];
  /** Budgets of this month, the closest to their limit first. */
  budgets: BudgetStatusRow[];
  recent: Transaction[];
  hasSalaryRule: boolean;
};

export async function loadHome(db: Db, month: YearMonth, today: LocalDate): Promise<HomeData> {
  const [totals, pending, budgets, recent, rules] = await Promise.all([
    monthTotals(db, month),
    pendingOccurrences(db, today),
    budgetStatuses(db, month),
    listTransactions(db, { month, limit: 5 }),
    listRecurringRules(db),
  ]);

  const salaryRule = rules.find((rule) => rule.type === "income" && rule.categoryId === "sys_salary" && rule.frequency === "monthly" && rule.pausedAt === null);
  const paydayDay = salaryRule ? (salaryRule.dayOfMonth ?? parseLocalDate(salaryRule.startDate).day) : null;
  const left = remaining(totals);

  return {
    month,
    today,
    totals,
    left,
    paydayDay,
    safePerDay: month === monthOf(today) && paydayDay !== null && left > 0 ? safePerDay(left, today, paydayDay) : null,
    pending,
    budgets: [...budgets].sort((a, b) => b.usage.pct - a.usage.pct),
    recent,
    hasSalaryRule: salaryRule !== undefined,
  };
}
