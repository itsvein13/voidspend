import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { font, radius } from "../constants/theme";
import { useFinance } from "../context/FinanceContext";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { formatNumberInput, parseFormattedNumber } from "../utils/format";

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
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

const EXPENSE_CATEGORIES = [
  "🍔 Food",
  "🚗 Transport",
  "🎮 Entertainment",
  "🏥 Health",
  "👗 Shopping",
  "📱 Bills",
  "📦 Others",
];

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
    budgets,
    setBudget,
    deleteBudget,
    expenseByCategory,
  } = useFinance();
  const { colors } = useTheme();
  const { username } = useUser();
  const insets = useSafeAreaInsets();

  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  function prevMonth() {
    if (selectedMonth === 0) setSelectedMonth(11, selectedYear - 1);
    else setSelectedMonth(selectedMonth - 1, selectedYear);
  }

  function nextMonth() {
    if (selectedMonth === 11) setSelectedMonth(0, selectedYear + 1);
    else setSelectedMonth(selectedMonth + 1, selectedYear);
  }

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

  function openAddBudget() {
    setEditingCategory(null);
    setBudgetCategory(EXPENSE_CATEGORIES[0]);
    setBudgetAmount("");
    setBudgetModal(true);
  }

  function openEditBudget(category: string) {
    setEditingCategory(category);
    setBudgetCategory(category);
    setBudgetAmount(formatNumberInput(String(budgets[category])));
    setBudgetModal(true);
  }

  function handleSaveBudget() {
    if (!budgetAmount) return;
    setBudget(budgetCategory, parseFormattedNumber(budgetAmount));
    setBudgetModal(false);
  }

  function handleDeleteBudget() {
    if (editingCategory) deleteBudget(editingCategory);
    setBudgetModal(false);
  }

  async function handleShare() {
    const monthLabel = `${MONTHS_FULL[selectedMonth]} ${selectedYear}`;
    const usedPct =
      salary > 0
        ? (((totalExpense + totalSaving) / salary) * 100).toFixed(1)
        : "0";

    let message = `📊 VOIDSPEND — ${monthLabel}\n`;
    message += `${username ? `${username}'s ` : ""}Monthly Summary\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💰 Income: ${fmt(salary)}\n`;
    message += `💸 Expense: ${fmt(totalExpense)}\n`;
    message += `🏦 Savings: ${fmt(totalSaving)}\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `${remaining >= 0 ? "✅" : "⚠️"} Remaining: ${fmt(remaining)}\n`;
    message += `📈 ${usedPct}% of salary used\n`;

    if (expenseData.length > 0) {
      message += `\n📦 Expense Breakdown:\n`;
      [...expenseData]
        .sort((a, b) => b.amount - a.amount)
        .forEach((item) => {
          message += `  ${item.category}: ${fmt(item.amount)}\n`;
        });
    }

    if (savingData.length > 0) {
      message += `\n🎯 Savings Breakdown:\n`;
      [...savingData]
        .sort((a, b) => b.amount - a.amount)
        .forEach((item) => {
          message += `  ${item.category}: ${fmt(item.amount)}\n`;
        });
    }

    message += `\n— tracked with VOIDSPEND 🖤`;

    try {
      await Share.share({ message });
    } catch (err) {
      // user cancelled or share failed silently
    }
  }

  const budgetEntries = Object.entries(budgets);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 80 + insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>REPORT</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Your financial analytics
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.shareBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={handleShare}
        >
          <Ionicons
            name="share-social-outline"
            size={20}
            color={colors.accent}
          />
        </TouchableOpacity>
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
        <View style={styles.budgetHeader}>
          <Text
            style={[styles.chartTitle, { color: colors.text, marginBottom: 0 }]}
          >
            Budget Tracker
          </Text>
          <TouchableOpacity
            style={[styles.addBudgetBtn, { borderColor: colors.accent }]}
            onPress={openAddBudget}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={[styles.addBudgetText, { color: colors.accent }]}>
              SET BUDGET
            </Text>
          </TouchableOpacity>
        </View>

        {budgetEntries.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No budget set yet
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16, marginTop: 12 }}>
            {budgetEntries.map(([category, limit]) => {
              const spent = expenseByCategory[category] || 0;
              const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
              const isOver = spent > limit;
              const isNear = !isOver && pct >= 80;
              const barColor = isOver
                ? colors.danger
                : isNear
                  ? "#ffd93d"
                  : colors.accent;

              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => openEditBudget(category)}
                >
                  <View style={styles.budgetRow}>
                    <Text
                      style={[styles.budgetCategory, { color: colors.text }]}
                    >
                      {category}
                    </Text>
                    <Text
                      style={[
                        styles.budgetAmount,
                        { color: isOver ? colors.danger : colors.muted },
                      ]}
                    >
                      {fmt(spent)} / {fmt(limit)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressBg,
                      { backgroundColor: colors.surface2, marginTop: 6 },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                  {isOver && (
                    <Text style={[styles.overText, { color: colors.danger }]}>
                      ⚠ Over budget by {fmt(spent - limit)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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

      <Modal
        visible={budgetModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingCategory ? "EDIT BUDGET" : "SET BUDGET"}
              </Text>

              <Text style={[styles.modalLabel, { color: colors.muted }]}>
                CATEGORY
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catScroll}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    disabled={!!editingCategory}
                    style={[
                      styles.catBtn,
                      { borderColor: colors.border },
                      budgetCategory === cat && {
                        borderColor: colors.accent,
                        backgroundColor: "rgba(200,245,66,0.1)",
                      },
                    ]}
                    onPress={() => setBudgetCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.catText,
                        {
                          color:
                            budgetCategory === cat
                              ? colors.accent
                              : colors.muted,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.modalLabel, { color: colors.muted }]}>
                MONTHLY LIMIT
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                    color: colors.text,
                  },
                ]}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={budgetAmount}
                onChangeText={(text) =>
                  setBudgetAmount(formatNumberInput(text))
                }
              />

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveBudget}
              >
                <Text style={[styles.modalBtnText, { color: "#000" }]}>
                  SAVE BUDGET
                </Text>
              </TouchableOpacity>

              {editingCategory && (
                <TouchableOpacity
                  style={[
                    styles.deleteBudgetBtn,
                    { borderColor: colors.danger },
                  ]}
                  onPress={handleDeleteBudget}
                >
                  <Text
                    style={[styles.deleteBudgetText, { color: colors.danger }]}
                  >
                    DELETE BUDGET
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelWrap}
                onPress={() => setBudgetModal(false)}
              >
                <Text
                  style={[styles.cancelBudgetText, { color: colors.muted }]}
                >
                  CANCEL
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 20,
    marginBottom: 20,
  },
  title: { fontFamily: font.black, fontSize: 28, letterSpacing: 4 },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 4,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addBudgetBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  addBudgetText: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1 },
  budgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetCategory: { fontFamily: font.bold, fontSize: 13 },
  budgetAmount: { fontFamily: font.regular, fontSize: 12 },
  overText: { fontFamily: font.regular, fontSize: 10, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 24,
    width: "100%",
  },
  modalTitle: {
    fontFamily: font.black,
    fontSize: 16,
    letterSpacing: 3,
    marginBottom: 20,
  },
  modalLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 8,
  },
  catScroll: { marginBottom: 16 },
  catBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  catText: { fontFamily: font.regular, fontSize: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    fontFamily: font.regular,
    fontSize: 15,
    padding: 12,
    marginBottom: 16,
  },
  modalBtn: {
    borderRadius: radius.sm,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  modalBtnText: { fontFamily: font.black, fontSize: 13, letterSpacing: 2 },
  deleteBudgetBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  deleteBudgetText: { fontFamily: font.bold, fontSize: 12, letterSpacing: 2 },
  cancelWrap: { alignItems: "center", marginTop: 16 },
  cancelBudgetText: { fontFamily: font.bold, fontSize: 11, letterSpacing: 2 },
});
