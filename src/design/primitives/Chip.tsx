import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { radius, tint } from "../tokens";
import { Icon, type IconName } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
};

/**
 * A filter or a choice. Selected is shown three ways, never by color alone: a
 * check mark, a heavier border and a tinted fill.
 */
export function Chip({ label, selected = false, onPress, icon, disabled, testID }: ChipProps) {
  const { color } = useTheme();
  const foreground = selected ? color.accentInk : color.text;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      selected={selected}
      haptic="select"
      accessibilityLabel={label}
      // 36 high plus 4 above and below makes the 44 touch target.
      hitSlop={{ top: 4, bottom: 4 }}
      cornerRadius={radius.field}
      style={[
        styles.base,
        {
          backgroundColor: selected ? tint(color, "accent") : "transparent",
          borderColor: selected ? color.accentInk : color.outline,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {selected ? (
          <Icon name="checkmark" size={16} color={foreground} />
        ) : icon ? (
          <Icon name={icon} size={16} color={foreground} />
        ) : null}
        <Text variant="label" style={{ color: foreground }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
});
