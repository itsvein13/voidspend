// The one-time import of v1 data. The order is chosen for safety:
//   1. read every v1 key and keep a raw copy in a backup file,
//   2. write everything in ONE database transaction,
//   3. check that counts and per-month totals equal the v1 sums,
//   4. only then mark the import done, in the same transaction.
// Any failure rolls the transaction back. The v1 keys are never changed or
// deleted, so the person can always go back.
import type { YearMonth } from "@/lib/dates";

import { getMeta, setMeta } from "../repo/meta";
import { createTransaction } from "../repo/transactions";
import type { Db } from "../types";
import { expectedLines, expectedLinesFromV1, planLegacyImport, type ImportContext, type MonthLine } from "./plan";
import { isEmptyRaw, LEGACY_KEYS, LegacyParseError, parseLegacy, type LegacyRaw, type SkippedRow } from "./parse";

export const LEGACY_META_KEY = "legacy_import";
export const LEGACY_REPORT_KEY = "legacy_import_report";

export type ImportStorage = { getItem(key: string): Promise<string | null> };

export type ImportDeps = {
  storage: ImportStorage;
  /** Saves the raw v1 data and returns where it went. Throwing stops the import before any write. */
  writeBackup: (fileName: string, json: string) => Promise<string>;
  ctx: ImportContext;
};

export type ImportReport = {
  status: "imported" | "nothing";
  importedAt: number;
  counts: { expenses: number; savings: number; salaries: number; budgets: number; goals: number; newCategories: number };
  /** Per month and type: what was written, equal to the v1 sums. */
  lines: MonthLine[];
  skipped: SkippedRow[];
  backupPath: string | null;
};

export type ImportResult =
  | { status: "already_done"; report: ImportReport | null }
  | { status: "imported" | "nothing"; report: ImportReport }
  | { status: "failed"; reason: string; message: string };

export async function readLegacyRaw(storage: ImportStorage): Promise<LegacyRaw> {
  const raw = {} as LegacyRaw;
  for (const key of LEGACY_KEYS) raw[key] = await storage.getItem(key);
  return raw;
}

class MismatchError extends Error {}

const lineKey = (line: Pick<MonthLine, "month" | "type">) => `${line.month}|${line.type}`;

function diffLines(expected: MonthLine[], actual: MonthLine[]): string | null {
  const actualBy = new Map(actual.map((line) => [lineKey(line), line]));
  for (const want of expected) {
    const got = actualBy.get(lineKey(want));
    if (!got || got.count !== want.count || got.total !== want.total) {
      return `${want.month} ${want.type}: expected ${want.count} rows totalling ${want.total}, found ${got ? `${got.count} rows totalling ${got.total}` : "none"}`;
    }
  }
  const expectedBy = new Set(expected.map(lineKey));
  const extra = actual.find((line) => !expectedBy.has(lineKey(line)));
  return extra ? `${extra.month} ${extra.type}: ${extra.count} unexpected rows` : null;
}

