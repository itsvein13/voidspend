import { StyleSheet, View } from "react-native";

import { useT } from "@/i18n";

import { useTheme } from "../theme";
import { minTarget, radius } from "../tokens";
import { Icon } from "./Icon";
import { pressKey, type KeypadKey, type KeypadState } from "./keypad";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

const ROWS: KeypadKey[][] = [
  ["1", "2", "3", "back"],
  ["4", "5", "6", "+"],
  ["7", "8", "9", "-"],
  ["000", "0", "clear", "equals"],
];

export type AmountKeypadProps = {
  state: KeypadState;
  onChange: (next: KeypadState) => void;
};

/** Digits, three zeros, backspace, plus, minus and equals. Hold backspace to clear. */
export function AmountKeypad({ state, onChange }: AmountKeypadProps) {
  const { color } = useTheme();
  const t = useT();

  const labelOf = (key: KeypadKey): string => {
    switch (key) {
      case "back":
        return t.keypad.back;
      case "clear":
        return t.keypad.clear;
      case "+":
        return t.keypad.plus;
      case "-":
        return t.keypad.minus;
      case "equals":
        return t.keypad.equals;
      case "000":
        return t.keypad.tripleZero;
      default:
        return key;
    }
  };

  const isUtility = (key: KeypadKey) => key === "back" || key === "clear" || key === "+" || key === "-" || key === "equals";

  return (
    <View accessibilityRole="keyboardkey" style={styles.grid}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <PressableScale
              key={key}
              accessibilityLabel={labelOf(key)}
              haptic="select"
              scaleTo={0.94}
              cornerRadius={radius.button}
              containerStyle={styles.cell}
              style={[
                styles.key,
                {
                  backgroundColor: isUtility(key) ? color.surface3 : color.surface2,
                  borderColor: color.hairline,
                },
              ]}
              onPress={() => onChange(pressKey(state, key))}
              onLongPress={key === "back" ? () => onChange(pressKey(state, "clear")) : undefined}
            >
              {key === "back" ? (
                <Icon name="backspace-outline" size={24} color={color.text} />
              ) : key === "clear" ? (
                <Text variant="amountMd" tone="secondary">
                  C
                </Text>
              ) : key === "equals" ? (
                <Text variant="amountMd" tone="accent">
                  =
                </Text>
              ) : (
                <Text variant="amountMd">{key === "-" ? "−" : key}</Text>
              )}
            </PressableScale>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  key: {
    minHeight: minTarget + 12,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
