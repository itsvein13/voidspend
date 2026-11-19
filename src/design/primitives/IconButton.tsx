import { StyleSheet } from "react-native";

import { useTheme } from "../theme";
import { minTarget, radius, tint } from "../tokens";
import { Icon, type IconName } from "./Icon";
import { PressableScale } from "./PressableScale";

export type IconButtonProps = {
  icon: IconName;
  /** Required: an icon alone tells a screen reader nothing. Say what the button does. */
  label: string;
  onPress: () => void;
  variant?: "plain" | "tonal" | "filled";
  /** For toggles such as a favourite or a filter. */
  selected?: boolean;
  disabled?: boolean;
  size?: number;
  testID?: string;
};

export function IconButton({
  icon,
  label,
  onPress,
  variant = "plain",
  selected,
  disabled,
  size = minTarget,
  testID,
}: IconButtonProps) {
  const { color } = useTheme();
  const box = Math.max(size, minTarget);

  let background = "transparent";
  let foreground = color.text;
  let border: string | null = null;
  if (variant === "tonal") {
    background = color.surface3;
    border = color.hairline;
  } else if (variant === "filled") {
    background = color.accent;
    foreground = color.onAccent;
  }
  if (selected) {
    background = tint(color, "accent");
    foreground = color.accentInk;
    border = color.accentInk;
  }

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      selected={selected}
      haptic="tap"
      accessibilityLabel={label}
      cornerRadius={radius.button}
      style={[
        styles.base,
        {
          width: box,
          height: box,
          backgroundColor: background,
          borderColor: border ?? "transparent",
          borderWidth: border ? 1 : 0,
        },
      ]}
    >
      <Icon name={icon} size={22} color={foreground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
});
