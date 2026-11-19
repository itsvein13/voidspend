import {
  addDays,
  addMonths,
  clampDay,
  currentOffsetMinutes,
  daysBetween,
  daysInMonth,
  epochFromLocal,
  fromV1Month,
  isValidLocalDate,
  localDateOf,
  localTimeOf,
  monthEndExclusive,
  monthOf,
  monthsBetween,
  weekdayOf,
} from "./dates";

describe("local dates from an epoch and a stored offset", () => {
  // 16 July 2026, 23:30 in Jakarta (UTC+7) is 16:30 UTC.
  const jakartaLate = Date.UTC(2026, 6, 16, 16, 30);

  it("keeps the date where the event happened, not where the phone is later", () => {
    expect(localDateOf(jakartaLate, 420)).toBe("2026-07-16");
    expect(localTimeOf(jakartaLate, 420)).toBe("23:30");
    // The same instant seen from Bali (UTC+8) is already the next day.
    expect(localDateOf(jakartaLate, 480)).toBe("2026-07-17");
    expect(localTimeOf(jakartaLate, 480)).toBe("00:30");
  });

  it("round-trips through epochFromLocal", () => {
    const epoch = epochFromLocal("2026-07-16", 23, 30, 420);
    expect(epoch).toBe(jakartaLate);
    expect(localDateOf(epoch, 420)).toBe("2026-07-16");
  });

  it("handles zones behind UTC and month and year boundaries", () => {
    const epoch = epochFromLocal("2026-12-31", 23, 59, -300);
    expect(localDateOf(epoch, -300)).toBe("2026-12-31");
    expect(localDateOf(epoch, 420)).toBe("2027-01-01");
  });

  it("never returns negative zero for the device offset", () => {
    expect(Object.is(currentOffsetMinutes(new Date(0)), -0)).toBe(false);
  });
});

describe("calendar math", () => {
  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(clampDay(2026, 4, 31)).toBe(30);
  });

  it("validates dates", () => {
    expect(isValidLocalDate("2026-02-29")).toBe(false);
    expect(isValidLocalDate("2028-02-29")).toBe(true);
    expect(isValidLocalDate("2026-13-01")).toBe(false);
    expect(isValidLocalDate("26-1-1")).toBe(false);
  });

  it("adds months across years in both directions", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthEndExclusive("2026-12")).toBe("2027-01-01");
    expect(monthsBetween("2026-11", "2027-02")).toBe(3);
    expect(monthOf("2026-07-16")).toBe("2026-07");
  });

  it("converts the 0-based months of v1", () => {
    expect(fromV1Month(2026, 6)).toBe("2026-07");
    expect(fromV1Month(2026, 11)).toBe("2026-12");
    expect(fromV1Month(2026, 0)).toBe("2026-01");
  });

  it("counts days and weekdays", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(daysBetween("2026-07-16", "2026-08-01")).toBe(16);
    expect(daysBetween("2026-08-01", "2026-07-16")).toBe(-16);
    expect(weekdayOf("2026-11-18")).toBe(3); // Wednesday
  });
});
