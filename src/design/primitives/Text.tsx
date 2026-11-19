import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { useTheme } from "../theme";
import { typography, type Palette, type TextVariant } from "../tokens";

export type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "accent"
  | "savings"
  | "danger"
  | "warning"
  | "onAccent"
  | "onSavings"
  | "onDanger"
  | "onWarning";

/** Which palette color a tone means. Inks are used so every tone passes 4.5:1. */
export function toneColor(color: Palette, tone: TextTone): string {
  switch (tone) {
    case "primary":
      return color.text;
    case "secondary":
      return color.textSecondary;
    case "tertiary":
      return color.textTertiary;
    case "accent":
      return color.accentInk;
    case "savings":
      return color.savingsInk;
    case "danger":
      return color.dangerInk;
    case "warning":
      return color.warningInk;
    case "onAccent":
      return color.onAccent;
    case "onSavings":
      return color.onSavings;
    case "onDanger":
      return color.onDanger;
    case "onWarning":
      return color.onWarning;
  }
}

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle["textAlign"];
};

export function Text({
  variant = "body",
  tone = "primary",
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const { color } = useTheme();
  const type = typography[variant];
  return (
    <RNText
      {...rest}
      // The system font scale is respected, but capped per variant so the hero
      // amount cannot break its card.
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? type.maxFontScale}
      style={[
        {
          fontFamily: type.fontFamily,
          fontSize: type.fontSize,
          lineHeight: type.lineHeight,
          letterSpacing: type.letterSpacing,
          color: toneColor(color, tone),
          textAlign: align,
        },
        type.tabular ? styles.tabular : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] },
});
