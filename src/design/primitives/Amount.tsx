import { StyleSheet, useWindowDimensions, View, type StyleProp, type TextStyle } from "react-native";

import { useT } from "@/i18n";
import { formatRupiah, groupThousands } from "@/lib/money";

import { useTheme } from "../theme";
import { typography } from "../tokens";
import { useReduceMotion } from "../useMotion";
import { RollingText } from "./RollingText";
import { Text, toneColor, type TextTone } from "./Text";

export type AmountKind = "income" | "expense" | "saving" | "neutral";

export type AmountProps = {
  /** Whole rupiah. Pass expenses as positive numbers; the kind adds the minus. */
  value: number;
  kind?: AmountKind;
  size?: "lg" | "md" | "sm";
  /** Digits roll to the new value. Only the large size rolls, and not under reduced motion. */
  animated?: boolean;
  /** Overrides the tone the kind would pick. */
  tone?: TextTone;
  /** The most width the large amount may take. The font shrinks to fit. */
  maxWidth?: number;
  style?: StyleProp<TextStyle>;
};

/** Shrinks the large size step by step until "Rp" plus the number fits. */
export function fitAmountSize(numberText: string, base: number, maxWidth: number, min = 26): number {
  const digits = numberText.replace(/\D/g, "").length;
  const separators = numberText.length - digits;
  // Widths in ems: digit columns, separators, and the small "Rp" before them.
  const ems = digits * 0.62 + separators * 0.3 + 1.1;
  let size = base;
  while (size > min && ems * size > maxWidth) size -= 1;
  return size;
}

const KIND_TONE: Record<AmountKind, TextTone> = {
  income: "accent",
  expense: "primary",
  saving: "savings",
  neutral: "primary",
};

export function Amount({ value, kind = "neutral", size = "md", animated = false, tone, maxWidth = 240, style }: AmountProps) {
  const { color } = useTheme();
  const t = useT();
  const reduce = useReduceMotion();
  const { fontScale } = useWindowDimensions();
  // The system font scale applies, but never past the cap of the large amount.
  const appliedScale = Math.min(fontScale, typography.amountLg.maxFontScale);

  const magnitude = Math.abs(Math.round(value));
  // Expenses read as minus, income as plus, savings and neutral amounts as they are.
  const display =
    kind === "expense" ? -magnitude : kind === "income" ? magnitude : Math.round(value);
  const sign = kind === "income" ? "always" : kind === "saving" ? "never" : "auto";
  const resolvedTone = tone ?? (kind === "neutral" && value < 0 ? "danger" : KIND_TONE[kind]);
  const textColor = toneColor(color, resolvedTone);

  const spoken =
    kind === "neutral"
      ? formatRupiah(value)
      : `${t.amount[kind]} ${formatRupiah(magnitude, "never")}`;

  if (size !== "lg") {
    return (
      <Text
        variant={size === "md" ? "amountMd" : "amountSm"}
        tone={resolvedTone}
        accessibilityLabel={spoken}
        style={style}
      >
        {formatRupiah(display, sign)}
      </Text>
    );
  }

  // The large size: a small "Rp" beside big digits, like a price on a receipt.
  const numberText = groupThousands(display);
  // Fit the number into maxWidth after the font scale is applied, so a large
  // system font shrinks the base size instead of overflowing the ring.
  const fontSize = fitAmountSize(numberText, typography.amountLg.fontSize, maxWidth / appliedScale);
  const prefixSize = Math.round(fontSize * 0.42);
  const signText = display < 0 ? "−" : kind === "income" ? "+" : "";
  const roll = animated && !reduce;

  const prefix = (
    <Text
      variant="amountMd"
      tone={resolvedTone}
      maxFontSizeMultiplier={typography.amountLg.maxFontScale}
      style={{
        fontSize: prefixSize,
        lineHeight: Math.round(prefixSize * 1.3),
        marginTop: Math.round(fontSize * appliedScale * 0.14),
        marginRight: 4,
      }}
    >
      {signText}Rp
    </Text>
  );

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={spoken} style={styles.row}>
      {prefix}
      {roll ? (
        <RollingText text={numberText} variant="amountLg" color={textColor} fontSize={Math.round(fontSize * appliedScale)} />
      ) : (
        <Text
          variant="amountLg"
          tone={resolvedTone}
          style={[{ fontSize, lineHeight: Math.round(fontSize * (typography.amountLg.lineHeight / typography.amountLg.fontSize)) }, style]}
          aria-hidden
        >
          {numberText.replace(/^-/, "")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
});
