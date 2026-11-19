import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useDb } from "@/db/DatabaseProvider";
import { ValidationError } from "@/db/types";
import { Button, Field, Screen, Segmented, SwitchRow, Text } from "@/design";
import { useLanguage, useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { parseFormattedNumber } from "@/utils/format";
import type { LanguagePref } from "@/lib/prefs";

import { applySalarySetup, setOnboarded, setUsername } from "../profile/profile";

/** Two steps: a welcome, then name, language and salary. The salary is optional. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const db = useDb();
  const t = useT();
  const { pref, setPref } = useLanguage();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [payday, setPayday] = useState("25");
  const [received, setReceived] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const languageOptions = [
    { value: "system", label: t.settings.language.system },
    { value: "id", label: "ID" },
    { value: "en", label: "EN" },
  ] as const satisfies readonly { value: LanguagePref; label: string }[];

  const finish = async () => {
    setError(null);
    setSaving(true);
    try {
      const amount = salary.trim() === "" ? 0 : parseFormattedNumber(salary);
      if (amount > 0) {
        const clock = getClock();
        await applySalarySetup(db, { amount, payday: Number(payday), receivedThisMonth: received }, clock);
      }
      if (name.trim() !== "") await setUsername(db, name);
      await setOnboarded(db);
      onDone();
    } catch (cause) {
      setError(cause instanceof ValidationError ? (t.errors as Record<string, string>)[cause.code] ?? t.errors.generic : t.errors.generic);
      setSaving(false);
    }
  };

  if (step === 0) {
    return (
      <Screen>
        <View style={styles.welcome}>
          <Image source={require("../../assets/mascot/happy2.png")} style={styles.mascot} contentFit="contain" accessible={false} />
          <Text variant="title" accessibilityRole="header">
            {t.onboarding.welcomeTitle}
          </Text>
          <Text variant="bodyLg" tone="secondary">
            {t.onboarding.welcomeBody}
          </Text>
          <Button label={t.onboarding.start} onPress={() => setStep(1)} fullWidth />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Text variant="title" accessibilityRole="header">
          {t.onboarding.setupTitle}
        </Text>
        <Field label={t.onboarding.name} value={name} onChangeText={setName} placeholder={t.onboarding.namePlaceholder} autoCapitalize="words" maxLength={40} />
        <Segmented label={t.settings.language.title} options={languageOptions} value={pref} onChange={setPref} />
        <Field label={t.onboarding.salary} variant="amount" value={salary} onChangeText={setSalary} helper={t.onboarding.salaryHelper} optional />
        {salary.trim() !== "" ? (
          <>
            <Field label={t.onboarding.payday} value={payday} onChangeText={(text) => setPayday(text.replace(/\D/g, "").slice(0, 2))} keyboardType="number-pad" helper={t.onboarding.paydayHelper} />
            <SwitchRow label={t.onboarding.received} value={received} onValueChange={setReceived} />
          </>
        ) : null}
        {error ? (
          <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label={t.onboarding.finish} onPress={finish} loading={saving} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { gap: 16, alignItems: "stretch", paddingTop: 40 },
  mascot: { width: 200, height: 200, alignSelf: "center" },
  form: { gap: 16 },
});
