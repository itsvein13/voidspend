import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { radius, type Palette } from "../tokens";
import { Icon, type IconName } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

// Visible height. The small size adds hitSlop so the touch target stays 44.
const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };

export type ButtonColors = { background: string; foreground: string; border: string | null };

/** Colors per variant. Every foreground and background pair is covered by tokens.test.ts. */
export function buttonColors(color: Palette, variant: ButtonVariant): ButtonColors {
  switch (variant) {
    case "primary":
      return { background: color.accent, foreground: color.onAccent, border: null };
    case "secondary":
      // The outline gives the control a 3:1 boundary against the canvas.
      return { background: color.surface3, foreground: color.text, border: color.outline };
    case "quiet":
      return { background: "transparent", foreground: color.accentInk, border: null };
    case "destructive":
      // Red marks a problem. A filled red button is for the final confirm only.
      return { background: color.danger, foreground: color.onDanger, border: null };
  }
}

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { color } = useTheme();
  const colors = buttonColors(color, variant);
  const inactive = disabled || loading;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      busy={loading}
      haptic="tap"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={size === "sm" ? { top: 2, bottom: 2 } : undefined}
      containerStyle={fullWidth ? styles.full : styles.auto}
      cornerRadius={radius.button}
      style={[
        styles.base,
        {
          minHeight: HEIGHT[size],
          backgroundColor: colors.background,
          borderColor: colors.border ?? "transparent",
          borderWidth: colors.border ? 1 : 0,
        },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : icon ? (
          <Icon name={icon} size={18} color={colors.foreground} />
        ) : null}
        <Text variant="button" style={{ color: colors.foreground }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  full: { alignSelf: "stretch" },
  auto: { alignSelf: "flex-start" },
});
