import { createMigratedDb, createTestDb } from "@/test/sqliteDb";

import { LATEST_VERSION, migrate } from "./migrate";
import { systemCategories, systemCategoryId } from "./systemCategories";

const T = 1_700_000_000_000;

// A minimal valid expense, overridden per test.
async function insertTx(db: Awaited<ReturnType<typeof createMigratedDb>>, overrides: Record<string, string | number | null> = {}) {
  const row: Record<string, string | number | null> = {
    id: `tx_${Math.random()}`,
    type: "expense",
    amount: 25_000,
    title: "Coffee",
    category_id: systemCategoryId("food"),
    goal_id: null,
    wallet_id: "wal_default",
    to_wallet_id: null,
    occurred_at: T,
    occurred_tz: "Asia/Jakarta",
    occurred_offset_min: 420,
    occurred_local_date: "2023-11-15",
    time_precision: "exact",
    source: "manual",
    recurring_rule_id: null,
    legacy_ref: null,
    created_at: T,
    updated_at: T,
    ...overrides,
  };
  const columns = Object.keys(row);
  await db.runAsync(
    `INSERT INTO transactions (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    columns.map((c) => row[c]),
  );
}

describe("migrate", () => {
  it("builds the schema, seeds the categories and the default wallet, and sets the version", async () => {
    const db = await createMigratedDb();
    const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(version?.user_version).toBe(LATEST_VERSION);

    const categories = await db.getAllAsync<{ id: string; system_key: string; kind: string; sort_order: number }>(
      "SELECT id, system_key, kind, sort_order FROM categories ORDER BY sort_order",
    );
    expect(categories.map((c) => c.system_key)).toEqual(systemCategories.map((c) => c.key));
    expect(categories.map((c) => c.kind)).toEqual(systemCategories.map((c) => c.kind));

    const wallets = await db.getAllAsync<{ id: string; is_default: number }>("SELECT id, is_default FROM wallets");
    expect(wallets).toEqual([{ id: "wal_default", is_default: 1 }]);
  });

  it("is a no-op on a second run", async () => {
    const db = await createMigratedDb();
    expect(await migrate(db)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });
    const count = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM categories");
    expect(count?.n).toBe(systemCategories.length);
  });

  it("refuses a database from a newer app instead of damaging it", async () => {
    const db = createTestDb();
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION + 1};`);
    await expect(migrate(db)).rejects.toThrow(/Update the app/);
  });

  it("rolls back a failed migration, version included", async () => {
    const db = createTestDb();
    await expect(
      db.withTransactionAsync(async () => {
        await db.execAsync("CREATE TABLE half (id INTEGER);");
        await db.execAsync("PRAGMA user_version = 9;");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(row?.user_version).toBe(0);
    expect(await db.getAllAsync("SELECT name FROM sqlite_master WHERE name = 'half'")).toEqual([]);
  });
});

describe("constraints the repositories rely on", () => {
  it("accepts a valid expense", async () => {
    const db = await createMigratedDb();
    await insertTx(db);
    expect(await db.getAllAsync("SELECT id FROM transactions")).toHaveLength(1);
  });

  it("rejects a zero or negative amount and unknown types", async () => {
    const db = await createMigratedDb();
    await expect(insertTx(db, { amount: 0 })).rejects.toThrow();
    await expect(insertTx(db, { amount: -5 })).rejects.toThrow();
    await expect(insertTx(db, { type: "gift" })).rejects.toThrow();
  });

  it("ties saving types to a goal and nothing else to one", async () => {
    const db = await createMigratedDb();
    await db.runAsync("INSERT INTO goals (id, name, created_at, updated_at) VALUES ('g1','Trip',?,?)", [T, T]);
    await expect(insertTx(db, { type: "saving_deposit", category_id: null, goal_id: null })).rejects.toThrow();
    await expect(insertTx(db, { type: "expense", goal_id: "g1" })).rejects.toThrow();
    await insertTx(db, { type: "saving_deposit", category_id: null, goal_id: "g1" });
  });

  it("needs a destination wallet for a transfer", async () => {
    const db = await createMigratedDb();
    await expect(insertTx(db, { type: "transfer", category_id: null, to_wallet_id: null })).rejects.toThrow();
  });

  it("enforces foreign keys", async () => {
    const db = await createMigratedDb();
    await expect(insertTx(db, { category_id: "does-not-exist" })).rejects.toThrow();
  });

  it("makes legacy_ref unique so an import cannot insert twice", async () => {
    const db = await createMigratedDb();
    await insertTx(db, { legacy_ref: "expenses:1" });
    await expect(insertTx(db, { legacy_ref: "expenses:1" })).rejects.toThrow();
    await insertTx(db, { legacy_ref: null });
    await insertTx(db, { legacy_ref: null }); // many rows without a ref are fine
  });

  it("allows one recurring item per rule and day", async () => {
    const db = await createMigratedDb();
    await db.runAsync(
      `INSERT INTO recurring_rules (id,type,amount,title,frequency,start_date,next_due_date,created_at,updated_at)
       VALUES ('r1','income',5000000,'Salary','monthly','2026-01-01','2026-01-25',?,?)`,
      [T, T],
    );
    await insertTx(db, { type: "income", category_id: systemCategoryId("salary"), recurring_rule_id: "r1", occurred_local_date: "2026-01-25" });
    await expect(
      insertTx(db, { type: "income", category_id: systemCategoryId("salary"), recurring_rule_id: "r1", occurred_local_date: "2026-01-25" }),
    ).rejects.toThrow();
    await insertTx(db, { type: "income", category_id: systemCategoryId("salary"), recurring_rule_id: "r1", occurred_local_date: "2026-02-25" });
  });

  it("allows one budget row per category and month", async () => {
    const db = await createMigratedDb();
    const sql = "INSERT INTO budgets (id,category_id,effective_from,amount,created_at,updated_at) VALUES (?,?,?,?,?,?)";
    await db.runAsync(sql, ["b1", systemCategoryId("food"), "2026-01", 1_000_000, T, T]);
    await expect(db.runAsync(sql, ["b2", systemCategoryId("food"), "2026-01", 2_000_000, T, T])).rejects.toThrow();
    await db.runAsync(sql, ["b3", systemCategoryId("food"), "2026-02", null, T, T]); // null means no budget
  });
});
