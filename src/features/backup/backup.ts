// A backup is one JSON file with every table. Restoring replaces everything on the
// phone with the file's contents, in one transaction, so a bad file changes nothing.
// Receipt photos are not in the file (they are large and live in the app folder),
// so a restored receipt keeps its lines and total but no photo.
import { LATEST_VERSION } from "@/db/migrate";
import { ValidationError, type Db, type SqlValue } from "@/db/types";

export const BACKUP_FORMAT = 1;

/** Parents before children, so foreign keys hold while rows are inserted. */
export const BACKUP_TABLES = [
  "wallets",
  "categories",
  "goals",
  "recurring_rules",
  "receipts",
  "receipt_items",
  "tags",
  "transactions",
  "transaction_tags",
  "budgets",
  "app_meta",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupRow = Record<string, SqlValue>;

export type Backup = {
  app: "voidspend";
  format: typeof BACKUP_FORMAT;
  schema: number;
  createdAt: number;
  tables: Record<BackupTable, BackupRow[]>;
};

export type ParseResult = { ok: true; backup: Backup } | { ok: false; reason: "not_json" | "not_backup" | "newer" | "damaged" };

/** Reads every table. Photo paths are left out because they only mean something on this phone. */
export async function createBackup(db: Db, now: number = Date.now()): Promise<Backup> {
  const tables = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    const rows = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
    tables[table] = table === "receipts" ? rows.map((row) => ({ ...row, image_path: null })) : rows;
  }
  return { app: "voidspend", format: BACKUP_FORMAT, schema: LATEST_VERSION, createdAt: now, tables };
}

export const backupFileName = (date: string) => `voidspend-backup-${date}.json`;

const isScalar = (value: unknown): value is SqlValue => value === null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value));

/** Checks a file's text before anything is restored. It says why a file is refused. */
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  if (typeof data !== "object" || data === null) return { ok: false, reason: "not_backup" };
  const file = data as Record<string, unknown>;
  if (file.app !== "voidspend" || file.format !== BACKUP_FORMAT) return { ok: false, reason: "not_backup" };
  if (typeof file.schema !== "number" || typeof file.createdAt !== "number") return { ok: false, reason: "damaged" };
  if (file.schema > LATEST_VERSION) return { ok: false, reason: "newer" };
  const tables = file.tables as Record<string, unknown> | undefined;
  if (typeof tables !== "object" || tables === null) return { ok: false, reason: "damaged" };

  for (const table of BACKUP_TABLES) {
    const rows = tables[table];
    if (!Array.isArray(rows)) return { ok: false, reason: "damaged" };
    for (const row of rows) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) return { ok: false, reason: "damaged" };
      if (!Object.values(row).every(isScalar)) return { ok: false, reason: "damaged" };
    }
  }
  // The shipped categories and the default wallet must be there, or the app would have nothing to attach rows to.
  if ((tables.wallets as BackupRow[]).length === 0 || (tables.categories as BackupRow[]).length === 0) return { ok: false, reason: "damaged" };
  return { ok: true, backup: file as unknown as Backup };
}

/** A short count for the confirmation screen. */
export function summarize(backup: Backup): { transactions: number; goals: number; createdAt: number } {
  return { transactions: backup.tables.transactions.filter((row) => row.deleted_at === null || row.deleted_at === undefined).length, goals: backup.tables.goals.length, createdAt: backup.createdAt };
}

/**
 * Replaces everything with the backup, in one transaction. Column names come from
 * the file, so each one is checked against the real table before it is used in SQL.
 * A row count that differs from the file after inserting rolls the whole thing back.
 */
export async function restoreBackup(db: Db, backup: Backup): Promise<void> {
  const known = new Map<BackupTable, Set<string>>();
  for (const table of BACKUP_TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    known.set(table, new Set(info.map((column) => column.name)));
  }
  for (const table of BACKUP_TABLES) {
    for (const row of backup.tables[table]) {
      if (!Object.keys(row).every((column) => known.get(table)!.has(column))) throw new ValidationError("backup_damaged");
    }
  }

  await db.withTransactionAsync(async () => {
    for (const table of [...BACKUP_TABLES].reverse()) await db.execAsync(`DELETE FROM ${table};`);
    for (const table of BACKUP_TABLES) {
      for (const row of backup.tables[table]) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        await db.runAsync(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, columns.map((column) => row[column]));
      }
      const count = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      if ((count?.n ?? 0) !== backup.tables[table].length) throw new ValidationError("backup_damaged");
    }
  });
}
