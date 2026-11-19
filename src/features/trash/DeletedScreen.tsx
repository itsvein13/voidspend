import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { daysLeft, listDeleted } from "@/db/repo/trash";
import { restoreTransaction, type Transaction } from "@/db/repo/transactions";
import { Banner, Button, EmptyState, Screen, SheetHeader, Skeleton, Surface, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { formatShortDate } from "@/lib/dateLabels";
import { formatRupiah } from "@/lib/money";

import { eraseForGood } from "./trash";

/** Transactions deleted in the last 30 days. They can come back, or be removed for good. */
export function DeletedScreen() {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const list = useQuery(["deleted"], (db) => listDeleted(db));
  const [confirming, setConfirming] = useState<string | null>(null);
  const { now, today } = getClock();

  const restore = async (tx: Transaction) => {
    await write((db) => restoreTransaction(db, tx.id));
    show({ message: t.trash.restored });
  };
  const erase = async (tx: Transaction) => {
    setConfirming(null);
    await write((db) => eraseForGood(db, [tx.id]));
    show({ message: t.trash.erased });
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.trash.title} onClose={() => router.back()} grabber={false} />
      <Text variant="body" tone="secondary">
        {t.trash.body(30)}
      </Text>
      {list.data === undefined ? (
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.stack}>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      ) : list.data.length === 0 ? (
        <EmptyState source={require("../../assets/mascot/what2.png")} title={t.trash.emptyTitle} body={t.trash.emptyBody} />
      ) : (
        list.data.map((tx) => (
          <Surface key={tx.id} variant="smoke" padding={16} style={styles.stack}>
            <View style={styles.head}>
              <View style={styles.titles}>
                <Text variant="body">{tx.title}</Text>
                <Text variant="caption" tone="secondary">
                  {`${formatShortDate(tx.occurredLocalDate, t, today)}, ${t.trash.daysLeft(daysLeft(tx.deletedAt ?? now, now))}`}
                </Text>
              </View>
              <Text variant="body">{formatRupiah(tx.amount)}</Text>
            </View>
            {confirming === tx.id ? (
              <View style={styles.stack}>
                <Banner tone="danger" message={t.trash.confirm} />
                <View style={styles.row}>
                  <Button label={t.trash.deleteForever} variant="destructive" size="sm" onPress={() => erase(tx)} />
                  <Button label={t.trash.keep} variant="quiet" size="sm" onPress={() => setConfirming(null)} />
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Button label={t.trash.restore} variant="secondary" size="sm" onPress={() => restore(tx)} />
                <Button label={t.trash.deleteForever} variant="quiet" size="sm" onPress={() => setConfirming(tx.id)} />
              </View>
            )}
          </Surface>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  stack: { gap: 12 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titles: { flex: 1, gap: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
