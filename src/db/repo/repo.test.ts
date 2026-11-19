import { en } from "@/i18n/en";
import { categoryLabel } from "@/i18n";
import { epochFromLocal } from "@/lib/dates";
import { remaining } from "@/lib/finance";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { systemCategoryId } from "../systemCategories";
import { ValidationError } from "../types";
import { setBudget, budgetStatuses } from "./budgets";
import { archiveCategory, createCategory, getCategory, listCategories } from "./categories";
import { createGoal, getGoal, listGoals } from "./goals";
import { getMeta, setMeta } from "./meta";
import {
  categoryTotals,
  createTransaction,
  getTransaction,
  listTransactions,
  monthTotals,
  purgeDeleted,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
  type NewTransaction,
} from "./transactions";

const JKT = { offsetMin: 420, tz: "Asia/Jakarta" };
const food = systemCategoryId("food");
const at = (date: string, hour = 12, minute = 0) => epochFromLocal(date, hour, minute, 420);

const expense = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: "expense",
  amount: 25_000,
  title: "Kopi",
  categoryId: food,
  occurredAt: at("2026-11-18", 8, 12),
  timePrecision: "exact",
  ...JKT,
  ...overrides,
});

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "ValidationError", code });
  await expect(promise).rejects.toBeInstanceOf(ValidationError);
}

describe("createTransaction", () => {
  it("stores the time, the zone and the local date separately from when the row was written", async () => {
    const id = await createTransaction(db, expense({ occurredAt: at("2026-07-31", 23, 30) }), 1_800_000_000_000);
    const tx = await getTransaction(db, id);
    expect(tx).toMatchObject({
      occurredLocalDate: "2026-07-31",
      occurredOffsetMin: 420,
      occurredTz: "Asia/Jakarta",
      timePrecision: "exact",
      source: "manual",
      walletId: "wal_default",
      createdAt: 1_800_000_000_000,
      updatedAt: 1_800_000_000_000,
      deletedAt: null,
    });
    expect(tx!.occurredAt).not.toBe(tx!.createdAt);
  });

  it("rounds a saved place to about 110 metres", async () => {
    const id = await createTransaction(db, expense({ location: { name: "Warung", lat: -6.2088123, lng: 106.8456789, source: "device" } }));
    expect((await getTransaction(db, id))!.location).toEqual({ name: "Warung", lat: -6.209, lng: 106.846, source: "device" });
  });

  it("explains what is wrong before writing anything", async () => {
    await expectCode(createTransaction(db, expense({ amount: 0 })), "amount_invalid");
    await expectCode(createTransaction(db, expense({ amount: 12.5 })), "amount_invalid");
    await expectCode(createTransaction(db, expense({ title: "   " })), "title_required");
    await expectCode(createTransaction(db, expense({ categoryId: null })), "category_required");
    await expectCode(createTransaction(db, { ...expense(), type: "saving_deposit", categoryId: null }), "goal_required");
    await expectCode(createTransaction(db, expense({ goalId: "g" })), "goal_not_allowed");
    await expectCode(createTransaction(db, { ...expense(), type: "transfer", categoryId: null, toWalletId: "wal_default", walletId: "wal_default" }), "transfer_wallets");
    await expectCode(createTransaction(db, expense({ offsetMin: 9999 })), "time_invalid");
    expect(await listTransactions(db)).toHaveLength(0);
  });
});

describe("updateTransaction", () => {
  it("edits fields, recomputes the local date and keeps created_at, source and legacy ref", async () => {
    const id = await createTransaction(db, expense({ legacyRef: "expenses:1", source: "legacy" }), 1_000);
    await updateTransaction(db, id, { amount: 30_000, occurredAt: at("2026-11-17", 23, 55), title: "  Kopi susu " }, 5_000);
    const tx = (await getTransaction(db, id))!;
    expect(tx).toMatchObject({
      amount: 30_000,
      title: "Kopi susu",
      occurredLocalDate: "2026-11-17",
      createdAt: 1_000,
      updatedAt: 5_000,
      source: "legacy",
      legacyRef: "expenses:1",
    });
  });

  it("can clear optional fields", async () => {
    const id = await createTransaction(db, expense({ note: "x", counterparty: "Kopi Kenangan" }));
    await updateTransaction(db, id, { note: null, counterparty: null });
    expect(await getTransaction(db, id)).toMatchObject({ note: null, counterparty: null });
  });

  it("refuses an invalid edit and a missing row", async () => {
    const id = await createTransaction(db, expense());
    await expectCode(updateTransaction(db, id, { amount: -1 }), "amount_invalid");
    await expectCode(updateTransaction(db, "nope", { amount: 5 }), "not_found");
    expect((await getTransaction(db, id))!.amount).toBe(25_000);
  });
});

