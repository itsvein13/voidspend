import {
  budgetUsage,
  effectiveBudget,
  goalProgress,
  lastDayBeforePayday,
  monthlyNeed,
  nextPayday,
  pctChange,
  remaining,
  safePerDay,
  savingsRate,
  spentShare,
  type BudgetRule,
} from "./finance";

describe("remaining", () => {
  it("is income minus expense and saving, plus withdrawals (v1 number for old data)", () => {
    expect(remaining({ income: 5_000_000, expense: 1_800_000, savingDeposit: 0, savingWithdrawal: 0 })).toBe(3_200_000);
    expect(remaining({ income: 5_000_000, expense: 1_000_000, savingDeposit: 500_000, savingWithdrawal: 200_000 })).toBe(3_700_000);
  });

  it("goes negative when more is spent than earned", () => {
    expect(remaining({ income: 0, expense: 120_000, savingDeposit: 0, savingWithdrawal: 0 })).toBe(-120_000);
  });

  it("has no share or rate without income", () => {
    const none = { income: 0, expense: 10, savingDeposit: 0, savingWithdrawal: 0 };
    expect(spentShare(none)).toBeNull();
    expect(savingsRate(none)).toBeNull();
    expect(spentShare({ income: 100, expense: 30, savingDeposit: 20, savingWithdrawal: 0 })).toBeCloseTo(0.5);
    expect(savingsRate({ income: 100, expense: 0, savingDeposit: 30, savingWithdrawal: 10 })).toBeCloseTo(0.2);
  });
});

describe("pctChange keeps the v1 null rule", () => {
  it("is null when last month is zero and this month is not", () => {
    expect(pctChange(500, 0)).toBeNull();
  });
  it("is 0 when both are zero", () => {
    expect(pctChange(0, 0)).toBe(0);
  });
  it("computes a signed percentage otherwise", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(0, 100)).toBe(-100);
  });
});

describe("budgetUsage", () => {
  it("is ok below 80 percent", () => {
    expect(budgetUsage(790, 1000)).toMatchObject({ status: "ok", pct: 79 });
  });
  it("is near from 80 percent up to and including 100", () => {
    expect(budgetUsage(800, 1000).status).toBe("near");
    expect(budgetUsage(1000, 1000).status).toBe("near");
  });
  it("is over above 100 percent and caps the bar", () => {
    expect(budgetUsage(1001, 1000)).toMatchObject({ status: "over", pct: 100, left: -1 });
  });
  it("honours a custom alert level", () => {
    expect(budgetUsage(600, 1000, 60).status).toBe("near");
  });
  it("does not divide by a zero limit", () => {
    expect(budgetUsage(10, 0)).toMatchObject({ pct: 0, status: "over" });
  });
});

describe("effectiveBudget", () => {
  const rules: BudgetRule[] = [
    { categoryId: "food", effectiveFrom: "2000-01", amount: 1_000_000, alertPct: 80 },
    { categoryId: "food", effectiveFrom: "2026-09", amount: 1_500_000, alertPct: 80 },
    { categoryId: "food", effectiveFrom: "2026-12", amount: null, alertPct: 80 },
    { categoryId: "bills", effectiveFrom: "2026-03", amount: 700_000, alertPct: 90 },
  ];

  it("uses the latest rule at or before the month", () => {
    expect(effectiveBudget(rules, "food", "2026-08")?.amount).toBe(1_000_000);
    expect(effectiveBudget(rules, "food", "2026-09")?.amount).toBe(1_500_000);
    expect(effectiveBudget(rules, "food", "2026-11")?.amount).toBe(1_500_000);
  });
  it("returns null when a later rule removes the budget", () => {
    expect(effectiveBudget(rules, "food", "2026-12")).toBeNull();
    expect(effectiveBudget(rules, "food", "2027-05")).toBeNull();
  });
  it("returns null before the first rule and for unknown categories", () => {
    expect(effectiveBudget(rules, "bills", "2026-02")).toBeNull();
    expect(effectiveBudget(rules, "health", "2026-11")).toBeNull();
  });
});

describe("goals", () => {
  it("reports progress, what is left and when it is reached", () => {
    expect(goalProgress(250, 1000)).toEqual({ saved: 250, target: 1000, pct: 25, left: 750, reached: false });
    expect(goalProgress(1200, 1000)).toMatchObject({ pct: 100, left: 0, reached: true });
  });
  it("has no percentage without a target", () => {
    expect(goalProgress(250, null)).toEqual({ saved: 250, target: null, pct: null, left: null, reached: false });
  });
  it("never shows a negative percentage", () => {
    expect(goalProgress(-50, 1000).pct).toBe(0);
  });
  it("works out what to put aside each month, counting this month", () => {
    expect(monthlyNeed(1_200_000, "2027-02-15", "2026-11-18")).toBe(400_000); // 3 months
    expect(monthlyNeed(1_000_001, "2027-02-15", "2026-11-18")).toBe(333_334); // rounds up
    expect(monthlyNeed(500_000, "2026-11-30", "2026-11-18")).toBe(500_000); // this month
    expect(monthlyNeed(500_000, "2026-06-30", "2026-11-18")).toBe(500_000); // overdue: all of it now
    expect(monthlyNeed(0, "2027-02-15", "2026-11-18")).toBe(0);
    expect(monthlyNeed(500_000, null, "2026-11-18")).toBeNull();
  });
});

describe("safe to spend per day", () => {
  it("finds the next payday strictly after today", () => {
    expect(nextPayday("2026-11-18", 25)).toBe("2026-11-25");
    expect(nextPayday("2026-11-25", 25)).toBe("2026-12-25");
    expect(nextPayday("2026-11-30", 1)).toBe("2026-12-01");
    expect(nextPayday("2026-12-30", 5)).toBe("2027-01-05");
  });
  it("moves a payday that does not exist back to the last day of the month", () => {
    expect(nextPayday("2026-02-10", 31)).toBe("2026-02-28");
    expect(nextPayday("2026-02-28", 31)).toBe("2026-03-31");
  });
  it("divides what is left by the days until payday, rounding down", () => {
    // 18 Nov to 25 Nov is 7 days.
    expect(safePerDay(700_000, "2026-11-18", 25)).toBe(100_000);
    expect(safePerDay(700_006, "2026-11-18", 25)).toBe(100_000);
  });
  it("is zero when nothing is left", () => {
    expect(safePerDay(0, "2026-11-18", 25)).toBe(0);
    expect(safePerDay(-5, "2026-11-18", 25)).toBe(0);
  });
  it("names the last day the money has to last", () => {
    expect(lastDayBeforePayday("2026-11-18", 25)).toBe("2026-11-24");
  });
});
