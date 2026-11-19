import { init001 } from "./migrations/001_init";
import type { Db } from "./types";

export type Migration = { version: number; name: string; sql: string };

// Append only. The version is stored in PRAGMA user_version.
export const migrations: readonly Migration[] = [{ version: 1, name: "init", sql: init001 }];

export const LATEST_VERSION = migrations[migrations.length - 1].version;

/**
 * Brings the database up to the latest schema. Each migration runs in its own
 * transaction together with the version bump, so a crash leaves either the old
 * schema or the new one, never half of it.
 */
export async function migrate(db: Db): Promise<{ from: number; to: number }> {
  // Foreign keys are off by default and are a per connection setting.
  await db.execAsync("PRAGMA foreign_keys = ON;");
  try {
    await db.execAsync("PRAGMA journal_mode = WAL;");
  } catch {
    // Web builds have no WAL. The data is just as safe, only slower to write.
  }

  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  if (current > LATEST_VERSION) {
    throw new Error(`The database is version ${current} but this app only knows up to ${LATEST_VERSION}. Update the app.`);
  }

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
  return { from: current, to: LATEST_VERSION };
}
