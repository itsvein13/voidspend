import { setMeta } from "@/db/repo/meta";
import type { Db } from "@/db/types";

/**
 * Deletes everything the person recorded and starts over: transactions, goals,
 * budgets, recurring rules, receipts, tags, their own categories and wallets, and the profile.
 * The shipped categories, the default wallet and the saved theme and language
 * stay. The import of v1 data and the carrying over of the v1 name are marked done,
 * so the old data does not come back after a reset the person asked for.
 */
export async function resetAllData(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      `DELETE FROM transaction_tags; DELETE FROM transactions; DELETE FROM receipt_items; DELETE FROM receipts;
       DELETE FROM budgets; DELETE FROM recurring_rules; DELETE FROM goals; DELETE FROM tags;
       DELETE FROM categories WHERE system_key IS NULL;
       UPDATE categories SET archived_at = NULL;
       DELETE FROM wallets WHERE is_default = 0;
       UPDATE wallets SET opening_balance = 0, archived_at = NULL;
       DELETE FROM app_meta;`,
    );
    await setMeta(db, "legacy_import", "done");
    await setMeta(db, "legacy_profile", "done");
  });
}
