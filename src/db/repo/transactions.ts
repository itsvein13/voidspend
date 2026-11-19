import { addMonths, localDateOf, monthEndExclusive, monthStart, type LocalDate, type YearMonth } from "@/lib/dates";
import type { MonthTotals } from "@/lib/finance";
import { newId } from "@/lib/ids";

import {
  DEFAULT_WALLET_ID,
  ValidationError,
  type Db,
  type SqlValue,
  type TimePrecision,
  type TransactionSource,
  type TransactionType,
} from "../types";

export type Location = {
  name: string | null;
  lat: number | null;
  lng: number | null;
  source: "device" | "manual" | "receipt";
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  title: string;
  counterparty: string | null;
  categoryId: string | null;
  goalId: string | null;
  walletId: string | null;
  toWalletId: string | null;
  paymentMethod: string | null;
  note: string | null;
  /** UTC epoch in milliseconds of the real event. */
  occurredAt: number;
  occurredTz: string;
  occurredOffsetMin: number;
  occurredLocalDate: LocalDate;
  timePrecision: TimePrecision;
  source: TransactionSource;
  location: Location | null;
  receiptId: string | null;
  recurringRuleId: string | null;
  legacyRef: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type NewTransaction = {
  id?: string;
  type: TransactionType;
  amount: number;
  title: string;
  counterparty?: string | null;
  categoryId?: string | null;
  goalId?: string | null;
  walletId?: string | null;
  toWalletId?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
  occurredAt: number;
  /** UTC offset in minutes where the event happened, for example 420. */
  offsetMin: number;
  /** IANA zone, for example "Asia/Jakarta". */
  tz: string;
  timePrecision: TimePrecision;
  source?: TransactionSource;
  location?: Location | null;
  receiptId?: string | null;
  recurringRuleId?: string | null;
  legacyRef?: string | null;
  /** For imported rows: the moment the row was really created. Defaults to now. */
  createdAt?: number;
};

type Row = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  title: string;
  counterparty: string | null;
  category_id: string | null;
  goal_id: string | null;
  wallet_id: string | null;
  to_wallet_id: string | null;
  payment_method: string | null;
  note: string | null;
  occurred_at: number;
  occurred_tz: string;
  occurred_offset_min: number;
  occurred_local_date: string;
  time_precision: TimePrecision;
  source: TransactionSource;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_source: "device" | "manual" | "receipt" | null;
  receipt_id: string | null;
  recurring_rule_id: string | null;
  legacy_ref: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export function mapTransaction(row: Row): Transaction {
  const hasLocation = row.location_source !== null;
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    title: row.title,
    counterparty: row.counterparty,
    categoryId: row.category_id,
    goalId: row.goal_id,
    walletId: row.wallet_id,
    toWalletId: row.to_wallet_id,
    paymentMethod: row.payment_method,
    note: row.note,
    occurredAt: row.occurred_at,
    occurredTz: row.occurred_tz,
    occurredOffsetMin: row.occurred_offset_min,
    occurredLocalDate: row.occurred_local_date,
    timePrecision: row.time_precision,
    source: row.source,
    location: hasLocation
      ? { name: row.location_name, lat: row.location_lat, lng: row.location_lng, source: row.location_source! }
      : null,
    receiptId: row.receipt_id,
    recurringRuleId: row.recurring_rule_id,
    legacyRef: row.legacy_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const TIME_PRECISIONS: readonly TimePrecision[] = ["exact", "date", "estimated"];

/** Checks what the database constraints would also catch, but with a code the UI can explain. */
export function validateNewTransaction(input: NewTransaction): void {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("amount_invalid", "The amount must be a whole number above zero.");
  }
  const title = input.title.trim();
  if (title === "") throw new ValidationError("title_required", "Give the transaction a title.");
  if (title.length > 120) throw new ValidationError("title_too_long", "The title is longer than 120 characters.");

  const isSaving = input.type === "saving_deposit" || input.type === "saving_withdrawal";
  if ((input.type === "expense" || input.type === "income") && !input.categoryId) {
    throw new ValidationError("category_required", "Pick a category.");
  }
  if (isSaving && !input.goalId) throw new ValidationError("goal_required", "Pick a goal.");
  if (!isSaving && input.goalId) throw new ValidationError("goal_not_allowed", "Only savings belong to a goal.");
  if (input.type === "transfer") {
    if (!input.toWalletId || input.toWalletId === input.walletId) {
      throw new ValidationError("transfer_wallets", "A transfer needs two different wallets.");
    }
  }
  if (!Number.isSafeInteger(input.occurredAt)) throw new ValidationError("time_invalid", "The date is not valid.");
  if (!Number.isInteger(input.offsetMin) || Math.abs(input.offsetMin) > 14 * 60) {
    throw new ValidationError("time_invalid", "The time zone offset is not valid.");
  }
  if (input.tz.trim() === "") throw new ValidationError("time_invalid", "The time zone is missing.");
  if (!TIME_PRECISIONS.includes(input.timePrecision)) throw new ValidationError("time_invalid", "Unknown time precision.");
}

// About 110 m. A place is enough for a spending history, a doorstep is not needed.
const roundCoordinate = (value: number | null) => (value === null ? null : Math.round(value * 1000) / 1000);

function toParams(input: NewTransaction, id: string, now: number, createdAt: number, deletedAt: number | null): SqlValue[] {
  const location = input.location ?? null;
  return [
    id,
    input.type,
    input.amount,
    input.title.trim(),
    input.counterparty?.trim() || null,
    input.categoryId ?? null,
    input.goalId ?? null,
    input.walletId === undefined ? DEFAULT_WALLET_ID : input.walletId,
    input.toWalletId ?? null,
    input.paymentMethod ?? null,
    input.note?.trim() || null,
    input.occurredAt,
    input.tz,
    input.offsetMin,
    localDateOf(input.occurredAt, input.offsetMin),
    input.timePrecision,
    input.source ?? "manual",
    location?.name ?? null,
    roundCoordinate(location?.lat ?? null),
    roundCoordinate(location?.lng ?? null),
    location?.source ?? null,
    input.receiptId ?? null,
    input.recurringRuleId ?? null,
    input.legacyRef ?? null,
    createdAt,
    now,
    deletedAt,
  ];
}

const INSERT_SQL = `INSERT INTO transactions (
  id, type, amount, title, counterparty, category_id, goal_id, wallet_id, to_wallet_id, payment_method, note,
  occurred_at, occurred_tz, occurred_offset_min, occurred_local_date, time_precision, source,
  location_name, location_lat, location_lng, location_source, receipt_id, recurring_rule_id, legacy_ref,
  created_at, updated_at, deleted_at
) VALUES (${new Array(27).fill("?").join(",")})`;

export async function createTransaction(db: Db, input: NewTransaction, now: number = Date.now()): Promise<string> {
  validateNewTransaction(input);
  const id = input.id ?? newId();
  // A new row has not been edited yet, so created and updated are the same moment.
  const created = input.createdAt ?? now;
  await db.runAsync(INSERT_SQL, toParams(input, id, created, created, null));
  return id;
}

export async function getTransaction(db: Db, id: string): Promise<Transaction | null> {
  const row = await db.getFirstAsync<Row>("SELECT * FROM transactions WHERE id = ?", [id]);
  return row ? mapTransaction(row) : null;
}

export type TransactionPatch = Partial<Omit<NewTransaction, "id" | "source" | "legacyRef" | "recurringRuleId">>;

/** Edits a transaction. `created_at`, the source and the legacy reference never change. */
export async function updateTransaction(db: Db, id: string, patch: TransactionPatch, now: number = Date.now()): Promise<void> {
  const current = await getTransaction(db, id);
  if (!current || current.deletedAt !== null) throw new ValidationError("not_found", "That transaction no longer exists.");

  const merged: NewTransaction = {
    type: patch.type ?? current.type,
    amount: patch.amount ?? current.amount,
    title: patch.title ?? current.title,
    counterparty: patch.counterparty === undefined ? current.counterparty : patch.counterparty,
    categoryId: patch.categoryId === undefined ? current.categoryId : patch.categoryId,
    goalId: patch.goalId === undefined ? current.goalId : patch.goalId,
    walletId: patch.walletId === undefined ? current.walletId : patch.walletId,
    toWalletId: patch.toWalletId === undefined ? current.toWalletId : patch.toWalletId,
    paymentMethod: patch.paymentMethod === undefined ? current.paymentMethod : patch.paymentMethod,
    note: patch.note === undefined ? current.note : patch.note,
    occurredAt: patch.occurredAt ?? current.occurredAt,
    offsetMin: patch.offsetMin ?? current.occurredOffsetMin,
    tz: patch.tz ?? current.occurredTz,
    timePrecision: patch.timePrecision ?? current.timePrecision,
    location: patch.location === undefined ? current.location : patch.location,
    receiptId: patch.receiptId === undefined ? current.receiptId : patch.receiptId,
    source: current.source,
    recurringRuleId: current.recurringRuleId,
    legacyRef: current.legacyRef,
  };
  validateNewTransaction(merged);

  const params = toParams(merged, id, now, current.createdAt, null);
  await db.runAsync(
    `UPDATE transactions SET
      type = ?2, amount = ?3, title = ?4, counterparty = ?5, category_id = ?6, goal_id = ?7, wallet_id = ?8,
      to_wallet_id = ?9, payment_method = ?10, note = ?11, occurred_at = ?12, occurred_tz = ?13,
      occurred_offset_min = ?14, occurred_local_date = ?15, time_precision = ?16,
      location_name = ?18, location_lat = ?19, location_lng = ?20, location_source = ?21,
      receipt_id = ?22, updated_at = ?26
     WHERE id = ?1`,
    // The statement names parameters 1 to 26. Numbered parameters need exactly that many values.
    params.slice(0, 26),
  );
}

/** Soft delete: the row stays for Undo and for "recently deleted". */
export async function softDeleteTransaction(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", [now, now, id]);
}

export async function restoreTransaction(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE id = ?", [now, id]);
}

export const RECENTLY_DELETED_DAYS = 30;

/** Removes rows deleted more than 30 days ago for good. Returns how many. */
export async function purgeDeleted(db: Db, now: number = Date.now()): Promise<number> {
  const cutoff = now - RECENTLY_DELETED_DAYS * 86_400_000;
  const result = await db.runAsync("DELETE FROM transactions WHERE deleted_at IS NOT NULL AND deleted_at < ?", [cutoff]);
  return result.changes;
}

export type TransactionFilter = {
  month?: YearMonth;
  fromDate?: LocalDate;
  /** Inclusive. */
  toDate?: LocalDate;
  types?: readonly TransactionType[];
  categoryId?: string;
  goalId?: string;
  /** One wallet: what was recorded in it, and transfers that moved money into it. */
  walletId?: string;
  /** Matches title, counterparty, note, the name of a saved place and the name of a tag. */
  search?: string;
  /** Only transactions that carry this tag (its id). */
  tagId?: string;
  /** True: only those with a receipt. False or left out: no condition. */
  hasReceipt?: boolean;
  /** True: only those with a saved place. False or left out: no condition. */
  hasLocation?: boolean;
  /** Matches the name of the saved place. */
  place?: string;
  minAmount?: number;
  maxAmount?: number;
  onlyDeleted?: boolean;
  limit?: number;
  offset?: number;
};

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export async function listTransactions(db: Db, filter: TransactionFilter = {}): Promise<Transaction[]> {
  const where: string[] = [filter.onlyDeleted ? "deleted_at IS NOT NULL" : "deleted_at IS NULL"];
  const params: SqlValue[] = [];

  if (filter.month) {
    where.push("occurred_local_date >= ? AND occurred_local_date < ?");
    params.push(monthStart(filter.month), monthEndExclusive(filter.month));
  }
  if (filter.fromDate) {
    where.push("occurred_local_date >= ?");
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    where.push("occurred_local_date <= ?");
    params.push(filter.toDate);
  }
  if (filter.types && filter.types.length > 0) {
    where.push(`type IN (${filter.types.map(() => "?").join(",")})`);
    params.push(...filter.types);
  }
  if (filter.categoryId) {
    where.push("category_id = ?");
    params.push(filter.categoryId);
  }
  if (filter.goalId) {
    where.push("goal_id = ?");
    params.push(filter.goalId);
  }
  if (filter.walletId) {
    where.push("(COALESCE(wallet_id, ?) = ? OR to_wallet_id = ?)");
    params.push(DEFAULT_WALLET_ID, filter.walletId, filter.walletId);
  }
  if (filter.minAmount !== undefined) {
    where.push("amount >= ?");
    params.push(filter.minAmount);
  }
  if (filter.maxAmount !== undefined) {
    where.push("amount <= ?");
    params.push(filter.maxAmount);
  }
  if (filter.tagId) {
    where.push("EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = transactions.id AND tt.tag_id = ?)");
    params.push(filter.tagId);
  }
  if (filter.hasReceipt) where.push("receipt_id IS NOT NULL");
  if (filter.hasLocation) where.push("location_source IS NOT NULL");
  const place = filter.place?.trim();
  if (place) {
    where.push("location_name LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(place)}%`);
  }
  const search = filter.search?.trim();
  if (search) {
    const like = `%${escapeLike(search)}%`;
    where.push(
      `(title LIKE ? ESCAPE '\\' OR counterparty LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\' OR location_name LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM transaction_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.transaction_id = transactions.id AND g.name LIKE ? ESCAPE '\\'))`,
    );
    params.push(like, like, like, like, like);
  }

  let sql = `SELECT * FROM transactions WHERE ${where.join(" AND ")} ORDER BY occurred_at DESC, created_at DESC`;
  if (filter.limit !== undefined) {
    sql += " LIMIT ? OFFSET ?";
    params.push(filter.limit, filter.offset ?? 0);
  }
  const rows = await db.getAllAsync<Row>(sql, params);
  return rows.map(mapTransaction);
}

/** Limits an aggregate to one wallet. A row with no wallet counts for the main one. Transfers are never in these totals. */
function walletClause(walletId?: string): { sql: string; params: SqlValue[] } {
  return walletId ? { sql: " AND COALESCE(wallet_id, ?) = ?", params: [DEFAULT_WALLET_ID, walletId] } : { sql: "", params: [] };
}

/** Totals by type for a range of local dates, `fromDate` included and `endExclusive` not. Optionally for one wallet. */
export async function rangeTotals(db: Db, fromDate: LocalDate, endExclusive: LocalDate, walletId?: string): Promise<MonthTotals> {
  const wallet = walletClause(walletId);
  const rows = await db.getAllAsync<{ type: TransactionType; total: number }>(
    `SELECT type, SUM(amount) AS total FROM transactions
     WHERE deleted_at IS NULL AND occurred_local_date >= ? AND occurred_local_date < ?${wallet.sql}
     GROUP BY type`,
    [fromDate, endExclusive, ...wallet.params],
  );
  const totals: MonthTotals = { income: 0, expense: 0, savingDeposit: 0, savingWithdrawal: 0 };
  for (const row of rows) {
    if (row.type === "income") totals.income = row.total;
    else if (row.type === "expense") totals.expense = row.total;
    else if (row.type === "saving_deposit") totals.savingDeposit = row.total;
    else if (row.type === "saving_withdrawal") totals.savingWithdrawal = row.total;
  }
  return totals;
}

/** Totals by type for one month. Months are ranges of the stored local date. */
export async function monthTotals(db: Db, month: YearMonth): Promise<MonthTotals> {
  return rangeTotals(db, monthStart(month), monthEndExclusive(month));
}

export type CategoryTotal = { categoryId: string | null; total: number };

export async function categoryTotals(db: Db, month: YearMonth, type: "expense" | "income" = "expense"): Promise<CategoryTotal[]> {
  const rows = await db.getAllAsync<{ category_id: string | null; total: number }>(
    `SELECT category_id, SUM(amount) AS total FROM transactions
     WHERE deleted_at IS NULL AND type = ? AND occurred_local_date >= ? AND occurred_local_date < ?
     GROUP BY category_id ORDER BY total DESC`,
    [type, monthStart(month), monthEndExclusive(month)],
  );
  return rows.map((row) => ({ categoryId: row.category_id, total: row.total }));
}

export async function categoryTotalsRange(db: Db, fromDate: LocalDate, endExclusive: LocalDate, type: "expense" | "income" = "expense", walletId?: string): Promise<CategoryTotal[]> {
  const wallet = walletClause(walletId);
  const rows = await db.getAllAsync<{ category_id: string | null; total: number }>(
    `SELECT category_id, SUM(amount) AS total FROM transactions
     WHERE deleted_at IS NULL AND type = ? AND occurred_local_date >= ? AND occurred_local_date < ?${wallet.sql}
     GROUP BY category_id ORDER BY total DESC`,
    [type, fromDate, endExclusive, ...wallet.params],
  );
  return rows.map((row) => ({ categoryId: row.category_id, total: row.total }));
}

export type MerchantTotal = { name: string; total: number; count: number };

/** Where the most money went, by the merchant typed on the expense (ignoring case). */
export async function merchantTotals(db: Db, fromDate: LocalDate, endExclusive: LocalDate, limit = 5, walletId?: string): Promise<MerchantTotal[]> {
  const wallet = walletClause(walletId);
  const rows = await db.getAllAsync<{ name: string; total: number; n: number }>(
    `SELECT MIN(counterparty) AS name, SUM(amount) AS total, COUNT(*) AS n FROM transactions
     WHERE deleted_at IS NULL AND type = 'expense' AND counterparty IS NOT NULL
       AND occurred_local_date >= ? AND occurred_local_date < ?${wallet.sql}
     GROUP BY lower(counterparty) ORDER BY total DESC, n DESC LIMIT ?`,
    [fromDate, endExclusive, ...wallet.params, limit],
  );
  return rows.map((row) => ({ name: row.name, total: row.total, count: row.n }));
}

export type MonthBar = { month: YearMonth; income: number; expense: number };

/** Income and spending per month for the bars. Months without rows are zeros, so the axis has no gaps. */
export async function monthlyBars(db: Db, fromMonth: YearMonth, toMonth: YearMonth, walletId?: string): Promise<MonthBar[]> {
  const wallet = walletClause(walletId);
  const rows = await db.getAllAsync<{ month: string; type: TransactionType; total: number }>(
    `SELECT substr(occurred_local_date, 1, 7) AS month, type, SUM(amount) AS total FROM transactions
     WHERE deleted_at IS NULL AND type IN ('income', 'expense') AND occurred_local_date >= ? AND occurred_local_date < ?${wallet.sql}
     GROUP BY month, type`,
    [monthStart(fromMonth), monthEndExclusive(toMonth), ...wallet.params],
  );
  const bars: MonthBar[] = [];
  for (let month = fromMonth; month <= toMonth; month = addMonths(month, 1)) bars.push({ month, income: 0, expense: 0 });
  for (const row of rows) {
    const bar = bars.find((item) => item.month === row.month);
    if (bar) bar[row.type === "income" ? "income" : "expense"] = row.total;
  }
  return bars;
}

export type DailyTotal = { date: LocalDate; total: number };

/** What was spent on each day of a month that had spending, optionally in one wallet. Days without spending have no entry. */
export async function dailyExpenseTotals(db: Db, month: YearMonth, walletId?: string): Promise<DailyTotal[]> {
  const wallet = walletClause(walletId);
  const rows = await db.getAllAsync<{ d: string; total: number }>(
    `SELECT occurred_local_date AS d, SUM(amount) AS total FROM transactions
     WHERE deleted_at IS NULL AND type = 'expense' AND occurred_local_date >= ? AND occurred_local_date < ?${wallet.sql}
     GROUP BY occurred_local_date ORDER BY occurred_local_date`,
    [monthStart(month), monthEndExclusive(month), ...wallet.params],
  );
  return rows.map((row) => ({ date: row.d, total: row.total }));
}

/** Removes every saved place from every transaction. The transactions themselves stay. Returns how many had one. */
export async function clearAllLocations(db: Db, now: number = Date.now()): Promise<number> {
  const result = await db.runAsync(
    `UPDATE transactions SET location_name = NULL, location_lat = NULL, location_lng = NULL, location_source = NULL, updated_at = ?
     WHERE location_source IS NOT NULL`,
    [now],
  );
  return result.changes;
}
