import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "../theme";
import { useEased } from "../useEased";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressRingProps = {
  /** 0 to 100. Null draws an empty track, for a goal without a target. */
  value: number | null;
  size?: number;
  strokeWidth?: number;
  /** Says what it measures, for screen readers: "Trip, 25 percent". */
  label: string;
  /** Sits in the middle, for example a percentage. */
  children?: ReactNode;
};

/**
 * A full ring that fills clockwise from the top. Blue for savings, lime once the
 * goal is reached. The fill eases to a new value, and holds still with reduced motion.
 */
export function ProgressRing({ value, size = 64, strokeWidth = 8, label, children }: ProgressRingProps) {
  const { color } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tone = pct >= 100 ? color.accent : color.savingsInk;
  const center = size / 2;

  const eased = useEased(pct);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - eased.get() / 100),
    // A round cap draws a dot at zero length, so the arc hides until it has something to show.
    opacity: eased.get() <= 0.2 ? 0 : 1,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={value === null ? undefined : { min: 0, max: 100, now: Math.round(pct) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} aria-hidden style={styles.svg}>
        <Circle cx={center} cy={center} r={radius} stroke={color.surface3} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={tone}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={[circumference, circumference]}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: "absolute", top: 0, left: 0, pointerEvents: "none" },
  center: { ...StyleSheet.flatten({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }), alignItems: "center", justifyContent: "center" },
});
