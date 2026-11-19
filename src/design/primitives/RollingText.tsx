import { useEffect } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { splitFormatted } from "@/lib/money";

import { motion, typography, type TextVariant } from "../tokens";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export type RollingTextProps = {
  /** The grouped number, for example "1.250.000". */
  text: string;
  variant: Extract<TextVariant, "amountLg" | "amountMd" | "amountSm">;
  color: string;
  fontSize?: number;
};

/**
 * A number whose digits roll like an odometer. Each digit is a column of 0 to 9
 * that slides to the right place with a spring on the UI thread. Digit columns
 * have a fixed width so the number never jitters while it rolls. Callers fall
 * back to plain text when motion is reduced.
 */
export function RollingText({ text, variant, color, fontSize }: RollingTextProps) {
  const type = typography[variant];
  const size = fontSize ?? type.fontSize;
  const lineHeight = Math.round(size * (type.lineHeight / type.fontSize));
  const digitWidth = Math.round(size * 0.62);
  const separatorWidth = Math.round(size * 0.3);
  const chars = splitFormatted(text);

  const base = {
    fontFamily: type.fontFamily,
    fontSize: size,
    lineHeight,
    color,
    includeFontPadding: false,
  } as const;
  // The digit columns have a fixed geometry. The caller passes a size that
  // already includes the system font scale (capped), so the glyphs must not
  // scale a second time or they outgrow their column and get clipped.
  const fixed = { allowFontScaling: false } as const;

  return (
    <View style={styles.row} aria-hidden>
      {chars.map((item, index) => {
        // Keyed from the right, so a column keeps its identity when the number
        // grows or shrinks by a digit.
        const fromRight = chars.length - index;
        return item.digit === null ? (
          <RNText key={`s${fromRight}`} {...fixed} style={[base, { width: separatorWidth, textAlign: "center" }]}>
            {item.char}
          </RNText>
        ) : (
          <DigitColumn
            key={`d${fromRight}`}
            digit={item.digit}
            width={digitWidth}
            lineHeight={lineHeight}
            textStyle={base}
          />
        );
      })}
    </View>
  );
}

function DigitColumn({
  digit,
  width,
  lineHeight,
  textStyle,
}: {
  digit: number;
  width: number;
  lineHeight: number;
  textStyle: object;
}) {
  const y = useSharedValue(-digit * lineHeight);

  useEffect(() => {
    y.set(withSpring(-digit * lineHeight, motion.spring.gentle));
  }, [digit, lineHeight, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <View style={{ width, height: lineHeight, overflow: "hidden" }}>
      <Animated.View style={style}>
        {DIGITS.map((d) => (
          <RNText key={d} allowFontScaling={false} style={[textStyle, { width, height: lineHeight, textAlign: "center" }]}>
            {d}
          </RNText>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
});
