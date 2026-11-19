import { confirmReceipt, createReceiptDraft, discardReceipt, getReceipt, listDrafts, listReceiptItems, saveDraft } from "@/db/repo/receipts";
import { createTransaction, listTransactions, type NewTransaction } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { findSamePhoto, findSimilarExpense, similarMerchant } from "./duplicates";
import { isOcrAvailable, recognizeReceipt, setOcrProvider } from "./ocr";
import { parseReceipt } from "./parse";
import { canSaveReview, checkReview, emptyReview, reviewFromParsed, reviewMoment, reviewToTransaction, type ReviewClock } from "./review";
import { categoryKeyFromText, suggestCategory } from "./suggest";

const clock: ReviewClock = { now: Date.UTC(2026, 10, 18, 9, 0), offsetMin: 420, tz: "Asia/Jakarta" }; // 16:00 on 18 Nov
const at = (date: string, hour = 12) => epochFromLocal(date, hour, 0, 420);
let counter = 0;
const nextId = () => `i${++counter}`;

const RECEIPT = `INDOMARET
18/11/2026 14:32
INDOMIE GORENG 2 x 3.500 7.000
AQUA 600ML 3.500
TOTAL 10.500
TUNAI 20.000`;

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
  counter = 0;
  setOcrProvider(null);
});

describe("review state", () => {
  it("comes from the parsed receipt, keeps what was unsure flagged, and defaults to nothing chosen", () => {
    const review = reviewFromParsed(parseReceipt(RECEIPT), nextId);
    expect(review).toMatchObject({ merchant: "Indomaret", date: "2026-11-18", time: { hour: 14, minute: 32 }, timeKnown: true, total: 10_500, paymentMethod: "cash", categoryId: null });
    expect(review.items.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(review.flags).toEqual({ merchant: true, date: true, total: "high" });
    expect(checkReview(review)).toEqual({ ok: true, computed: 10_500, diff: 0 });
  });

  it("falls back to the sum of the lines when no total was read, and says it is not sure", () => {
    const review = reviewFromParsed(parseReceipt("KIOS\nBERAS 50.000\nGULA 20.000"), nextId);
    expect(review.total).toBe(70_000);
    expect(review.flags.total).toBe("none");
  });

  it("notices when the lines and the total disagree, and when they are only a rounding apart", () => {
    const review = reviewFromParsed(parseReceipt(RECEIPT), nextId);
    expect(checkReview({ ...review, total: 11_000 }).ok).toBe(true); // 500 is within rounding
    expect(checkReview({ ...review, total: 12_000 })).toMatchObject({ ok: false, diff: 1_500 });
    expect(checkReview({ ...review, items: [] }).ok).toBe(true); // nothing to check against
  });

  it("only needs a total to be saved", () => {
    expect(canSaveReview(emptyReview())).toBe(false);
    expect(canSaveReview({ ...emptyReview(), total: 5_000 })).toBe(true);
    expect(canSaveReview({ ...emptyReview(), total: 12.5 })).toBe(false);
  });

  it("dates the expense by the receipt, at its printed time or at noon, and never in the future", () => {
    const review = reviewFromParsed(parseReceipt(RECEIPT), nextId);
    expect(reviewMoment(review, clock)).toMatchObject({ occurredAt: epochFromLocal("2026-11-18", 14, 32, 420), precision: "exact", date: "2026-11-18" });
    expect(reviewMoment({ ...review, timeKnown: false }, clock)).toMatchObject({ occurredAt: at("2026-11-18"), precision: "date" });
    expect(reviewMoment({ ...review, date: null }, clock).date).toBe("2026-11-18"); // unread date: today
    expect(reviewMoment({ ...review, date: "2031-01-01" }, clock).date).toBe("2026-11-18"); // a misread year
  });

  it("builds the expense with the merchant as title and counterparty and Other as the default category", () => {
    const review = { ...reviewFromParsed(parseReceipt(RECEIPT), nextId), address: "JL. SUDIRMAN" };
    expect(reviewToTransaction(review, clock, "r1", "Receipt")).toMatchObject({
      type: "expense", amount: 10_500, title: "Indomaret", counterparty: "Indomaret", categoryId: systemCategoryId("other"),
      source: "receipt", receiptId: "r1", paymentMethod: "cash", location: { name: "JL. SUDIRMAN", lat: null, lng: null, source: "receipt" },
    });
    expect(reviewToTransaction({ ...review, merchant: " ", categoryId: systemCategoryId("food") }, clock, "r1", "Receipt")).toMatchObject({ title: "Receipt", counterparty: null, categoryId: systemCategoryId("food") });
  });
});

describe("category suggestion", () => {
  it("uses a small keyword table", () => {
    expect(categoryKeyFromText("Pertamina", [])).toBe("transport");
    expect(categoryKeyFromText("Apotek Sehat", [])).toBe("health");
    expect(categoryKeyFromText("Kopi Kenangan", [])).toBe("food");
    expect(categoryKeyFromText("Indomaret", [])).toBe("shopping");
    expect(categoryKeyFromText("", ["TOKEN LISTRIK"])).toBe("bills");
    expect(categoryKeyFromText("XYZ", ["abc"])).toBeNull();
  });

  it("prefers what this person chose for the same merchant last time", async () => {
    expect(await suggestCategory(db, "Indomaret", [])).toBe(systemCategoryId("shopping")); // the table
    for (let i = 0; i < 2; i++) await createTransaction(db, base({ counterparty: "Indomaret", categoryId: systemCategoryId("food") }));
    await createTransaction(db, base({ counterparty: "Indomaret", categoryId: systemCategoryId("bills") }));
    expect(await suggestCategory(db, "indomaret", [])).toBe(systemCategoryId("food")); // history, ignoring case
  });
});

const base = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: "expense", amount: 10_500, title: "x", categoryId: systemCategoryId("food"), occurredAt: at("2026-11-18"), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact", ...overrides,
});

