import { createGoal } from "@/db/repo/goals";
import { getRecurringRule, listRecurringRules } from "@/db/repo/recurring";
import { createTransaction, getTransaction, listTransactions, updateTransaction, type NewTransaction } from "@/db/repo/transactions";
import { createWallet, walletBalances } from "@/db/repo/wallets";
import { systemCategoryId } from "@/db/systemCategories";
import { DEFAULT_WALLET_ID } from "@/db/types";
import { en } from "@/i18n/en";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { buildInsightsReport } from "../export/insightsReport";
import { goalWalletSplit } from "../goals/goals";
import { loadInsights } from "../insights/insights";
import { applySalarySetup } from "../profile/profile";
import { resolveMoment } from "../transactions/form";
import { inputFromOpening, openingFromInput } from "./opening";

const food = systemCategoryId("food");
const transport = systemCategoryId("transport");
const salary = systemCategoryId("salary");
const at = (date: string) => epochFromLocal(date, 12, 0, 420);
const base = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: "expense", amount: 10_000, title: "x", categoryId: food, occurredAt: at("2026-11-10"), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact", ...overrides,
});
const month = { kind: "month" as const, month: "2026-11" };

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe("the starting balance in the wallet form", () => {
  it("reads digits with the owed switch as a signed number, and blank as zero", () => {
    expect(openingFromInput("1.250.000", false)).toBe(1_250_000);
    expect(openingFromInput("1.250.000", true)).toBe(-1_250_000);
    expect(openingFromInput("", false)).toBe(0);
    expect(openingFromInput("  ", true)).toBe(0);
    expect(Object.is(openingFromInput("", true), -0)).toBe(false);
    expect(Object.is(openingFromInput("0", true), -0)).toBe(false);
  });

  it("opens a saved wallet with the number grouped and the switch set from its sign", () => {
    expect(inputFromOpening(1_250_000)).toEqual({ text: "1.250.000", owed: false });
    expect(inputFromOpening(-750_000)).toEqual({ text: "750.000", owed: true });
    expect(inputFromOpening(0)).toEqual({ text: "", owed: false });
  });

  it("round trips: what the form saves is what it shows again", () => {
    for (const balance of [-2_000_000, -1, 0, 1, 99_000_000]) {
      const { text, owed } = inputFromOpening(balance);
      expect(openingFromInput(text, owed)).toBe(balance);
    }
  });
});

describe("a goal by wallet", () => {
  it("nets deposits and withdrawals per wallet, counts no wallet as the main one, and drops a wallet that cancels out", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    const cash = await createWallet(db, { name: "Cash", kind: "cash", openingBalance: 0 });
    const goal = await createGoal(db, { name: "Trip", targetAmount: null, categoryId: null });
    const deposit = (amount: number, walletId: string | null, type: "saving_deposit" | "saving_withdrawal" = "saving_deposit") =>
      createTransaction(db, { ...base({ amount, categoryId: null, goalId: goal, walletId }), type });
    await deposit(500_000, DEFAULT_WALLET_ID);
    await deposit(200_000, null); // no wallet: the main one
    await deposit(300_000, bank);
    await deposit(100_000, bank, "saving_withdrawal");
    await deposit(50_000, cash);
    await deposit(50_000, cash, "saving_withdrawal"); // cancels out
    expect(await goalWalletSplit(db, goal)).toEqual([
      { walletId: DEFAULT_WALLET_ID, net: 700_000 },
      { walletId: bank, net: 200_000 },
    ]);
  });

  it("leaves out deleted rows and other goals", async () => {
    const goal = await createGoal(db, { name: "Trip", targetAmount: null, categoryId: null });
    const other = await createGoal(db, { name: "Phone", targetAmount: null, categoryId: null });
    const gone = await createTransaction(db, { ...base({ amount: 10_000, categoryId: null, goalId: goal }), type: "saving_deposit" });
    await createTransaction(db, { ...base({ amount: 20_000, categoryId: null, goalId: other }), type: "saving_deposit" });
    await db.runAsync("UPDATE transactions SET deleted_at = 1 WHERE id = ?", [gone]);
    expect(await goalWalletSplit(db, goal)).toEqual([]);
  });
});

