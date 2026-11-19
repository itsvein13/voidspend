import { useEffect } from "react";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { motion } from "./tokens";
import { useReduceMotion } from "./useMotion";

/**
 * A number that eases toward `target` on the UI thread, for chart marks that
 * should move between datasets instead of jumping. It starts at `from` (zero by
 * default), so a chart grows in the first time it shows. With reduced motion, or
 * `animated` false, it holds the target from the first frame and never tweens.
 */
export function useEased(target: number, { animated = true, from = 0 }: { animated?: boolean; from?: number } = {}): SharedValue<number> {
  const reduce = useReduceMotion();
  const animate = animated && !reduce;
  const value = useSharedValue(animate ? from : target);

  useEffect(() => {
    value.set(animate ? withTiming(target, { duration: motion.duration.slow, easing: Easing.out(Easing.cubic) }) : target);
  }, [target, animate, value]);

  return value;
}
