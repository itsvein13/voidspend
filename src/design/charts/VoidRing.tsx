import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useT } from "@/i18n";
import { formatRupiah } from "@/lib/money";

import { withAlpha } from "../color";
import { useTheme } from "../theme";
import { motion } from "../tokens";
import { useReduceMotion } from "../useMotion";
import {
  arcLength,
  gapPoint,
  pointOnRing,
  RING_START,
  RING_STEP_INDEX,
  ringFraction,
  ringStep,
} from "./voidRingGeometry";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DROP_SIZE = 8;

export type VoidRingProps = {
  /** Rupiah still left this month. Negative means spending went past income. */
  remaining: number;
  /** Rupiah of income this month. Zero draws an empty ring. */
  income: number;
  size?: number;
  strokeWidth?: number;
  /** Turn off the spring and the falling drop. Reduced motion turns them off too. */
  animated?: boolean;
  /** Sits in the middle of the ring: the amount and its caption. */
  children?: ReactNode;
};

/**
 * Money left this month, drawn as light around a void. The arc drains as you
 * spend, and a drop falls into the gap each time it does. Color follows how
 * much is left: lime, then amber, then red.
 */
export function VoidRing({
  remaining,
  income,
  size = 280,
  strokeWidth = 14,
  animated = true,
  children,
}: VoidRingProps) {
  const { color } = useTheme();
  const t = useT();
  const reduce = useReduceMotion();
  const animate = animated && !reduce;

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = arcLength(radius);
  const fraction = ringFraction(remaining, income);
  const step = ringStep(remaining, income);

  const progress = useSharedValue(fraction);
  const stepValue = useSharedValue(RING_STEP_INDEX[step]);

  useEffect(() => {
    progress.set(animate ? withSpring(fraction, motion.spring.gentle) : fraction);
  }, [fraction, animate, progress]);

  useEffect(() => {
    const target = RING_STEP_INDEX[step];
    stepValue.set(animate ? withTiming(target, { duration: motion.duration.base }) : target);
  }, [step, animate, stepValue]);

  // Strokes use the ink of each hue so the arc is at least 3:1 on every surface.
  const stepColors = [color.track, color.accentInk, color.warningInk, color.dangerInk, color.dangerInk];

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arc * (1 - progress.get()),
    stroke: interpolateColor(stepValue.get(), [0, 1, 2, 3, 4], stepColors),
    opacity: progress.get() <= 0.002 ? 0 : 1,
  }));

  // A drop falls into the gap whenever the remaining amount goes down. This is
  // derived during render from the previous value, not from an effect.
  const [previousRemaining, setPreviousRemaining] = useState(remaining);
  const [drop, setDrop] = useState<{ key: number; from: number } | null>(null);
  if (remaining !== previousRemaining) {
    setPreviousRemaining(remaining);
    if (animate && remaining < previousRemaining && income > 0) {
      setDrop({ key: (drop?.key ?? 0) + 1, from: ringFraction(previousRemaining, income) });
    }
  }

  const pct = Math.round(fraction * 100);
  const summary =
    income > 0
      ? remaining < 0
        ? t.ring.summaryOver(formatRupiah(-remaining, "never"), formatRupiah(income, "never"))
        : t.ring.summary(formatRupiah(remaining, "never"), formatRupiah(income, "never"), pct)
      : t.ring.noIncome;

  const trackColor = step === "over" ? withAlpha(color.danger, 0.35) : color.track;
  const dash = [arc, circumference];
  // Start the arc at the bottom left. A rotate() transform is valid SVG on native and web.
  const rotateTransform = `rotate(${RING_START} ${center} ${center})`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={summary}
      accessibilityValue={{ min: 0, max: 100, now: pct, text: summary }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dash}
          transform={rotateTransform}
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dash}
          transform={rotateTransform}
          animatedProps={animatedProps}
        />
      </Svg>
      {drop ? (
        <Drop key={drop.key} from={pointOnRing(center, center, radius, drop.from)} to={gapPoint(center, center, radius)} color={stepColors[RING_STEP_INDEX[step]]} />
      ) : null}
      <View style={styles.center} aria-hidden>
        {children}
      </View>
    </View>
  );
}

function Drop({
  from,
  to,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}) {
  const fall = useSharedValue(0);

  useEffect(() => {
    fall.set(withTiming(1, { duration: motion.duration.slow, easing: Easing.in(Easing.quad) }));
  }, [fall]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.get(),
    transform: [
      { translateX: from.x + (to.x - from.x) * fall.get() - DROP_SIZE / 2 },
      { translateY: from.y + (to.y - from.y) * fall.get() - DROP_SIZE / 2 },
    ],
  }));

  return <Animated.View style={[styles.drop, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  drop: {
    position: "absolute",
    top: 0,
    left: 0,
    width: DROP_SIZE,
    height: DROP_SIZE,
    borderRadius: DROP_SIZE / 2,
    pointerEvents: "none",
  },
});
