import { createGoal } from "@/db/repo/goals";
import { getMeta } from "@/db/repo/meta";
import { createTransaction, listTransactions } from "@/db/repo/transactions";
import { createWallet, listWallets, updateWallet } from "@/db/repo/wallets";
import { systemCategoryId } from "@/db/systemCategories";
import { DEFAULT_WALLET_ID } from "@/db/types";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb } from "@/test/sqliteDb";

import { resetAllData } from "./reset";

describe("deleting all data", () => {
  it("clears what was recorded, keeps the main wallet at zero, and marks the v1 import done", async () => {
    const db = await createMigratedDb();
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 900_000 });
    await updateWallet(db, DEFAULT_WALLET_ID, { name: "Main", kind: "other", openingBalance: 250_000 });
    await createGoal(db, { name: "Trip", targetAmount: null, categoryId: null });
    await createTransaction(db, {
      type: "expense",
      amount: 10_000,
      title: "Kopi",
      categoryId: systemCategoryId("food"),
      walletId: bank,
      occurredAt: epochFromLocal("2026-11-18", 9, 0, 420),
      offsetMin: 420,
      tz: "Asia/Jakarta",
      timePrecision: "exact",
    });

    await resetAllData(db);

    expect(await listTransactions(db)).toHaveLength(0);
    const wallets = await listWallets(db, { includeArchived: true });
    expect(wallets).toHaveLength(1);
    expect(wallets[0]).toMatchObject({ id: DEFAULT_WALLET_ID, openingBalance: 0, archivedAt: null });
    expect(await getMeta(db, "legacy_import")).toBe("done");
  });
});
