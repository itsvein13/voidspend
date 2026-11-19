// A real SQLite for unit tests: Node's built-in `node:sqlite` behind the same
// `Db` interface the app uses with expo-sqlite. It is loaded through
// process.getBuiltinModule because Jest's resolver does not know the
// `node:sqlite` prefix. Tests therefore run the real SQL, indexes and CHECKs.
import { migrate } from "@/db/migrate";
import type { Db, SqlValue } from "@/db/types";

type Statement = {
  run(...params: SqlValue[]): { changes: number | bigint };
  all(...params: SqlValue[]): Record<string, unknown>[];
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
};
type RawDb = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };

export type TestDb = Db & { close(): void; raw: RawDb };

export function createTestDb(): TestDb {
  const nodeProcess = (globalThis as unknown as { process: { getBuiltinModule(id: string): unknown } }).process;
  const sqlite = nodeProcess.getBuiltinModule("node:sqlite") as { DatabaseSync: new (path: string) => RawDb };
  const raw = new sqlite.DatabaseSync(":memory:");
  let depth = 0;

  const plain = <T>(row: Record<string, unknown>) => ({ ...row }) as T;

  return {
    raw,
    close: () => raw.close(),
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    runAsync: async (sql, params = []) => ({ changes: Number(raw.prepare(sql).run(...params).changes) }),
    getAllAsync: async <T>(sql: string, params: SqlValue[] = []) =>
      raw.prepare(sql).all(...params).map((row) => plain<T>(row)),
    getFirstAsync: async <T>(sql: string, params: SqlValue[] = []) => {
      const row = raw.prepare(sql).get(...params);
      return row ? plain<T>(row) : null;
    },
    withTransactionAsync: async (task) => {
      // Nested calls join the outer transaction, like a savepoint-free flat one.
      if (depth > 0) {
        await task();
        return;
      }
      raw.exec("BEGIN");
      depth++;
      try {
        await task();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      } finally {
        depth--;
      }
    },
  };
}

/** A migrated in-memory database, the usual starting point of a repository test. */
export async function createMigratedDb(): Promise<TestDb> {
  const db = createTestDb();
  await migrate(db);
  return db;
}
