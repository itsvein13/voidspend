import type { Db } from "../types";
import { mapTransaction, RECENTLY_DELETED_DAYS, type Transaction } from "./transactions";

const DAY = 86_400_000;

type Row = Parameters<typeof mapTransaction>[0];

/** Deleted transactions, the most recently deleted first. */
export async function listDeleted(db: Db): Promise<Transaction[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM transactions WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id");
  return rows.map(mapTransaction);
}

/** Whole days until a deleted transaction is removed for good. Never below zero. */
export function daysLeft(deletedAt: number, now: number): number {
  return Math.max(0, Math.ceil((deletedAt + RECENTLY_DELETED_DAYS * DAY - now) / DAY));
}

/** Ids deleted more than 30 days ago. */
export async function expiredDeletedIds(db: Db, now: number = Date.now()): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>("SELECT id FROM transactions WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now - RECENTLY_DELETED_DAYS * DAY]);
  return rows.map((row) => row.id);
}

/**
 * Removes deleted transactions for good, together with the receipt each one came
 * from when nothing else uses it. Only rows that are already deleted can be erased,
 * so a wrong id never touches a live transaction. Returns the photo paths of the
 * receipts removed, for the caller to delete from storage.
 */
export async function eraseTransactions(db: Db, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const marks = ids.map(() => "?").join(",");
  const paths: string[] = [];
  await db.withTransactionAsync(async () => {
    const receipts = await db.getAllAsync<{ receipt_id: string }>(
      `SELECT DISTINCT receipt_id FROM transactions WHERE id IN (${marks}) AND deleted_at IS NOT NULL AND receipt_id IS NOT NULL`,
      [...ids],
    );
    await db.runAsync(`DELETE FROM transactions WHERE id IN (${marks}) AND deleted_at IS NOT NULL`, [...ids]);
    for (const { receipt_id: receiptId } of receipts) {
      const used = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE receipt_id = ?", [receiptId]);
      if (used && used.n > 0) continue;
      const receipt = await db.getFirstAsync<{ image_path: string | null }>("SELECT image_path FROM receipts WHERE id = ?", [receiptId]);
      if (receipt?.image_path) paths.push(receipt.image_path);
      await db.runAsync("DELETE FROM receipts WHERE id = ?", [receiptId]);
    }
  });
  return paths;
}