describe("a salary into a wallet", () => {
  const clock = { now: Date.UTC(2026, 10, 19, 1, 0), offsetMin: 420, tz: "Asia/Jakarta", today: "2026-11-19" };

  it("records the rule and this month's salary in the chosen wallet", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    await applySalarySetup(db, { amount: 5_000_000, payday: 25, receivedThisMonth: true, walletId: bank }, clock);
    const [rule] = await listRecurringRules(db);
    expect((await getRecurringRule(db, rule.id))?.walletId).toBe(bank);
    const [income] = await listTransactions(db);
    expect(income).toMatchObject({ type: "income", walletId: bank });
    const balances = new Map((await walletBalances(db)).map((entry) => [entry.wallet.id, entry.balance]));
    expect(balances.get(bank)).toBe(5_000_000);
    expect(balances.get(DEFAULT_WALLET_ID)).toBe(0);
  });

  it("uses the main wallet when none is given", async () => {
    await applySalarySetup(db, { amount: 5_000_000, payday: 25, receivedThisMonth: true }, clock);
    const [rule] = await listRecurringRules(db);
    expect(rule.walletId).toBe(DEFAULT_WALLET_ID);
    expect((await listTransactions(db))[0].walletId).toBe(DEFAULT_WALLET_ID);
  });
});

describe("the moment of a transfer", () => {
  const clock = { now: Date.UTC(2026, 10, 19, 1, 0, 42), offsetMin: 420, tz: "Asia/Jakarta" };

  it("is now with the seconds, yesterday at the same time, or the day and time picked", () => {
    expect(resolveMoment({ when: { kind: "now" }, timeKnown: true, zone: null }, clock)).toMatchObject({ occurredAt: clock.now, precision: "exact" });
    const yesterday = resolveMoment({ when: { kind: "yesterday" }, timeKnown: true, zone: null }, clock);
    expect(yesterday.occurredAt).toBe(epochFromLocal("2026-11-18", 8, 0, 420)); // 01:00 UTC is 08:00 in Jakarta
    const picked = resolveMoment({ when: { kind: "custom", date: "2026-11-02", hour: 21, minute: 15 }, timeKnown: true, zone: null }, clock);
    expect(picked).toMatchObject({ occurredAt: epochFromLocal("2026-11-02", 21, 15, 420), offsetMin: 420, tz: "Asia/Jakarta", precision: "exact" });
  });

  it("keeps the zone an edited transfer was made in", () => {
    const moved = resolveMoment({ when: { kind: "custom", date: "2026-11-02", hour: 9, minute: 0 }, timeKnown: true, zone: { tz: "Asia/Makassar", offsetMin: 480 } }, clock);
    expect(moved).toMatchObject({ offsetMin: 480, tz: "Asia/Makassar", occurredAt: epochFromLocal("2026-11-02", 9, 0, 480) });
  });

  it("moves a transfer to another month when its date is edited, and leaves the time alone otherwise", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    const id = await createTransaction(db, { ...base({ categoryId: null, walletId: DEFAULT_WALLET_ID }), type: "transfer", toWalletId: bank });
    const before = (await getTransaction(db, id))!;
    await updateTransaction(db, id, { note: "only the note" });
    expect((await getTransaction(db, id))?.occurredAt).toBe(before.occurredAt);
    const moment = resolveMoment({ when: { kind: "custom", date: "2026-10-03", hour: 10, minute: 0 }, timeKnown: true, zone: { tz: before.occurredTz, offsetMin: before.occurredOffsetMin } }, { now: before.occurredAt, offsetMin: 420, tz: "Asia/Jakarta" });
    await updateTransaction(db, id, { occurredAt: moment.occurredAt, offsetMin: moment.offsetMin, tz: moment.tz, timePrecision: moment.precision });
    expect((await getTransaction(db, id))?.occurredLocalDate).toBe("2026-10-03");
  });
});

