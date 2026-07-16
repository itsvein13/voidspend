import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  Alert,
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
import { font, radius } from "../constants/theme";
import { useFinance } from "../context/FinanceContext";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { formatNumberInput, parseFormattedNumber } from "../utils/format";

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");
const SAWERIA_URL = "https://saweria.co/vein13";

export default function ProfileScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const { username, setUsername } = useUser();
  const { salary, setSalary, remaining, expenses, savings, resetData } =
    useFinance();
  const insets = useSafeAreaInsets();

  const [editNameVisible, setEditNameVisible] = useState(false);
  const [editSalaryVisible, setEditSalaryVisible] = useState(false);
  const [nameInput, setNameInput] = useState(username);
  const [salaryInput, setSalaryInput] = useState(
    salary > 0 ? formatNumberInput(String(salary)) : "",
  );

  function handleSaveName() {
    if (!nameInput.trim()) return;
    setUsername(nameInput.trim());
    setEditNameVisible(false);
  }

  function handleSaveSalary() {
    setSalary(parseFormattedNumber(salaryInput));
    setEditSalaryVisible(false);
  }

  function handleReset() {
    Alert.alert(
      "Reset Data",
      "All expense and savings data will be deleted. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetData();
            Alert.alert("Done", "All data has been reset.");
          },
        },
      ],
    );
  }

  function handleDonate() {
    Linking.openURL(SAWERIA_URL);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 80 + insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>PROFILE</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Your account settings
        </Text>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.avatarWrap, { borderColor: colors.accent }]}>
          <Image
            source={require("../assets/mascot/voidspendchibbi2.png")}
            style={styles.avatar}
            resizeMode="contain"
          />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {username}
          </Text>
          <Text style={[styles.profileSub, { color: colors.muted }]}>
            VOIDSPEND User
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.danger }]}>
            {expenses.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            Expenses
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.saving }]}>
            {savings.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            Savings
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {fmt(remaining)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            Remaining
          </Text>
        </View>
      </View>

      {/* Support Card */}
      <TouchableOpacity
        style={[styles.supportCard, { borderColor: colors.accent }]}
        onPress={handleDonate}
      >
        <View style={styles.supportLeft}>
          <View
            style={[
              styles.supportIcon,
              { backgroundColor: "rgba(200,245,66,0.15)" },
            ]}
          >
            <Ionicons name="heart" size={20} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.supportTitle, { color: colors.text }]}>
              Support the Developer
            </Text>
            <Text style={[styles.supportSub, { color: colors.muted }]}>
              Buy me a coffee via Saweria
            </Text>
          </View>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.accent} />
      </TouchableOpacity>

      <Text style={[styles.sectionLabel, { color: colors.muted }]}>
        SETTINGS
      </Text>
      <View style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: colors.border }]}
          onPress={() => {
            setNameInput(username);
            setEditNameVisible(true);
          }}
        >
          <View
            style={[
              styles.settingIcon,
              { backgroundColor: "rgba(200,245,66,0.1)" },
            ]}
          >
            <Ionicons name="person-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              Username
            </Text>
            <Text style={[styles.settingValue, { color: colors.muted }]}>
              {username}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: colors.border }]}
          onPress={() => {
            setSalaryInput(formatNumberInput(String(salary)));
            setEditSalaryVisible(true);
          }}
        >
          <View
            style={[
              styles.settingIcon,
              { backgroundColor: "rgba(59,130,246,0.1)" },
            ]}
          >
            <Ionicons name="cash-outline" size={18} color={colors.saving} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              Monthly Salary
            </Text>
            <Text style={[styles.settingValue, { color: colors.muted }]}>
              {fmt(salary)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: colors.border }]}
          onPress={toggleTheme}
        >
          <View
            style={[
              styles.settingIcon,
              { backgroundColor: "rgba(200,245,66,0.1)" },
            ]}
          >
            <Ionicons
              name={theme === "dark" ? "sunny-outline" : "moon-outline"}
              size={18}
              color={colors.accent}
            />
          </View>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              Theme
            </Text>
            <Text style={[styles.settingValue, { color: colors.muted }]}>
              {theme === "dark" ? "Dark Mode" : "Light Mode"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleReset}>
          <View
            style={[
              styles.settingIcon,
              { backgroundColor: "rgba(255,59,59,0.1)" },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.danger }]}>
              Reset Data
            </Text>
            <Text style={[styles.settingValue, { color: colors.muted }]}>
              Delete all transactions
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.footer, { color: colors.muted }]}>
        VOIDSPEND v1.0.1 — created by veingh0st
      </Text>

      <Modal visible={editNameVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              EDIT USERNAME
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
              value={nameInput}
              onChangeText={setNameInput}
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setEditNameVisible(false)}
              >
                <Text style={[styles.cancelText, { color: colors.muted }]}>
                  CANCEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveName}
              >
                <Text style={[styles.saveText, { color: "#000" }]}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editSalaryVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              EDIT SALARY
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
              value={salaryInput}
              onChangeText={(text) => setSalaryInput(formatNumberInput(text))}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setEditSalaryVisible(false)}
              >
                <Text style={[styles.cancelText, { color: colors.muted }]}>
                  CANCEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveSalary}
              >
                <Text style={[styles.saveText, { color: "#000" }]}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  profileCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 80, height: 80 },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: font.black, fontSize: 22 },
  profileSub: {
    fontFamily: font.regular,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 4,
  },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: 14,
    alignItems: "center",
  },
  statValue: { fontFamily: font.black, fontSize: 14, marginBottom: 4 },
  statLabel: { fontFamily: font.regular, fontSize: 10, letterSpacing: 1 },
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 24,
  },
  supportLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  supportTitle: { fontFamily: font.bold, fontSize: 14 },
  supportSub: { fontFamily: font.regular, fontSize: 11, marginTop: 2 },
  sectionLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 10,
  },
  settingsCard: {
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontFamily: font.bold, fontSize: 14 },
  settingValue: { fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  footer: {
    fontFamily: font.regular,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 8,
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
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    fontFamily: font.regular,
    fontSize: 16,
    padding: 12,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 10 },
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
