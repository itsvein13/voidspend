import { newId } from "@/lib/ids";

import { ValidationError, type CategoryKind, type Db } from "../types";

export type Category = {
  id: string;
  kind: CategoryKind;
  /** Set for the categories that ship with the app. Their label comes from i18n. */
  systemKey: string | null;
  /** Set for categories the person made. */
  name: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  archivedAt: number | null;
};

type Row = {
  id: string;
  kind: CategoryKind;
  system_key: string | null;
  name: string | null;
  icon: string;
  color: string;
  sort_order: number;
  archived_at: number | null;
};

const map = (row: Row): Category => ({
  id: row.id,
  kind: row.kind,
  systemKey: row.system_key,
  name: row.name,
  icon: row.icon,
  color: row.color,
  sortOrder: row.sort_order,
  archivedAt: row.archived_at,
});

export async function listCategories(db: Db, options: { kind?: CategoryKind; includeArchived?: boolean } = {}): Promise<Category[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (options.kind) {
    where.push("kind = ?");
    params.push(options.kind);
  }
  if (!options.includeArchived) where.push("archived_at IS NULL");
  const rows = await db.getAllAsync<Row>(
    `SELECT id, kind, system_key, name, icon, color, sort_order, archived_at FROM categories
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY sort_order, name`,
    params,
  );
  return rows.map(map);
}

export async function getCategory(db: Db, id: string): Promise<Category | null> {
  const row = await db.getFirstAsync<Row>(
    "SELECT id, kind, system_key, name, icon, color, sort_order, archived_at FROM categories WHERE id = ?",
    [id],
  );
  return row ? map(row) : null;
}

/** A category the person made. Names are unique per kind, ignoring case. */
export async function createCategory(
  db: Db,
  input: { kind: CategoryKind; name: string; icon: string; color: string; id?: string },
  now: number = Date.now(),
): Promise<string> {
  const name = input.name.trim();
  if (name === "") throw new ValidationError("name_required", "Give the category a name.");
  if (name.length > 40) throw new ValidationError("name_too_long", "The name is longer than 40 characters.");
  const clash = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM categories WHERE kind = ? AND lower(name) = lower(?) AND archived_at IS NULL",
    [input.kind, name],
  );
  if (clash) throw new ValidationError("category_exists", "A category with that name already exists.");

  const next = await db.getFirstAsync<{ n: number }>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM categories WHERE kind = ?", [input.kind]);
  const id = input.id ?? newId();
  await db.runAsync(
    `INSERT INTO categories (id, kind, system_key, name, icon, color, sort_order, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    [id, input.kind, name, input.icon, input.color, next?.n ?? 0, now, now],
  );
  return id;
}

/** Hides a category from pickers. Old transactions keep pointing at it. */
export async function archiveCategory(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE categories SET archived_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
}

export async function restoreCategory(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE categories SET archived_at = NULL, updated_at = ? WHERE id = ?", [now, id]);
}
