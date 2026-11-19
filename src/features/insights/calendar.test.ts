import { createTransaction, dailyExpenseTotals, type NewTransaction } from "@/db/repo/transactions";
import { createWallet } from "@/db/repo/wallets";
import { systemCategoryId } from "@/db/systemCategories";
import { DEFAULT_WALLET_ID } from "@/db/types";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { buildMonthGrid, heatStep, mondayFirst, mondayIndex } from "./calendar";

describe("heat steps", () => {
  it("is zero without spending and five on the busiest day", () => {
    expect(heatStep(0, 100)).toBe(0);
    expect(heatStep(50, 0)).toBe(0);
    expect(heatStep(100, 100)).toBe(5);
    expect(heatStep(1, 1_000_000)).toBe(1); // any spending shows, never as an empty day
  });

  it("never goes down as the amount grows, and uses every step", () => {
    const steps = Array.from({ length: 101 }, (_, index) => heatStep(index, 100));
    for (let index = 1; index < steps.length; index++) expect(steps[index]).toBeGreaterThanOrEqual(steps[index - 1]);
    expect(new Set(steps)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it("keeps an ordinary day visible next to one large purchase", () => {
    expect(heatStep(50_000, 1_000_000)).toBeGreaterThanOrEqual(2);
  });
});

describe("the month grid", () => {
  it("starts weeks on Monday", () => {
    expect(mondayIndex("2026-11-02")).toBe(0); // a Monday
    expect(mondayIndex("2026-11-01")).toBe(6); // a Sunday
    expect(mondayFirst(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("pads the first and last week with blanks and holds every day once", () => {
    const grid = buildMonthGrid("2026-11", []); // 1 November 2026 is a Sunday, 30 days
    expect(grid.weeks.every((week) => week.length === 7)).toBe(true);
    expect(grid.weeks[0].filter((cell) => cell === null)).toHaveLength(6);
    expect(grid.weeks[0][6]?.day).toBe(1);
    const days = grid.weeks.flat().flatMap((cell) => (cell ? [cell.day] : []));
    expect(days).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(grid.weeks).toHaveLength(6); // six blanks plus thirty days is thirty-six cells
    expect(grid.busiest).toBeNull();
    expect(grid.max).toBe(0);
  });

  it("handles February in a leap year and a month that starts on Monday", () => {
    expect(buildMonthGrid("2028-02", []).weeks.flat().filter(Boolean)).toHaveLength(29);
    const june = buildMonthGrid("2026-06", []); // 1 June 2026 is a Monday
    expect(june.weeks[0][0]?.day).toBe(1);
  });

  it("puts the amounts on their days, finds the busiest, and the earliest when two tie", () => {
    const grid = buildMonthGrid("2026-11", [
      { date: "2026-11-05", total: 100_000 },
      { date: "2026-11-12", total: 400_000 },
      { date: "2026-11-20", total: 400_000 },
    ]);
    const cells = grid.weeks.flat().filter((cell): cell is NonNullable<typeof cell> => cell !== null);
    expect(cells.find((cell) => cell.day === 5)).toMatchObject({ total: 100_000, step: 3 });
    expect(cells.find((cell) => cell.day === 6)).toMatchObject({ total: 0, step: 0 });
    expect(grid.max).toBe(400_000);
    expect(grid.busiest).toMatchObject({ date: "2026-11-12", total: 400_000, step: 5 });
    expect(grid.total).toBe(900_000);
  });
});

describe("daily totals from the database", () => {
  let db: TestDb;
  const base = (date: string, overrides: Partial<NewTransaction> = {}): NewTransaction => ({
    type: "expense", amount: 10_000, title: "x", categoryId: systemCategoryId("food"), occurredAt: epochFromLocal(date, 23, 30, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact", ...overrides,
  });
  beforeEach(async () => {
    db = await createMigratedDb();
  });

  it("sums spending per local day, leaves out income, transfers, deleted rows and other months", async () => {
    await createTransaction(db, base("2026-11-05", { amount: 30_000 }));
    await createTransaction(db, base("2026-11-05", { amount: 20_000 }));
    await createTransaction(db, base("2026-11-07", { amount: 5_000 }));
    await createTransaction(db, base("2026-11-07", { type: "income", categoryId: systemCategoryId("salary"), amount: 9_000_000 }));
    await createTransaction(db, base("2026-10-31", { amount: 99_000 }));
    await createTransaction(db, base("2026-12-01", { amount: 99_000 }));
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    await createTransaction(db, { ...base("2026-11-08", { categoryId: null, walletId: DEFAULT_WALLET_ID }), type: "transfer", toWalletId: bank });
    expect(await dailyExpenseTotals(db, "2026-11")).toEqual([
      { date: "2026-11-05", total: 50_000 },
      { date: "2026-11-07", total: 5_000 },
    ]);
  });

  it("keeps a late-night spend on its own day", async () => {
    await createTransaction(db, base("2026-11-05")); // 23:30 in Jakarta is 16:30 UTC, still the 5th
    expect((await dailyExpenseTotals(db, "2026-11"))[0].date).toBe("2026-11-05");
  });

  it("narrows to one wallet", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    await createTransaction(db, base("2026-11-05", { amount: 30_000 }));
    await createTransaction(db, base("2026-11-05", { amount: 70_000, walletId: bank }));
    expect(await dailyExpenseTotals(db, "2026-11", bank)).toEqual([{ date: "2026-11-05", total: 70_000 }]);
    expect(await dailyExpenseTotals(db, "2026-11", DEFAULT_WALLET_ID)).toEqual([{ date: "2026-11-05", total: 30_000 }]);
    expect(await dailyExpenseTotals(db, "2026-11")).toEqual([{ date: "2026-11-05", total: 100_000 }]);
  });
});
