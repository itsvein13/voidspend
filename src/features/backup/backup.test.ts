import { setBudget } from "@/db/repo/budgets";
import { createGoal } from "@/db/repo/goals";
import { getMeta, setMeta } from "@/db/repo/meta";
import { createTransaction, listTransactions, softDeleteTransaction } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { BACKUP_TABLES, backupFileName, createBackup, parseBackup, restoreBackup, summarize, type Backup } from "./backup";

const food = systemCategoryId("food");
const base = { type: "expense" as const, amount: 25_000, title: "Kopi", categoryId: food, occurredAt: epochFromLocal("2026-11-18", 8, 12, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" as const };

async function filled(): Promise<TestDb> {
  const db = await createMigratedDb();
  await createTransaction(db, { ...base, location: { name: "Warung", lat: -6.209, lng: 106.846, source: "device" } });
  await createTransaction(db, { ...base, amount: 40_000, title: "Makan" });
  const gone = await createTransaction(db, { ...base, amount: 9_000, title: "Salah catat" });
  await softDeleteTransaction(db, gone);
  const goal = await createGoal(db, { name: "Trip", targetAmount: 1_000_000, categoryId: systemCategoryId("vacation") });
  await createTransaction(db, { ...base, type: "saving_deposit", amount: 100_000, title: "Trip", categoryId: null, goalId: goal });
  await setBudget(db, { categoryId: food, effectiveFrom: "2026-11", amount: 500_000 });
  await setMeta(db, "username", "Rizky");
  return db;
}

describe("creating a backup", () => {
  it("holds every table, with the deleted row and without photo paths", async () => {
    const db = await filled();
    await db.runAsync("INSERT INTO receipts (id, image_path, status, created_at, updated_at) VALUES ('r1', 'file:///data/r1.jpg', 'confirmed', 1, 1)");
    const backup = await createBackup(db, 1_800_000_000_000);
    expect(Object.keys(backup.tables)).toEqual([...BACKUP_TABLES]);
    expect(backup).toMatchObject({ app: "voidspend", format: 1, createdAt: 1_800_000_000_000 });
    expect(backup.tables.transactions).toHaveLength(4);
    expect(backup.tables.receipts[0].image_path).toBeNull();
    expect(summarize(backup)).toEqual({ transactions: 3, goals: 1, createdAt: 1_800_000_000_000 });
  });

  it("names the file by date", () => {
    expect(backupFileName("2026-11-18")).toBe("voidspend-backup-2026-11-18.json");
  });
});

describe("reading a file", () => {
  it("accepts what it wrote, through JSON", async () => {
    const text = JSON.stringify(await createBackup(await filled()));
    expect(parseBackup(text)).toMatchObject({ ok: true });
  });

  it.each([
    ["text that is not JSON", "hello", "not_json"],
    ["JSON that is not a backup", JSON.stringify({ hello: 1 }), "not_backup"],
    ["a list", "[]", "not_backup"],
    ["another app's file", JSON.stringify({ app: "other", format: 1 }), "not_backup"],
  ])("refuses %s", (_name, text, reason) => {
    expect(parseBackup(text)).toEqual({ ok: false, reason });
  });

  it("refuses a file from a newer schema", async () => {
    const backup = await createBackup(await filled());
    expect(parseBackup(JSON.stringify({ ...backup, schema: 99 }))).toEqual({ ok: false, reason: "newer" });
  });

  it("refuses a missing table, a row that is not an object, a value that is not a plain value, and no wallets or categories", async () => {
    const backup = await createBackup(await filled());
    const without = { ...backup, tables: { ...backup.tables } } as Record<string, unknown> & { tables: Record<string, unknown> };
    delete without.tables.budgets;
    expect(parseBackup(JSON.stringify(without))).toEqual({ ok: false, reason: "damaged" });
    expect(parseBackup(JSON.stringify({ ...backup, tables: { ...backup.tables, goals: [5] } }))).toEqual({ ok: false, reason: "damaged" });
    expect(parseBackup(JSON.stringify({ ...backup, tables: { ...backup.tables, goals: [{ id: { x: 1 } }] } }))).toEqual({ ok: false, reason: "damaged" });
    expect(parseBackup(JSON.stringify({ ...backup, tables: { ...backup.tables, wallets: [] } }))).toEqual({ ok: false, reason: "damaged" });
    expect(parseBackup(JSON.stringify({ ...backup, tables: { ...backup.tables, categories: [] } }))).toEqual({ ok: false, reason: "damaged" });
  });
});

describe("restoring", () => {
  it("brings everything back into another database, deleted row included", async () => {
    const source = await filled();
    const backup = JSON.parse(JSON.stringify(await createBackup(source))) as Backup;

    const target = await createMigratedDb();
    await createTransaction(target, { ...base, title: "Will be replaced" });
    await setMeta(target, "username", "Someone else");
    await restoreBackup(target, backup);

    const rows = await listTransactions(target);
    expect(rows.map((row) => row.title).sort()).toEqual(["Kopi", "Makan", "Trip"]);
    expect(rows.find((row) => row.title === "Kopi")?.location).toMatchObject({ name: "Warung", lat: -6.209 });
    expect(await listTransactions(target, { onlyDeleted: true })).toHaveLength(1);
    expect(await getMeta(target, "username")).toBe("Rizky");
    const rebuilt = await createBackup(target, backup.createdAt);
    for (const table of BACKUP_TABLES) {
      const key = (row: Record<string, unknown>) => JSON.stringify(Object.entries(row).sort());
      expect(rebuilt.tables[table].map(key).sort()).toEqual(backup.tables[table].map(key).sort());
    }
  });

  it("restores into an empty database made by a reset", async () => {
    const backup = await createBackup(await filled());
    const target = await createMigratedDb();
    await target.execAsync("DELETE FROM transactions; DELETE FROM app_meta; DELETE FROM categories; DELETE FROM wallets;");
    await restoreBackup(target, backup);
    expect(await listTransactions(target)).toHaveLength(3);
  });

  it("changes nothing when a column name is not in the table", async () => {
    const target = await filled();
    const backup = await createBackup(await createMigratedDb());
    backup.tables.goals = [{ id: "g1", name: "x", "name) VALUES ('x'); DROP TABLE goals; --": "x" }];
    await expect(restoreBackup(target, backup)).rejects.toMatchObject({ code: "backup_damaged" });
    expect(await listTransactions(target)).toHaveLength(3);
  });

  it("rolls back when a row breaks a rule, leaving the old data in place", async () => {
    const target = await filled();
    const backup = await createBackup(await filled());
    backup.tables.transactions = [{ ...backup.tables.transactions[0], amount: -5 }];
    await expect(restoreBackup(target, backup)).rejects.toThrow();
    expect(await listTransactions(target)).toHaveLength(3);
    expect(await getMeta(target, "username")).toBe("Rizky");
  });
});