describe("duplicate detection", () => {
  it("matches merchant names that are probably one place", () => {
    expect(similarMerchant("Indomaret", "INDOMARET SUDIRMAN")).toBe(true);
    expect(similarMerchant("Kopi Kenangan", "kopi-kenangan")).toBe(true);
    expect(similarMerchant("Indomaret", "Alfamart")).toBe(false);
    expect(similarMerchant("", "Alfamart")).toBe(false);
  });

  it("warns softly about the same total on the same day at a similar merchant, a day either side included", async () => {
    await createTransaction(db, base({ counterparty: "Indomaret Sudirman" }));
    const hit = await findSimilarExpense(db, { total: 10_500, date: "2026-11-19", merchant: "Indomaret" });
    expect(hit?.counterparty).toBe("Indomaret Sudirman");
    expect(await findSimilarExpense(db, { total: 10_500, date: "2026-11-21", merchant: "Indomaret" })).toBeNull(); // too far
    expect(await findSimilarExpense(db, { total: 10_000, date: "2026-11-18", merchant: "Indomaret" })).toBeNull(); // another amount
    expect(await findSimilarExpense(db, { total: 10_500, date: "2026-11-18", merchant: "Alfamart" })).toBeNull(); // another place
    expect(await findSimilarExpense(db, { total: 10_500, date: "2026-11-18", merchant: "" })).not.toBeNull(); // no merchant: total and day only
  });

  it("warns strongly about a photo that was already saved, and not about drafts or the receipt itself", async () => {
    const draft = await createReceiptDraft(db, { imagePath: "/a.jpg", imageHash: "h1", ocrText: null, draftJson: "{}" });
    expect(await findSamePhoto(db, "h1")).toBeNull(); // a draft is not a saved receipt
    await confirmReceipt(db, draft, base(), []);
    expect(await findSamePhoto(db, "h1")).toBe(draft);
    expect(await findSamePhoto(db, "h1", draft)).toBeNull();
    expect(await findSamePhoto(db, "other")).toBeNull();
  });
});

