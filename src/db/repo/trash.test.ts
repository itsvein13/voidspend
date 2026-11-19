import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { daysLeft, eraseTransactions, expiredDeletedIds, listDeleted } from "./trash";
import { createTransaction, getTransaction, listTransactions, restoreTransaction, softDeleteTransaction } from "./transactions";

const DAY = 86_400_000;
const base = { type: "expense" as const, amount: 10_000, title: "Kopi", categoryId: systemCategoryId("food"), occurredAt: epochFromLocal("2026-11-18", 9, 0, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" as const };

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe("recently deleted", () => {
  it("lists only deleted rows, newest deletion first, and they can be restored", async () => {
    const a = await createTransaction(db, { ...base, title: "A" });
    const b = await createTransaction(db, { ...base, title: "B" });
    await createTransaction(db, { ...base, title: "Live" });
    await softDeleteTransaction(db, a, 1_000);
    await softDeleteTransaction(db, b, 2_000);
    expect((await listDeleted(db)).map((tx) => tx.title)).toEqual(["B", "A"]);
    await restoreTransaction(db, a);
    expect((await listDeleted(db)).map((tx) => tx.title)).toEqual(["B"]);
    expect(await listTransactions(db)).toHaveLength(2);
  });

  it("counts whole days left, rounding up, and stops at zero", () => {
    expect(daysLeft(0, 0)).toBe(30);
    expect(daysLeft(0, 1)).toBe(30);
    expect(daysLeft(0, 29 * DAY + 1)).toBe(1);
    expect(daysLeft(0, 30 * DAY)).toBe(0);
    expect(daysLeft(0, 90 * DAY)).toBe(0);
  });

  it("finds what was deleted more than 30 days ago", async () => {
    const old = await createTransaction(db, base);
    const recent = await createTransaction(db, base);
    await softDeleteTransaction(db, old, 100 * DAY);
    await softDeleteTransaction(db, recent, 125 * DAY);
    expect(await expiredDeletedIds(db, 131 * DAY)).toEqual([old]);
    expect(await expiredDeletedIds(db, 129 * DAY)).toEqual([]);
  });
});

describe("erasing for good", () => {
  it("removes deleted rows and refuses a live one", async () => {
    const gone = await createTransaction(db, base);
    const live = await createTransaction(db, base);
    await softDeleteTransaction(db, gone);
    expect(await eraseTransactions(db, [gone, live])).toEqual([]);
    expect(await getTransaction(db, gone)).toBeNull();
    expect(await getTransaction(db, live)).not.toBeNull();
  });

  it("removes the receipt, its lines and hands back the photo path, when nothing else uses it", async () => {
    await db.runAsync("INSERT INTO receipts (id, image_path, status, created_at, updated_at) VALUES ('r1', 'file:///r1.jpg', 'confirmed', 1, 1)");
    await db.runAsync("INSERT INTO receipt_items (id, receipt_id, kind, name, quantity, line_total, sort_order) VALUES ('i1', 'r1', 'item', 'Teh', 1, 5000, 0)");
    const gone = await createTransaction(db, { ...base, source: "receipt", receiptId: "r1" });
    await softDeleteTransaction(db, gone);
    expect(await eraseTransactions(db, [gone])).toEqual(["file:///r1.jpg"]);
    expect(await db.getFirstAsync("SELECT id FROM receipts WHERE id = 'r1'")).toBeNull();
    expect(await db.getFirstAsync("SELECT id FROM receipt_items WHERE id = 'i1'")).toBeNull();
  });

  it("keeps a receipt that another transaction still uses", async () => {
    await db.runAsync("INSERT INTO receipts (id, image_path, status, created_at, updated_at) VALUES ('r2', 'file:///r2.jpg', 'confirmed', 1, 1)");
    const gone = await createTransaction(db, { ...base, source: "receipt", receiptId: "r2" });
    await createTransaction(db, { ...base, source: "receipt", receiptId: "r2" });
    await softDeleteTransaction(db, gone);
    expect(await eraseTransactions(db, [gone])).toEqual([]);
    expect(await db.getFirstAsync("SELECT id FROM receipts WHERE id = 'r2'")).not.toBeNull();
  });

  it("does nothing for an empty list", async () => {
    expect(await eraseTransactions(db, [])).toEqual([]);
  });
});
