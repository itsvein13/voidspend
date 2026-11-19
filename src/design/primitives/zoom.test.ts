import { clampScale, clampTranslate, DOUBLE_TAP_ZOOM, doubleTapScale, MAX_ZOOM, MIN_ZOOM, stepScale, zoomAbout, ZOOM_STEP } from "./zoom";

describe("how far a photo may zoom", () => {
  it("stays between the smallest and the largest zoom", () => {
    expect(clampScale(0.4)).toBe(MIN_ZOOM);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(40)).toBe(MAX_ZOOM);
  });

  it("steps by the same factor each way, and ends flat when it gets close to the smallest zoom", () => {
    expect(stepScale(1, 1)).toBeCloseTo(ZOOM_STEP);
    expect(stepScale(ZOOM_STEP, -1)).toBe(MIN_ZOOM);
    expect(stepScale(1, -1)).toBe(MIN_ZOOM);
    expect(stepScale(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepScale(2, -1)).toBeCloseTo(2 / ZOOM_STEP);
    // pressing in and then out gets back to the start
    expect(stepScale(stepScale(1, 1), -1)).toBe(MIN_ZOOM);
  });

  it("zooms in on a double tap when flat and out when already zoomed", () => {
    expect(doubleTapScale(1)).toBe(DOUBLE_TAP_ZOOM);
    expect(doubleTapScale(1.005)).toBe(DOUBLE_TAP_ZOOM); // the rounding left by a pinch back to flat
    expect(doubleTapScale(1.5)).toBe(MIN_ZOOM);
    expect(doubleTapScale(MAX_ZOOM)).toBe(MIN_ZOOM);
  });
});

describe("how far a zoomed photo may be dragged", () => {
  it("cannot move when flat", () => {
    expect(clampTranslate(120, 1, 400)).toBe(0);
    expect(clampTranslate(-120, 1, 400)).toBe(0);
  });

  it("may move until an edge of the photo reaches the edge of the view, and no further", () => {
    // At 2x a 400 point wide view shows half the photo: the photo may shift 200 points either way.
    expect(clampTranslate(150, 2, 400)).toBe(150);
    expect(clampTranslate(500, 2, 400)).toBe(200);
    expect(clampTranslate(-500, 2, 400)).toBe(-200);
    expect(clampTranslate(10_000, MAX_ZOOM, 400)).toBe(800);
  });

  it("is symmetric, and never returns minus zero for a flat photo", () => {
    expect(Object.is(clampTranslate(-5, 1, 400), -0)).toBe(false);
    expect(clampTranslate(-150, 2, 400)).toBe(-clampTranslate(150, 2, 400));
  });
});

describe("zooming about a point", () => {
  it("leaves the point under the fingers where it was", () => {
    // A point 100 right of the middle, photo not moved, zoom from 1x to 2x: the photo shifts left by 100 so the
    // point still sits 100 right of the middle.
    const shift = zoomAbout(100, 0, 1, 2);
    const pointOnPhoto = (100 - 0) / 1; // where the point is on the photo before, in photo points
    expect(pointOnPhoto * 2 + shift).toBeCloseTo(100);
  });

  it("does nothing when the middle is the focus of a photo that has not moved", () => {
    expect(zoomAbout(0, 0, 1, 3)).toBe(0);
  });

  it("keeps an earlier shift in proportion", () => {
    expect(zoomAbout(0, 60, 2, 4)).toBe(120);
  });

  it("returns to the start when zooming in and straight back out about the same point", () => {
    const out = zoomAbout(80, 10, 3, 1.5);
    const back = zoomAbout(80, out, 1.5, 3);
    expect(back).toBeCloseTo(10);
  });
});
