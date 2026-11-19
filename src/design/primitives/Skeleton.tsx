import { useEffect } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme";
import { motion, radius as radii } from "../tokens";
import { useReduceMotion } from "../useMotion";

export type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  /** A slow fade in and out while real content is on its way. Off under reduced motion. */
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A placeholder block for content that is loading. Use it only where waiting is
 * real (a scan, an import, an export), never as decoration. It is hidden from
 * screen readers: the container announces "loading" instead.
 */
export function Skeleton({ width = "100%", height, radius = radii.field, pulse = true, style }: SkeletonProps) {
  const { color } = useTheme();
  const reduce = useReduceMotion();
  const opacity = useSharedValue(1);
  const shouldPulse = pulse && !reduce;

  useEffect(() => {
    if (!shouldPulse) {
      opacity.set(1);
      return;
    }
    opacity.set(
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: motion.duration.slow * 2.5 }),
          withTiming(1, { duration: motion.duration.slow * 2.5 }),
        ),
        -1,
      ),
    );
  }, [shouldPulse, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      aria-hidden
      style={[{ width, height, borderRadius: radius, backgroundColor: color.surface3 }, animatedStyle, style]}
    />
  );
}
