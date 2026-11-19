import { eraseTransactions, expiredDeletedIds } from "@/db/repo/trash";
import type { Db } from "@/db/types";

import { deleteReceiptImage } from "../receipts/images";

/** Removes deleted transactions for good, then the receipt photos that went with them. */
export async function eraseForGood(db: Db, ids: readonly string[]): Promise<number> {
  const paths = await eraseTransactions(db, ids);
  await Promise.all(paths.map((path) => deleteReceiptImage(path)));
  return ids.length;
}

/** Runs when the app opens: anything deleted more than 30 days ago goes now. */
export async function purgeExpired(db: Db, now: number = Date.now()): Promise<number> {
  const ids = await expiredDeletedIds(db, now);
  if (ids.length === 0) return 0;
  return eraseForGood(db, ids);
}
