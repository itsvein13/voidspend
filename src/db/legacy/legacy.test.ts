import { createMigratedDb, type TestDb } from "@/test/sqliteDb";
import { remaining } from "@/lib/finance";

import { getMeta } from "../repo/meta";
import { listBudgetRules } from "../repo/budgets";
import { listGoals } from "../repo/goals";
import { listTransactions, monthTotals } from "../repo/transactions";
import { systemCategoryId } from "../systemCategories";
import type { Db } from "../types";
import { LEGACY_META_KEY, runLegacyImport, type ImportDeps } from "./import";
import { legacyCategory, normalizeLabel } from "./labels";
import { parseLegacy, type LegacyRaw } from "./parse";
import { planLegacyImport } from "./plan";
import { JULY_ID, sampleLegacyRaw } from "./sample";

const ctx = { offsetMin: 420, tz: "Asia/Jakarta", now: Date.UTC(2026, 10, 18, 5, 0) };
const rawOf = (parts: Partial<Record<keyof LegacyRaw, unknown>>): LegacyRaw => ({
  salaries: null,
  salary: null,
  expenses: null,
  savings: null,
  budgets: null,
  ...Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])),
});

const fixture = () => sampleLegacyRaw();

function deps(raw: LegacyRaw, overrides: Partial<ImportDeps> = {}) {
  const written: { name: string; json: string }[] = [];
  const reads: string[] = [];
  const value: ImportDeps = {
    storage: { getItem: async (key) => (reads.push(key), raw[key as keyof LegacyRaw] ?? null) },
    writeBackup: async (name, json) => {
      written.push({ name, json });
      return `/backups/${name}`;
    },
    ctx,
    ...overrides,
  };
  return { value, written, reads };
}

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe("labels", () => {
  it("normalizes emoji labels and maps English and Indonesian to the same category", () => {
    expect(normalizeLabel("🍔 Food")).toBe("food");
    expect(normalizeLabel("✈️ Liburan")).toBe("liburan");
    expect(legacyCategory("🍔 Food", "expense").categoryId).toBe(systemCategoryId("food"));
    expect(legacyCategory("🍔 Makan", "expense").categoryId).toBe(systemCategoryId("food"));
    expect(legacyCategory("📦 Others", "expense").categoryId).toBe(systemCategoryId("other"));
    expect(legacyCategory("📦 Lainnya", "saving").categoryId).toBe(systemCategoryId("saving_other"));
    expect(legacyCategory("🎯 Dana Darurat", "saving").categoryId).toBe(systemCategoryId("emergency"));
    expect(legacyCategory("📱 Gadget", "saving").categoryId).toBe(systemCategoryId("gadget"));
  });

  it("turns an unknown label into a category of the person's own, with a stable id", () => {
    const first = legacyCategory("🧴 Skincare", "expense");
    expect(first.create).toEqual({ kind: "expense", name: "Skincare" });
    expect(legacyCategory("🧴 Skincare", "expense").categoryId).toBe(first.categoryId);
    expect(legacyCategory("🧴 Skincare", "saving").categoryId).not.toBe(first.categoryId);
  });
});

describe("parseLegacy", () => {
  it("reads the fixture and lists rows it cannot import, with a reason", () => {
    const { data, skipped } = parseLegacy(fixture(), { year: 2026, month: 10 });
    expect(data.expenses).toHaveLength(6);
    expect(data.savings).toHaveLength(3);
    expect(data.salaries).toHaveLength(2); // the 0 is "no salary", not an entry and not an error
    expect(data.budgets).toEqual([
      { label: "🍔 Food", amount: 1_000_000 },
      { label: "🧴 Skincare", amount: 200_000 },
    ]);
    expect(skipped).toEqual([{ table: "expenses", ref: "1", reason: "amount_invalid" }]);
  });

  it("reads the oldest format, a bare salary number, as the current month", () => {
    const { data } = parseLegacy(rawOf({ salary: "4500000" }), { year: 2026, month: 10 });
    expect(data.salaries).toEqual([{ year: 2026, month: 10, amount: 4_500_000 }]);
  });

  it("prefers salaries over the old salary key, like v1 did", () => {
    const { data } = parseLegacy(rawOf({ salary: "1", salaries: { "2026-6": 5 } }), { year: 2026, month: 10 });
    expect(data.salaries).toEqual([{ year: 2026, month: 6, amount: 5 }]);
  });

  it("skips invalid months and bad entries instead of failing", () => {
    const { data, skipped } = parseLegacy(
      rawOf({ salaries: { "2026-12": 5, "x": 5 }, expenses: [null, { id: 1, amount: 5, month: 13, year: 2026 }, { id: 2, amount: 5, month: 1, year: 1800 }] }),
      { year: 2026, month: 10 },
    );
    expect(data.salaries).toEqual([]);
    expect(skipped.map((row) => row.reason)).toEqual(["month_invalid", "month_invalid", "not_an_object", "month_invalid", "year_invalid"]);
  });

  it("throws for data that is not JSON or has the wrong shape", () => {
    expect(() => parseLegacy(rawOf({ expenses: "{oops" }), { year: 2026, month: 10 })).toThrow(/not readable/);
    expect(() => parseLegacy(rawOf({ expenses: { a: 1 } }), { year: 2026, month: 10 })).toThrow(/unexpected shape/);
  });
});

