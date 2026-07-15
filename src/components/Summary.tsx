import { StyleSheet, Text, View } from "react-native";
import { font, radius } from "../constants/theme";
import { useFinance } from "../context/FinanceContext";
import { useTheme } from "../context/ThemeContext";

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function Summary() {
  const { salary, totalExpense, totalSaving, remaining } = useFinance();
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>
        RINGKASAN
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Row
          label="GAJI"
          value={fmt(salary)}
          valueColor={colors.text}
          colors={colors}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row
          label="PENGELUARAN"
          value={fmt(totalExpense)}
          valueColor={colors.danger}
          colors={colors}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row
          label="TABUNGAN"
          value={fmt(totalSaving)}
          valueColor={colors.saving}
          colors={colors}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.remainingRow}>
          <Text style={[styles.remainingLabel, { color: colors.text }]}>
            SISA
          </Text>
          <Text
            style={[
              styles.remainingValue,
              { color: remaining >= 0 ? colors.accent : colors.danger },
            ]}
          >
            {fmt(remaining)}
          </Text>
        </View>
      </View>

      {salary > 0 && (
        <View style={styles.progressWrap}>
          <View
            style={[styles.progressBg, { backgroundColor: colors.surface2 }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(((totalExpense + totalSaving) / salary) * 100, 100)}%`,
                  backgroundColor:
                    (totalExpense + totalSaving) / salary >= 0.9
                      ? colors.danger
                      : colors.accent,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: colors.muted }]}>
            {(((totalExpense + totalSaving) / salary) * 100).toFixed(1)}%
            terpakai
          </Text>
        </View>
      )}
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
  colors,
}: {
  label: string;
  value: string;
  valueColor: string;
  colors: any;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 10,
  },
  card: { borderWidth: 1, borderRadius: radius.sm, padding: 20 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 2 },
  rowValue: { fontFamily: font.black, fontSize: 16 },
  divider: { height: 1 },
  remainingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    marginTop: 6,
  },
  remainingLabel: { fontFamily: font.black, fontSize: 12, letterSpacing: 2 },
  remainingValue: { fontFamily: font.black, fontSize: 24 },
  progressWrap: { marginTop: 14 },
  progressBg: { height: 3, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 6,
    textAlign: "right",
  },
});