describe("soft delete", () => {
  it("hides a row, restores it, and purges it after 30 days", async () => {
    const id = await createTransaction(db, expense());
    const day = 86_400_000;
    await softDeleteTransaction(db, id, 1_000 * day);
    expect(await listTransactions(db)).toHaveLength(0);
    expect(await listTransactions(db, { onlyDeleted: true })).toHaveLength(1);
    expect((await monthTotals(db, "2026-11")).expense).toBe(0);

    await restoreTransaction(db, id);
    expect(await listTransactions(db)).toHaveLength(1);

    await softDeleteTransaction(db, id, 1_000 * day);
    expect(await purgeDeleted(db, 1_029 * day)).toBe(0);
    expect(await purgeDeleted(db, 1_031 * day)).toBe(1);
    expect(await getTransaction(db, id)).toBeNull();
  });
});

describe("listTransactions", () => {
  beforeEach(async () => {
    await createTransaction(db, expense({ title: "Kopi 100% arabika", occurredAt: at("2026-07-31", 23, 30) }));
    await createTransaction(db, expense({ title: "Bensin", categoryId: systemCategoryId("transport"), amount: 50_000, occurredAt: at("2026-08-01", 0, 10), counterparty: "SPBU" }));
    await createTransaction(db, { ...expense({ title: "Gaji", amount: 5_000_000, occurredAt: at("2026-08-01", 9, 0) }), type: "income", categoryId: systemCategoryId("salary") });
  });

  it("groups by the stored local day, so 23:30 stays in July and 00:10 is August", async () => {
    expect((await listTransactions(db, { month: "2026-07" })).map((t) => t.title)).toEqual(["Kopi 100% arabika"]);
    expect((await listTransactions(db, { month: "2026-08" })).map((t) => t.title)).toEqual(["Gaji", "Bensin"]);
  });

  it("filters by type, category, amount and date range", async () => {
    expect(await listTransactions(db, { types: ["income"] })).toHaveLength(1);
    expect(await listTransactions(db, { categoryId: food })).toHaveLength(1);
    expect(await listTransactions(db, { minAmount: 40_000, maxAmount: 60_000 })).toHaveLength(1);
    expect(await listTransactions(db, { fromDate: "2026-08-01", toDate: "2026-08-01" })).toHaveLength(2);
  });

  it("searches title, counterparty and note, treating % and _ as plain characters", async () => {
    expect((await listTransactions(db, { search: "spbu" })).map((t) => t.title)).toEqual(["Bensin"]);
    expect((await listTransactions(db, { search: "100%" })).map((t) => t.title)).toEqual(["Kopi 100% arabika"]);
    expect(await listTransactions(db, { search: "%" })).toHaveLength(1);
  });

  it("pages newest first", async () => {
    const page = await listTransactions(db, { limit: 2, offset: 0 });
    expect(page.map((t) => t.title)).toEqual(["Gaji", "Bensin"]);
    expect((await listTransactions(db, { limit: 2, offset: 2 })).map((t) => t.title)).toEqual(["Kopi 100% arabika"]);
  });
});

