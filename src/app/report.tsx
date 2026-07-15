import { Ionicons } from "@expo/vector-icons";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { font, radius } from "../constants/theme";
import { useFinance } from "../context/FinanceContext";
import { useTheme } from "../context/ThemeContext";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

const CATEGORY_COLORS: Record<string, string> = {
  "🍔 Food": "#ff6b6b",
  "🚗 Transport": "#ffd93d",
  "🎮 Entertainment": "#6bcb77",
  "🏥 Health": "#4d96ff",
  "👗 Shopping": "#ff922b",
  "📱 Bills": "#cc5de8",
  "📦 Others": "#868e96",
  "🎯 Emergency Fund": "#4d96ff",
  "✈️ Vacation": "#ffd93d",
  "🏠 House": "#ff6b6b",
  "📱 Gadget": "#cc5de8",
  "🎓 Education": "#6bcb77",
  "💼 Investment": "#c8f542",
  // fallback for old data
  "🍔 Makan": "#ff6b6b",
  "🎮 Hiburan": "#6bcb77",
  "🏥 Kesehatan": "#4d96ff",
  "👗 Belanja": "#ff922b",
  "📱 Tagihan": "#cc5de8",
  "📦 Lainnya": "#868e96",
  "🎯 Dana Darurat": "#4d96ff",
  "✈️ Liburan": "#ffd93d",
  "🏠 Rumah": "#ff6b6b",
  "🎓 Pendidikan": "#6bcb77",
  "💼 Investasi": "#c8f542",
};

function PieChart({
  data,
  total,
}: {
  data: { category: string; amount: number }[];
  total: number;
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const innerR = 45;

  if (total === 0)
    return (
      <View
        style={{ alignItems: "center", justifyContent: "center", height: size }}
      >
        <Text style={{ fontSize: 40 }}>🫙</Text>
      </View>
    );

  let startAngle = -Math.PI / 2;
  const slices = data.map((item) => {
    const angle = (item.amount / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(startAngle);
    const yi1 = cy + innerR * Math.sin(startAngle);
    const xi2 = cx + innerR * Math.cos(endAngle);
    const yi2 = cy + innerR * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M${xi1},${yi1} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${xi2},${yi2} A${innerR},${innerR} 0 ${largeArc} 0 ${xi1},${yi1}`;
    const result = {
      d,
      color: CATEGORY_COLORS[item.category] || "#868e96",
      ...item,
    };
    startAngle = endAngle;
    return result;
  });

  return (
    <Svg width={size} height={size}>
      {slices.map((slice, i) => (
        <Path key={i} d={slice.d} fill={slice.color} />
      ))}
    </Svg>
  );
}

export default function ReportScreen() {
  const {
    filteredExpenses,
    filteredSavings,
    totalExpense,
    totalSaving,
    salary,
    remaining,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
  } = useFinance();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  function prevMonth() {
    if (selectedMonth === 0) setSelectedMonth(11, selectedYear - 1);
    else setSelectedMonth(selectedMonth - 1, selectedYear);
  }

  function nextMonth() {
    if (selectedMonth === 11) setSelectedMonth(0, selectedYear + 1);
    else setSelectedMonth(selectedMonth + 1, selectedYear);
  }

  const expenseByCategory = filteredExpenses.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  const savingByCategory = filteredSavings.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  const expenseData = Object.entries(expenseByCategory).map(
    ([category, amount]) => ({ category, amount }),
  );
  const savingData = Object.entries(savingByCategory).map(
    ([category, amount]) => ({ category, amount }),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 80 + insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>REPORT</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Your financial analytics
        </Text>
      </View>

      <View
        style={[
          styles.monthNav,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={prevMonth}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {MONTHS[selectedMonth]} {selectedYear}
        </Text>
        <TouchableOpacity onPress={nextMonth}>
          <Ionicons name="chevron-forward" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>
            Income
          </Text>
          <Text style={[styles.summaryAmount, { color: colors.accent }]}>
            {fmt(salary)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>
            Expense
          </Text>
          <Text style={[styles.summaryAmount, { color: colors.danger }]}>
            {fmt(totalExpense)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>
            Savings
          </Text>
          <Text style={[styles.summaryAmount, { color: colors.saving }]}>
            {fmt(totalSaving)}
          </Text>
        </View>
      </View>

      <View style={[styles.remainingCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.remainingLabel, { color: colors.muted }]}>
          Remaining This Month
        </Text>
        <Text
          style={[
            styles.remainingAmount,
            { color: remaining >= 0 ? colors.accent : colors.danger },
          ]}
        >
          {fmt(remaining)}
        </Text>
        {salary > 0 && (
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
        )}
        <Text style={[styles.progressLabel, { color: colors.muted }]}>
          {salary > 0
            ? (((totalExpense + totalSaving) / salary) * 100).toFixed(1)
            : 0}
          % used from salary
        </Text>
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>
          Expense by Category
        </Text>
        {expenseData.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyIcon}>🫙</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No expenses yet
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.chartWrap}>
              <PieChart data={expenseData} total={totalExpense} />
            </View>
            <View style={styles.legend}>
              {expenseData.map((item) => (
                <View key={item.category} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor:
                          CATEGORY_COLORS[item.category] || "#868e96",
                      },
                    ]}
                  />
                  <Text style={[styles.legendLabel, { color: colors.muted }]}>
                    {item.category}
                  </Text>
                  <Text style={[styles.legendAmount, { color: colors.text }]}>
                    {fmt(item.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>
          Savings by Category
        </Text>
        {savingData.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyIcon}>🫙</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No savings yet
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.chartWrap}>
              <PieChart data={savingData} total={totalSaving} />
            </View>
            <View style={styles.legend}>
              {savingData.map((item) => (
                <View key={item.category} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor:
                          CATEGORY_COLORS[item.category] || "#868e96",
                      },
                    ]}
                  />
                  <Text style={[styles.legendLabel, { color: colors.muted }]}>
                    {item.category}
                  </Text>
                  <Text style={[styles.legendAmount, { color: colors.text }]}>
                    {fmt(item.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  header: { marginTop: 20, marginBottom: 20 },
  title: { fontFamily: font.black, fontSize: 28, letterSpacing: 4 },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 4,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 16,
  },
  monthLabel: { fontFamily: font.black, fontSize: 13, letterSpacing: 3 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: 12,
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryAmount: { fontFamily: font.black, fontSize: 13 },
  remainingCard: { borderRadius: radius.lg, padding: 20, marginBottom: 16 },
  remainingLabel: {
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  remainingAmount: { fontFamily: font.black, fontSize: 28, marginBottom: 16 },
  progressBg: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", borderRadius: 999 },
  progressLabel: { fontFamily: font.regular, fontSize: 11, letterSpacing: 1 },
  chartCard: { borderRadius: radius.lg, padding: 20, marginBottom: 16 },
  chartTitle: { fontFamily: font.black, fontSize: 16, marginBottom: 16 },
  chartWrap: { alignItems: "center", marginBottom: 16 },
  emptyChart: { alignItems: "center", padding: 20 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontFamily: font.regular, fontSize: 13 },
  legend: { gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontFamily: font.regular, fontSize: 13 },
  legendAmount: { fontFamily: font.bold, fontSize: 13 },
});
