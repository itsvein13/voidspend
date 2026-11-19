import { createTransaction, listTransactions, type NewTransaction } from "@/db/repo/transactions";
import { listTags, setTransactionTags } from "@/db/repo/tags";
import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { DATE_PRESETS, extraCount, extraToFilter, NO_EXTRA, presetOf, presetRange } from "./filters";

describe("amount range and switches", () => {
  it("reads typed amounts, treats blank as no limit, and swaps a reversed range", () => {
    expect(extraToFilter(NO_EXTRA)).toEqual({ minAmount: undefined, maxAmount: undefined, hasReceipt: undefined, hasLocation: undefined, place: undefined });
    expect(extraToFilter({ ...NO_EXTRA, min: "50.000" })).toMatchObject({ minAmount: 50_000, maxAmount: undefined });
    expect(extraToFilter({ ...NO_EXTRA, max: "1.000.000" })).toMatchObject({ minAmount: undefined, maxAmount: 1_000_000 });
    expect(extraToFilter({ ...NO_EXTRA, min: "900.000", max: "100.000" })).toMatchObject({ minAmount: 100_000, maxAmount: 900_000 });
    expect(extraToFilter({ ...NO_EXTRA, min: "0" })).toMatchObject({ minAmount: 0 });
  });

  it("passes the switches only when they are on, and trims the place", () => {
    expect(extraToFilter({ ...NO_EXTRA, hasReceipt: true, hasLocation: true, place: "  Sudirman " })).toMatchObject({ hasReceipt: true, hasLocation: true, place: "Sudirman" });
    expect(extraToFilter({ ...NO_EXTRA, place: "   " }).place).toBeUndefined();
  });

  it("counts a range once, and every other filter that is on", () => {
    expect(extraCount(NO_EXTRA)).toBe(0);
    expect(extraCount({ ...NO_EXTRA, min: "1", max: "2" })).toBe(1);
    expect(extraCount({ min: "1", max: "", hasReceipt: true, hasLocation: true, place: "x" })).toBe(4);
    expect(extraCount({ ...NO_EXTRA, place: "  " })).toBe(0);
  });
});

describe("date presets", () => {
  const today = "2026-11-19";

  it("knows each range, ends included", () => {
    expect(presetRange("thisMonth", today)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(presetRange("lastMonth", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("last30", today)).toEqual({ from: "2026-10-21", to: "2026-11-19" });
    expect(presetRange("thisYear", today)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("crosses a year boundary", () => {
    expect(presetRange("lastMonth", "2027-01-05")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(presetRange("last30", "2027-01-05")).toEqual({ from: "2026-12-07", to: "2027-01-05" });
    expect(presetRange("thisMonth", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" }); // a leap year
  });

  it("finds the preset a range equals, and none for any other", () => {
    for (const preset of DATE_PRESETS) {
      const { from, to } = presetRange(preset, today);
      expect(presetOf(from, to, today)).toBe(preset);
    }
    expect(presetOf("2026-11-01", "2026-11-15", today)).toBeNull();
    expect(presetOf("2026-11-01", undefined, today)).toBeNull();
    expect(presetOf(undefined, undefined, today)).toBeNull();
  });
});

describe("the repository filters behind them", () => {
  let db: TestDb;
  const base = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
    type: "expense", amount: 10_000, title: "x", categoryId: systemCategoryId("food"), occurredAt: epochFromLocal("2026-11-10", 12, 0, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact", ...overrides,
  });
  const titles = async (filter: Parameters<typeof listTransactions>[1]) => (await listTransactions(db, filter)).map((tx) => tx.title).sort();

  beforeEach(async () => {
    db = await createMigratedDb();
    const a = await createTransaction(db, base({ title: "Kopi", amount: 25_000, location: { name: "Jl. Sudirman", lat: null, lng: null, source: "manual" } }));
    const b = await createTransaction(db, base({ title: "Makan", amount: 80_000, counterparty: "Warung" }));
    await createTransaction(db, base({ title: "Bensin", amount: 150_000 }));
    await setTransactionTags(db, a, ["kantor"]);
    await setTransactionTags(db, b, ["liburan", "kantor"]);
  });

  it("limits by amount, inclusive at both ends", async () => {
    expect(await titles({ minAmount: 25_000, maxAmount: 80_000 })).toEqual(["Kopi", "Makan"]);
    expect(await titles({ minAmount: 100_000 })).toEqual(["Bensin"]);
  });

  it("limits by tag", async () => {
    const tags = await listTags(db);
    const kantor = tags.find((tag) => tag.name === "kantor")!;
    const liburan = tags.find((tag) => tag.name === "liburan")!;
    expect(await titles({ tagId: kantor.id })).toEqual(["Kopi", "Makan"]);
    expect(await titles({ tagId: liburan.id })).toEqual(["Makan"]);
  });

  it("limits to the ones with a saved place, and by part of its name", async () => {
    expect(await titles({ hasLocation: true })).toEqual(["Kopi"]);
    expect(await titles({ place: "sudir" })).toEqual(["Kopi"]);
    expect(await titles({ place: "nowhere" })).toEqual([]);
    expect(await titles({ hasLocation: false })).toEqual(["Bensin", "Kopi", "Makan"]); // false is no condition
  });

  it("finds a tag or a place by the search box too", async () => {
    expect(await titles({ search: "liburan" })).toEqual(["Makan"]);
    expect(await titles({ search: "kantor" })).toEqual(["Kopi", "Makan"]);
    expect(await titles({ search: "Sudirman" })).toEqual(["Kopi"]);
    expect(await titles({ search: "warung" })).toEqual(["Makan"]);
  });

  it("combines filters, and a wildcard typed in a place is only text", async () => {
    expect(await titles({ minAmount: 50_000, search: "kantor" })).toEqual(["Makan"]);
    expect(await titles({ place: "%" })).toEqual([]);
  });

  it("finds the ones that have a receipt", async () => {
    expect(await titles({ hasReceipt: true })).toEqual([]);
    await db.runAsync("INSERT INTO receipts (id, status, created_at, updated_at) VALUES ('r1', 'confirmed', 1, 1)");
    await db.runAsync("UPDATE transactions SET receipt_id = 'r1' WHERE title = 'Bensin'");
    expect(await titles({ hasReceipt: true })).toEqual(["Bensin"]);
  });
});
