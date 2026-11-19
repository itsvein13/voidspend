import { createTransaction, getTransaction, listTransactions, type NewTransaction } from "@/db/repo/transactions";
import { setTransactionTags, tagsFor } from "@/db/repo/tags";
import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { buildCsv } from "../export/csv";
import { resetAllData } from "../settings/reset";
import { formForDuplicate, formFromTransaction, initialForm } from "../transactions/form";

const base = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: "expense", amount: 10_000, title: "Kopi", categoryId: systemCategoryId("food"), occurredAt: epochFromLocal("2026-11-18", 9, 0, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact", ...overrides,
});

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe("tags in the add sheet's form", () => {
  it("starts with none, and an edit or a copy starts with the ones it has", async () => {
    expect(initialForm().tags).toEqual([]);
    const id = await createTransaction(db, base());
    await setTransactionTags(db, id, ["liburan", "Bali"]);
    const tx = (await getTransaction(db, id))!;
    const names = (await tagsFor(db, [id])).get(id)!;
    expect(formFromTransaction(tx, names).tags).toEqual(["Bali", "liburan"]);
    expect(formForDuplicate(tx, names).tags).toEqual(["Bali", "liburan"]);
    expect(formFromTransaction(tx).tags).toEqual([]);
  });

  it("does not share the list with the form it came from", async () => {
    const id = await createTransaction(db, base());
    const tx = (await getTransaction(db, id))!;
    const given = ["a"];
    const form = formFromTransaction(tx, given);
    form.tags.push("b");
    expect(given).toEqual(["a"]);
  });
});

describe("saving a transaction with its tags", () => {
  it("saves both in one database transaction, so a refused tag leaves nothing behind", async () => {
    let id = "";
    await expect(
      db.withTransactionAsync(async () => {
        id = await createTransaction(db, base());
        await setTransactionTags(db, id, ["fine", "x".repeat(40)]);
      }),
    ).rejects.toMatchObject({ code: "tag_too_long" });
    expect(await listTransactions(db)).toHaveLength(0);
    expect((await tagsFor(db, [id])).size).toBe(0);
  });

  it("is gone with the data when everything is deleted", async () => {
    const id = await createTransaction(db, base());
    await setTransactionTags(db, id, ["liburan"]);
    await resetAllData(db);
    expect((await tagsFor(db, [id])).size).toBe(0);
    expect(await db.getAllAsync("SELECT id FROM tags")).toEqual([]);
  });
});

describe("tags in the CSV", () => {
  it("adds a Tags column only when asked, after Source, joined by semicolons", async () => {
    const a = await createTransaction(db, base());
    const b = await createTransaction(db, base({ title: "Makan" }));
    await setTransactionTags(db, a, ["liburan", "Bali"]);
    const rows = await listTransactions(db);
    const names = await tagsFor(db, rows.map((row) => row.id));

    const plain = buildCsv(rows, { nameOf: () => "Food" });
    expect(plain.split("\r\n")[0].endsWith("Time zone,Source")).toBe(true);

    const withTags = buildCsv(rows, { nameOf: () => "Food", tagsOf: (tx) => names.get(tx.id) ?? [] });
    expect(withTags.split("\r\n")[0].endsWith("Time zone,Source,Tags")).toBe(true);
    expect(withTags).toContain(",manual,Bali; liburan\r\n");
    expect(withTags).toContain(",manual,\r\n"); // the row without tags has an empty cell, not a shifted one
    expect(rows.map((row) => row.id)).toContain(b);
  });

  it("keeps the Tags column before the place columns, and guards a tag that starts like a formula", async () => {
    const a = await createTransaction(db, base());
    await setTransactionTags(db, a, ["=cmd"]);
    const rows = await listTransactions(db);
    const names = await tagsFor(db, [a]);
    const csv = buildCsv(rows, { nameOf: () => "Food", includeLocation: true, tagsOf: (tx) => names.get(tx.id) ?? [] });
    expect(csv.split("\r\n")[0].endsWith("Source,Tags,Place,Latitude,Longitude")).toBe(true);
    expect(csv).toContain("'=cmd");
  });
});
