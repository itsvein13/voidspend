import { createRecurringRule, listRecurringRules, postOccurrence } from "@/db/repo/recurring";
import { createTransaction, listTransactions, type NewTransaction } from "@/db/repo/transactions";
import { setBudget } from "@/db/repo/budgets";
import { systemCategoryId } from "@/db/systemCategories";
import { keypadFromAmount } from "@/design/primitives/keypad";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { loadHome } from "./home/home";
import { applySalarySetup, getUsername, isOnboarded, migrateLegacyProfile, planSalarySetup, validateSalarySetup } from "./profile/profile";
import { buildTransaction, formFromTransaction, formForDuplicate, initialForm, isSavable, resolveMoment, type FormClock, type FormState } from "./transactions/form";
import { groupByDay } from "./transactions/grouping";

const clock: FormClock = { now: Date.UTC(2026, 10, 18, 7, 12, 30), offsetMin: 420, tz: "Asia/Jakarta" }; // 14:12:30 on 18 Nov in Jakarta
const food = systemCategoryId("food");
const at = (date: string, hour = 12, minute = 0) => epochFromLocal(date, hour, minute, 420);
const base = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: "expense",
  amount: 25_000,
  title: "Kopi",
  categoryId: food,
  occurredAt: at("2026-11-18", 8, 0),
  offsetMin: 420,
  tz: "Asia/Jakarta",
  timePrecision: "exact",
  ...overrides,
});

const filled = (overrides: Partial<FormState> = {}): FormState => ({ ...initialForm(), amount: keypadFromAmount(25_000), categoryId: food, ...overrides });

describe("the add form", () => {
  it("can be saved with only an amount and a category", () => {
    expect(isSavable(initialForm())).toBe(false);
    expect(isSavable({ ...initialForm(), amount: keypadFromAmount(5_000) })).toBe(false);
    expect(isSavable({ ...initialForm(), categoryId: food })).toBe(false);
    expect(isSavable(filled())).toBe(true);
  });

  it("uses the category name when the title is blank", () => {
    expect(buildTransaction(filled(), clock, "Food").title).toBe("Food");
    expect(buildTransaction(filled({ title: "  Kopi susu " }), clock, "Food").title).toBe("Kopi susu");
  });

  it("records 'now' as the exact instant in the phone's zone", () => {
    const tx = buildTransaction(filled(), clock, "Food");
    expect(tx).toMatchObject({ occurredAt: clock.now, timePrecision: "exact", offsetMin: 420, tz: "Asia/Jakarta", type: "expense", amount: 25_000 });
  });

  it("records 'yesterday' at the same time of day", () => {
    const moment = resolveMoment(filled({ when: { kind: "yesterday" } }), clock);
    expect(moment.occurredAt).toBe(at("2026-11-17", 14, 12));
    expect(moment.precision).toBe("exact");
  });

  it("records a picked date and time", () => {
    const moment = resolveMoment(filled({ when: { kind: "custom", date: "2026-11-01", hour: 23, minute: 30 } }), clock);
    expect(moment.occurredAt).toBe(at("2026-11-01", 23, 30));
  });

  it("stores only the day, at noon, when the time is unknown", () => {
    const moment = resolveMoment(filled({ when: { kind: "yesterday" }, timeKnown: false }), clock);
    expect(moment).toMatchObject({ occurredAt: at("2026-11-17", 12, 0), precision: "date" });
  });

  it("refuses to build without an amount or a category", () => {
    expect(() => buildTransaction({ ...filled(), amount: keypadFromAmount(0) }, clock, "Food")).toThrow(expect.objectContaining({ code: "amount_invalid" }));
    expect(() => buildTransaction({ ...filled(), categoryId: null }, clock, "Food")).toThrow(expect.objectContaining({ code: "category_required" }));
  });

  it("fills itself from a saved transaction for Edit, keeping its zone", async () => {
    const db = await createMigratedDb();
    const id = await createTransaction(db, base({ counterparty: "Kopi Kenangan", note: "pagi", paymentMethod: "qris", occurredAt: at("2026-11-18", 23, 5), offsetMin: 480, tz: "Asia/Makassar" }));
    const [tx] = await listTransactions(db);
    expect(tx.id).toBe(id);
    const form = formFromTransaction(tx);
    expect(form).toMatchObject({ type: "expense", categoryId: food, title: "Kopi", counterparty: "Kopi Kenangan", note: "pagi", paymentMethod: "qris", timeKnown: true });
    expect(form.zone).toEqual({ tz: "Asia/Makassar", offsetMin: 480 });
    // Saving the edit unchanged gives the same moment back, in the same zone.
    expect(buildTransaction(form, clock, "Food")).toMatchObject({ occurredAt: tx.occurredAt, offsetMin: 480, tz: "Asia/Makassar" });
  });

  it("duplicates into 'now' in the current zone", async () => {
    const db = await createMigratedDb();
    await createTransaction(db, base({ occurredAt: at("2026-10-01", 9, 0), offsetMin: 480, tz: "Asia/Makassar" }));
    const [tx] = await listTransactions(db);
    expect(formForDuplicate(tx)).toMatchObject({ when: { kind: "now" }, zone: null, timeKnown: true, title: "Kopi" });
  });
});

