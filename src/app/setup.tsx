import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Image,
    KeyboardAvoidingView,
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
import { useUser } from "../context/UserContext";

export default function SetupScreen() {
  const { colors } = useTheme();
  const { setUsername, setHasOnboarded } = useUser();
  const { setSalary } = useFinance();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [nameInput, setNameInput] = useState("");
  const [salaryInput, setSalaryInput] = useState("");

  function handleNextStep() {
    if (!nameInput.trim()) return;
    setStep(2);
  }

  function handleFinish() {
    if (!salaryInput) return;
    setUsername(nameInput.trim());
    setSalary(parseFloat(salaryInput) || 0);
    setHasOnboarded(true);
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Step 1 — Username */}
        {step === 1 && (
          <View style={styles.stepWrap}>
            <Image
              source={require("../assets/mascot/what2.png")}
              style={styles.mascot}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.text }]}>
              What should we{"\n"}call you?
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              This will appear on your dashboard.
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                },
              ]}
              placeholder="Enter your name..."
              placeholderTextColor={colors.muted}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor: nameInput.trim()
                    ? colors.accent
                    : colors.border,
                },
              ]}
              onPress={handleNextStep}
              disabled={!nameInput.trim()}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: nameInput.trim() ? "#000" : colors.muted },
                ]}
              >
                Next →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2 — Salary */}
        {step === 2 && (
          <View style={styles.stepWrap}>
            <Image
              source={require("../assets/mascot/happy2.png")}
              style={styles.mascot}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.text }]}>
              Set your monthly{"\n"}salary, {nameInput}!
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              We'll help you track how much is left.
            </Text>
            <View
              style={[
                styles.salaryWrap,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.currency, { color: colors.accent }]}>
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
                value={salaryInput}
                onChangeText={setSalaryInput}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor: salaryInput ? colors.accent : colors.border,
                },
              ]}
              onPress={handleFinish}
              disabled={!salaryInput}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: salaryInput ? "#000" : colors.muted },
                ]}
              >
                Let's Go! 🔥
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.muted }]}>
                ← Back
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 },
  stepWrap: { flex: 1, alignItems: "center" },
  mascot: { width: 220, height: 220, marginBottom: 24 },
  title: {
    fontFamily: font.black,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 16,
    fontFamily: font.bold,
    fontSize: 16,
    marginBottom: 16,
  },
  salaryWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: 16,
    overflow: "hidden",
  },
  currency: {
    fontFamily: font.black,
    fontSize: 13,
    paddingHorizontal: 16,
    letterSpacing: 1,
  },
  salaryInput: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 20,
    padding: 16,
    borderLeftWidth: 1,
  },
  btn: {
    width: "100%",
    borderRadius: radius.md,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  btnText: { fontFamily: font.black, fontSize: 14, letterSpacing: 2 },
  backBtn: { padding: 8 },
  backText: { fontFamily: font.regular, fontSize: 13, letterSpacing: 1 },
});
