import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { systemCategoryId } from "../systemCategories";
import {
  createRecurringRule,
  getRecurringRule,
  latestSalary,
  pendingOccurrences,
  postOccurrence,
  runAutoRecurring,
  setRecurringPaused,
  skipOccurrence,
  updateRecurringRule,
  type Clock,
} from "./recurring";
import { listTransactions } from "./transactions";
import { createWallet, walletBalances } from "./wallets";

const clock: Clock = { offsetMin: 420, tz: "Asia/Jakarta", now: Date.UTC(2026, 10, 18) };
const salary = systemCategoryId("salary");

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

const newSalary = (overrides = {}) =>
  createRecurringRule(db, { type: "income", amount: 5_000_000, title: "Salary", categoryId: salary, frequency: "monthly", dayOfMonth: 25, startDate: "2026-08-01", ...overrides });

describe("recurring salary", () => {
  it("starts at the first occurrence on or after the start date", async () => {
    const rule = (await getRecurringRule(db, await newSalary()))!;
    expect(rule.nextDueDate).toBe("2026-08-25");
    expect(rule).toMatchObject({ mode: "confirm", remind: false, pausedAt: null, walletId: "wal_default" });
  });

  it("validates what it needs", async () => {
    await expect(newSalary({ amount: 0 })).rejects.toMatchObject({ code: "amount_invalid" });
    await expect(newSalary({ title: " " })).rejects.toMatchObject({ code: "title_required" });
    await expect(newSalary({ categoryId: null })).rejects.toMatchObject({ code: "category_required" });
    await expect(newSalary({ startDate: "2026-02-30" })).rejects.toMatchObject({ code: "date_invalid" });
    await expect(newSalary({ endDate: "2026-07-01" })).rejects.toMatchObject({ code: "date_invalid" });
  });

  it("lists every due date for a rule that waits for confirmation, and none when paused", async () => {
    const id = await newSalary();
    const pending = await pendingOccurrences(db, "2026-11-18");
    expect(pending).toHaveLength(1);
    expect(pending[0].dates).toEqual(["2026-08-25", "2026-09-25", "2026-10-25"]);

    await setRecurringPaused(db, id, true);
    expect(await pendingOccurrences(db, "2026-11-18")).toEqual([]);
  });

  it("records an occurrence on its own date, dated by noon in the person's zone, and advances", async () => {
    const id = await newSalary();
    const rule = (await getRecurringRule(db, id))!;
    expect(await postOccurrence(db, rule, "2026-08-25", clock)).toBe(true);

    const [tx] = await listTransactions(db);
    expect(tx).toMatchObject({
      type: "income",
      amount: 5_000_000,
      occurredLocalDate: "2026-08-25",
      timePrecision: "date",
      source: "recurring",
      recurringRuleId: id,
    });
    expect((await getRecurringRule(db, id))!.nextDueDate).toBe("2026-09-25");
  });

  it("never records the same day twice", async () => {
    const id = await newSalary();
    const rule = (await getRecurringRule(db, id))!;
    expect(await postOccurrence(db, rule, "2026-08-25", clock)).toBe(true);
    expect(await postOccurrence(db, rule, "2026-08-25", clock)).toBe(false);
    expect(await listTransactions(db)).toHaveLength(1);
  });

  it("skips an occurrence without recording anything", async () => {
    const id = await newSalary();
    await skipOccurrence(db, (await getRecurringRule(db, id))!, "2026-08-25");
    expect(await listTransactions(db)).toHaveLength(0);
    expect((await getRecurringRule(db, id))!.nextDueDate).toBe("2026-09-25");
  });

  it("posts a long catch-up in auto mode, and only up to the end date", async () => {
    await newSalary({ mode: "auto", endDate: "2026-10-31" });
    expect(await runAutoRecurring(db, "2026-11-18", clock)).toBe(3);
    expect((await listTransactions(db)).map((t) => t.occurredLocalDate).sort()).toEqual(["2026-08-25", "2026-09-25", "2026-10-25"]);
    expect(await runAutoRecurring(db, "2026-11-18", clock)).toBe(0); // a second run adds nothing
  });

  it("leaves rules that wait for confirmation alone in auto runs", async () => {
    await newSalary();
    expect(await runAutoRecurring(db, "2026-11-18", clock)).toBe(0);
  });

  it("finds the latest salary to offer a recurring rule after the v1 import", async () => {
    expect(await latestSalary(db)).toBeNull();
    const rule = (await getRecurringRule(db, await newSalary()))!;
    await postOccurrence(db, rule, "2026-08-25", clock);
    await postOccurrence(db, { ...rule, nextDueDate: "2026-09-25" }, "2026-09-25", clock);
    expect(await latestSalary(db)).toEqual({ amount: 5_000_000, date: "2026-09-25" });
  });
});

describe("the wallet of a recurring rule", () => {
  it("changes where the next occurrence is recorded, and not what was already recorded", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    const id = await newSalary();
    const first = (await getRecurringRule(db, id))!;
    await postOccurrence(db, first, "2026-08-25", clock);

    await updateRecurringRule(db, id, { walletId: bank });
    const second = (await getRecurringRule(db, id))!;
    expect(second.walletId).toBe(bank);
    await postOccurrence(db, second, "2026-09-25", clock);

    const wallets = (await listTransactions(db)).map((tx) => [tx.occurredLocalDate, tx.walletId]).sort();
    expect(wallets).toEqual([
      ["2026-08-25", "wal_default"],
      ["2026-09-25", bank],
    ]);
    const balances = new Map((await walletBalances(db)).map((entry) => [entry.wallet.id, entry.balance]));
    expect(balances.get("wal_default")).toBe(5_000_000);
    expect(balances.get(bank)).toBe(5_000_000);
  });

  it("refuses a wallet that does not exist, and leaves the rule as it was", async () => {
    const id = await newSalary();
    await expect(updateRecurringRule(db, id, { walletId: "wal_nope" })).rejects.toMatchObject({ code: "not_found" });
    expect((await getRecurringRule(db, id))!.walletId).toBe("wal_default");
  });

  it("keeps the wallet when only the amount changes", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    const id = await newSalary({ walletId: bank });
    await updateRecurringRule(db, id, { amount: 6_000_000 });
    expect(await getRecurringRule(db, id)).toMatchObject({ amount: 6_000_000, walletId: bank });
  });
});