describe("month totals and goals", () => {
  it("sums by type and leaves deleted rows out", async () => {
    await createTransaction(db, { ...expense({ amount: 5_000_000, title: "Gaji" }), type: "income", categoryId: systemCategoryId("salary") });
    await createTransaction(db, expense({ amount: 100_000 }));
    const goalId = await createGoal(db, { name: "Liburan", targetAmount: 1_000_000 });
    await createTransaction(db, { ...expense({ amount: 400_000, title: "Setor", goalId }), type: "saving_deposit", categoryId: null });
    await createTransaction(db, { ...expense({ amount: 100_000, title: "Tarik", goalId }), type: "saving_withdrawal", categoryId: null });
    const gone = await createTransaction(db, expense({ amount: 999 }));
    await softDeleteTransaction(db, gone);

    const totals = await monthTotals(db, "2026-11");
    expect(totals).toEqual({ income: 5_000_000, expense: 100_000, savingDeposit: 400_000, savingWithdrawal: 100_000 });
    expect(remaining(totals)).toBe(4_600_000);
    expect(await categoryTotals(db, "2026-11")).toEqual([{ categoryId: food, total: 100_000 }]);

    const goal = (await getGoal(db, goalId))!;
    expect(goal.saved).toBe(300_000);
    expect(goal.progress).toMatchObject({ pct: 30, left: 700_000, reached: false });
    expect(await listGoals(db)).toHaveLength(1);
  });
});

describe("categories", () => {
  it("creates a category, refuses a duplicate name and hides an archived one", async () => {
    const id = await createCategory(db, { kind: "expense", name: "Skincare", icon: "color-wand-outline", color: "other" });
    await expectCode(createCategory(db, { kind: "expense", name: " skincare ", icon: "x", color: "other" }), "category_exists");
    await createCategory(db, { kind: "income", name: "Skincare", icon: "x", color: "accent" }); // another kind is fine
    expect((await listCategories(db, { kind: "expense" })).some((c) => c.id === id)).toBe(true);

    await archiveCategory(db, id);
    expect((await listCategories(db, { kind: "expense" })).some((c) => c.id === id)).toBe(false);
    expect((await getCategory(db, id))!.archivedAt).not.toBeNull();
  });

  it("labels system categories from the language files and keeps custom names", async () => {
    const system = (await getCategory(db, food))!;
    expect(categoryLabel(system, en)).toBe("Food");
    expect(categoryLabel({ systemKey: null, name: "Skincare" }, en)).toBe("Skincare");
  });
});

describe("budgets with an effective month", () => {
  it("applies a limit from a month on and reports spending against it", async () => {
    await setBudget(db, { categoryId: food, effectiveFrom: "2026-01", amount: 100_000 });
    await setBudget(db, { categoryId: food, effectiveFrom: "2026-11", amount: 200_000, alertPct: 90 });
    await createTransaction(db, expense({ amount: 150_000 }));
    await createTransaction(db, expense({ amount: 150_000, occurredAt: at("2026-10-10") }));

    const nov = await budgetStatuses(db, "2026-11");
    expect(nov).toHaveLength(1);
    expect(nov[0]).toMatchObject({ categoryId: food, limit: 200_000, alertPct: 90, spent: 150_000 });
    expect(nov[0].usage.status).toBe("ok");

    const oct = await budgetStatuses(db, "2026-10");
    expect(oct[0]).toMatchObject({ limit: 100_000, spent: 150_000 });
    expect(oct[0].usage.status).toBe("over");
  });

  it("updates in place and a null amount removes the budget from that month on", async () => {
    await setBudget(db, { categoryId: food, effectiveFrom: "2026-11", amount: 200_000 });
    await setBudget(db, { categoryId: food, effectiveFrom: "2026-11", amount: 250_000 });
    expect((await budgetStatuses(db, "2026-11"))[0].limit).toBe(250_000);
    await setBudget(db, { categoryId: food, effectiveFrom: "2026-12", amount: null });
    expect(await budgetStatuses(db, "2026-12")).toEqual([]);
    expect(await budgetStatuses(db, "2026-11")).toHaveLength(1);
  });

  it("validates the month, amount and alert level", async () => {
    await expectCode(setBudget(db, { categoryId: food, effectiveFrom: "2026-13", amount: 1 }), "month_invalid");
    await expectCode(setBudget(db, { categoryId: food, effectiveFrom: "2026-11", amount: 0 }), "amount_invalid");
    await expectCode(setBudget(db, { categoryId: food, effectiveFrom: "2026-11", amount: 5, alertPct: 0 }), "alert_invalid");
  });
});

describe("meta", () => {
  it("stores and overwrites values", async () => {
    expect(await getMeta(db, "k")).toBeNull();
    await setMeta(db, "k", "a");
    await setMeta(db, "k", "b");
    expect(await getMeta(db, "k")).toBe("b");
  });
});
