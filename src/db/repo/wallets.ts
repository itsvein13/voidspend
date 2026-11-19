import { newId } from "@/lib/ids";

import { DEFAULT_WALLET_ID, ValidationError, type Db } from "../types";

export type WalletKind = "cash" | "bank" | "ewallet" | "other";
export const WALLET_KINDS: readonly WalletKind[] = ["cash", "bank", "ewallet", "other"];

export type Wallet = {
  id: string;
  name: string;
  kind: WalletKind;
  currency: string;
  /** What the wallet held before VOIDSPEND started counting. Can be below zero, for a card. */
  openingBalance: number;
  isDefault: boolean;
  archivedAt: number | null;
};

export type WalletInput = { name: string; kind: WalletKind; openingBalance: number };

type Row = {
  id: string;
  name: string;
  kind: WalletKind;
  currency: string;
  opening_balance: number;
  is_default: number;
  archived_at: number | null;
};

const map = (row: Row): Wallet => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  currency: row.currency,
  openingBalance: row.opening_balance,
  isDefault: row.is_default === 1,
  archivedAt: row.archived_at,
});

async function validate(db: Db, input: WalletInput, ignoreId?: string): Promise<void> {
  const name = input.name.trim();
  if (name === "") throw new ValidationError("name_required", "Enter a name.");
  if (name.length > 40) throw new ValidationError("name_too_long", "The name is too long.");
  if (!WALLET_KINDS.includes(input.kind)) throw new ValidationError("wallet_kind", "Unknown wallet kind.");
  if (!Number.isSafeInteger(input.openingBalance)) throw new ValidationError("amount_invalid", "The balance must be a whole number.");
  const clash = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM wallets WHERE name = ? COLLATE NOCASE AND archived_at IS NULL AND id <> ?",
    [name, ignoreId ?? ""],
  );
  if (clash) throw new ValidationError("wallet_exists", "A wallet with that name already exists.");
}

export async function listWallets(db: Db, options: { includeArchived?: boolean } = {}): Promise<Wallet[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM wallets ${options.includeArchived ? "" : "WHERE archived_at IS NULL"} ORDER BY is_default DESC, created_at, name`,
  );
  return rows.map(map);
}

export async function getWallet(db: Db, id: string): Promise<Wallet | null> {
  const row = await db.getFirstAsync<Row>("SELECT * FROM wallets WHERE id = ?", [id]);
  return row ? map(row) : null;
}

export async function createWallet(db: Db, input: WalletInput, now: number = Date.now()): Promise<string> {
  await validate(db, input);
  const id = newId();
  await db.runAsync(
    "INSERT INTO wallets (id, name, kind, currency, opening_balance, is_default, created_at, updated_at) VALUES (?,?,?,?,?,0,?,?)",
    [id, input.name.trim(), input.kind, "IDR", input.openingBalance, now, now],
  );
  return id;
}

export async function updateWallet(db: Db, id: string, input: WalletInput, now: number = Date.now()): Promise<void> {
  await validate(db, input, id);
  const result = await db.runAsync("UPDATE wallets SET name = ?, kind = ?, opening_balance = ?, updated_at = ? WHERE id = ?", [
    input.name.trim(),
    input.kind,
    input.openingBalance,
    now,
    id,
  ]);
  if (result.changes === 0) throw new ValidationError("not_found", "This wallet no longer exists.");
}

/** Hides a wallet from the pickers. Its transactions stay and still count. The default wallet cannot be hidden. */
export async function archiveWallet(db: Db, id: string, now: number = Date.now()): Promise<void> {
  if (id === DEFAULT_WALLET_ID) throw new ValidationError("wallet_default", "The main wallet cannot be hidden.");
  await db.runAsync("UPDATE wallets SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL", [now, now, id]);
}

export async function restoreWallet(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE wallets SET archived_at = NULL, updated_at = ? WHERE id = ?", [now, id]);
}

export type WalletBalance = { wallet: Wallet; balance: number };

/**
 * What each wallet holds: its opening balance, plus income and savings taken out,
 * minus expenses, savings put in and transfers out, plus transfers in. Deleted
 * transactions do not count, and a transaction with no wallet counts for the main one.
 */
export async function walletBalances(db: Db, options: { includeArchived?: boolean } = {}): Promise<WalletBalance[]> {
  const wallets = await listWallets(db, options);
  const moves = await db.getAllAsync<{ id: string; delta: number }>(
    `SELECT COALESCE(wallet_id, '${DEFAULT_WALLET_ID}') AS id,
            SUM(CASE type WHEN 'income' THEN amount WHEN 'saving_withdrawal' THEN amount
                          WHEN 'expense' THEN -amount WHEN 'saving_deposit' THEN -amount
                          WHEN 'transfer' THEN -amount ELSE 0 END) AS delta
       FROM transactions WHERE deleted_at IS NULL GROUP BY 1
     UNION ALL
     SELECT to_wallet_id AS id, SUM(amount) AS delta
       FROM transactions WHERE deleted_at IS NULL AND type = 'transfer' AND to_wallet_id IS NOT NULL GROUP BY 1`,
  );
  const delta = new Map<string, number>();
  for (const move of moves) delta.set(move.id, (delta.get(move.id) ?? 0) + Number(move.delta));
  return wallets.map((wallet) => ({ wallet, balance: wallet.openingBalance + (delta.get(wallet.id) ?? 0) }));
}
