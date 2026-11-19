import { isValidYearMonth, type YearMonth } from "@/lib/dates";
import { budgetUsage, effectiveBudget, type BudgetRule, type BudgetUsage } from "@/lib/finance";
import { newId } from "@/lib/ids";

import { ValidationError, type Db } from "../types";
import { categoryTotals } from "./transactions";

type Row = { category_id: string; effective_from: string; amount: number | null; alert_pct: number };

export async function listBudgetRules(db: Db): Promise<BudgetRule[]> {
  const rows = await db.getAllAsync<Row>("SELECT category_id, effective_from, amount, alert_pct FROM budgets ORDER BY category_id, effective_from");
  return rows.map((row) => ({
    categoryId: row.category_id,
    effectiveFrom: row.effective_from,
    amount: row.amount,
    alertPct: row.alert_pct,
  }));
}

/**
 * Sets a category's limit from a month on. It applies to that month and every
 * later one until another rule replaces it, so changing it does not rewrite
 * history. An amount of null means "no budget from this month on".
 */
export async function setBudget(
  db: Db,
  input: { categoryId: string; effectiveFrom: YearMonth; amount: number | null; alertPct?: number },
  now: number = Date.now(),
): Promise<void> {
  if (!isValidYearMonth(input.effectiveFrom)) throw new ValidationError("month_invalid", "The month is not valid.");
  if (input.amount !== null && (!Number.isSafeInteger(input.amount) || input.amount <= 0)) {
    throw new ValidationError("amount_invalid", "The limit must be a whole number above zero.");
  }
  const alertPct = input.alertPct ?? 80;
  if (!Number.isInteger(alertPct) || alertPct < 1 || alertPct > 100) {
    throw new ValidationError("alert_invalid", "The alert level must be between 1 and 100 percent.");
  }
  await db.runAsync(
    `INSERT INTO budgets (id, category_id, effective_from, amount, alert_pct, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(category_id, effective_from) DO UPDATE SET amount = excluded.amount, alert_pct = excluded.alert_pct, updated_at = excluded.updated_at`,
    [newId(), input.categoryId, input.effectiveFrom, input.amount, alertPct, now, now],
  );
}

export type BudgetStatusRow = {
  categoryId: string;
  limit: number;
  alertPct: number;
  spent: number;
  usage: BudgetUsage;
};

/** Every category with a budget in `month`, with what was spent and how close it is. */
export async function budgetStatuses(db: Db, month: YearMonth): Promise<BudgetStatusRow[]> {
  const [rules, totals] = await Promise.all([listBudgetRules(db), categoryTotals(db, month, "expense")]);
  const spentBy = new Map(totals.map((total) => [total.categoryId, total.total]));
  const result: BudgetStatusRow[] = [];
  for (const categoryId of new Set(rules.map((rule) => rule.categoryId))) {
    const rule = effectiveBudget(rules, categoryId, month);
    if (!rule || rule.amount === null) continue;
    const spent = spentBy.get(categoryId) ?? 0;
    result.push({ categoryId, limit: rule.amount, alertPct: rule.alertPct, spent, usage: budgetUsage(spent, rule.amount, rule.alertPct) });
  }
  return result;
}
