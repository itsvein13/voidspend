import { isValidLocalDate, type LocalDate } from "@/lib/dates";
import { goalProgress, type GoalProgress } from "@/lib/finance";
import { newId } from "@/lib/ids";

import { ValidationError, type Db } from "../types";

export type Goal = {
  id: string;
  name: string;
  categoryId: string | null;
  targetAmount: number | null;
  targetDate: LocalDate | null;
  archivedAt: number | null;
  /** Deposits minus withdrawals. */
  saved: number;
  progress: GoalProgress;
};

type Row = {
  id: string;
  name: string;
  category_id: string | null;
  target_amount: number | null;
  target_date: string | null;
  archived_at: number | null;
  saved: number;
};

const map = (row: Row): Goal => ({
  id: row.id,
  name: row.name,
  categoryId: row.category_id,
  targetAmount: row.target_amount,
  targetDate: row.target_date,
  archivedAt: row.archived_at,
  saved: row.saved,
  progress: goalProgress(row.saved, row.target_amount),
});

const SELECT = `
  SELECT g.id, g.name, g.category_id, g.target_amount, g.target_date, g.archived_at,
    COALESCE(SUM(CASE t.type WHEN 'saving_deposit' THEN t.amount WHEN 'saving_withdrawal' THEN -t.amount ELSE 0 END), 0) AS saved
  FROM goals g
  LEFT JOIN transactions t ON t.goal_id = g.id AND t.deleted_at IS NULL`;

export type GoalInput = {
  name: string;
  categoryId?: string | null;
  targetAmount?: number | null;
  targetDate?: LocalDate | null;
};

function validate(input: GoalInput): void {
  if (input.name.trim() === "") throw new ValidationError("name_required", "Give the goal a name.");
  if (input.targetAmount != null && (!Number.isSafeInteger(input.targetAmount) || input.targetAmount <= 0)) {
    throw new ValidationError("target_invalid", "The target must be a whole number above zero.");
  }
  if (input.targetDate != null && !isValidLocalDate(input.targetDate)) {
    throw new ValidationError("date_invalid", "The target date is not valid.");
  }
}

export async function createGoal(db: Db, input: GoalInput & { id?: string }, now: number = Date.now()): Promise<string> {
  validate(input);
  const id = input.id ?? newId();
  await db.runAsync(
    `INSERT INTO goals (id, name, category_id, target_amount, target_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, input.name.trim(), input.categoryId ?? null, input.targetAmount ?? null, input.targetDate ?? null, now, now],
  );
  return id;
}

export async function updateGoal(db: Db, id: string, input: GoalInput, now: number = Date.now()): Promise<void> {
  validate(input);
  await db.runAsync(
    "UPDATE goals SET name = ?, category_id = ?, target_amount = ?, target_date = ?, updated_at = ? WHERE id = ?",
    [input.name.trim(), input.categoryId ?? null, input.targetAmount ?? null, input.targetDate ?? null, now, id],
  );
}

export async function archiveGoal(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE goals SET archived_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
}

export async function listGoals(db: Db, options: { includeArchived?: boolean } = {}): Promise<Goal[]> {
  const rows = await db.getAllAsync<Row>(
    `${SELECT} ${options.includeArchived ? "" : "WHERE g.archived_at IS NULL"} GROUP BY g.id ORDER BY g.created_at, g.name`,
  );
  return rows.map(map);
}

export async function getGoal(db: Db, id: string): Promise<Goal | null> {
  const row = await db.getFirstAsync<Row>(`${SELECT} WHERE g.id = ? GROUP BY g.id`, [id]);
  return row ? map(row) : null;
}

export async function restoreGoal(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE goals SET archived_at = NULL, updated_at = ? WHERE id = ?", [now, id]);
}
