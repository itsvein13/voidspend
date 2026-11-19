// The small slice of the expo-sqlite API this app uses. Repositories take a
// `Db`, so the same code runs on the device (expo-sqlite) and in unit tests
// (Node's built-in SQLite, see src/test/sqliteDb.ts) with the real SQL and the
// real constraints.
export type SqlValue = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Rolls back when the task throws. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export type TransactionType =
  | "expense"
  | "income"
  | "saving_deposit"
  | "saving_withdrawal"
  | "transfer"
  | "adjustment";

export type TimePrecision = "exact" | "date" | "estimated";
export type TransactionSource = "manual" | "receipt" | "recurring" | "import" | "legacy";
export type CategoryKind = "expense" | "income" | "saving";

export const DEFAULT_WALLET_ID = "wal_default";

/** Thrown before anything is written, so the UI can say what to fix (web SQLite errors are generic). */
export class ValidationError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "ValidationError";
    this.code = code;
  }
}
