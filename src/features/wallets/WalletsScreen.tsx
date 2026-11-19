import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { archiveWallet, restoreWallet, walletBalances } from "@/db/repo/wallets";
import { Amount, Button, Screen, SheetHeader, Skeleton, Surface, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";

import { walletName } from "./wallets";

/** Every wallet with what it holds, the total, and the ways to add one, change one or move money. */
export function WalletsScreen() {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const list = useQuery(["wallet-balances"], (db) => walletBalances(db, { includeArchived: true }));
  const shown = (list.data ?? []).filter((entry) => entry.wallet.archivedAt === null);
  const hidden = (list.data ?? []).filter((entry) => entry.wallet.archivedAt !== null);
  const total = shown.reduce((sum, entry) => sum + entry.balance, 0);

  const hide = async (id: string) => {
    try {
      await write((db) => archiveWallet(db, id));
    } catch (cause) {
      show({ message: errorMessage(cause, t) });
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.wallets.title} onClose={() => router.back()} grabber={false} />
      {list.data === undefined ? (
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.stack}>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      ) : (
        <>
          <Surface variant="glass" radius="hero" padding={20} style={styles.total}>
            <Text variant="label" tone="secondary">
              {t.wallets.total}
            </Text>
            <Amount value={total} kind="neutral" size="lg" />
          </Surface>
          <View style={styles.row}>
            <Button label={t.wallets.newWallet} icon="add" onPress={() => router.push("/wallet-edit")} />
            <Button label={t.wallets.transfer} variant="secondary" onPress={() => router.push("/transfer")} />
          </View>
          {shown.map(({ wallet, balance }) => (
            <Surface key={wallet.id} variant="smoke" padding={16} style={styles.stack}>
              <View style={styles.head}>
                <View style={styles.titles}>
                  <Text variant="body">{walletName(wallet, t)}</Text>
                  <Text variant="caption" tone="secondary">
                    {t.wallets.kinds[wallet.kind]}
                  </Text>
                </View>
                <Amount value={balance} kind="neutral" size="sm" />
              </View>
              <View style={styles.row}>
                <Button label={t.wallets.edit} variant="secondary" size="sm" onPress={() => router.push({ pathname: "/wallet-edit", params: { id: wallet.id } })} />
                {wallet.isDefault ? null : <Button label={t.wallets.hide} variant="quiet" size="sm" onPress={() => hide(wallet.id)} />}
              </View>
            </Surface>
          ))}
          {hidden.length > 0 ? (
            <>
              <Text variant="heading" accessibilityRole="header">
                {t.wallets.hidden}
              </Text>
              {hidden.map(({ wallet, balance }) => (
                <Surface key={wallet.id} variant="smoke" padding={16} style={styles.stack}>
                  <View style={styles.head}>
                    <Text variant="body" style={styles.titles}>
                      {walletName(wallet, t)}
                    </Text>
                    <Amount value={balance} kind="neutral" size="sm" />
                  </View>
                  <View style={styles.row}>
                    <Button label={t.wallets.show} variant="secondary" size="sm" onPress={() => write((db) => restoreWallet(db, wallet.id))} />
                  </View>
                </Surface>
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  stack: { gap: 12 },
  total: { alignItems: "center", gap: 4 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titles: { flex: 1, gap: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
