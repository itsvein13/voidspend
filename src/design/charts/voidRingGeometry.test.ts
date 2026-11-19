import {
  arcLength,
  gapPoint,
  pointOnRing,
  RING_START,
  RING_SWEEP,
  ringFraction,
  ringStep,
} from "./voidRingGeometry";

describe("ringFraction", () => {
  it("is the share of income left, clamped to 0..1", () => {
    expect(ringFraction(2500000, 5000000)).toBe(0.5);
    expect(ringFraction(5000000, 5000000)).toBe(1);
    expect(ringFraction(7000000, 5000000)).toBe(1);
    expect(ringFraction(-100, 5000000)).toBe(0);
  });

  it("is empty when there is no income", () => {
    expect(ringFraction(1000, 0)).toBe(0);
    expect(ringFraction(1000, -5)).toBe(0);
    expect(ringFraction(1000, NaN)).toBe(0);
  });
});

describe("ringStep", () => {
  const income = 1000;

  it("is lime at 40 percent and above", () => {
    expect(ringStep(1000, income)).toBe("good");
    expect(ringStep(400, income)).toBe("good");
  });

  it("is amber from 10 up to 40 percent", () => {
    expect(ringStep(399, income)).toBe("warn");
    expect(ringStep(100, income)).toBe("warn");
  });

  it("is red below 10 percent", () => {
    expect(ringStep(99, income)).toBe("low");
    expect(ringStep(0, income)).toBe("low");
  });

  it("is over when spending went past income", () => {
    expect(ringStep(-1, income)).toBe("over");
  });

  it("is none without income", () => {
    expect(ringStep(500, 0)).toBe("none");
  });
});

describe("ring geometry", () => {
  it("draws 300 of 360 degrees", () => {
    expect(arcLength(100)).toBeCloseTo((2 * Math.PI * 100 * 300) / 360, 6);
    expect(RING_SWEEP).toBe(300);
  });

  it("starts at the bottom left and ends at the bottom right, leaving a gap below", () => {
    const start = pointOnRing(100, 100, 50, 0);
    const end = pointOnRing(100, 100, 50, 1);
    expect(RING_START).toBe(120);
    // Both ends sit below the center, on either side of the gap.
    expect(start.y).toBeGreaterThan(100);
    expect(end.y).toBeGreaterThan(100);
    expect(start.x).toBeLessThan(100);
    expect(end.x).toBeGreaterThan(100);
    expect(start.y).toBeCloseTo(end.y, 6);
  });

  it("puts the middle of the arc at the top", () => {
    const top = pointOnRing(100, 100, 50, 0.5);
    expect(top.x).toBeCloseTo(100, 6);
    expect(top.y).toBeCloseTo(50, 6);
  });

  it("puts the gap point straight below the center", () => {
    const gap = gapPoint(100, 100, 50);
    expect(gap.x).toBeCloseTo(100, 6);
    expect(gap.y).toBeCloseTo(150, 6);
  });
});
