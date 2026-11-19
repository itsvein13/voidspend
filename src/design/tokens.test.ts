import { blend, contrastRatio, withAlpha } from "./color";
import {
  categoryOrder,
  darkPalette,
  lightPalette,
  tint,
  type Hue,
  type Palette,
} from "./tokens";

const hues: Hue[] = ["accent", "savings", "danger", "warning"];
const inks = {
  accent: "accentInk",
  savings: "savingsInk",
  danger: "dangerInk",
  warning: "warningInk",
} as const;
const onFill = {
  accent: "onAccent",
  savings: "onSavings",
  danger: "onDanger",
  warning: "onWarning",
} as const;

const AA_TEXT = 4.5;
const NON_TEXT = 3;

// The same matrix for both themes: if a hex changes, the failing line names
// the exact pair that broke.
describe.each([
  ["dark", darkPalette],
  ["light", lightPalette],
] as const)("%s palette contrast", (_name, p: Palette) => {
  const surfaces = {
    canvas: p.canvas,
    surface1: p.surface1,
    surface2: p.surface2,
    surface3: p.surface3,
  };

  describe.each(Object.entries(surfaces))("on %s", (_sn, bg) => {
    it.each([
      ["text", p.text],
      ["textSecondary", p.textSecondary],
      ["textTertiary", p.textTertiary],
    ])("%s reads as text (4.5:1)", (_n, fg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(hues)("%s ink reads as text and as a stroke", (hue) => {
      const ink = p[inks[hue]];
      expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("outline identifies a control boundary (3:1)", () => {
      expect(contrastRatio(p.outline, bg)).toBeGreaterThanOrEqual(NON_TEXT);
    });

    it("focus ring is visible (3:1)", () => {
      expect(contrastRatio(p.focus, bg)).toBeGreaterThanOrEqual(NON_TEXT);
    });
  });

  it.each(hues)("text on a %s fill reads as text", (hue) => {
    expect(contrastRatio(p[onFill[hue]], p[hue])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(hues.filter((h) => h !== "warning"))(
    "%s fill stands out from the canvas and cards (3:1)",
    (hue) => {
      expect(contrastRatio(p[hue], p.canvas)).toBeGreaterThanOrEqual(NON_TEXT);
      expect(contrastRatio(p[hue], p.surface1)).toBeGreaterThanOrEqual(NON_TEXT);
    },
  );

  it.each(hues)("%s ink reads on its own translucent tint", (hue) => {
    for (const bg of [p.canvas, p.surface1, p.surface2]) {
      const tinted = blend(p[hue], p.tintAlpha[hue], bg);
      expect(contrastRatio(p[inks[hue]], tinted)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(p.text, tinted)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("text on glass over the strongest glow keeps its contrast", () => {
    const glow = blend(p.accent, p.glass.glowMax, p.canvas);
    const glass = blend(p.glass.tint, p.glass.alpha, glow);
    expect(contrastRatio(p.text, glass)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.textSecondary, glass)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("category colors are drawn in a fixed order and all exist", () => {
    expect(Object.keys(p.category).sort()).toEqual([...categoryOrder].sort());
  });
});

describe("amber needs a border on light surfaces", () => {
  it("fill alone has no 3:1 boundary, so banners pair it with warningInk", () => {
    expect(contrastRatio(lightPalette.warning, lightPalette.surface1)).toBeLessThan(NON_TEXT);
    expect(contrastRatio(lightPalette.warningInk, lightPalette.surface1)).toBeGreaterThanOrEqual(NON_TEXT);
  });
});

describe("category colors", () => {
  it("dark colors clear 3:1 on the dark card surface", () => {
    for (const key of categoryOrder) {
      expect(contrastRatio(darkPalette.category[key], darkPalette.surface1)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  it("light colors stay above 2.6:1, so slices always ship with visible labels", () => {
    // The dataviz validator reports relief for aqua (2.82) and magenta (2.69)
    // on white: the donut always has a legend with the category name.
    for (const key of categoryOrder) {
      expect(contrastRatio(lightPalette.category[key], lightPalette.surface1)).toBeGreaterThanOrEqual(2.6);
    }
  });
});

describe("tint", () => {
  it("returns a translucent rgba of the hue", () => {
    expect(tint(darkPalette, "accent")).toBe(withAlpha("#C8F542", darkPalette.tintAlpha.accent));
  });
});
