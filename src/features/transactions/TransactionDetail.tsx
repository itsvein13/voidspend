import { useRouter } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { tagsFor } from "@/db/repo/tags";
import { getTransaction, restoreTransaction, softDeleteTransaction } from "@/db/repo/transactions";
import { listWallets } from "@/db/repo/wallets";
import { DEFAULT_WALLET_ID } from "@/db/types";
import { Amount, Button, ListRow, Screen, SheetHeader, Skeleton, Surface, Text, useSnackbar, type AmountKind } from "@/design";
import { categoryLabel, useT } from "@/i18n";
import { formatFullDate, formatStamp } from "@/lib/dateLabels";
import { currentOffsetMinutes, localTimeOf } from "@/lib/dates";

import { useCategories } from "../categories/categories";
import { geoUrl } from "../location/location";
import { walletName } from "../wallets/wallets";
import { CategoryTile } from "./components/TransactionRow";

const KIND: Record<string, AmountKind> = { expense: "expense", income: "income", saving_deposit: "saving", saving_withdrawal: "saving" };

type Props = {
  id: string;
  /** Leaves the detail: goes back when it is a screen, or empties the pane when it sits beside the list. */
  onClose: () => void;
  /**
   * True when the detail sits beside the list on a wide window. Then it does not replace itself with the edit
   * screen (that would replace the list), it opens the edit screen on top.
   */
  beside?: boolean;
};

/** Everything about one transaction, and what can be done with it. A screen of its own, or the right pane of History. */
export function TransactionDetail({ id, onClose, beside = false }: Props) {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const { byId } = useCategories();
  const query = useQuery(["tx", id], (db) => getTransaction(db, id));
  const tags = useQuery(["tx-tags", id], async (db) => (await tagsFor(db, [id])).get(id) ?? []);
  // Hidden wallets too: a transfer into a wallet that has since been hidden still names it.
  const wallets = useQuery(["wallets-all"], (db) => listWallets(db, { includeArchived: true }));
  const go = beside ? router.push : router.replace;

  if (query.loading) {
    return (
      <Screen>
        <Skeleton height={28} width="50%" />
      </Screen>
    );
  }
  const tx = query.data;
  if (!tx || tx.deletedAt !== null) {
    return (
      <Screen>
        <SheetHeader title={t.detail.title} onClose={onClose} grabber={false} />
        <Text variant="body" tone="secondary">
          {t.detail.notFound}
        </Text>
      </Screen>
    );
  }

  const category = tx.categoryId ? byId.get(tx.categoryId) : undefined;
  const nameOfWallet = (walletId: string | null) => {
    const wallet = (wallets.data ?? []).find((item) => item.id === (walletId ?? DEFAULT_WALLET_ID));
    return wallet ? walletName(wallet, t) : "";
  };
  const editable = tx.type === "expense" || tx.type === "income";
  const deviceOffset = currentOffsetMinutes();
  const time = tx.timePrecision === "exact" ? localTimeOf(tx.occurredAt, tx.occurredOffsetMin) : t.detail.dateOnly;
  const edited = tx.updatedAt - tx.createdAt > 60_000;

  const remove = async () => {
    await write((db) => softDeleteTransaction(db, tx.id));
    onClose();
    show({ message: t.history.deleted, actionLabel: t.common.undo, onAction: () => void write((db) => restoreTransaction(db, tx.id)) });
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.detail.title} onClose={onClose} grabber={false} />
      <View style={styles.top}>
        <CategoryTile category={category} />
        <View style={styles.topText}>
          <Text variant="bodyLg">{tx.title}</Text>
          <Text variant="caption" tone="secondary">
            {t.detail.types[tx.type]}
          </Text>
        </View>
      </View>
      <Amount value={tx.amount} kind={KIND[tx.type] ?? "neutral"} size="lg" maxWidth={320} />

      <Surface variant="smoke" padding={8}>
        {category ? <ListRow title={t.detail.category} subtitle={categoryLabel(category, t)} divider /> : null}
        {tx.type === "transfer" ? (
          <>
            <ListRow title={t.wallets.from} subtitle={nameOfWallet(tx.walletId)} divider />
            <ListRow title={t.wallets.to} subtitle={nameOfWallet(tx.toWalletId)} divider />
          </>
        ) : null}
        {tx.counterparty ? <ListRow title={t.detail.counterparty} subtitle={tx.counterparty} divider /> : null}
        <ListRow title={t.detail.when} subtitle={`${formatFullDate(tx.occurredLocalDate, t)}, ${time}`} divider />
        {tx.occurredOffsetMin !== deviceOffset ? <ListRow title={t.detail.zone} subtitle={`${tx.occurredTz} (UTC${tx.occurredOffsetMin >= 0 ? "+" : "-"}${Math.abs(tx.occurredOffsetMin) / 60})`} divider /> : null}
        {tx.location ? <ListRow title={t.place.title} subtitle={tx.location.name ?? `${tx.location.lat}, ${tx.location.lng}`} divider /> : null}
        {tx.paymentMethod ? <ListRow title={t.detail.payment} subtitle={(t.add.paymentMethods as Record<string, string>)[tx.paymentMethod] ?? tx.paymentMethod} divider /> : null}
        {tags.data && tags.data.length > 0 ? <ListRow title={t.tags.title} subtitle={tags.data.map((tag) => `#${tag}`).join(" ")} divider /> : null}
        {tx.note ? <ListRow title={t.detail.note} subtitle={tx.note} divider /> : null}
        <ListRow title={t.detail.source} subtitle={t.detail.sources[tx.source]} />
      </Surface>

      <Text variant="caption" tone="secondary">
        {`${t.detail.recorded(formatStamp(tx.createdAt, deviceOffset, t))}${edited ? `, ${t.detail.edited(formatStamp(tx.updatedAt, deviceOffset, t))}` : ""}`}
      </Text>

      {tx.location && geoUrl(tx.location) ? <Button label={t.place.openMaps} icon="map-outline" variant="secondary" onPress={() => Linking.openURL(geoUrl(tx.location!)!)} fullWidth /> : null}

      <View style={styles.actions}>
        {editable ? (
          <>
            <Button label={t.detail.edit} icon="create-outline" onPress={() => go({ pathname: "/add", params: { edit: tx.id } })} fullWidth />
            <Button label={t.detail.duplicate} icon="copy-outline" variant="secondary" onPress={() => go({ pathname: "/add", params: { copy: tx.id } })} fullWidth />
          </>
        ) : tx.type === "transfer" ? (
          <Button label={t.detail.edit} icon="create-outline" onPress={() => go({ pathname: "/transfer", params: { edit: tx.id } })} fullWidth />
        ) : (
          <Text variant="caption" tone="secondary">
            {t.detail.editLater}
          </Text>
        )}
        <Button label={t.detail.delete} icon="trash-outline" variant="destructive" onPress={remove} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  topText: { flex: 1 },
  actions: { gap: 12 },
});