export async function runLegacyImport(db: Db, deps: ImportDeps): Promise<ImportResult> {
  if ((await getMeta(db, LEGACY_META_KEY)) === "done") {
    const saved = await getMeta(db, LEGACY_REPORT_KEY);
    return { status: "already_done", report: saved ? (JSON.parse(saved) as ImportReport) : null };
  }

  const { ctx } = deps;
  const raw = await readLegacyRaw(deps.storage);

  if (isEmptyRaw(raw)) {
    const report: ImportReport = {
      status: "nothing",
      importedAt: ctx.now,
      counts: { expenses: 0, savings: 0, salaries: 0, budgets: 0, goals: 0, newCategories: 0 },
      lines: [],
      skipped: [],
      backupPath: null,
    };
    await setMeta(db, LEGACY_META_KEY, "done");
    await setMeta(db, LEGACY_REPORT_KEY, JSON.stringify(report));
    return { status: "nothing", report };
  }

  let parsed: ReturnType<typeof parseLegacy>;
  try {
    const nowLocal = new Date(ctx.now + ctx.offsetMin * 60_000);
    parsed = parseLegacy(raw, { year: nowLocal.getUTCFullYear(), month: nowLocal.getUTCMonth() });
  } catch (error) {
    if (error instanceof LegacyParseError) return { status: "failed", reason: "unreadable", message: error.message };
    throw error;
  }

  // Safety first: no write happens until the raw copy is on disk.
  let backupPath: string;
  try {
    backupPath = await deps.writeBackup(`v1-${ctx.now}.json`, JSON.stringify({ savedAt: ctx.now, data: raw }, null, 2));
  } catch (error) {
    return { status: "failed", reason: "backup_failed", message: error instanceof Error ? error.message : "The backup file could not be saved." };
  }

  const { data, skipped } = parsed;
  const plan = planLegacyImport(data, ctx);
  const expected = expectedLinesFromV1(data);
  const planned = expectedLines(plan.transactions);
  const planProblem = diffLines(expected, planned);
  if (planProblem) return { status: "failed", reason: "plan_mismatch", message: planProblem };

  const report: ImportReport = {
    status: "imported",
    importedAt: ctx.now,
    counts: {
      expenses: data.expenses.length,
      savings: data.savings.length,
      salaries: data.salaries.length,
      budgets: data.budgets.length,
      goals: plan.goals.length,
      newCategories: plan.categories.length,
    },
    lines: expected,
    skipped,
    backupPath,
  };

  try {
    await db.withTransactionAsync(async () => {
      for (const category of plan.categories) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, kind, system_key, name, icon, color, sort_order, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, 1000, ?, ?)`,
          [category.id, category.kind, category.name, category.kind === "saving" ? "cube-outline" : "pricetag-outline", category.kind === "saving" ? "savings" : "other", ctx.now, ctx.now],
        );
      }
      for (const goal of plan.goals) {
        await db.runAsync(
          `INSERT OR IGNORE INTO goals (id, name, category_id, target_amount, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
          [goal.id, goal.name, goal.categoryId, goal.targetAmount, ctx.now, ctx.now],
        );
      }
      for (const budget of plan.budgets) {
        await db.runAsync(
          `INSERT OR IGNORE INTO budgets (id, category_id, effective_from, amount, alert_pct, created_at, updated_at)
           VALUES (?, ?, '2000-01', ?, 80, ?, ?)`,
          [`leg_budget_${budget.categoryId}`, budget.categoryId, budget.amount, ctx.now, ctx.now],
        );
      }
      for (const tx of plan.transactions) {
        const exists = await db.getFirstAsync<{ id: string }>("SELECT id FROM transactions WHERE legacy_ref = ?", [tx.legacyRef]);
        if (exists) continue;
        await createTransaction(
          db,
          {
            type: tx.type,
            amount: tx.amount,
            title: tx.title,
            categoryId: tx.categoryId,
            goalId: tx.goalId,
            occurredAt: tx.occurredAt,
            createdAt: tx.createdAt,
            offsetMin: ctx.offsetMin,
            tz: ctx.tz,
            timePrecision: tx.precision,
            source: "legacy",
            legacyRef: tx.legacyRef,
          },
          ctx.now,
        );
      }

      const actual = await db.getAllAsync<{ month: YearMonth; type: MonthLine["type"]; count: number; total: number }>(
        `SELECT substr(occurred_local_date, 1, 7) AS month, type, COUNT(*) AS count, SUM(amount) AS total
         FROM transactions WHERE source = 'legacy' AND deleted_at IS NULL GROUP BY month, type`,
      );
      const problem = diffLines(expected, actual);
      if (problem) throw new MismatchError(problem);

      await setMeta(db, LEGACY_META_KEY, "done");
      await setMeta(db, LEGACY_REPORT_KEY, JSON.stringify(report));
    });
  } catch (error) {
    if (error instanceof MismatchError) return { status: "failed", reason: "totals_mismatch", message: error.message };
    return { status: "failed", reason: "write_failed", message: error instanceof Error ? error.message : "The data could not be written." };
  }

  return { status: "imported", report };
}