describe("receipts in the database", () => {
  it("keeps a draft that can be saved again and listed", async () => {
    const id = await createReceiptDraft(db, { imagePath: "/a.jpg", imageHash: "h", ocrText: "TEXT", draftJson: '{"v":1}' }, 1_000);
    await saveDraft(db, id, '{"v":2}', 2_000);
    expect(await getReceipt(db, id)).toMatchObject({ status: "draft", draftJson: '{"v":2}', ocrText: "TEXT", updatedAt: 2_000, createdAt: 1_000 });
    expect((await listDrafts(db)).map((r) => r.id)).toEqual([id]);
  });

  it("confirms a receipt into an expense with its lines, once", async () => {
    const review = reviewFromParsed(parseReceipt(RECEIPT), nextId);
    const id = await createReceiptDraft(db, { imagePath: "/a.jpg", imageHash: "h", ocrText: "T", draftJson: "{}" });
    const txId = await confirmReceipt(db, id, reviewToTransaction({ ...review, categoryId: systemCategoryId("shopping") }, clock, id, "Receipt"), review.items);

    const [tx] = await listTransactions(db);
    expect(tx).toMatchObject({ id: txId, amount: 10_500, source: "receipt", receiptId: id, title: "Indomaret", occurredLocalDate: "2026-11-18" });
    expect((await listReceiptItems(db, id)).map((i) => [i.name, i.quantity, i.lineTotal])).toEqual([["INDOMIE GORENG", 2, 7_000], ["AQUA 600ML", 1, 3_500]]);
    expect(await getReceipt(db, id)).toMatchObject({ status: "confirmed", draftJson: null });
    expect(await listDrafts(db)).toEqual([]);

    // A second tap on Save cannot add a second expense.
    await expect(confirmReceipt(db, id, base(), [])).rejects.toMatchObject({ code: "receipt_not_draft" });
    expect(await listTransactions(db)).toHaveLength(1);
  });

  it("rolls the whole save back when the expense is invalid", async () => {
    const id = await createReceiptDraft(db, { imagePath: null, imageHash: null, ocrText: null, draftJson: "{}" });
    await expect(confirmReceipt(db, id, base({ amount: 0 }), [{ kind: "item", name: "A", quantity: 1, unitPrice: null, lineTotal: 1 }])).rejects.toMatchObject({ code: "amount_invalid" });
    expect(await listReceiptItems(db, id)).toEqual([]);
    expect((await getReceipt(db, id))?.status).toBe("draft");
  });

  it("discards a draft and hands back the photo to delete", async () => {
    const id = await createReceiptDraft(db, { imagePath: "/a.jpg", imageHash: "h", ocrText: "TEXT", draftJson: "{}" });
    expect(await discardReceipt(db, id)).toBe("/a.jpg");
    expect(await getReceipt(db, id)).toMatchObject({ status: "discarded", imagePath: null, ocrText: null, draftJson: null });
    expect(await discardReceipt(db, id)).toBeNull(); // nothing left to delete
    expect(await listDrafts(db)).toEqual([]);
  });
});

describe("text recognition outcomes", () => {
  it("says unavailable without a reader, and reads through a provider when there is one", async () => {
    expect(isOcrAvailable()).toBe(false);
    expect(await recognizeReceipt("file:///a.jpg")).toEqual({ status: "unavailable" });

    setOcrProvider(async () => ({ text: RECEIPT, lines: [] }));
    expect(isOcrAvailable()).toBe(true);
    expect(await recognizeReceipt("file:///a.jpg")).toMatchObject({ status: "ok" });
  });

  it("tells an empty photo from a failure, and stops when cancelled", async () => {
    setOcrProvider(async () => ({ text: "  ", lines: [] }));
    expect(await recognizeReceipt("x")).toEqual({ status: "empty" });
    setOcrProvider(async () => {
      throw new Error("model not ready");
    });
    expect(await recognizeReceipt("x")).toEqual({ status: "error", message: "model not ready" });
    setOcrProvider(async () => ({ text: "A", lines: [] }));
    expect(await recognizeReceipt("x", () => true)).toEqual({ status: "error", message: "cancelled" });
  });
});
