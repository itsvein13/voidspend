import { blend, contrastRatio } from "../color";
import type { Palette } from "../tokens";

/**
 * How much of the text color is mixed into the surface at each step of the spending calendar. Step 0 is an empty
 * day. Spending is neutral in this app (red and lime keep their meanings), so the ramp is one neutral going from
 * faint to strong. The steps skip the middle where neither text color would reach 4.5:1 on the fill.
 */
export const HEAT_ALPHAS = [0, 0.16, 0.28, 0.4, 0.62, 0.9] as const;

/** The fill of a calendar cell and the color of the day number on it. */
export function heatCell(palette: Palette, step: number): { fill: string; text: string } {
  if (step <= 0) return { fill: "transparent", text: palette.textSecondary };
  const alpha = HEAT_ALPHAS[Math.min(step, HEAT_ALPHAS.length - 1)];
  const fill = blend(palette.text, alpha, palette.surface1);
  // Whichever of the two ink colors reads better on this fill: light text on the faint steps, dark on the strong ones.
  const text = contrastRatio(palette.text, fill) >= contrastRatio(palette.canvas, fill) ? palette.text : palette.canvas;
  return { fill, text };
}
