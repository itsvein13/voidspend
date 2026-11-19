import { blend, contrastRatio, parseHex, relativeLuminance, toHex, withAlpha } from "./color";

describe("parseHex and toHex", () => {
  it("parses long and short hex", () => {
    expect(parseHex("#C8F542")).toEqual([200, 245, 66]);
    expect(parseHex("fff")).toEqual([255, 255, 255]);
  });

  it("rejects malformed input", () => {
    expect(() => parseHex("#12")).toThrow();
    expect(() => parseHex("not a color")).toThrow();
  });

  it("round-trips and clamps", () => {
    expect(toHex(parseHex("#0e100f"))).toBe("#0E100F");
    expect(toHex([300, -5, 12.4])).toBe("#FF000C");
  });
});

// Reference pairings from the antislop-human contrast table.
describe("contrastRatio", () => {
  it("matches the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#123456", "#FEDCBA")).toBeCloseTo(
      contrastRatio("#FEDCBA", "#123456"),
      10,
    );
  });

  it("matches the reference table", () => {
    expect(contrastRatio("#FFFFFF", "#333333")).toBeCloseTo(12.63, 1);
    expect(contrastRatio("#FFFFFF", "#666666")).toBeCloseTo(5.74, 1);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#FFFFFF", "#999999")).toBeCloseTo(2.85, 1);
  });

  it("shows why the v1 muted grey fails", () => {
    const ratio = contrastRatio("#555555", "#000000");
    expect(ratio).toBeCloseTo(2.82, 1);
    expect(ratio).toBeLessThan(4.5);
  });

  it("does not round before comparing to a threshold", () => {
    // 4.498 prints as 4.50 but still fails 4.5.
    expect(contrastRatio("#777777", "#070707")).toBeLessThan(4.5);
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 8);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 8);
  });
});

describe("blend and withAlpha", () => {
  it("composites a translucent color over a background", () => {
    expect(blend("#FFFFFF", 0.5, "#000000")).toBe("#808080");
    expect(blend("#FF0000", 0, "#00FF00")).toBe("#00FF00");
    expect(blend("#FF0000", 1, "#00FF00")).toBe("#FF0000");
  });

  it("formats rgba strings", () => {
    expect(withAlpha("#C8F542", 0.12)).toBe("rgba(200, 245, 66, 0.12)");
  });
});
