import { createCategory, listCategories, archiveCategory } from "@/db/repo/categories";
import { createGoal, getGoal, listGoals } from "@/db/repo/goals";
import { getMeta, setMeta } from "@/db/repo/meta";
import { createRecurringRule, getRecurringRule, updateRecurringRule } from "@/db/repo/recurring";
import { createTransaction, listTransactions, merchantTotals, monthlyBars, type NewTransaction, type Transaction } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { keypadFromAmount } from "@/design/primitives/keypad";
import { epochFromLocal } from "@/lib/dates";
import { budgetCrossing } from "@/lib/finance";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { buildCsv, csvText } from "./export/csv";
import { buildReportHtml, escapeHtml } from "./export/report";
import { assertCanWithdraw, goalNeedPerMonth, totalSaved } from "./goals/goals";
import { donutSlices } from "./insights/donut";
import { barMonths, loadInsights, periodRange, previousPeriod, shiftPeriod } from "./insights/insights";
import { resetAllData } from "./settings/reset";
import { buildTransaction, initialForm, isSavable, type FormClock } from "./transactions/form";

const food = systemCategoryId("food");
const transport = systemCategoryId("transport");
const salary = systemCategoryId("salary");
const at = (date: string, hour = 12) => epochFromLocal(date, hour, 0, 420);
const base = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: "expense", amount: 10_000, title: "x", categoryId: food, occurredAt: at("2026-11-10"), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact", ...overrides,
});
const clock: FormClock = { now: Date.UTC(2026, 10, 18, 7, 12, 30), offsetMin: 420, tz: "Asia/Jakarta" };

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe("budget alerts", () => {
  it("alerts once for each line crossed, and not again past it", () => {
    expect(budgetCrossing(700, 790, 1000)).toBeNull();
    expect(budgetCrossing(700, 800, 1000)).toBe("near");
    expect(budgetCrossing(900, 1000, 1000)).toBeNull(); // still near, already alerted
    expect(budgetCrossing(900, 1001, 1000)).toBe("over");
    expect(budgetCrossing(500, 1500, 1000)).toBe("over"); // straight past the limit
    expect(budgetCrossing(1100, 1300, 1000)).toBeNull();
    expect(budgetCrossing(500, 600, 1000, 60)).toBe("near");
  });
});

