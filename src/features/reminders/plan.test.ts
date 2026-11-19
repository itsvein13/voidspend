import type { RecurringRule } from "@/db/repo/recurring";
import { epochFromLocal } from "@/lib/dates";

import { planReminders, REMINDER_HORIZON, REMINDER_PREFIX } from "./plan";

const rule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "r1", type: "expense", amount: 350_000, title: "Listrik", counterparty: null, categoryId: "sys_bills", goalId: null, walletId: null,
  frequency: "monthly", dayOfMonth: 20, weekday: null, startDate: "2026-01-20", endDate: null, nextDueDate: "2026-11-20", mode: "confirm", remind: true, pausedAt: null, ...overrides,
});
const WIB = 420;
const at = (date: string, offset = WIB) => epochFromLocal(date, 9, 0, offset);
const now = epochFromLocal("2026-11-19", 7, 0, WIB);

describe("planning reminders", () => {
  it("puts a reminder at nine in the morning of each coming due date, as many as the horizon", () => {
    const plan = planReminders([rule()], now, WIB);
    expect(plan).toHaveLength(REMINDER_HORIZON);
    expect(plan.map((item) => item.date)).toEqual(["2026-11-20", "2026-12-20", "2027-01-20", "2027-02-20", "2027-03-20", "2027-04-20"]);
    expect(plan[0]).toMatchObject({ id: `${REMINDER_PREFIX}r1-2026-11-20`, at: at("2026-11-20"), title: "Listrik", amount: 350_000, auto: false });
  });

  it("follows the phone's zone, so nine o'clock stays nine o'clock where the person is", () => {
    const bali = planReminders([rule()], now, 480);
    expect(bali[0].at).toBe(at("2026-11-20", 480));
    expect(bali[0].at).not.toBe(at("2026-11-20", WIB));
  });

  it("leaves out a rule that does not ask for one, and a paused rule", () => {
    expect(planReminders([rule({ remind: false })], now, WIB)).toEqual([]);
    expect(planReminders([rule({ pausedAt: 1 })], now, WIB)).toEqual([]);
  });

  it("skips a due date whose nine o'clock has passed, and the missed one is left to Home", () => {
    const late = epochFromLocal("2026-11-20", 9, 1, WIB);
    expect(planReminders([rule()], late, WIB)[0].date).toBe("2026-12-20");
    const behind = rule({ nextDueDate: "2026-08-20" }); // three months behind: those are on Home already
    expect(planReminders([behind], now, WIB)[0].date).toBe("2026-11-20");
  });

  it("stops at the end date, and gives none for a rule that has ended", () => {
    const ending = planReminders([rule({ endDate: "2027-01-31" })], now, WIB);
    expect(ending.map((item) => item.date)).toEqual(["2026-11-20", "2026-12-20", "2027-01-20"]);
    expect(planReminders([rule({ endDate: "2026-10-31" })], now, WIB)).toEqual([]);
  });

  it("handles weekly and yearly rules", () => {
    const weekly = planReminders([rule({ frequency: "weekly", dayOfMonth: null, weekday: 1, startDate: "2026-11-02", nextDueDate: "2026-11-23" })], now, WIB, 3);
    expect(weekly.map((item) => item.date)).toEqual(["2026-11-23", "2026-11-30", "2026-12-07"]);
    const yearly = planReminders([rule({ frequency: "yearly", dayOfMonth: 20, startDate: "2025-11-20", nextDueDate: "2026-11-20" })], now, WIB, 2);
    expect(yearly.map((item) => item.date)).toEqual(["2026-11-20", "2027-11-20"]);
  });

  it("marks an automatic rule, and sorts the reminders of several rules by time", () => {
    const plan = planReminders([rule({ id: "b", nextDueDate: "2026-12-05", dayOfMonth: 5, mode: "auto", title: "Gaji" }), rule({ id: "a" })], now, WIB, 2);
    expect(plan.map((item) => item.date)).toEqual(["2026-11-20", "2026-12-05", "2026-12-20", "2027-01-05"]);
    expect(plan.find((item) => item.ruleId === "b")?.auto).toBe(true);
  });

  it("gives every reminder its own id, so a second run replaces the first and never doubles it", () => {
    const first = planReminders([rule()], now, WIB).map((item) => item.id);
    const second = planReminders([rule()], now, WIB).map((item) => item.id);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});
