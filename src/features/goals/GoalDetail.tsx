import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { archiveGoal, getGoal, restoreGoal } from "@/db/repo/goals";
import { listTransactions } from "@/db/repo/transactions";
import { listWallets } from "@/db/repo/wallets";
import { Amount, Button, ListRow, ProgressRing, Screen, SheetHeader, Skeleton, Surface, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { formatShortDate } from "@/lib/dateLabels";
import { formatRupiah } from "@/lib/money";

import { TransactionRow } from "../transactions/components/TransactionRow";
import { walletName } from "../wallets/wallets";
import { goalNeedPerMonth, goalWalletSplit } from "./goals";

export function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const goal = useQuery(["goal", id], (db) => getGoal(db, id));
  const moves = useQuery(["goal-moves", id], (db) => listTransactions(db, { goalId: id }));
  const split = useQuery(["goal-split", id], (db) => goalWalletSplit(db, id));
  // Hidden wallets too: a deposit made from a wallet that has since been hidden still names it.
  const wallets = useQuery(["wallets-all"], (db) => listWallets(db, { includeArchived: true }));
  const today = getClock().today;

  if (goal.loading) {
    return (
      <Screen>
        <Skeleton height={28} width="50%" />
      </Screen>
    );
  }
  const data = goal.data;
  if (!data || data.archivedAt !== null) {
    return (
      <Screen>
        <SheetHeader title={t.goals.title} onClose={() => router.back()} grabber={false} />
        <Text variant="body" tone="secondary">
          {t.goals.notFound}
        </Text>
      </Screen>
    );
  }

  const need = goalNeedPerMonth(data, today);
  const pct = data.progress.pct;

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={data.name} onClose={() => router.back()} grabber={false} />
      <View style={styles.hero}>
        <ProgressRing value={pct} label={`${data.name}, ${pct === null ? t.goals.noTarget : t.insights.percent(pct)}`} size={160} strokeWidth={14}>
          <Text variant="heading">{pct === null ? "" : `${Math.round(pct)}%`}</Text>
        </ProgressRing>
        <Amount value={data.saved} kind="saving" size="lg" maxWidth={300} />
        <Text variant="body" tone="secondary">
          {data.progress.target === null ? t.goals.noTarget : t.goals.progress(formatRupiah(data.saved), formatRupiah(data.progress.target))}
        </Text>
        {data.targetDate ? (
          <Text variant="body" tone="secondary">
            {`${t.goals.dueBy(formatShortDate(data.targetDate, t, today))}${need !== null && need > 0 ? `, ${t.goals.needPerMonth(formatRupiah(need))}` : ""}`}
          </Text>
        ) : null}
        {data.progress.reached ? <Text variant="label" tone="accent">{t.goals.reached}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button label={t.goals.deposit} icon="add" onPress={() => router.push({ pathname: "/add", params: { type: "saving_deposit", goal: data.id } })} fullWidth />
        <Button label={t.goals.withdraw} variant="secondary" disabled={data.saved <= 0} onPress={() => router.push({ pathname: "/add", params: { type: "saving_withdrawal", goal: data.id } })} fullWidth />
      </View>

      {/* Only when more than one wallet is involved, so the common case shows nothing extra. */}
      {split.data && split.data.length > 1 ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            {t.goals.byWallet}
          </Text>
          <Text variant="caption" tone="secondary">
            {t.goals.byWalletHelp}
          </Text>
          <Surface variant="smoke" padding={8}>
            {split.data.map((share, index, all) => {
              const wallet = (wallets.data ?? []).find((item) => item.id === share.walletId);
              return <ListRow key={share.walletId} title={wallet ? walletName(wallet, t) : ""} trailing={<Amount value={share.net} kind="neutral" tone="primary" size="sm" />} divider={index < all.length - 1} />;
            })}
          </Surface>
        </>
      ) : null}

      <Text variant="heading" accessibilityRole="header">
        {t.goals.timeline}
      </Text>
      <Surface variant="smoke" padding={8}>
        {moves.data && moves.data.length > 0 ? (
          moves.data.map((tx, index, all) => (
            <TransactionRow key={tx.id} tx={tx} category={undefined} divider={index < all.length - 1} onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: tx.id } })} />
          ))
        ) : (
          <Text variant="body" tone="secondary" style={styles.empty}>
            {t.goals.noMoves}
          </Text>
        )}
      </Surface>

      <View style={styles.actions}>
        <Button label={t.goals.editGoal} variant="quiet" icon="create-outline" onPress={() => router.push({ pathname: "/goal-edit", params: { id: data.id } })} fullWidth />
        <Button
          label={t.goals.archive}
          variant="quiet"
          onPress={async () => {
            await write((db) => archiveGoal(db, data.id));
            router.back();
            show({ message: t.goals.archived, actionLabel: t.common.undo, onAction: () => void write((db) => restoreGoal(db, data.id)) });
          }}
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  hero: { alignItems: "center", gap: 8 },
  actions: { gap: 12 },
  empty: { padding: 12 },
});
