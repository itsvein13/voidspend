import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
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
const SAVINGS_CATEGORIES = [
  "🎯 Emergency Fund",
  "✈️ Vacation",
  "🏠 House",
  "📱 Gadget",
  "🎓 Education",
  "💼 Investment",
  "📦 Others",
];

function getMascot(remaining: number, salary: number) {
  if (salary === 0) return require("../assets/mascot/what2.png");
  const pct = remaining / salary;
  if (pct > 0.7) return require("../assets/mascot/happy2.png");
  if (pct > 0.4) return require("../assets/mascot/calm2.png");
  if (pct > 0.1) return require("../assets/mascot/confused2.png");
  return require("../assets/mascot/eepy2.png");
}

function getGreetingMessage(remaining: number, salary: number): string {
  if (salary === 0) return "Let's track your expenses\nand build your future.";
  const pct = remaining / salary;
  if (pct >= 0.7)
    return "You're doing great!\nKeep saving and spending wisely.";
  if (pct >= 0.5)
    return "Halfway through the month,\nyour budget still looks solid.";
  if (pct >= 0.3) return "Getting tighter,\nstay mindful with your spending.";
  if (pct >= 0.1) return "Careful now,\nyour balance is running low.";
  return "Whoa, you're almost out!\nTime to slow down on spending.";
}