describe("insights for one wallet", () => {
  async function seed() {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    await createTransaction(db, base({ type: "income", categoryId: salary, amount: 5_000_000, title: "Gaji", walletId: bank }));
    await createTransaction(db, base({ amount: 100_000, counterparty: "Warung", walletId: bank }));
    await createTransaction(db, base({ amount: 30_000, counterparty: "Kopi", categoryId: transport }));
    await createTransaction(db, base({ amount: 20_000, counterparty: "Kopi", walletId: null })); // no wallet: the main one
    await createTransaction(db, base({ amount: 70_000, counterparty: "Warung", walletId: bank, occurredAt: at("2026-10-10") })); // last month
    await createTransaction(db, { ...base({ amount: 1_000_000, title: "Move", categoryId: null, walletId: bank }), type: "transfer", toWalletId: DEFAULT_WALLET_ID });
    return bank;
  }

  it("sums only what was recorded in that wallet, and leaves a transfer out", async () => {
    const bank = await seed();
    const all = await loadInsights(db, month);
    expect(all.walletId).toBeNull();
    expect(all.totals).toMatchObject({ income: 5_000_000, expense: 150_000 });

    const inBank = await loadInsights(db, month, bank);
    expect(inBank.walletId).toBe(bank);
    expect(inBank.totals).toEqual({ income: 5_000_000, expense: 100_000, savingDeposit: 0, savingWithdrawal: 0 });
    expect(inBank.left).toBe(4_900_000);
    expect(inBank.categories.map((item) => [item.categoryId, item.total])).toEqual([[food, 100_000]]);
    expect(inBank.merchants.map((item) => [item.name, item.total])).toEqual([["Warung", 100_000]]);
    expect(inBank.bars.at(-1)).toMatchObject({ month: "2026-11", income: 5_000_000, expense: 100_000 });

    const inMain = await loadInsights(db, month, DEFAULT_WALLET_ID);
    expect(inMain.totals).toMatchObject({ income: 0, expense: 50_000 });
    expect(inMain.merchants).toMatchObject([{ name: "Kopi", total: 50_000, count: 2 }]);
  });

  it("compares with the last period inside the same wallet", async () => {
    const bank = await seed();
    const inBank = await loadInsights(db, month, bank);
    expect(inBank.previous.expense).toBe(70_000);
    expect(inBank.changes.expense).toBeCloseTo((100_000 / 70_000 - 1) * 100);
    const inMain = await loadInsights(db, month, DEFAULT_WALLET_ID);
    expect(inMain.changes.expense).toBeNull(); // the main wallet spent nothing last month
  });

  it("adds up across wallets to what the all-wallets view says", async () => {
    const bank = await seed();
    const parts = await Promise.all([bank, DEFAULT_WALLET_ID].map((id) => loadInsights(db, month, id)));
    const all = await loadInsights(db, month);
    expect(parts.reduce((sum, item) => sum + item.totals.income, 0)).toBe(all.totals.income);
    expect(parts.reduce((sum, item) => sum + item.totals.expense, 0)).toBe(all.totals.expense);
  });

  it("is empty for a wallet with nothing in the period", async () => {
    await seed();
    const idle = await createWallet(db, { name: "Idle", kind: "cash", openingBalance: 0 });
    expect((await loadInsights(db, month, idle)).hasData).toBe(false);
  });

  it("names the wallet in the report, and says nothing extra for all of them", async () => {
    const bank = await seed();
    const name = () => "x";
    const forBank = buildInsightsReport(await loadInsights(db, month, bank), en, name, "Bank");
    const forAll = buildInsightsReport(await loadInsights(db, month), en, name);
    expect(forBank.subtitle).toBe("November 2026, Bank");
    expect(forAll.subtitle).toBe("November 2026");
    // What moved through one wallet is a net for the period, not what it holds, so it is not called "left".
    const labels = (model: typeof forBank) => model.summary.map((item) => item.label);
    expect(labels(forBank)).toContain(en.insights.net);
    expect(labels(forBank)).not.toContain(en.insights.left);
    expect(labels(forAll)).toContain(en.insights.left);
  });

  it("filters the exported rows to the wallet, with its transfers", async () => {
    const bank = await seed();
    const rows = await listTransactions(db, { fromDate: "2026-11-01", toDate: "2026-11-30", walletId: bank });
    expect(rows.map((tx) => tx.title).sort()).toEqual(["Gaji", "Move", "x"]);
  });
});
