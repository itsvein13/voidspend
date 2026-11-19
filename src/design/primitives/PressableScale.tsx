import { useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptic } from "@/lib/haptics";

import { useTheme } from "../theme";
import { motion, radius as radii } from "../tokens";
import { useReduceMotion } from "../useMotion";

type HapticKind = "tap" | "select" | "success" | "warning";

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  /** The visible element: size, fill, border. */
  style?: StyleProp<ViewStyle>;
  /** Layout of the touch target itself: flex, alignSelf, margin. */
  containerStyle?: StyleProp<ViewStyle>;
  haptic?: HapticKind | false;
  scaleTo?: number;
  /** Corner radius of the visible element, so overlays and the focus ring match it. */
  cornerRadius?: number;
  busy?: boolean;
  selected?: boolean;
  checked?: boolean;
};

// react-native-web accepts more cursor and outline values than the React Native
// types list. The browser's own focus outline is turned off because the focus
// ring drawn below replaces it; keeping both showed two rings on keyboard focus.
function webStyle(disabled: boolean): ViewStyle | null {
  if (Platform.OS !== "web") return null;
  return { cursor: disabled ? "not-allowed" : "pointer", outlineStyle: "none" } as unknown as ViewStyle;
}

/**
 * The one pressable every control is built on. It gives press feedback that
 * does not rely on color alone (a small scale and an overlay), a visible focus
 * ring for keyboards, a pointer cursor and hover on web, and a disabled state
 * that stops everything (antislop R-39).
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  haptic: hapticKind = false,
  scaleTo = 0.97,
  cornerRadius = radii.button,
  disabled,
  busy,
  selected,
  checked,
  accessibilityRole = "button",
  accessibilityState,
  onPress,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  onHoverIn,
  onHoverOut,
  ...rest
}: PressableScaleProps) {
  const { color } = useTheme();
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isDisabled = Boolean(disabled);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  let overlay: string | null = null;
  if (!isDisabled) {
    if (pressed) overlay = color.press;
    else if (hovered) overlay = color.hover;
  }

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        disabled: isDisabled,
        busy,
        selected,
        checked,
        ...accessibilityState,
      }}
      style={[containerStyle, webStyle(isDisabled)]}
      onPressIn={(event) => {
        setPressed(true);
        if (!reduce && !isDisabled) scale.set(withSpring(scaleTo, motion.spring.snappy));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.set(reduce ? 1 : withSpring(1, motion.spring.snappy));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (hapticKind) haptic[hapticKind]();
        onPress?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
    >
      <Animated.View style={[style, animatedStyle, isDisabled ? styles.disabled : null]}>
        {children}
        {overlay ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.passThrough,
              { backgroundColor: overlay, borderRadius: cornerRadius },
            ]}
          />
        ) : null}
        {focused ? (
          <View
            style={[
              styles.focusRing,
              { borderColor: color.focus, borderRadius: cornerRadius + 3 },
            ]}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.4 },
  passThrough: { pointerEvents: "none" },
  focusRing: {
    position: "absolute",
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    pointerEvents: "none",
  },
});
