import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptic } from "@/lib/haptics";

import { useTheme } from "../theme";
import { minTarget, motion, radius } from "../tokens";
import { useReduceMotion } from "../useMotion";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, for example "Appearance". */
  label: string;
};

const PAD = 4;

/** Two to four mutually exclusive choices with a moving indicator. */
export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  const { color, scheme } = useTheme();
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const placed = useRef(false);

  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segmentWidth = width > 0 ? (width - PAD * 2) / options.length : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = index * segmentWidth;
    // The first placement jumps straight to the selected segment. Only later
    // changes slide.
    if (!placed.current || reduce) {
      x.set(target);
      placed.current = true;
    } else {
      x.set(withSpring(target, motion.spring.snappy));
    }
  }, [index, segmentWidth, reduce, x]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.track,
        { backgroundColor: scheme === "dark" ? color.canvas : color.surface2, borderColor: color.hairline },
      ]}
    >
      {/* Always mounted and hidden until measured, so it never appears late. */}
      <Animated.View
        style={[
          styles.indicator,
          {
            width: segmentWidth,
            opacity: segmentWidth > 0 ? 1 : 0,
            backgroundColor: scheme === "dark" ? color.surface3 : color.surface1,
            borderColor: color.outline,
          },
          indicatorStyle,
        ]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            selected={selected}
            checked={selected}
            scaleTo={1}
            cornerRadius={radius.button - PAD}
            containerStyle={styles.cell}
            style={styles.segment}
            onPress={() => {
              if (selected) return;
              haptic.select();
              onChange(option.value);
            }}
          >
            {/* The selected label is also heavier, so selection is not color alone. */}
            <Text
              variant={selected ? "button" : "label"}
              tone={selected ? "primary" : "secondary"}
              align="center"
              // Two lines at most: a long label wraps instead of being cut off,
              // which keeps it readable at large font sizes.
              numberOfLines={2}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: PAD,
    minHeight: minTarget + PAD * 2,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  indicator: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.button - PAD,
    borderWidth: 1,
    pointerEvents: "none",
  },
  cell: { flex: 1 },
  segment: { minHeight: minTarget, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
});
