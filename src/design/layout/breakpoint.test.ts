import { gutterFor, widthClass } from "./breakpoint";

describe("widthClass", () => {
  it("splits at 600 and 840 dp", () => {
    expect(widthClass(360)).toBe("compact");
    expect(widthClass(599)).toBe("compact");
    expect(widthClass(600)).toBe("medium");
    expect(widthClass(839)).toBe("medium");
    expect(widthClass(840)).toBe("expanded");
    expect(widthClass(1280)).toBe("expanded");
  });
});

describe("gutterFor", () => {
  it("gives wider screens wider gutters", () => {
    expect(gutterFor(360)).toBe(20);
    expect(gutterFor(700)).toBe(24);
    expect(gutterFor(1000)).toBe(32);
  });
});
