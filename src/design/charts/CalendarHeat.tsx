import { StyleSheet, View } from "react-native";

import { PressableScale } from "../primitives/PressableScale";
import { Text } from "../primitives/Text";
import { useTheme } from "../theme";
import { minTarget } from "../tokens";
import { HEAT_ALPHAS, heatCell } from "./heat";

export type HeatDay = {
  /** "YYYY-MM-DD", given back to onSelect. */
  date: string;
  day: number;
  /** 0 for an empty day, then 1 to 5. */
  step: number;
  /** What a screen reader says: the day and the amount, so no one needs the colors. */
  label: string;
  today?: boolean;
};

export type CalendarHeatProps = {
  /** Seven short names, in the order of the columns. */
  weekdays: readonly string[];
  /** Rows of seven. A null is a blank. */
  weeks: readonly (HeatDay | null)[][];
  selected: string | null;
  onSelect: (date: string) => void;
  lessLabel: string;
  moreLabel: string;
};

/**
 * A month of days, each shaded by how much was spent. The shade is never the only way to learn the amount: every
 * day can be selected and the screen reads its amount out, and the label of each day says it.
 */
export function CalendarHeat({ weekdays, weeks, selected, onSelect, lessLabel, moreLabel }: CalendarHeatProps) {
  const { color } = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {weekdays.map((name, index) => (
          <Text key={`${name}-${index}`} variant="micro" tone="secondary" style={styles.weekday}>
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.row}>
          {week.map((cell, index) => {
            if (!cell) return <View key={index} style={styles.cell} />;
            const { fill, text } = heatCell(color, cell.step);
            const isSelected = cell.date === selected;
            return (
              <PressableScale
                key={cell.date}
                containerStyle={styles.cell}
                onPress={() => onSelect(cell.date)}
                selected={isSelected}
                haptic="select"
                accessibilityLabel={cell.label}
                cornerRadius={10}
                style={[
                  styles.day,
                  {
                    backgroundColor: fill,
                    borderColor: isSelected ? color.focus : cell.today ? color.accentInk : color.outline,
                    borderWidth: isSelected ? 2 : cell.today ? 1.5 : 1,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: text }} maxFontSizeMultiplier={1.3}>
                  {cell.day}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      ))}
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text variant="micro" tone="secondary">
          {lessLabel}
        </Text>
        {HEAT_ALPHAS.slice(1).map((_, index) => (
          <View key={index} style={[styles.swatch, { backgroundColor: heatCell(color, index + 1).fill, borderColor: color.outline }]} />
        ))}
        <Text variant="micro" tone="secondary">
          {moreLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  row: { flexDirection: "row", gap: 4 },
  weekday: { flex: 1, textAlign: "center" },
  cell: { flex: 1 },
  day: { minHeight: minTarget, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 8 },
  swatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1 },
});
