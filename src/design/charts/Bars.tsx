import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { Text } from "../primitives/Text";
import { useTheme } from "../theme";
import { useEased } from "../useEased";

/** One bar. It grows from the baseline the first time and eases when the value changes. */
function Bar({ target, tone }: { target: number; tone: string }) {
  const eased = useEased(target);
  const style = useAnimatedStyle(() => ({ height: eased.get() }));
  return <Animated.View style={[styles.bar, { backgroundColor: tone }, style]} />;
}

export type BarGroup = { key: string; label: string; income: number; expense: number; description: string };

export type BarsProps = {
  groups: readonly BarGroup[];
  height?: number;
};

/**
 * Income and spending per month, two thin bars side by side. Income is lime and
 * spending is the neutral text color (red is for problems only). The month sits
 * under each pair as a direct label, and each pair has a full sentence for screen
 * readers. Bars start at the baseline with rounded tops.
 */
export function Bars({ groups, height = 140 }: BarsProps) {
  const { color } = useTheme();
  const max = Math.max(1, ...groups.flatMap((group) => [group.income, group.expense]));
  const bar = (value: number, tone: string) => <Bar target={Math.max(value > 0 ? 3 : 0, (value / max) * height)} tone={tone} />;

  return (
    <View style={styles.row}>
      {groups.map((group) => (
        <View key={group.key} accessible accessibilityLabel={group.description} style={styles.column}>
          <View style={[styles.plot, { height }]}>
            {bar(group.income, color.accent)}
            {bar(group.expense, color.textSecondary)}
          </View>
          <View style={[styles.baseline, { backgroundColor: color.outline }]} />
          <Text variant="micro" tone="secondary" numberOfLines={1} style={styles.label}>
            {group.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "flex-end" },
  column: { flex: 1, alignItems: "center", gap: 4 },
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  baseline: { alignSelf: "stretch", height: StyleSheet.hairlineWidth * 2 },
  label: { textAlign: "center" },
});
