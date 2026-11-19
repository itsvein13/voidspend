import { formatNumberInput, parseFormattedNumber } from "./format";

// These pin down the v1 behaviour of the money input helpers. v2 keeps them
// (money stays whole rupiah), so they must not change by accident.
describe("formatNumberInput", () => {
  it("groups digits with dots as thousands separators", () => {
    expect(formatNumberInput("1234567")).toBe("1.234.567");
    expect(formatNumberInput("999")).toBe("999");
    expect(formatNumberInput("1000")).toBe("1.000");
  });

  it("strips everything that is not a digit", () => {
    expect(formatNumberInput("Rp 25.000,50")).toBe("2.500.050");
    expect(formatNumberInput("-12")).toBe("12");
  });

  it("returns an empty string when there are no digits", () => {
    expect(formatNumberInput("")).toBe("");
    expect(formatNumberInput("abc")).toBe("");
  });
});

describe("parseFormattedNumber", () => {
  it("turns a formatted amount back into an integer", () => {
    expect(parseFormattedNumber("1.234.567")).toBe(1234567);
    expect(parseFormattedNumber("25.000")).toBe(25000);
  });

  it("returns 0 for empty or non-numeric input", () => {
    expect(parseFormattedNumber("")).toBe(0);
    expect(parseFormattedNumber("abc")).toBe(0);
  });

  it("round-trips with formatNumberInput", () => {
    for (const n of [0, 5, 999, 1000, 54300, 10000000]) {
      expect(parseFormattedNumber(formatNumberInput(String(n)))).toBe(n);
    }
  });
});
