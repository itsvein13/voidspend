import { renderHook } from "@testing-library/react-native";

import { useEased } from "./useEased";

// The Reanimated mock runs tweens instantly, so what can be proven here is where
// a value starts: charts grow in from zero, and reduced motion starts at the target.
const mockReduce = jest.fn(() => false);
jest.mock("./useMotion", () => ({ useReduceMotion: () => mockReduce() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const reanimated = require("react-native-reanimated") as { useSharedValue: (value: number) => unknown };

describe("useEased", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(reanimated, "useSharedValue");
    mockReduce.mockReturnValue(false);
  });
  afterEach(() => spy.mockRestore());

  it("starts at zero so a chart grows in", async () => {
    await renderHook(() => useEased(60));
    expect(spy).toHaveBeenCalledWith(0);
  });

  it("can start from a given value, for marks that only move", async () => {
    await renderHook(() => useEased(60, { from: 40 }));
    expect(spy).toHaveBeenCalledWith(40);
  });

  it("starts at the target with reduced motion, so nothing tweens", async () => {
    mockReduce.mockReturnValue(true);
    await renderHook(() => useEased(60));
    expect(spy).toHaveBeenCalledWith(60);
  });

  it("starts at the target when animation is turned off for the mark", async () => {
    await renderHook(() => useEased(60, { animated: false }));
    expect(spy).toHaveBeenCalledWith(60);
  });
});
