import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { font, radius } from "../constants/theme";
import { useFinance } from "../context/FinanceContext";
import { useTheme } from "../context/ThemeContext";
import { formatNumberInput, parseFormattedNumber } from "../utils/format";

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

const CATEGORIES = [
  "🍔 Food",
  "🚗 Transport",
  "🎮 Entertainment",
  "🏥 Health",
  "👗 Shopping",
  "📱 Bills",
  "📦 Others",
];

export default function ExpenseScreen() {
  const {
    filteredExpenses: expenses,
    addExpense,
    deleteExpense,
    editExpense,
    totalExpense,
  } = useFinance();
  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [editVisible, setEditVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(CATEGORIES[0]);

  function handleAdd() {
    if (!name.trim() || !amount) return;
    addExpense(name.trim(), parseFormattedNumber(amount), category);
    setName("");
    setAmount("");
    setCategory(CATEGORIES[0]);
  }

  function openEdit(
    id: number,
    name: string,
    amount: number,
    category: string,
  ) {
    setEditId(id);
    setEditName(name);
    setEditAmount(formatNumberInput(String(amount)));
    setEditCategory(category);
    setEditVisible(true);
  }

  function handleEdit() {
    if (!editName.trim() || !editAmount || editId === null) return;
    editExpense(
      editId,
      editName.trim(),
      parseFormattedNumber(editAmount),
      editCategory,
    );
    setEditVisible(false);
  }

  function handleDelete(id: number, name: string) {
    Alert.alert("Delete Expense", `Delete "${name}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteExpense(id),
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>EXPENSE</Text>
        <Text style={[styles.total, { color: colors.danger }]}>
          {fmt(totalExpense)}
        </Text>
      </View>

      <View
        style={[
          styles.form,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.label, { color: colors.muted }]}>CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catBtn,
                { borderColor: colors.border },
                category === cat && {
                  borderColor: colors.danger,
                  backgroundColor: "rgba(255,59,59,0.1)",
                },
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.catText,
                  { color: colors.muted },
                  category === cat && {
                    color: colors.danger,
                    fontFamily: font.bold,
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: colors.muted }]}>NAME</Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              color: colors.text,
            },
          ]}
          placeholder="e.g. lunch, grab..."
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: colors.muted }]}>AMOUNT</Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              color: colors.text,
            },
          ]}
          placeholder="0"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatNumberInput(text))}
        />

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.danger }]}
          onPress={handleAdd}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>+ ADD</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.listLabel, { color: colors.muted }]}>
        LIST — {expenses.length} ITEMS
      </Text>
      {expenses.length === 0 && (
        <Text style={[styles.empty, { color: colors.muted }]}>
          // no expenses yet
        </Text>
      )}
      {[...expenses].reverse().map((item) => (
        <View
          key={item.id}
          style={[
            styles.item,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.itemInfo}>
            <Text style={[styles.itemCategory, { color: colors.muted }]}>
              {item.category}
            </Text>
            <Text style={[styles.itemName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.itemAmount, { color: colors.danger }]}>
              {fmt(item.amount)}
            </Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: colors.accent }]}
              onPress={() =>
                openEdit(item.id, item.name, item.amount, item.category)
              }
            >
              <Text style={[styles.editText, { color: colors.accent }]}>
                EDIT
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.delBtn, { borderColor: colors.border }]}
              onPress={() => handleDelete(item.id, item.name)}
            >
              <Text style={[styles.delText, { color: colors.muted }]}>
                DELETE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Modal visible={editVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                EDIT EXPENSE
              </Text>
              <Text style={[styles.label, { color: colors.muted }]}>
                CATEGORY
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catBtn,
                      { borderColor: colors.border },
                      editCategory === cat && {
                        borderColor: colors.danger,
                        backgroundColor: "rgba(255,59,59,0.1)",
                      },
                    ]}
                    onPress={() => setEditCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.catText,
                        { color: colors.muted },
                        editCategory === cat && {
                          color: colors.danger,
                          fontFamily: font.bold,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[styles.label, { color: colors.muted }]}>NAME</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                    color: colors.text,
                  },
                ]}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={colors.muted}
              />
              <Text style={[styles.label, { color: colors.muted }]}>
                AMOUNT
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                    color: colors.text,
                  },
                ]}
                value={editAmount}
                onChangeText={(text) => setEditAmount(formatNumberInput(text))}
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => setEditVisible(false)}
                >
                  <Text style={[styles.cancelText, { color: colors.muted }]}>
                    CANCEL
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.danger }]}
                  onPress={handleEdit}
                >
                  <Text style={[styles.saveText, { color: "#fff" }]}>SAVE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 60 },
  header: { marginTop: 20, marginBottom: 28 },
  title: { fontFamily: font.black, fontSize: 28, letterSpacing: 4 },
  total: { fontFamily: font.black, fontSize: 20, marginTop: 4 },
  form: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 16,
    marginBottom: 28,
  },
  label: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 8,
  },
  categoryScroll: { marginBottom: 16 },
  catBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  catText: { fontFamily: font.regular, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    fontFamily: font.regular,
    fontSize: 14,
    padding: 12,
    marginBottom: 16,
  },
  btn: {
    borderRadius: radius.sm,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { fontFamily: font.black, fontSize: 12, letterSpacing: 3 },
  listLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 12,
  },
  empty: {
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: "center",
    marginTop: 40,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 8,
  },
  itemInfo: { flex: 1 },
  itemCategory: { fontFamily: font.regular, fontSize: 11, marginBottom: 2 },
  itemName: { fontFamily: font.bold, fontSize: 14 },
  itemAmount: { fontFamily: font.regular, fontSize: 12, marginTop: 3 },
  itemActions: { flexDirection: "row", gap: 8 },
  editBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  editText: { fontFamily: font.bold, fontSize: 10, letterSpacing: 2 },
  delBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  delText: { fontFamily: font.bold, fontSize: 10, letterSpacing: 2 },
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
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    alignItems: "center",
  },
  cancelText: { fontFamily: font.bold, fontSize: 11, letterSpacing: 2 },
  saveBtn: {
    flex: 1,
    borderRadius: radius.sm,
    padding: 12,
    alignItems: "center",
  },
  saveText: { fontFamily: font.bold, fontSize: 11, letterSpacing: 2 },
});
