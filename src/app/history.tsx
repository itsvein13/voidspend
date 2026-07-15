import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
type FilterType = "all" | "expense" | "savings";

export default function HistoryScreen() {
  const {
    filteredExpenses,
    filteredSavings,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
  } = useFinance();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>("all");

  function prevMonth() {
    if (selectedMonth === 0) setSelectedMonth(11, selectedYear - 1);
    else setSelectedMonth(selectedMonth - 1, selectedYear);
  }

  function nextMonth() {
    if (selectedMonth === 11) setSelectedMonth(0, selectedYear + 1);
    else setSelectedMonth(selectedMonth + 1, selectedYear);
  }

  const allItems = [
    ...filteredExpenses.map((e) => ({ ...e, type: "expense" as const })),
    ...filteredSavings.map((s) => ({ ...s, type: "savings" as const })),
  ].sort((a, b) => b.id - a.id);

  const displayed =
    filter === "all"
      ? allItems
      : filter === "expense"
        ? allItems.filter((i) => i.type === "expense")
        : allItems.filter((i) => i.type === "savings");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 80 + insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>HISTORY</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          All your transactions
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

      <View style={[styles.filterWrap, { backgroundColor: colors.surface }]}>
        {(["all", "expense", "savings"] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              filter === f && { backgroundColor: colors.accent },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f ? "#000" : colors.muted },
              ]}
            >
              {f === "all" ? "All" : f === "expense" ? "Expense" : "Savings"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {displayed.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🫙</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            // no transactions this month
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {displayed.map((item) => (
            <View
              key={`${item.type}-${item.id}`}
              style={[
                styles.item,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor:
                      item.type === "expense"
                        ? "rgba(255,59,59,0.15)"
                        : "rgba(59,130,246,0.15)",
                  },
                ]}
              >
                <Ionicons
                  name={item.type === "expense" ? "arrow-up" : "wallet"}
                  size={18}
                  color={
                    item.type === "expense" ? colors.danger : colors.saving
                  }
                />
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.itemCat, { color: colors.muted }]}>
                  {item.category}
                </Text>
              </View>
              <Text
                style={[
                  styles.itemAmount,
                  {
                    color:
                      item.type === "expense" ? colors.danger : colors.saving,
                  },
                ]}
              >
                {item.type === "expense" ? "-" : "+"}
                {fmt(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
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
    marginBottom: 12,
  },
  monthLabel: { fontFamily: font.black, fontSize: 13, letterSpacing: 3 },
  filterWrap: {
    flexDirection: "row",
    borderRadius: radius.sm,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  filterText: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.5 },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontFamily: font.regular, fontSize: 13 },
  list: { gap: 10 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: font.bold, fontSize: 14 },
  itemCat: { fontFamily: font.regular, fontSize: 11, marginTop: 2 },
  itemAmount: { fontFamily: font.black, fontSize: 14 },
});
