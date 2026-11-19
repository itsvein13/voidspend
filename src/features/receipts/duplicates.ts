import { getTransaction, type Transaction } from "@/db/repo/transactions";
import type { Db } from "@/db/types";
import { addDays, type LocalDate } from "@/lib/dates";

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + 3 <= text.length; i++) set.add(text.slice(i, i + 3));
  return set;
}

/** Two merchant names that are probably the same place: one contains the other, or most of their letters overlap. */
export function similarMerchant(a: string, b: string): boolean {
  const [x, y] = [normalize(a), normalize(b)];
  if (x === "" || y === "") return false;
  if (x.includes(y) || y.includes(x)) return true;
  const [tx, ty] = [trigrams(x), trigrams(y)];
  if (tx.size === 0 || ty.size === 0) return false;
  let shared = 0;
  for (const gram of tx) if (ty.has(gram)) shared++;
  return shared / (tx.size + ty.size - shared) >= 0.6;
}

/** A confirmed receipt with the very same photo: a strong warning. */
export async function findSamePhoto(db: Db, hash: string, excludeId?: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM receipts WHERE image_hash = ? AND status = 'confirmed' AND id <> ? LIMIT 1",
    [hash, excludeId ?? ""],
  );
  return row?.id ?? null;
}

/** A recorded expense with the same total on the same day (or a day either side) at a similar merchant: a soft warning. */
export async function findSimilarExpense(db: Db, input: { total: number; date: LocalDate; merchant: string }): Promise<Transaction | null> {
  const rows = await db.getAllAsync<{ id: string; counterparty: string | null; title: string }>(
    `SELECT id, counterparty, title FROM transactions
     WHERE deleted_at IS NULL AND type = 'expense' AND amount = ?
       AND occurred_local_date >= ? AND occurred_local_date <= ?`,
    [input.total, addDays(input.date, -1), addDays(input.date, 1)],
  );
  for (const row of rows) {
    // With no merchant on either side the total and the day are all there is to go on.
    const name = row.counterparty ?? row.title;
    if (input.merchant.trim() === "" || similarMerchant(name, input.merchant)) return getTransaction(db, row.id);
  }
  return null;
}
