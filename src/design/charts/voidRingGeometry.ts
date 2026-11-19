// Geometry and thresholds of the Void ring, with no React in it so the numbers
// are unit tested. The ring is the identity motif of VOIDSPEND: an arc of
// light around a gap, taken from the app icon (a V falling into a ring).

/** Degrees of the arc. The other 60 degrees are the gap at the bottom. */
export const RING_SWEEP = 300;
/** Where the arc starts, clockwise from 3 o'clock: bottom left. */
export const RING_START = 120;
/** Direction of the gap, straight down. */
export const RING_GAP_ANGLE = 90;

export type RingStep = "none" | "good" | "warn" | "low" | "over";

/** Share of income still left, clamped to 0 to 1. No income means an empty ring. */
export function ringFraction(remaining: number, income: number): number {
  if (!(income > 0)) return 0;
  return Math.min(1, Math.max(0, remaining / income));
}

/**
 * Lime while at least 40 percent is left, amber from 10 to 40, red below 10 or
 * when spending went past income.
 */
export function ringStep(remaining: number, income: number): RingStep {
  if (!(income > 0)) return "none";
  if (remaining < 0) return "over";
  const fraction = remaining / income;
  if (fraction < 0.1) return "low";
  if (fraction < 0.4) return "warn";
  return "good";
}

export const RING_STEP_INDEX: Record<RingStep, number> = {
  none: 0,
  good: 1,
  warn: 2,
  low: 3,
  over: 4,
};

/** Length of the full 300 degree arc for a circle of this radius. */
export function arcLength(radius: number): number {
  return (2 * Math.PI * radius * RING_SWEEP) / 360;
}

/** The point on the ring where an arc of this fraction ends. */
export function pointOnRing(
  cx: number,
  cy: number,
  radius: number,
  fraction: number,
): { x: number; y: number } {
  const angle = ((RING_START + RING_SWEEP * fraction) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/** The middle of the gap: where a drop of spent money falls into the void. */
export function gapPoint(cx: number, cy: number, radius: number): { x: number; y: number } {
  const angle = (RING_GAP_ANGLE * Math.PI) / 180;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}
