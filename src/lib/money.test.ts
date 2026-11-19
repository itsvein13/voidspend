import { formatRupiah, groupThousands, splitFormatted } from "./money";

const NBSP = " ";
const MINUS = "−";

describe("groupThousands", () => {
  it("puts a dot between thousands", () => {
    expect(groupThousands(0)).toBe("0");
    expect(groupThousands(999)).toBe("999");
    expect(groupThousands(1000)).toBe("1.000");
    expect(groupThousands(1250000)).toBe("1.250.000");
    expect(groupThousands(10000000)).toBe("10.000.000");
  });

  it("ignores sign and decimals", () => {
    expect(groupThousands(-54300.6)).toBe("54.301");
  });

  it("treats non-finite input as zero", () => {
    expect(groupThousands(NaN)).toBe("0");
    expect(groupThousands(Infinity)).toBe("0");
  });
});

describe("formatRupiah", () => {
  it("keeps Rp and the number on one line", () => {
    expect(formatRupiah(25000)).toBe(`Rp${NBSP}25.000`);
  });

  it("marks only negative amounts by default", () => {
    expect(formatRupiah(-25000)).toBe(`${MINUS}Rp${NBSP}25.000`);
    expect(formatRupiah(25000)).toBe(`Rp${NBSP}25.000`);
  });

  it("can always show a sign, except for zero", () => {
    expect(formatRupiah(25000, "always")).toBe(`+Rp${NBSP}25.000`);
    expect(formatRupiah(-25000, "always")).toBe(`${MINUS}Rp${NBSP}25.000`);
    expect(formatRupiah(0, "always")).toBe(`Rp${NBSP}0`);
    expect(formatRupiah(-0, "always")).toBe(`Rp${NBSP}0`);
  });

  it("can hide the sign", () => {
    expect(formatRupiah(-25000, "never")).toBe(`Rp${NBSP}25.000`);
  });

  it("rounds to whole rupiah", () => {
    expect(formatRupiah(1499.5)).toBe(`Rp${NBSP}1.500`);
    expect(formatRupiah(-0.4)).toBe(`Rp${NBSP}0`);
  });
});

describe("splitFormatted", () => {
  it("marks digits and leaves separators alone", () => {
    expect(splitFormatted("Rp 1.5")).toEqual([
      { char: "R", digit: null },
      { char: "p", digit: null },
      { char: " ", digit: null },
      { char: "1", digit: 1 },
      { char: ".", digit: null },
      { char: "5", digit: 5 },
    ]);
  });
});