describe("planLegacyImport", () => {
  const plan = () => planLegacyImport(parseLegacy(fixture(), { year: 2026, month: 10 }).data, ctx);

  it("gives rows that share an id different references", () => {
    const refs = plan().transactions.map((tx) => tx.legacyRef);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs).toContain(`expenses:${JULY_ID}`);
    expect(refs).toContain(`expenses:${JULY_ID}#2`);
  });

  it("uses the id as the moment when it falls inside the stored month, otherwise noon on the 1st", () => {
    const byTitle = Object.fromEntries(plan().transactions.map((tx) => [tx.title, tx]));
    expect(byTitle.Kopi).toMatchObject({ localDate: "2026-07-16", occurredAt: JULY_ID, createdAt: JULY_ID, precision: "estimated" });
    expect(byTitle["Odd id"]).toMatchObject({ localDate: "2026-07-01", month: "2026-07" });
    // 00:30 on 1 August locally, but v1 filed it under July: it stays in July so totals match.
    expect(byTitle["Late night"]).toMatchObject({ localDate: "2026-07-01", month: "2026-07" });
  });

  it("makes one goal per saving name and category, with the latest target", () => {
    const { goals } = plan();
    expect(goals.map((goal) => goal.name).sort()).toEqual(["Dana", "Liburan Bali"]);
    expect(goals.find((goal) => goal.name === "Liburan Bali")).toMatchObject({ categoryId: systemCategoryId("vacation"), targetAmount: 5_000_000 });
  });

  it("dates a salary on day 1 of its month at noon, date only, with its v1 month meaning", () => {
    const salary = plan().transactions.find((tx) => tx.legacyRef === "salaries:2026-6")!;
    expect(salary).toMatchObject({ type: "income", month: "2026-07", localDate: "2026-07-01", precision: "date", title: "Salary" });
  });

  it("fills a blank name and creates the unknown category once", () => {
    const { transactions, categories } = plan();
    expect(transactions.find((tx) => tx.amount === 7_000)!.title).toBe("Expense");
    expect(categories).toEqual([expect.objectContaining({ kind: "expense", name: "Skincare" })]);
  });
});

