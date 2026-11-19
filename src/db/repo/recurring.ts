import { epochFromLocal, isValidLocalDate, type LocalDate } from "@/lib/dates";
import { newId } from "@/lib/ids";
import { dueOccurrences, firstOccurrence, nextOccurrenceAfter, stepOccurrence, type Frequency, type Schedule } from "@/lib/recurrence";

import { ValidationError, type Db } from "../types";
import { createTransaction } from "./transactions";
import { getWallet } from "./wallets";

export type RecurringType = "expense" | "income" | "saving_deposit";
export type RecurringMode = "confirm" | "auto";

export type RecurringRule = {
  id: string;
  type: RecurringType;
  amount: number;
  title: string;
  counterparty: string | null;
  categoryId: string | null;
  goalId: string | null;
  walletId: string | null;
  frequency: Frequency;
  dayOfMonth: number | null;
  weekday: number | null;
  startDate: LocalDate;
  endDate: LocalDate | null;
  nextDueDate: LocalDate;
  mode: RecurringMode;
  remind: boolean;
  pausedAt: number | null;
};

type Row = {
  id: string;
  type: RecurringType;
  amount: number;
  title: string;
  counterparty: string | null;
  category_id: string | null;
  goal_id: string | null;
  wallet_id: string | null;
  frequency: Frequency;
  day_of_month: number | null;
  weekday: number | null;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  mode: RecurringMode;
  remind: number;
  paused_at: number | null;
};

const map = (row: Row): RecurringRule => ({
  id: row.id,
  type: row.type,
  amount: row.amount,
  title: row.title,
  counterparty: row.counterparty,
  categoryId: row.category_id,
  goalId: row.goal_id,
  walletId: row.wallet_id,
  frequency: row.frequency,
  dayOfMonth: row.day_of_month,
  weekday: row.weekday,
  startDate: row.start_date,
  endDate: row.end_date,
  nextDueDate: row.next_due_date,
  mode: row.mode,
  remind: row.remind === 1,
  pausedAt: row.paused_at,
});

export const scheduleOf = (rule: RecurringRule): Schedule => ({
  frequency: rule.frequency,
  dayOfMonth: rule.dayOfMonth,
  weekday: rule.weekday,
  startDate: rule.startDate,
});

export type NewRecurringRule = {
  type: RecurringType;
  amount: number;
  title: string;
  counterparty?: string | null;
  categoryId?: string | null;
  goalId?: string | null;
  walletId?: string | null;
  frequency: Frequency;
  dayOfMonth?: number | null;
  weekday?: number | null;
  startDate: LocalDate;
  endDate?: LocalDate | null;
  mode?: RecurringMode;
  remind?: boolean;
};

