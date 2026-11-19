import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useWrite } from "@/db/DatabaseProvider";
import { DEFAULT_WALLET_ID } from "@/db/types";
import { Button, Chip, Field, Screen, SheetHeader, SwitchRow, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { getClock } from "@/lib/clock";
import { parseFormattedNumber } from "@/utils/format";

import { applySalarySetup } from "../profile/profile";
import { useWallets, walletName } from "../wallets/wallets";

/** Sets up the monthly salary after onboarding: one recurring rule, and this month's salary if it already came. */
export function SalaryScreen() {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const [salary, setSalary] = useState("");
  const [payday, setPayday] = useState("25");
  const [received, setReceived] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const wallets = useWallets();
  const [walletPick, setWalletPick] = useState<string | null>(null);
  // A wallet hidden since it was picked no longer counts, so the salary never lands in one the person cannot see.
  const walletList = wallets.data ?? [];
  const walletId = walletPick && walletList.some((wallet) => wallet.id === walletPick) ? walletPick : DEFAULT_WALLET_ID;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await write((db) => applySalarySetup(db, { amount: salary.trim() === "" ? 0 : parseFormattedNumber(salary), payday: Number(payday), receivedThisMonth: received, walletId }, getClock()));
      router.back();
      show({ message: t.add.saved });
    } catch (cause) {
      setError(errorMessage(cause, t));
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.home.salaryTitle} onClose={() => router.back()} grabber={false} />
      <Field label={t.onboarding.salary} variant="amount" value={salary} onChangeText={setSalary} />
      <Field label={t.onboarding.payday} value={payday} onChangeText={(text) => setPayday(text.replace(/\D/g, "").slice(0, 2))} keyboardType="number-pad" helper={t.onboarding.paydayHelper} />
      <SwitchRow label={t.onboarding.received} value={received} onValueChange={setReceived} />
      {walletList.length > 1 ? (
        <View style={styles.pick}>
          <Text variant="label" tone="secondary">
            {t.wallets.field}
          </Text>
          <View style={styles.wrap}>
            {walletList.map((wallet) => (
              <Chip key={wallet.id} label={walletName(wallet, t)} selected={walletId === wallet.id} onPress={() => setWalletPick(wallet.id)} />
            ))}
          </View>
        </View>
      ) : null}
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="body" tone="danger">
            {error}
          </Text>
        </View>
      ) : null}
      <Button label={t.add.save} onPress={save} loading={saving} disabled={salary.trim() === ""} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  pick: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