describe("grouping by day", () => {
  it("keeps the stored day, with day totals", async () => {
    const db = await createMigratedDb();
    await createTransaction(db, base({ title: "A", amount: 10_000, occurredAt: at("2026-11-18", 9, 0) }));
    await createTransaction(db, base({ title: "B", amount: 5_000, occurredAt: at("2026-11-18", 20, 0) }));
    await createTransaction(db, base({ title: "Gaji", type: "income", amount: 100, categoryId: systemCategoryId("salary"), occurredAt: at("2026-11-18", 21, 0) }));
    await createTransaction(db, base({ title: "C", amount: 7_000, occurredAt: at("2026-11-17", 23, 30) }));
    const groups = groupByDay(await listTransactions(db));
    expect(groups.map((g) => [g.date, g.items.length, g.spent, g.income])).toEqual([
      ["2026-11-18", 3, 15_000, 100],
      ["2026-11-17", 1, 7_000, 0],
    ]);
    expect(groups[0].items.map((t) => t.title)).toEqual(["Gaji", "B", "A"]);
  });
});

describe("profile and salary setup", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createMigratedDb();
  });

  it("carries the v1 name and onboarding flag once, without touching v1", async () => {
    const reads: string[] = [];
    const storage = { getItem: async (key: string) => (reads.push(key), { username: " Rizky ", hasOnboarded: "true" }[key] ?? null) };
    await migrateLegacyProfile(db, storage);
    expect(await getUsername(db)).toBe("Rizky");
    expect(await isOnboarded(db)).toBe(true);
    reads.length = 0;
    await migrateLegacyProfile(db, storage); // a second run does nothing
    expect(reads).toEqual([]);
  });

  it("leaves a fresh install to be welcomed", async () => {
    await migrateLegacyProfile(db, { getItem: async () => null });
    expect(await isOnboarded(db)).toBe(false);
    expect(await getUsername(db)).toBeNull();
  });

  it("validates a salary setup", () => {
    expect(() => validateSalarySetup({ amount: 0, payday: 25, receivedThisMonth: true })).toThrow(expect.objectContaining({ code: "amount_invalid" }));
    expect(() => validateSalarySetup({ amount: 5, payday: 32, receivedThisMonth: true })).toThrow(expect.objectContaining({ code: "payday_invalid" }));
    expect(() => validateSalarySetup({ amount: 5, payday: 0, receivedThisMonth: true })).toThrow(expect.objectContaining({ code: "payday_invalid" }));
  });

  it("starts the rule next month when this month's salary is already in, otherwise this month", () => {
    expect(planSalarySetup({ amount: 5_000_000, payday: 25, receivedThisMonth: true }, "2026-11-18").rule.startDate).toBe("2026-12-01");
    expect(planSalarySetup({ amount: 5_000_000, payday: 25, receivedThisMonth: false }, "2026-11-18").rule.startDate).toBe("2026-11-01");
  });

  it("records this month's salary now and makes the rule, in one go", async () => {
    await applySalarySetup(db, { amount: 5_000_000, payday: 25, receivedThisMonth: true }, { ...clock, today: "2026-11-18" });
    const [rule] = await listRecurringRules(db);
    expect(rule).toMatchObject({ title: "Salary", dayOfMonth: 25, nextDueDate: "2026-12-25", mode: "confirm" });
    const rows = await listTransactions(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "income", amount: 5_000_000, occurredLocalDate: "2026-11-18", timePrecision: "date" });
  });

  it("leaves the salary pending when it has not arrived yet", async () => {
    await applySalarySetup(db, { amount: 5_000_000, payday: 25, receivedThisMonth: false }, { ...clock, today: "2026-11-18" });
    expect(await listTransactions(db)).toHaveLength(0);
    expect((await listRecurringRules(db))[0].nextDueDate).toBe("2026-11-25");
  });
});

describe("home data", () => {
  it("collects totals, the safe amount per day, pending salary, budgets and recent rows", async () => {
    const db = await createMigratedDb();
    await applySalarySetup(db, { amount: 5_000_000, payday: 25, receivedThisMonth: true }, { ...clock, today: "2026-11-18" });
    await createTransaction(db, base({ amount: 300_000 }));
    await setBudget(db, { categoryId: food, effectiveFrom: "2026-11", amount: 400_000 });

    const home = await loadHome(db, "2026-11", "2026-11-18");
    expect(home.totals).toMatchObject({ income: 5_000_000, expense: 300_000 });
    expect(home.left).toBe(4_700_000);
    expect(home.paydayDay).toBe(25);
    expect(home.hasSalaryRule).toBe(true);
    expect(home.safePerDay).toBe(Math.floor(4_700_000 / 7)); // 18 to 25 November
    expect(home.budgets[0]).toMatchObject({ spent: 300_000, limit: 400_000 });
    expect(home.budgets[0].usage.status).toBe("ok");
    expect(home.recent).toHaveLength(2);
    expect(home.pending).toEqual([]);
  });

  it("lists a salary that is due and shows no daily amount for another month or without money", async () => {
    const db = await createMigratedDb();
    await createRecurringRule(db, { type: "income", amount: 5_000_000, title: "Salary", categoryId: "sys_salary", frequency: "monthly", dayOfMonth: 5, startDate: "2026-11-01" });
    const home = await loadHome(db, "2026-11", "2026-11-18");
    expect(home.pending[0].dates).toEqual(["2026-11-05"]);
    expect(home.safePerDay).toBeNull(); // nothing left yet

    const rule = (await listRecurringRules(db))[0];
    await postOccurrence(db, rule, "2026-11-05", { ...clock });
    expect((await loadHome(db, "2026-11", "2026-11-18")).safePerDay).not.toBeNull();
    expect((await loadHome(db, "2026-10", "2026-11-18")).safePerDay).toBeNull(); // a past month
  });

  it("has no salary rule on a fresh database", async () => {
    const db = await createMigratedDb();
    expect(await loadHome(db, "2026-11", "2026-11-18")).toMatchObject({ hasSalaryRule: false, paydayDay: null, left: 0, recent: [] });
  });
});
