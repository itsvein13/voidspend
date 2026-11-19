import { StyleSheet, Switch, View } from "react-native";

import { haptic } from "@/lib/haptics";

import { useTheme } from "../theme";
import { radius } from "../tokens";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/** A setting you turn on or off. The whole row is the touch target. */
export function SwitchRow({ label, description, value, onValueChange, disabled, testID }: SwitchRowProps) {
  const { color, scheme } = useTheme();
  // A light thumb on the dark grey track, a white one on the light theme's track:
  // the off thumb stays clearly separate from the track in both themes.
  const offThumb = scheme === "dark" ? color.text : color.surface1;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      checked={value}
      disabled={disabled}
      scaleTo={0.985}
      cornerRadius={radius.field}
      style={styles.row}
      onPress={() => {
        haptic.select();
        onValueChange(!value);
      }}
    >
      <View style={styles.text}>
        <Text variant="bodyLg">{label}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      {/* The row handles the press. The native switch only shows the state. */}
      <View style={styles.inert} aria-hidden>
        <Switch
          value={value}
          disabled={disabled}
          trackColor={{ false: color.outline, true: color.accent }}
          thumbColor={value ? color.onAccent : offThumb}
        />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  inert: { pointerEvents: "none" },
});
