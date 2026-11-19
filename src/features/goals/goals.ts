import { DEFAULT_WALLET_ID, ValidationError, type Db } from "@/db/types";
import type { Goal } from "@/db/repo/goals";
import type { LocalDate } from "@/lib/dates";
import { monthlyNeed } from "@/lib/finance";

/** A withdrawal can never take out more than the goal holds. `excludeId` leaves out the row being edited. */
export async function assertCanWithdraw(db: Db, goalId: string, amount: number, excludeId?: string): Promise<void> {
  const row = await db.getFirstAsync<{ saved: number }>(
    `SELECT COALESCE(SUM(CASE type WHEN 'saving_deposit' THEN amount WHEN 'saving_withdrawal' THEN -amount ELSE 0 END), 0) AS saved
     FROM transactions WHERE goal_id = ? AND deleted_at IS NULL AND id <> ?`,
    [goalId, excludeId ?? ""],
  );
  if (amount > (row?.saved ?? 0)) throw new ValidationError("insufficient_saved", "The goal does not hold that much.");
}

export type GoalWalletShare = { walletId: string; net: number };

/**
 * What each wallet has put into a goal, net of what it took back: deposits minus withdrawals. A transaction with
 * no wallet counts for the main one. A wallet whose deposits and withdrawals cancel is left out. Most to least.
 */
export async function goalWalletSplit(db: Db, goalId: string): Promise<GoalWalletShare[]> {
  const rows = await db.getAllAsync<{ id: string; net: number }>(
    `SELECT COALESCE(wallet_id, ?) AS id,
            SUM(CASE type WHEN 'saving_deposit' THEN amount WHEN 'saving_withdrawal' THEN -amount ELSE 0 END) AS net
       FROM transactions WHERE goal_id = ? AND deleted_at IS NULL
      GROUP BY 1 HAVING net <> 0 ORDER BY net DESC, id`,
    [DEFAULT_WALLET_ID, goalId],
  );
  return rows.map((row) => ({ walletId: row.id, net: row.net }));
}

/** What to put aside each month to reach the goal by its date, or null without a date. */
export const goalNeedPerMonth = (goal: Pick<Goal, "progress" | "targetDate">, today: LocalDate): number | null =>
  monthlyNeed(goal.progress.left, goal.targetDate, today);

/** All the money in active goals. */
export const totalSaved = (goals: readonly Pick<Goal, "saved">[]): number => goals.reduce((sum, goal) => sum + goal.saved, 0);
