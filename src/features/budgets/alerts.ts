import { budgetStatuses } from "@/db/repo/budgets";
import type { Db } from "@/db/types";
import type { YearMonth } from "@/lib/dates";
import { budgetCrossing } from "@/lib/finance";

export type BudgetSnapshot = { spent: number; limit: number; alertPct: number };

/** What a category has spent against its limit in a month, or null when it has no budget. */
export async function budgetSnapshot(db: Db, categoryId: string, month: YearMonth): Promise<BudgetSnapshot | null> {
  const row = (await budgetStatuses(db, month)).find((status) => status.categoryId === categoryId);
  return row ? { spent: row.spent, limit: row.limit, alertPct: row.alertPct } : null;
}

/** The line a save just crossed, comparing the snapshots taken before and after it. */
export function crossingBetween(before: BudgetSnapshot | null, after: BudgetSnapshot | null): "near" | "over" | null {
  if (!after) return null;
  return budgetCrossing(before?.spent ?? 0, after.spent, after.limit, after.alertPct);
}
