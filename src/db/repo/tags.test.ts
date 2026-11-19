import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { cleanTagNames, deleteTag, listTags, MAX_TAG_LENGTH, MAX_TAGS_PER_TRANSACTION, normalizeTagName, renameTag, setTransactionTags, tagsFor } from "./tags";
import { createTransaction, softDeleteTransaction, type NewTransaction } from "./transactions";

const base = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: "expense", amount: 10_000, title: "Kopi", categoryId: systemCategoryId("food"), occurredAt: epochFromLocal("2026-11-18", 9, 0, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact", ...overrides,
});

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe("tag names", () => {
  it("drops the hash, trims and joins spaces", () => {
    expect(normalizeTagName("  #liburan ")).toBe("liburan");
    expect(normalizeTagName("##  kerja   kantor")).toBe("kerja kantor");
    expect(normalizeTagName("#")).toBe("");
    expect(normalizeTagName("   ")).toBe("");
  });

  it("keeps the first spelling of a repeat, ignoring case, and skips empty ones", () => {
    expect(cleanTagNames(["Liburan", "liburan", " #LIBURAN", "", "  ", "kantor"])).toEqual(["Liburan", "kantor"]);
  });

  it("refuses a name that is too long and too many tags", () => {
    expect(() => cleanTagNames(["x".repeat(MAX_TAG_LENGTH + 1)])).toThrow(expect.objectContaining({ code: "tag_too_long" }));
    expect(cleanTagNames(["x".repeat(MAX_TAG_LENGTH)])).toHaveLength(1);
    const many = Array.from({ length: MAX_TAGS_PER_TRANSACTION + 1 }, (_, index) => `tag${index}`);
    expect(() => cleanTagNames(many)).toThrow(expect.objectContaining({ code: "too_many_tags" }));
    expect(cleanTagNames(many.slice(0, MAX_TAGS_PER_TRANSACTION))).toHaveLength(MAX_TAGS_PER_TRANSACTION);
  });
});

describe("tags on transactions", () => {
  it("creates missing tags, reuses existing ones whatever the case, and reads them back sorted", async () => {
    const a = await createTransaction(db, base());
    const b = await createTransaction(db, base({ title: "Makan" }));
    await setTransactionTags(db, a, ["liburan", "Bali"]);
    await setTransactionTags(db, b, ["LIBURAN", "kantor"]);

    const names = await tagsFor(db, [a, b]);
    expect(names.get(a)).toEqual(["Bali", "liburan"]);
    expect(names.get(b)).toEqual(["kantor", "liburan"]); // the stored spelling, not the typed one
    expect((await listTags(db)).map((tag) => [tag.name, tag.count])).toEqual([
      ["liburan", 2],
      ["Bali", 1],
      ["kantor", 1],
    ]);
  });

  it("replaces the tags on a second call, and clears them with an empty list", async () => {
    const id = await createTransaction(db, base());
    await setTransactionTags(db, id, ["a", "b"]);
    await setTransactionTags(db, id, ["b", "c"]);
    expect((await tagsFor(db, [id])).get(id)).toEqual(["b", "c"]);
    await setTransactionTags(db, id, []);
    expect((await tagsFor(db, [id])).has(id)).toBe(false);
  });

  it("leaves the old tags alone when a name is refused", async () => {
    const id = await createTransaction(db, base());
    await setTransactionTags(db, id, ["a"]);
    await expect(setTransactionTags(db, id, ["fine", "x".repeat(MAX_TAG_LENGTH + 1)])).rejects.toMatchObject({ code: "tag_too_long" });
    expect((await tagsFor(db, [id])).get(id)).toEqual(["a"]);
  });

  it("does not count a deleted transaction in the usage, and keeps its tags for a restore", async () => {
    const id = await createTransaction(db, base());
    await setTransactionTags(db, id, ["liburan"]);
    await softDeleteTransaction(db, id);
    expect((await listTags(db))[0]).toMatchObject({ name: "liburan", count: 0 });
    expect((await tagsFor(db, [id])).get(id)).toEqual(["liburan"]);
  });

  it("reads more transactions than one query holds", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 450; index++) ids.push(await createTransaction(db, base({ title: `T${index}` })));
    await setTransactionTags(db, ids[0], ["first"]);
    await setTransactionTags(db, ids[449], ["last"]);
    const names = await tagsFor(db, ids);
    expect(names.get(ids[0])).toEqual(["first"]);
    expect(names.get(ids[449])).toEqual(["last"]);
  });
});

describe("renaming and deleting tags", () => {
  it("renames everywhere, keeps its own name valid and refuses another tag's name", async () => {
    const id = await createTransaction(db, base());
    await setTransactionTags(db, id, ["liburan", "kantor"]);
    const [liburan] = (await listTags(db)).filter((tag) => tag.name === "liburan");
    await renameTag(db, liburan.id, "#Trip");
    expect((await tagsFor(db, [id])).get(id)).toEqual(["kantor", "Trip"]);
    await renameTag(db, liburan.id, "trip"); // same tag, different case
    await expect(renameTag(db, liburan.id, "KANTOR")).rejects.toMatchObject({ code: "tag_exists" });
    await expect(renameTag(db, liburan.id, "  ")).rejects.toMatchObject({ code: "tag_empty" });
    await expect(renameTag(db, "nope", "x")).rejects.toMatchObject({ code: "not_found" });
  });

  it("deletes a tag from every transaction and keeps the transactions", async () => {
    const a = await createTransaction(db, base());
    const b = await createTransaction(db, base({ title: "Makan" }));
    await setTransactionTags(db, a, ["liburan", "x"]);
    await setTransactionTags(db, b, ["liburan"]);
    const [liburan] = (await listTags(db)).filter((tag) => tag.name === "liburan");
    await deleteTag(db, liburan.id);
    const names = await tagsFor(db, [a, b]);
    expect(names.get(a)).toEqual(["x"]);
    expect(names.has(b)).toBe(false);
    expect((await listTags(db)).map((tag) => tag.name)).toEqual(["x"]);
  });
});