describe("insights", () => {
  it("knows its ranges and neighbours", () => {
    expect(periodRange({ kind: "month", month: "2026-12" })).toEqual({ from: "2026-12-01", endExclusive: "2027-01-01" });
    expect(periodRange({ kind: "year", year: 2026 })).toEqual({ from: "2026-01-01", endExclusive: "2027-01-01" });
    expect(previousPeriod({ kind: "month", month: "2026-01" })).toEqual({ kind: "month", month: "2025-12" });
    expect(shiftPeriod({ kind: "year", year: 2026 }, 1)).toEqual({ kind: "year", year: 2027 });
    expect(barMonths({ kind: "month", month: "2026-11" })).toEqual({ from: "2026-06", to: "2026-11" });
    expect(barMonths({ kind: "year", year: 2026 })).toEqual({ from: "2026-01", to: "2026-12" });
  });

  it("sums a month, compares it with the last one and keeps the null rule", async () => {
    await createTransaction(db, base({ type: "income", categoryId: salary, amount: 5_000_000, title: "Gaji" }));
    await createTransaction(db, base({ amount: 100_000, counterparty: "Warung Bu Tini" }));
    await createTransaction(db, base({ amount: 50_000, counterparty: "warung bu tini", occurredAt: at("2026-11-12") }));
    await createTransaction(db, base({ amount: 70_000, categoryId: transport, counterparty: "Gojek" }));
    await createTransaction(db, base({ amount: 200_000, occurredAt: at("2026-10-10") })); // last month
    const goal = await createGoal(db, { name: "Trip" });
    await createTransaction(db, { ...base({ amount: 400_000, goalId: goal }), type: "saving_deposit", categoryId: null });

    const data = await loadInsights(db, { kind: "month", month: "2026-11" });
    expect(data.totals).toEqual({ income: 5_000_000, expense: 220_000, savingDeposit: 400_000, savingWithdrawal: 0 });
    expect(data.left).toBe(4_380_000);
    expect(data.savingsRate).toBeCloseTo(0.08);
    expect(data.changes.expense).toBeCloseTo(10); // 220k against 200k
    expect(data.changes.income).toBeNull(); // nothing last month to compare with
    expect(data.categories.map((c) => [c.categoryId, c.total])).toEqual([[food, 150_000], [transport, 70_000]]);
    expect(data.merchants[0]).toMatchObject({ total: 150_000, count: 2 }); // two spellings, one merchant
    expect(data.bars).toHaveLength(6);
    expect(data.bars.at(-1)).toMatchObject({ month: "2026-11", income: 5_000_000, expense: 220_000 });
    expect(data.bars[2]).toMatchObject({ month: "2026-08", income: 0, expense: 0 }); // no gaps on the axis
    expect(data.hasData).toBe(true);
  });

  it("reads a whole year and an empty period", async () => {
    await createTransaction(db, base({ amount: 10_000, occurredAt: at("2026-01-05") }));
    await createTransaction(db, base({ amount: 30_000, occurredAt: at("2026-12-31") }));
    const year = await loadInsights(db, { kind: "year", year: 2026 });
    expect(year.totals.expense).toBe(40_000);
    expect(year.bars).toHaveLength(12);
    const empty = await loadInsights(db, { kind: "month", month: "2030-01" });
    expect(empty.hasData).toBe(false);
    expect(empty.changes).toEqual({ income: 0, expense: 0, saving: 0 });
    expect(await merchantTotals(db, "2030-01-01", "2030-02-01")).toEqual([]);
    expect((await monthlyBars(db, "2026-01", "2026-03")).map((b) => b.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});

describe("donut slices", () => {
  const cats = new Map([
    [food, { id: food, label: "Food", colorToken: "food" }],
    [transport, { id: transport, label: "Transport", colorToken: "transport" }],
    ["other", { id: "other", label: "Other", colorToken: "other" }],
    ["mine", { id: "mine", label: "Skincare", colorToken: "other" }],
  ]);

  it("keeps the color of each category and folds the gray ones into one slice", () => {
    const slices = donutSlices([{ categoryId: "mine", total: 300 }, { categoryId: food, total: 400 }, { categoryId: "other", total: 100 }, { categoryId: transport, total: 200 }, { categoryId: null, total: 0 }], cats, "Other");
    expect(slices.map((s) => [s.label, s.value, s.colorToken])).toEqual([["Food", 400, "food"], ["Transport", 200, "transport"], ["Other", 400, "other"]]);
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it("has no slices without spending", () => {
    expect(donutSlices([], cats, "Other")).toEqual([]);
    expect(donutSlices([{ categoryId: food, total: 0 }], cats, "Other")).toEqual([]);
  });
});

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks, and stops formulas", () => {
    expect(csvText("plain")).toBe("plain");
    expect(csvText('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvText("two\nlines")).toBe('"two\nlines"');
    expect(csvText("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvText("-5 off")).toBe("'-5 off");
    expect(csvText(null)).toBe("");
  });

  it("writes one row per transaction with the stored local date and time, and leaves places out by default", async () => {
    await createTransaction(db, base({ title: "Kopi, susu", counterparty: "Kenangan", occurredAt: at("2026-11-18", 7), location: { name: "Jl. Sudirman", lat: -6.2088, lng: 106.8456, source: "manual" } }));
    await createTransaction(db, base({ title: "Gaji", type: "income", categoryId: salary, amount: 5_000_000, timePrecision: "date", occurredAt: at("2026-11-01") }));
    const rows = await listTransactions(db);
    const names = (tx: Transaction) => (tx.categoryId === food ? "Food" : "Salary");

    const csv = buildCsv(rows, { nameOf: names });
    expect(csv.startsWith("﻿Date,Time,Type,Category,Title,Merchant,Amount,Payment,Note,Time zone,Source\r\n")).toBe(true);
    expect(csv).toContain('2026-11-18,07:00,expense,Food,"Kopi, susu",Kenangan,10000,,,Asia/Jakarta,manual');
    expect(csv).toContain("2026-11-01,,income,Salary,Gaji,,5000000,,,Asia/Jakarta,manual"); // date-only rows have no time
    expect(csv).not.toContain("Sudirman");

    const withPlaces = buildCsv(rows, { nameOf: names, includeLocation: true });
    expect(withPlaces).toContain("Jl. Sudirman");
    expect(withPlaces.split("\r\n")[0].endsWith("Place,Latitude,Longitude")).toBe(true);
  });
});

describe("PDF report page", () => {
  it("escapes everything it prints and skips empty sections", () => {
    const html = buildReportHtml({
      title: "VOIDSPEND <report>",
      subtitle: "November 2026",
      summary: [{ label: "Income", value: "Rp 5.000.000", note: "+10%" }],
      sections: [{ title: "Empty", rows: [] }, { title: "Top merchants", rows: [{ label: "A & B <script>", value: "Rp 1" }] }],
      footer: "Made with VOIDSPEND",
    }, "en");
    expect(html).toContain("&lt;report&gt;");
    expect(html).toContain("A &amp; B &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("Empty");
    expect(html).toContain('lang="en"');
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });
});

describe("goals", () => {
  it("never lets a withdrawal take out more than the goal holds", async () => {
    const goal = await createGoal(db, { name: "Trip", targetAmount: 1_000_000, targetDate: "2027-02-15" });
    const move = (type: "saving_deposit" | "saving_withdrawal", amount: number) => createTransaction(db, { ...base({ amount, goalId: goal }), type, categoryId: null });
    await move("saving_deposit", 500_000);
    const w = await move("saving_withdrawal", 100_000);
    await expect(assertCanWithdraw(db, goal, 400_000)).resolves.toBeUndefined();
    await expect(assertCanWithdraw(db, goal, 400_001)).rejects.toMatchObject({ code: "insufficient_saved" });
    // Editing the withdrawal itself leaves its own 100k out of the count.
    await expect(assertCanWithdraw(db, goal, 500_000, w)).resolves.toBeUndefined();
  });

  it("totals what is saved and works out the monthly need", async () => {
    const a = await createGoal(db, { name: "A", targetAmount: 900_000, targetDate: "2027-02-15" });
    await createGoal(db, { name: "B" });
    await createTransaction(db, { ...base({ amount: 300_000, goalId: a }), type: "saving_deposit", categoryId: null });
    const goals = await listGoals(db);
    expect(totalSaved(goals)).toBe(300_000);
    const goal = (await getGoal(db, a))!;
    expect(goalNeedPerMonth(goal, "2026-11-18")).toBe(200_000); // 600k over three months
    expect(goalNeedPerMonth({ progress: goal.progress, targetDate: null }, "2026-11-18")).toBeNull();
  });
});

describe("the add form with saving types", () => {
  it("needs a goal instead of a category, and records a goal movement", () => {
    const form = { ...initialForm("saving_deposit"), amount: keypadFromAmount(250_000) };
    expect(isSavable(form)).toBe(false);
    expect(isSavable({ ...form, goalId: "g1" })).toBe(true);
    expect(() => buildTransaction(form, clock, "Trip")).toThrow(expect.objectContaining({ code: "goal_required" }));
    expect(buildTransaction({ ...form, goalId: "g1", categoryId: food }, clock, "Trip")).toMatchObject({ type: "saving_deposit", goalId: "g1", categoryId: null, title: "Trip", amount: 250_000 });
    expect(isSavable({ ...initialForm("withdraw" as never), amount: keypadFromAmount(1), categoryId: food })).toBe(true); // an unknown type falls back to the category rule
  });
});

describe("reset", () => {
  it("clears what the person recorded and keeps the shipped parts", async () => {
    await createTransaction(db, base());
    await createGoal(db, { name: "Trip" });
    await createCategory(db, { kind: "expense", name: "Skincare", icon: "x", color: "other" });
    await archiveCategory(db, food);
    await createRecurringRule(db, { type: "income", amount: 5, title: "Salary", categoryId: salary, frequency: "monthly", dayOfMonth: 25, startDate: "2026-11-01" });
    await setMeta(db, "onboarded", "1");
    await setMeta(db, "username", "Rizky");

    await resetAllData(db);

    expect(await listTransactions(db)).toHaveLength(0);
    expect(await listGoals(db)).toHaveLength(0);
    expect(await getMeta(db, "onboarded")).toBeNull();
    expect(await getMeta(db, "username")).toBeNull();
    expect(await getMeta(db, "legacy_import")).toBe("done");
    expect(await getMeta(db, "legacy_profile")).toBe("done");
    const categories = await listCategories(db);
    expect(categories.every((c) => c.systemKey !== null)).toBe(true);
    expect(categories.some((c) => c.id === food)).toBe(true); // archived ones come back
    expect(await db.getAllAsync("SELECT id FROM wallets")).toHaveLength(1);
  });
});

describe("recurring rule updates", () => {
  it("changes the amount and the mode, and refuses bad values", async () => {
    const id = await createRecurringRule(db, { type: "income", amount: 5_000_000, title: "Salary", categoryId: salary, frequency: "monthly", dayOfMonth: 25, startDate: "2026-11-01" });
    await updateRecurringRule(db, id, { amount: 5_500_000, mode: "auto" });
    expect(await getRecurringRule(db, id)).toMatchObject({ amount: 5_500_000, mode: "auto", title: "Salary" });
    await expect(updateRecurringRule(db, id, { amount: 0 })).rejects.toMatchObject({ code: "amount_invalid" });
    await expect(updateRecurringRule(db, "nope", { amount: 5 })).rejects.toMatchObject({ code: "not_found" });
  });
});