function MiniChart({ expenses, savings }: { expenses: any[]; savings: any[] }) {
  const width = 240;
  const height = 80;
  const points = "0,60 40,50 80,45 120,30 160,35 200,20 240,10";
  const allItems = [...expenses, ...savings];

  if (allItems.length === 0) {
    return (
      <Svg height={height} width={width} style={styles.chartBg}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#c8f542" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#c8f542" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={`M${points} L240,80 L0,80 Z`} fill="url(#grad)" />
        <Path
          d={`M${points}`}
          fill="none"
          stroke="#c8f542"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  const sorted = [...allItems].sort((a, b) => a.id - b.id);
  const maxVal = sorted.reduce((acc, item) => acc + item.amount, 0) || 1;
  let cumulative = 0;
  const chartPoints = sorted.map((item, i) => {
    cumulative += item.amount;
    const x = Math.min((i / Math.max(sorted.length - 1, 1)) * width, width);
    const y = Math.max(height - (cumulative / maxVal) * (height - 10), 5);
    return `${x},${y}`;
  });

  const allPoints = `0,${height} ${chartPoints.join(" ")} ${width},${height}`;
  const linePoints = chartPoints.join(" ");

  return (
    <Svg height={height} width={width} style={styles.chartBg}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#c8f542" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#c8f542" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={`M${allPoints} Z`} fill="url(#grad)" />
      <Path
        d={`M${linePoints}`}
        fill="none"
        stroke="#c8f542"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const {
    salary,
    totalExpense,
    totalSaving,
    remaining,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    addExpense,
    addSaving,
    setSalary,
    filteredExpenses,
    filteredSavings,
  } = useFinance();
  const { colors, theme, toggleTheme } = useTheme();
  const { username } = useUser();
  const insets = useSafeAreaInsets();
  const mascot = getMascot(remaining, salary);
  const greetingMessage = getGreetingMessage(remaining, salary);

  const [expenseModal, setExpenseModal] = useState(false);
  const [savingsModal, setSavingsModal] = useState(false);
  const [incomeModal, setIncomeModal] = useState(false);
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [savName, setSavName] = useState("");
  const [savAmount, setSavAmount] = useState("");
  const [savCategory, setSavCategory] = useState(SAVINGS_CATEGORIES[0]);
  const [savTarget, setSavTarget] = useState("");
  const [incomeInput, setIncomeInput] = useState(
    salary > 0 ? formatNumberInput(String(salary)) : "",
  );

  function handleAddExpense() {
    if (!expName.trim() || !expAmount) return;
    addExpense(expName.trim(), parseFormattedNumber(expAmount), expCategory);
    setExpName("");
    setExpAmount("");
    setExpCategory(EXPENSE_CATEGORIES[0]);
    setExpenseModal(false);
  }

  function handleAddSavings() {
    if (!savName.trim() || !savAmount) return;
    addSaving(
      savName.trim(),
      parseFormattedNumber(savAmount),
      savCategory,
      savTarget ? parseFormattedNumber(savTarget) : undefined,
    );
    setSavName("");
    setSavAmount("");
    setSavCategory(SAVINGS_CATEGORIES[0]);
    setSavTarget("");
    setSavingsModal(false);
  }

  function prevMonth() {
    if (selectedMonth === 0) setSelectedMonth(11, selectedYear - 1);
    else setSelectedMonth(selectedMonth - 1, selectedYear);
  }

  function nextMonth() {
    if (selectedMonth === 11) setSelectedMonth(0, selectedYear + 1);
    else setSelectedMonth(selectedMonth + 1, selectedYear);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 80 + insets.bottom },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, { color: colors.muted }]}>
            Track your flow.
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[
            styles.settingsBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name={theme === "dark" ? "sunny-outline" : "moon-outline"}
            size={20}
            color={colors.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Greeting Card */}
      <View style={[styles.greetingCard, { backgroundColor: colors.surface }]}>
        <View style={styles.greetingLeft}>
          <Text style={[styles.greetingHello, { color: colors.text }]}>
            Hello, {username || "User"}!
          </Text>
          <Text style={[styles.greetingDesc, { color: colors.muted }]}>
            {greetingMessage}
          </Text>
        </View>
        <Image source={mascot} style={styles.mascotImg} resizeMode="contain" />
      </View>

      {/* Month Navigator */}
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

      {/* Total Balance Card */}
      <View style={[styles.balanceCard, { backgroundColor: colors.surface }]}>
        <View style={styles.balanceTop}>
          <Text style={[styles.balanceLabel, { color: colors.muted }]}>
            Total Balance
          </Text>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.muted}
          />
        </View>
        <Text style={[styles.balanceAmount, { color: colors.text }]}>
          {fmt(remaining)}
        </Text>
        <View style={styles.balanceBadge}>
          <Ionicons name="arrow-up" size={10} color="#000" />
          <Text style={styles.balanceBadgeText}>
            {salary > 0 ? ((remaining / salary) * 100).toFixed(0) : 0}% vs last
            month
          </Text>
        </View>
        <MiniChart expenses={filteredExpenses} savings={filteredSavings} />
      </View>

      {/* Stats Cards */}
      <View style={styles.statsWrap}>
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: colors.surface }]}
          onPress={() => setIncomeModal(true)}
        >
          <View
            style={[
              styles.statIconBox,
              { backgroundColor: "rgba(200,245,66,0.15)" },
            ]}
          >
            <Ionicons name="arrow-down" size={18} color={colors.accent} />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statTitle, { color: colors.text }]}>
              Income
            </Text>
            <Text style={[styles.statSub, { color: colors.muted }]}>
              Total income
            </Text>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statAmount, { color: colors.text }]}>
              {fmt(salary)}
            </Text>
            <Text style={[styles.statVs, { color: colors.accent }]}>
              +0% vs last month
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: colors.surface }]}
          onPress={() => setExpenseModal(true)}
        >
          <View
            style={[
              styles.statIconBox,
              { backgroundColor: "rgba(255,59,59,0.15)" },
            ]}
          >
            <Ionicons name="arrow-up" size={18} color={colors.danger} />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statTitle, { color: colors.text }]}>
              Expense
            </Text>
            <Text style={[styles.statSub, { color: colors.muted }]}>
              Total expense
            </Text>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statAmount, { color: colors.text }]}>
              {fmt(totalExpense)}
            </Text>
            <Text style={[styles.statVs, { color: colors.danger }]}>
              +0% vs last month
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: colors.surface }]}
          onPress={() => setSavingsModal(true)}
        >
          <View
            style={[
              styles.statIconBox,
              { backgroundColor: "rgba(59,130,246,0.15)" },
            ]}
          >
            <Ionicons name="wallet" size={18} color={colors.saving} />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statTitle, { color: colors.text }]}>
              Savings
            </Text>
            <Text style={[styles.statSub, { color: colors.muted }]}>
              Total savings
            </Text>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statAmount, { color: colors.text }]}>
              {fmt(totalSaving)}
            </Text>
            <Text style={[styles.statVs, { color: colors.saving }]}>
              +0% vs last month
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        Quick Actions
      </Text>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[
            styles.quickBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => setExpenseModal(true)}
        >
          <View style={[styles.quickIconBox, { borderColor: colors.border }]}>
            <Ionicons name="add" size={20} color={colors.text} />
          </View>
          <Text style={[styles.quickLabel, { color: colors.text }]}>
            Add Expense
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.quickBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => setIncomeModal(true)}
        >
          <View style={[styles.quickIconBox, { borderColor: colors.border }]}>
            <Ionicons name="arrow-down-outline" size={20} color={colors.text} />
          </View>
          <Text style={[styles.quickLabel, { color: colors.text }]}>
            Add Income
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.quickBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => setSavingsModal(true)}
        >
          <View style={[styles.quickIconBox, { borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={20} color={colors.text} />
          </View>
          <Text style={[styles.quickLabel, { color: colors.text }]}>
            Add Savings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal Add Expense */}
      <Modal visible={expenseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add Expense
              </Text>
              <TouchableOpacity onPress={() => setExpenseModal(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
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
                  style={[
                    styles.catBtn,
                    { borderColor: colors.border },
                    expCategory === cat && {
                      borderColor: colors.danger,
                      backgroundColor: "rgba(255,59,59,0.1)",
                    },
                  ]}
                  onPress={() => setExpCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catText,
                      {
                        color:
                          expCategory === cat ? colors.danger : colors.muted,
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.modalLabel, { color: colors.muted }]}>
              NAME
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
              placeholder="e.g. Lunch, Grab..."
              placeholderTextColor={colors.muted}
              value={expName}
              onChangeText={setExpName}
            />
            <Text style={[styles.modalLabel, { color: colors.muted }]}>
              AMOUNT
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
              value={expAmount}
              onChangeText={(text) => setExpAmount(formatNumberInput(text))}
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.danger }]}
              onPress={handleAddExpense}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                + ADD EXPENSE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Add Savings */}
      <Modal visible={savingsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add Savings
              </Text>
              <TouchableOpacity onPress={() => setSavingsModal(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { color: colors.muted }]}>
              CATEGORY
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catScroll}
            >
              {SAVINGS_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catBtn,
                    { borderColor: colors.border },
                    savCategory === cat && {
                      borderColor: colors.saving,
                      backgroundColor: "rgba(59,130,246,0.1)",
                    },
                  ]}
                  onPress={() => setSavCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catText,
                      {
                        color:
                          savCategory === cat ? colors.saving : colors.muted,
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.modalLabel, { color: colors.muted }]}>
              NAME
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
              placeholder="e.g. Emergency fund, Vacation..."
              placeholderTextColor={colors.muted}
              value={savName}
              onChangeText={setSavName}
            />
            <Text style={[styles.modalLabel, { color: colors.muted }]}>
              AMOUNT
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
              value={savAmount}
              onChangeText={(text) => setSavAmount(formatNumberInput(text))}
            />
            <Text style={[styles.modalLabel, { color: colors.muted }]}>
              TARGET (OPTIONAL)
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
              value={savTarget}
              onChangeText={(text) => setSavTarget(formatNumberInput(text))}
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.saving }]}
              onPress={handleAddSavings}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                + ADD SAVINGS
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Add Income */}
      <Modal visible={incomeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Monthly Salary
              </Text>
              <TouchableOpacity onPress={() => setIncomeModal(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.muted }]}>
              Update your monthly salary. This is used to calculate your
              remaining balance.
            </Text>
            <Text style={[styles.modalLabel, { color: colors.muted }]}>
              SALARY (IDR)
            </Text>
            <View
              style={[
                styles.salaryInputWrap,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface2,
                },
              ]}
            >
              <Text style={[styles.salaryPrefix, { color: colors.accent }]}>
                IDR
              </Text>
              <TextInput
                style={[
                  styles.salaryInput,
                  { color: colors.text, borderLeftColor: colors.border },
                ]}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={incomeInput}
                onChangeText={(text) => setIncomeInput(formatNumberInput(text))}
              />
            </View>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                setSalary(parseFormattedNumber(incomeInput));
                setIncomeModal(false);
              }}
            >
              <Text style={[styles.modalBtnText, { color: "#000" }]}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  logo: { width: 160, height: 40 },
  tagline: {
    fontFamily: font.regular,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  greetingCard: {
    borderRadius: 20,
    paddingLeft: 20,
    paddingTop: 20,
    paddingBottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
    overflow: "hidden",
    minHeight: 140,
  },
  greetingLeft: { flex: 1, paddingRight: 10, paddingBottom: 20 },
  greetingHello: { fontFamily: font.black, fontSize: 22, marginBottom: 8 },
  greetingDesc: { fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  mascotImg: { width: 120, height: 120 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
  },
  monthLabel: { fontFamily: font.black, fontSize: 13, letterSpacing: 3 },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
    minHeight: 130,
  },
  balanceTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  balanceLabel: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1 },
  balanceAmount: { fontFamily: font.black, fontSize: 30, marginBottom: 10 },
  balanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#c8f542",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
    gap: 4,
  },
  balanceBadgeText: { fontFamily: font.bold, fontSize: 10, color: "#000" },
  chartBg: { position: "absolute", bottom: 0, right: 0 },
  statsWrap: { gap: 10, marginBottom: 24 },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statInfo: { flex: 1 },
  statTitle: { fontFamily: font.bold, fontSize: 14 },
  statSub: { fontFamily: font.regular, fontSize: 11, marginTop: 2 },
  statRight: { alignItems: "flex-end", gap: 2 },
  statAmount: { fontFamily: font.black, fontSize: 14 },
  statVs: { fontFamily: font.regular, fontSize: 10 },
  sectionLabel: { fontFamily: font.black, fontSize: 16, marginBottom: 12 },
  quickActions: { flexDirection: "row", gap: 10 },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  quickIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontFamily: font.black, fontSize: 20, letterSpacing: 1 },
  modalDesc: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 20,
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
  salaryInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.sm,
    marginBottom: 16,
    overflow: "hidden",
  },
  salaryPrefix: {
    fontFamily: font.black,
    fontSize: 12,
    paddingHorizontal: 14,
    letterSpacing: 1,
  },
  salaryInput: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 18,
    padding: 12,
    borderLeftWidth: 1,
  },
});
