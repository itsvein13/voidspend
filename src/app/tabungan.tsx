import { useState } from "react";
import {
  Modal,
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

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

const CATEGORIES = [
  "🎯 Emergency Fund",
  "✈️ Vacation",
  "🏠 House",
  "📱 Gadget",
  "🎓 Education",
  "💼 Investment",
  "📦 Others",
];

export default function SavingsScreen() {
  const {
    filteredSavings: savings,
    addSaving,
    deleteSaving,
    editSaving,
    totalSaving,
  } = useFinance();
  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [editVisible, setEditVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editCategory, setEditCategory] = useState(CATEGORIES[0]);

  function handleAdd() {
    if (!name.trim() || !amount) return;
    addSaving(
      name.trim(),
      parseFloat(amount),
      category,
      target ? parseFloat(target) : undefined,
    );
    setName("");
    setAmount("");
    setTarget("");
    setCategory(CATEGORIES[0]);
  }

  function openEdit(
    id: number,
    name: string,
    amount: number,
    category: string,
    target?: number,
  ) {
    setEditId(id);
    setEditName(name);
    setEditAmount(String(amount));
    setEditTarget(target ? String(target) : "");
    setEditCategory(category);
    setEditVisible(true);
  }

  function handleEdit() {
    if (!editName.trim() || !editAmount || editId === null) return;
    editSaving(
      editId,
      editName.trim(),
      parseFloat(editAmount),
      editCategory,
      editTarget ? parseFloat(editTarget) : undefined,
    );
    setEditVisible(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>SAVINGS</Text>
        <Text style={[styles.total, { color: colors.saving }]}>
          {fmt(totalSaving)}
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
                  borderColor: colors.saving,
                  backgroundColor: "rgba(59,130,246,0.1)",
                },
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.catText,
                  { color: colors.muted },
                  category === cat && {
                    color: colors.saving,
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
          placeholder="e.g. emergency fund, vacation..."
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
          onChangeText={setAmount}
        />

        <Text style={[styles.label, { color: colors.muted }]}>
          TARGET (OPTIONAL)
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
          placeholder="0"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          value={target}
          onChangeText={setTarget}
        />

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.saving }]}
          onPress={handleAdd}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>+ SAVE</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.listLabel, { color: colors.muted }]}>
        LIST — {savings.length} ITEMS
      </Text>
      {savings.length === 0 && (
        <Text style={[styles.empty, { color: colors.muted }]}>
          // no savings yet
        </Text>
      )}
      {[...savings].reverse().map((item) => {
        const pct = item.target
          ? Math.min((item.amount / item.target) * 100, 100)
          : null;
        return (
          <View
            key={item.id}
            style={[
              styles.item,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.itemTop}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemCategory, { color: colors.muted }]}>
                  {item.category}
                </Text>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.itemAmount, { color: colors.saving }]}>
                  {fmt(item.amount)}
                </Text>
                {item.target && (
                  <Text style={[styles.itemTarget, { color: colors.muted }]}>
                    target: {fmt(item.target)}
                  </Text>
                )}
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={[styles.editBtn, { borderColor: colors.accent }]}
                  onPress={() =>
                    openEdit(
                      item.id,
                      item.name,
                      item.amount,
                      item.category,
                      item.target,
                    )
                  }
                >
                  <Text style={[styles.editText, { color: colors.accent }]}>
                    EDIT
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.delBtn, { borderColor: colors.border }]}
                  onPress={() => deleteSaving(item.id)}
                >
                  <Text style={[styles.delText, { color: colors.muted }]}>
                    DELETE
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {pct !== null && (
              <View style={styles.progressWrap}>
                <View
                  style={[
                    styles.progressBg,
                    { backgroundColor: colors.surface2 },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor:
                          pct >= 100 ? colors.accent : colors.saving,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: colors.muted }]}>
                  {pct.toFixed(1)}% achieved
                </Text>
              </View>
            )}
          </View>
        );
      })}

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              EDIT SAVINGS
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
                      borderColor: colors.saving,
                      backgroundColor: "rgba(59,130,246,0.1)",
                    },
                  ]}
                  onPress={() => setEditCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catText,
                      { color: colors.muted },
                      editCategory === cat && {
                        color: colors.saving,
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
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.label, { color: colors.muted }]}>
              TARGET (OPTIONAL)
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
              value={editTarget}
              onChangeText={setEditTarget}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
              placeholder="0"
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
                style={[styles.saveBtn, { backgroundColor: colors.saving }]}
                onPress={handleEdit}
              >
                <Text style={[styles.saveText, { color: "#fff" }]}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 8,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  itemInfo: { flex: 1 },
  itemCategory: { fontFamily: font.regular, fontSize: 11, marginBottom: 2 },
  itemName: { fontFamily: font.bold, fontSize: 14 },
  itemAmount: { fontFamily: font.regular, fontSize: 12, marginTop: 3 },
  itemTarget: { fontFamily: font.regular, fontSize: 11, marginTop: 2 },
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
  progressWrap: { marginTop: 12 },
  progressBg: { height: 3, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 4,
    textAlign: "right",
  },
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