export async function createRecurringRule(db: Db, input: NewRecurringRule, now: number = Date.now()): Promise<string> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ValidationError("amount_invalid", "The amount must be above zero.");
  if (input.title.trim() === "") throw new ValidationError("title_required", "Give it a title.");
  if (!isValidLocalDate(input.startDate)) throw new ValidationError("date_invalid", "The start date is not valid.");
  if (input.endDate != null && (!isValidLocalDate(input.endDate) || input.endDate < input.startDate)) {
    throw new ValidationError("date_invalid", "The end date must not be before the start.");
  }
  if (input.type === "saving_deposit" ? !input.goalId : !input.categoryId) {
    throw new ValidationError(input.type === "saving_deposit" ? "goal_required" : "category_required", "Pick where it belongs.");
  }

  const schedule: Schedule = {
    frequency: input.frequency,
    dayOfMonth: input.dayOfMonth ?? null,
    weekday: input.weekday ?? null,
    startDate: input.startDate,
  };
  const id = newId();
  await db.runAsync(
    `INSERT INTO recurring_rules (id, type, amount, title, counterparty, category_id, goal_id, wallet_id, frequency,
       day_of_month, weekday, start_date, end_date, next_due_date, mode, remind, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.type,
      input.amount,
      input.title.trim(),
      input.counterparty?.trim() || null,
      input.categoryId ?? null,
      input.goalId ?? null,
      input.walletId ?? "wal_default",
      input.frequency,
      schedule.dayOfMonth,
      schedule.weekday,
      input.startDate,
      input.endDate ?? null,
      firstOccurrence(schedule),
      input.mode ?? "confirm",
      input.remind ? 1 : 0,
      now,
      now,
    ],
  );
  return id;
}

export async function listRecurringRules(db: Db): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM recurring_rules ORDER BY next_due_date, title");
  return rows.map(map);
}

export async function getRecurringRule(db: Db, id: string): Promise<RecurringRule | null> {
  const row = await db.getFirstAsync<Row>("SELECT * FROM recurring_rules WHERE id = ?", [id]);
  return row ? map(row) : null;
}

export async function setRecurringPaused(db: Db, id: string, paused: boolean, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE recurring_rules SET paused_at = ?, updated_at = ? WHERE id = ?", [paused ? now : null, now, id]);
}

/** Where a posted occurrence is dated: noon in the person's zone, so the date survives any zone shift. */
export type Clock = { offsetMin: number; tz: string; now: number };

export type PendingOccurrence = { rule: RecurringRule; dates: LocalDate[] };

function dueFor(rule: RecurringRule, today: LocalDate): LocalDate[] {
  if (rule.pausedAt !== null) return [];
  const until = rule.endDate !== null && rule.endDate < today ? rule.endDate : today;
  return dueOccurrences(scheduleOf(rule), rule.nextDueDate, until);
}

/** Rules in "confirm" mode that are due: Home offers Record, Skip, Edit for each. */
export async function pendingOccurrences(db: Db, today: LocalDate): Promise<PendingOccurrence[]> {
  const rules = (await listRecurringRules(db)).filter((rule) => rule.mode === "confirm");
  return rules.map((rule) => ({ rule, dates: dueFor(rule, today) })).filter((pending) => pending.dates.length > 0);
}

async function advance(db: Db, rule: RecurringRule, afterDate: LocalDate, now: number): Promise<void> {
  const next = nextOccurrenceAfter(scheduleOf(rule), afterDate);
  await db.runAsync("UPDATE recurring_rules SET next_due_date = ?, updated_at = ? WHERE id = ?", [next, now, rule.id]);
}

/**
 * Records one occurrence as a transaction and moves the rule forward. Safe to
 * call twice for the same day: the unique index on (rule, day) stops a second
 * row, and the rule still advances.
 */
export async function postOccurrence(db: Db, rule: RecurringRule, date: LocalDate, clock: Clock, overrides: { amount?: number } = {}): Promise<boolean> {
  let posted = false;
  await db.withTransactionAsync(async () => {
    const exists = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM transactions WHERE recurring_rule_id = ? AND occurred_local_date = ?",
      [rule.id, date],
    );
    if (!exists) {
      await createTransaction(
        db,
        {
          type: rule.type,
          amount: overrides.amount ?? rule.amount,
          title: rule.title,
          counterparty: rule.counterparty,
          categoryId: rule.categoryId,
          goalId: rule.goalId,
          walletId: rule.walletId,
          occurredAt: epochFromLocal(date, 12, 0, clock.offsetMin),
          offsetMin: clock.offsetMin,
          tz: clock.tz,
          timePrecision: "date",
          source: "recurring",
          recurringRuleId: rule.id,
        },
        clock.now,
      );
      posted = true;
    }
    await advance(db, rule, date, clock.now);
  });
  return posted;
}

/** "Skip" in the pending card: nothing is recorded, the rule just moves on. */
export async function skipOccurrence(db: Db, rule: RecurringRule, date: LocalDate, now: number = Date.now()): Promise<void> {
  await advance(db, rule, date, now);
}

/** Posts every due occurrence of the rules in "auto" mode. Returns how many were recorded. */
export async function runAutoRecurring(db: Db, today: LocalDate, clock: Clock): Promise<number> {
  const rules = (await listRecurringRules(db)).filter((rule) => rule.mode === "auto");
  let count = 0;
  for (const rule of rules) {
    let current = rule;
    for (const date of dueFor(rule, today)) {
      if (await postOccurrence(db, current, date, clock)) count++;
      current = { ...current, nextDueDate: stepOccurrence(scheduleOf(rule), date) };
    }
  }
  return count;
}

/** The latest salary entry, used to offer "make this a recurring salary" after the v1 import. */
export async function latestSalary(db: Db): Promise<{ amount: number; date: LocalDate } | null> {
  const row = await db.getFirstAsync<{ amount: number; occurred_local_date: string }>(
    `SELECT amount, occurred_local_date FROM transactions
     WHERE deleted_at IS NULL AND type = 'income' AND category_id = 'sys_salary'
     ORDER BY occurred_local_date DESC, occurred_at DESC LIMIT 1`,
  );
  return row ? { amount: row.amount, date: row.occurred_local_date } : null;
}

/** Changes what a rule records next time, never what it already recorded. The wallet is the one the next entry goes into. */
export async function updateRecurringRule(
  db: Db,
  id: string,
  patch: { amount?: number; mode?: RecurringMode; title?: string; walletId?: string; remind?: boolean },
  now: number = Date.now(),
): Promise<void> {
  if (patch.amount !== undefined && (!Number.isSafeInteger(patch.amount) || patch.amount <= 0)) throw new ValidationError("amount_invalid", "The amount must be above zero.");
  if (patch.title !== undefined && patch.title.trim() === "") throw new ValidationError("title_required", "Give it a title.");
  const current = await getRecurringRule(db, id);
  if (!current) throw new ValidationError("not_found", "That rule no longer exists.");
  if (patch.walletId !== undefined && !(await getWallet(db, patch.walletId))) throw new ValidationError("not_found", "That wallet no longer exists.");
  await db.runAsync("UPDATE recurring_rules SET amount = ?, mode = ?, title = ?, wallet_id = ?, remind = ?, updated_at = ? WHERE id = ?", [
    patch.amount ?? current.amount,
    patch.mode ?? current.mode,
    patch.title?.trim() ?? current.title,
    patch.walletId ?? current.walletId,
    (patch.remind ?? current.remind) ? 1 : 0,
    now,
    id,
  ]);
}
