import { dueOccurrences, firstOccurrence, nextOccurrenceAfter, stepOccurrence, type Schedule } from "./recurrence";

const monthly = (dayOfMonth: number | null, startDate: string): Schedule => ({
  frequency: "monthly",
  dayOfMonth,
  weekday: null,
  startDate,
});

describe("monthly schedules", () => {
  it("starts on the wanted day of the start month, or the next month if that day has passed", () => {
    expect(firstOccurrence(monthly(25, "2026-11-01"))).toBe("2026-11-25");
    expect(firstOccurrence(monthly(5, "2026-11-18"))).toBe("2026-12-05");
  });

  it("falls back to the day of the start date", () => {
    expect(firstOccurrence(monthly(null, "2026-11-18"))).toBe("2026-11-18");
  });

  it("does not drift after a short month", () => {
    const schedule = monthly(31, "2026-01-31");
    const dates: string[] = [];
    let current = firstOccurrence(schedule);
    for (let i = 0; i < 5; i++) {
      dates.push(current);
      current = stepOccurrence(schedule, current);
    }
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("crosses the year end", () => {
    expect(stepOccurrence(monthly(25, "2026-01-01"), "2026-12-25")).toBe("2027-01-25");
  });

  it("finds the next occurrence after a date", () => {
    const schedule = monthly(25, "2026-01-01");
    expect(nextOccurrenceAfter(schedule, "2026-11-18")).toBe("2026-11-25");
    expect(nextOccurrenceAfter(schedule, "2026-11-25")).toBe("2026-12-25");
  });
});

describe("weekly and yearly schedules", () => {
  it("weekly lands on the wanted weekday", () => {
    // 18 Nov 2026 is a Wednesday. Friday is 5.
    const schedule: Schedule = { frequency: "weekly", dayOfMonth: null, weekday: 5, startDate: "2026-11-18" };
    expect(firstOccurrence(schedule)).toBe("2026-11-20");
    expect(stepOccurrence(schedule, "2026-11-20")).toBe("2026-11-27");
  });

  it("yearly keeps the date and survives 29 February", () => {
    const schedule: Schedule = { frequency: "yearly", dayOfMonth: null, weekday: null, startDate: "2028-02-29" };
    expect(firstOccurrence(schedule)).toBe("2028-02-29");
    expect(stepOccurrence(schedule, "2028-02-29")).toBe("2029-02-28");
    expect(stepOccurrence(schedule, "2029-02-28")).toBe("2030-02-28");
  });
});

describe("due occurrences", () => {
  it("lists everything due from the next due date up to today, oldest first", () => {
    const schedule = monthly(25, "2026-08-01");
    expect(dueOccurrences(schedule, "2026-08-25", "2026-11-18")).toEqual(["2026-08-25", "2026-09-25", "2026-10-25"]);
  });

  it("is empty when nothing is due yet", () => {
    expect(dueOccurrences(monthly(25, "2026-08-01"), "2026-11-25", "2026-11-18")).toEqual([]);
  });

  it("includes today and caps a very long catch-up", () => {
    expect(dueOccurrences(monthly(18, "2026-01-01"), "2026-11-18", "2026-11-18")).toEqual(["2026-11-18"]);
    expect(dueOccurrences(monthly(1, "2020-01-01"), "2020-01-01", "2026-11-18", 12)).toHaveLength(12);
  });
});