describe("runLegacyImport", () => {
  it("imports, matches the v1 numbers month by month, and leaves the v1 keys alone", async () => {
    const raw = fixture();
    const snapshot = JSON.stringify(raw);
    const { value, written } = deps(raw);

    const result = await runLegacyImport(db, value);
    expect(result.status).toBe("imported");
    if (result.status !== "imported") return;

    // The numbers v1 itself would show for July and August.
    const july = await monthTotals(db, "2026-07");
    expect(july).toEqual({ income: 5_000_000, expense: 25_000 + 40_000 + 10_000 + 9_000, savingDeposit: 500_000, savingWithdrawal: 0 });
    expect(remaining(july)).toBe(5_000_000 - 84_000 - 500_000);
    const august = await monthTotals(db, "2026-08");
    expect(remaining(august)).toBe(5_200_000 - (150_000 + 7_000) - (300_000 + 200_000));

    expect(result.report.counts).toEqual({ expenses: 6, savings: 3, salaries: 2, budgets: 2, goals: 2, newCategories: 1 });
    expect(result.report.skipped).toEqual([{ table: "expenses", ref: "1", reason: "amount_invalid" }]);
    expect(result.report.lines.find((line) => line.month === "2026-07" && line.type === "expense")).toMatchObject({ count: 4, total: 84_000 });

    const rows = await listTransactions(db);
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.source === "legacy" && row.legacyRef !== null)).toBe(true);
    expect((await listGoals(db)).find((goal) => goal.name === "Liburan Bali")).toMatchObject({ saved: 800_000, targetAmount: 5_000_000 });
    expect(await listBudgetRules(db)).toEqual(expect.arrayContaining([{ categoryId: systemCategoryId("food"), effectiveFrom: "2000-01", amount: 1_000_000, alertPct: 80 }]));

    expect(written).toHaveLength(1);
    expect(JSON.parse(written[0].json).data).toEqual(raw);
    expect(result.report.backupPath).toBe(`/backups/${written[0].name}`);
    expect(JSON.stringify(raw)).toBe(snapshot);
    expect(await getMeta(db, LEGACY_META_KEY)).toBe("done");
  });

  it("is a no-op the second time and returns the saved report", async () => {
    const { value, written } = deps(fixture());
    await runLegacyImport(db, value);
    const again = await runLegacyImport(db, value);
    expect(again.status).toBe("already_done");
    if (again.status === "already_done") expect(again.report?.counts.expenses).toBe(6);
    expect(await listTransactions(db)).toHaveLength(11);
    expect(written).toHaveLength(1);
  });

  it("inserts nothing twice even when the done marker is lost", async () => {
    const { value } = deps(fixture());
    await runLegacyImport(db, value);
    await db.runAsync("DELETE FROM app_meta");
    const again = await runLegacyImport(db, value);
    expect(again.status).toBe("imported");
    expect(await listTransactions(db)).toHaveLength(11);
    expect(await listGoals(db)).toHaveLength(2);
  });

  it("marks a fresh install as done without writing a backup", async () => {
    const { value, written } = deps(rawOf({}));
    const result = await runLegacyImport(db, value);
    expect(result.status).toBe("nothing");
    expect(written).toHaveLength(0);
    expect(await getMeta(db, LEGACY_META_KEY)).toBe("done");
  });

  it("stops before any write when the data is unreadable", async () => {
    const { value, written } = deps(rawOf({ expenses: "{oops" }));
    const result = await runLegacyImport(db, value);
    expect(result).toMatchObject({ status: "failed", reason: "unreadable" });
    expect(written).toHaveLength(0);
    expect(await listTransactions(db)).toHaveLength(0);
    expect(await getMeta(db, LEGACY_META_KEY)).toBeNull();
  });

  it("does not touch the database when the backup cannot be saved", async () => {
    const { value } = deps(fixture(), { writeBackup: async () => { throw new Error("disk full"); } });
    const result = await runLegacyImport(db, value);
    expect(result).toMatchObject({ status: "failed", reason: "backup_failed", message: "disk full" });
    expect(await listTransactions(db)).toHaveLength(0);
    expect(await getMeta(db, LEGACY_META_KEY)).toBeNull();
  });

  it("rolls everything back when the totals do not match", async () => {
    // A row with the same reference but another amount blocks the insert of the real one.
    await db.runAsync(
      `INSERT INTO transactions (id,type,amount,title,category_id,wallet_id,occurred_at,occurred_tz,occurred_offset_min,occurred_local_date,time_precision,source,legacy_ref,created_at,updated_at)
       VALUES ('x','expense',1,'Planted','${systemCategoryId("food")}','wal_default',1,'Asia/Jakarta',420,'2026-07-16','estimated','legacy','expenses:${JULY_ID}',1,1)`,
    );
    const { value } = deps(fixture());
    const result = await runLegacyImport(db, value);
    expect(result).toMatchObject({ status: "failed", reason: "totals_mismatch" });
    expect(await listTransactions(db)).toHaveLength(1);
    expect(await listGoals(db)).toHaveLength(0);
    expect(await getMeta(db, LEGACY_META_KEY)).toBeNull();
  });

  it("rolls everything back when a write fails halfway", async () => {
    let inserts = 0;
    const flaky: Db = {
      ...db,
      runAsync: async (sql, params) => {
        if (sql.includes("INSERT INTO transactions") && ++inserts === 5) throw new Error("io error");
        return db.runAsync(sql, params);
      },
    };
    const { value } = deps(fixture());
    const result = await runLegacyImport(flaky, value);
    expect(result).toMatchObject({ status: "failed", reason: "write_failed", message: "io error" });
    expect(await listTransactions(db)).toHaveLength(0);
    expect(await listGoals(db)).toHaveLength(0);
    expect(await getMeta(db, LEGACY_META_KEY)).toBeNull();
  });
});
