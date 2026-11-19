import { useState } from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useT } from "@/i18n";
import { formatNumberInput } from "@/utils/format";

import { useTheme } from "../theme";
import { fonts, minTarget, radius } from "../tokens";
import { Icon } from "./Icon";
import { Text } from "./Text";

// The box draws its own focus ring, so the browser outline on the inner input is
// turned off. Keeping both showed two rings on web. react-native-web accepts
// "none" although the React Native types do not list it.
const webInputReset: TextStyle | null =
  Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null;

export type FieldProps = Omit<
  TextInputProps,
  "style" | "value" | "onChangeText" | "editable" | "placeholderTextColor"
> & {
  /** Always visible above the input. A placeholder is never the label. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helper?: string;
  /** Says what is wrong and what to do. Shown with an icon, not only in red. */
  error?: string;
  prefix?: string;
  suffix?: string;
  optional?: boolean;
  /** "amount" groups digits as you type: 1250000 shows as 1.250.000. */
  variant?: "text" | "amount";
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Field({
  label,
  value,
  onChangeText,
  helper,
  error,
  prefix,
  suffix,
  optional = false,
  variant = "text",
  disabled = false,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: FieldProps) {
  const { color } = useTheme();
  const t = useT();
  const [focused, setFocused] = useState(false);
  const isAmount = variant === "amount";
  const shownPrefix = prefix ?? (isAmount ? "Rp" : undefined);

  const borderColor = error ? color.dangerInk : focused ? color.focus : color.outline;
  const description = error ?? helper;

  return (
    <View style={containerStyle}>
      <Text variant="label" tone="secondary" style={styles.label}>
        {optional ? `${label} (${t.common.optional})` : label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor,
            backgroundColor: disabled ? color.surface2 : color.surface1,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        {/* Focus adds a second pixel inside the border, so the box never changes size. */}
        {focused || error ? (
          <View style={[styles.ring, { borderColor }]} />
        ) : null}
        {shownPrefix ? (
          <Text variant="bodyLg" tone="secondary">
            {shownPrefix}
          </Text>
        ) : null}
        <TextInput
          {...rest}
          value={value}
          onChangeText={(text) => onChangeText(isAmount ? formatNumberInput(text) : text)}
          editable={!disabled}
          keyboardType={isAmount ? "number-pad" : rest.keyboardType}
          inputMode={isAmount ? "numeric" : rest.inputMode}
          placeholderTextColor={color.textTertiary}
          selectionColor={color.accentInk}
          cursorColor={color.accentInk}
          accessibilityLabel={label}
          accessibilityHint={description}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: color.text }, webInputReset]}
        />
        {suffix ? (
          <Text variant="bodyLg" tone="secondary">
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={16} color={color.dangerInk} />
          <Text variant="caption" tone="danger" style={styles.messageText}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" tone="secondary" style={styles.message}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: minTarget + 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.field,
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: radius.field,
    pointerEvents: "none",
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.textMedium,
    fontSize: 17,
    minHeight: minTarget,
  },
  message: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  messageText: { flex: 1 },
});
