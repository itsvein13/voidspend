// Tags: short labels the person puts on a transaction, for things a category does not say ("liburan", "kantor").
// A tag is one row, found by name without regard to case, and linked to any number of transactions.
import { newId } from "@/lib/ids";

import { ValidationError, type Db } from "../types";

export const MAX_TAG_LENGTH = 24;
export const MAX_TAGS_PER_TRANSACTION = 8;

export type Tag = { id: string; name: string; createdAt: number };
/** A tag with the number of transactions that carry it. Deleted transactions are not counted. */
export type TagUsage = Tag & { count: number };

/** What is stored for what was typed: no leading hash, single spaces, trimmed. An empty result means "no tag". */
export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
}

function checkedName(raw: string): string {
  const name = normalizeTagName(raw);
  if (name === "") throw new ValidationError("tag_empty", "Write a name for the tag.");
  if (name.length > MAX_TAG_LENGTH) throw new ValidationError("tag_too_long", `A tag can have at most ${MAX_TAG_LENGTH} characters.`);
  return name;
}

/** The names to keep: normalized, empty ones dropped, repeats (ignoring case) dropped, the first spelling wins. */
export function cleanTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of names) {
    if (normalizeTagName(raw) === "") continue;
    const name = checkedName(raw);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(name);
  }
  if (kept.length > MAX_TAGS_PER_TRANSACTION) {
    throw new ValidationError("too_many_tags", `A transaction can have at most ${MAX_TAGS_PER_TRANSACTION} tags.`);
  }
  return kept;
}

type UsageRow = { id: string; name: string; created_at: number; n: number };

/** Every tag with how many transactions use it, most used first. Used to suggest tags and to manage them. */
export async function listTags(db: Db): Promise<TagUsage[]> {
  const rows = await db.getAllAsync<UsageRow>(
    `SELECT g.id, g.name, g.created_at, COUNT(t.id) AS n
       FROM tags g
       LEFT JOIN transaction_tags tt ON tt.tag_id = g.id
       LEFT JOIN transactions t ON t.id = tt.transaction_id AND t.deleted_at IS NULL
      GROUP BY g.id
      ORDER BY n DESC, g.name COLLATE NOCASE`,
  );
  return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at, count: row.n }));
}

const CHUNK = 400;

/** The tag names of each transaction in `ids`, sorted by name. A transaction without tags has no entry. */
export async function tagsFor(db: Db, ids: readonly string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (let start = 0; start < ids.length; start += CHUNK) {
    const part = ids.slice(start, start + CHUNK);
    const rows = await db.getAllAsync<{ tx: string; name: string }>(
      `SELECT tt.transaction_id AS tx, g.name AS name
         FROM transaction_tags tt JOIN tags g ON g.id = tt.tag_id
        WHERE tt.transaction_id IN (${part.map(() => "?").join(",")})
        ORDER BY g.name COLLATE NOCASE`,
      [...part],
    );
    for (const row of rows) {
      const list = result.get(row.tx);
      if (list) list.push(row.name);
      else result.set(row.tx, [row.name]);
    }
  }
  return result;
}

/**
 * Replaces the tags of a transaction with `names`, creating the ones that do not exist yet. The caller wraps it
 * with the write of the transaction itself in one database transaction, so a failure leaves neither half behind.
 */
export async function setTransactionTags(db: Db, transactionId: string, names: readonly string[], now: number = Date.now()): Promise<void> {
  const kept = cleanTagNames(names);
  await db.runAsync("DELETE FROM transaction_tags WHERE transaction_id = ?", [transactionId]);
  for (const name of kept) {
    const found = await db.getFirstAsync<{ id: string }>("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", [name]);
    let tagId = found?.id;
    if (!tagId) {
      tagId = newId();
      await db.runAsync("INSERT INTO tags (id, name, created_at) VALUES (?,?,?)", [tagId, name, now]);
    }
    await db.runAsync("INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?,?)", [transactionId, tagId]);
  }
}

/** Gives a tag a new name everywhere it is used. A name that another tag already has is refused. */
export async function renameTag(db: Db, id: string, raw: string): Promise<void> {
  const name = checkedName(raw);
  const clash = await db.getFirstAsync<{ id: string }>("SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id <> ?", [name, id]);
  if (clash) throw new ValidationError("tag_exists", "A tag with that name already exists.");
  const result = await db.runAsync("UPDATE tags SET name = ? WHERE id = ?", [name, id]);
  if (result.changes === 0) throw new ValidationError("not_found", "This tag no longer exists.");
}

/** Removes a tag and takes it off every transaction. The transactions stay. */
export async function deleteTag(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM transaction_tags WHERE tag_id = ?", [id]);
  await db.runAsync("DELETE FROM tags WHERE id = ?", [id]);
}
