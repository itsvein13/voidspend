// The numbers behind pinch to zoom. Pure, so the limits (how far, how far it may be dragged, what a double tap
// does) are tested. Each one is marked as a worklet because the gestures call them on the UI thread.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
/** Where a double tap zooms to. */
export const DOUBLE_TAP_ZOOM = 2.5;
/** What one press of the zoom buttons multiplies or divides by. */
export const ZOOM_STEP = 1.5;

export function clampScale(scale: number): number {
  "worklet";
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/**
 * How far the picture may be dragged from the middle. At the smallest zoom it fills the view and cannot move.
 * Zoomed in, an edge of the picture can reach the edge of the view and no further, so it never shows an empty gap.
 */
export function clampTranslate(value: number, scale: number, viewport: number): number {
  "worklet";
  const limit = (viewport * (scale - 1)) / 2;
  // Adding zero turns the minus zero a flat photo would give into a plain zero.
  return Math.min(limit, Math.max(-limit, value)) + 0;
}

/** One step of the zoom buttons. A result close to the smallest zoom snaps to it, so zooming back out ends flat. */
export function stepScale(scale: number, direction: 1 | -1): number {
  "worklet";
  const next = clampScale(direction === 1 ? scale * ZOOM_STEP : scale / ZOOM_STEP);
  return next < 1.05 ? MIN_ZOOM : next;
}

/** A double tap zooms out when zoomed in at all, and in to a comfortable reading size when not. */
export function doubleTapScale(scale: number): number {
  "worklet";
  return scale > 1.01 ? MIN_ZOOM : DOUBLE_TAP_ZOOM;
}

/**
 * The shift that keeps the point under the fingers (or the tapped point) where it is while the scale changes.
 * `focal` and `translate` are measured from the middle of the view. Used for a pinch and for a double tap.
 */
export function zoomAbout(focal: number, translate: number, fromScale: number, toScale: number): number {
  "worklet";
  return focal - (focal - translate) * (toScale / fromScale);
}
