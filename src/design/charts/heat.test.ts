import { contrastRatio } from "../color";
import { palettes, type Scheme } from "../tokens";
import { HEAT_ALPHAS, heatCell } from "./heat";

const schemes: Scheme[] = ["dark", "light"];

describe.each(schemes)("the spending calendar colors in the %s theme", (scheme) => {
  const palette = palettes[scheme];

  it("keeps the day number readable on every step (4.5:1)", () => {
    for (let step = 1; step < HEAT_ALPHAS.length; step++) {
      const { fill, text } = heatCell(palette, step);
      expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("leaves an empty day on the card with secondary text that also reads", () => {
    const { fill, text } = heatCell(palette, 0);
    expect(fill).toBe("transparent");
    expect(contrastRatio(text, palette.surface1)).toBeGreaterThanOrEqual(4.5);
  });

  it("grows stronger against the card with every step", () => {
    const ratios = [1, 2, 3, 4, 5].map((step) => contrastRatio(heatCell(palette, step).fill, palette.surface1));
    for (let index = 1; index < ratios.length; index++) expect(ratios[index]).toBeGreaterThan(ratios[index - 1]);
  });

  it("stops at the last step for a number past it", () => {
    expect(heatCell(palette, 99)).toEqual(heatCell(palette, 5));
  });
});
