import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "../theme";
import { useEased } from "../useEased";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ArcProps = { dash: number; at: number; circumference: number; cx: number; radius: number; stroke: string; strokeWidth: number; onPress?: () => void };

/** One slice. Its length and start ease between datasets, so slices slide and resize instead of jumping. */
function Arc({ dash, at, circumference, cx, radius, stroke, strokeWidth, onPress }: ArcProps) {
  const length = useEased(dash);
  const start = useEased(at, { from: at });
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [Math.max(0, length.get()), circumference],
    strokeDashoffset: -start.get(),
  }));
  return (
    <AnimatedCircle
      cx={cx}
      cy={cx}
      r={radius}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      transform={`rotate(-90 ${cx} ${cx})`}
      onPress={onPress}
      animatedProps={animatedProps}
    />
  );
}

export type DonutSliceInput = { key: string; value: number; color: string };

export type DonutProps = {
  slices: readonly DonutSliceInput[];
  size?: number;
  strokeWidth?: number;
  /** One sentence that gives the whole chart, since the slices are not read one by one. */
  label: string;
  /** Tapping a slice. The list under the chart does the same, and is the version for screen readers. */
  onSelect?: (key: string) => void;
  children?: ReactNode;
};

const GAP = 3;

/**
 * Spending by category as a ring. Slices are separated by a surface-colored gap
 * (the dataviz rule for adjacent fills), start at the top and run clockwise in
 * the order given. Color comes from the caller, one per category.
 */
export function Donut({ slices, size = 220, strokeWidth = 28, label, onSelect, children }: DonutProps) {
  const { color } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const center = size / 2;

  const arcs = slices.map((slice, index) => {
    const length = total > 0 ? (slice.value / total) * circumference : 0;
    const before = slices.slice(0, index).reduce((sum, item) => sum + (total > 0 ? (item.value / total) * circumference : 0), 0);
    return { slice, dash: Math.max(0, length - (slices.length > 1 ? GAP : 0)), at: before };
  });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size} aria-hidden>
        <Circle cx={center} cy={center} r={radius} stroke={color.surface3} strokeWidth={strokeWidth} fill="none" />
        {arcs.map(({ slice, dash, at }) => (
          <Arc
            key={slice.key}
            dash={dash}
            at={at}
            circumference={circumference}
            cx={center}
            radius={radius}
            stroke={slice.color}
            strokeWidth={strokeWidth}
            onPress={onSelect ? () => onSelect(slice.key) : undefined}
          />
        ))}
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" },
});
