import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { createWallet, getWallet, updateWallet, WALLET_KINDS, type Wallet, type WalletKind } from "@/db/repo/wallets";
import { Button, Chip, Field, Screen, SheetHeader, Skeleton, SwitchRow, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";

import { inputFromOpening, openingFromInput } from "./opening";
import { walletName } from "./wallets";

/** Loads the wallet to edit, then shows the form. A new wallet shows it at once. */
export function WalletEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const wallet = useQuery(["wallet", id ?? ""], async (db) => (id ? getWallet(db, id) : null));
  if (id && wallet.loading) {
    return (
      <Screen>
        <Skeleton height={28} width="50%" />
      </Screen>
    );
  }
  return <WalletForm key={id ?? "new"} wallet={wallet.data ?? null} />;
}

function WalletForm({ wallet }: { wallet: Wallet | null }) {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const [name, setName] = useState(wallet ? walletName(wallet, t) : "");
  const [kind, setKind] = useState<WalletKind>(wallet?.kind ?? "cash");
  const initial = inputFromOpening(wallet?.openingBalance ?? 0);
  const [opening, setOpening] = useState(initial.text);
  const [owed, setOwed] = useState(initial.owed);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input = { name, kind, openingBalance: openingFromInput(opening, owed) };
      if (wallet) await write((db) => updateWallet(db, wallet.id, input));
      else await write((db) => createWallet(db, input));
      router.back();
      show({ message: t.wallets.saved });
    } catch (cause) {
      setError(errorMessage(cause, t));
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={wallet ? t.wallets.editWallet : t.wallets.newWallet} onClose={() => router.back()} grabber={false} />
      <Field label={t.wallets.name} value={name} onChangeText={setName} maxLength={40} />
      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {t.wallets.kind}
        </Text>
        <View style={styles.wrap}>
          {WALLET_KINDS.map((option) => (
            <Chip key={option} label={t.wallets.kinds[option]} selected={kind === option} onPress={() => setKind(option)} />
          ))}
        </View>
      </View>
      <Field label={t.wallets.opening} variant="amount" value={opening} onChangeText={setOpening} helper={t.wallets.openingHelp} optional />
      <SwitchRow label={t.wallets.owed} description={t.wallets.owedHelp} value={owed} onValueChange={setOwed} />
      {error ? (
        <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label={t.wallets.save} onPress={save} loading={saving} disabled={name.trim() === ""} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  block: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
