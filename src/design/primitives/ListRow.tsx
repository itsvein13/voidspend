import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { radius } from "../tokens";
import { Icon } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Makes the row a button. Without it the row is plain content. */
  onPress?: () => void;
  /** A chevron says "this opens something". Defaults on for pressable rows. */
  chevron?: boolean;
  divider?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  chevron,
  divider = false,
  disabled,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const { color } = useTheme();
  const showChevron = chevron ?? Boolean(onPress);

  const content = (
    <View style={styles.row}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text variant="bodyLg" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevron-forward" size={18} color={color.textSecondary} /> : null}
    </View>
  );

  const border = divider
    ? { borderBottomColor: color.hairline, borderBottomWidth: StyleSheet.hairlineWidth * 2 }
    : null;

  if (!onPress) {
    return (
      <View testID={testID} style={[styles.base, border]} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ")}
      cornerRadius={radius.field}
      style={[styles.base, border]}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 56, justifyContent: "center", paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  leading: { alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
});
