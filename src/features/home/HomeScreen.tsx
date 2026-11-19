import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { getMeta } from "@/db/repo/meta";
import { listDrafts } from "@/db/repo/receipts";
import { postOccurrence, skipOccurrence } from "@/db/repo/recurring";
import { walletBalances } from "@/db/repo/wallets";
import {
  Amount,
  Banner,
  Button,
  EmptyState,
  HorizonGlow,
  IconButton,
  ListRow,
  Screen,
  Skeleton,
  Surface,
  Text,
  useBreakpoint,
  useReduceMotion,
  useSnackbar,
  VoidRing,
} from "@/design";
import { DOCK_SPACE } from "@/features/shell/Dock";
import { categoryLabel, useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { formatMonthLabel, formatShortDate } from "@/lib/dateLabels";
import { addMonths, monthOf } from "@/lib/dates";
import { lastDayBeforePayday } from "@/lib/finance";
import { formatRupiah } from "@/lib/money";

import { useCategories } from "../categories/categories";
import { TransactionRow } from "../transactions/components/TransactionRow";
import { reviewFromJson } from "../receipts/review";
import { walletName } from "../wallets/wallets";
import { loadHome } from "./home";

export function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const { byId } = useCategories();
  const clock = getClock();
  const currentMonth = monthOf(clock.today);
  const [month, setMonth] = useState(currentMonth);
  // The way the month last moved, so the content slides in from that side. Reduced motion skips it.
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduce = useReduceMotion();
  const { largeText } = useBreakpoint();
  const go =(delta: 1 | -1) => {
    setDirection(delta);
    setMonth(addMonths(month, delta));
  };

  const home = useQuery(["home", month, clock.today], (db) => loadHome(db, month, clock.today));
  const name = useQuery(["username"], async (db) => (await getMeta(db, "username")) ?? "");
  const drafts = useQuery(["drafts"], (db) => listDrafts(db));
  const balances = useQuery(["home-wallets"], (db) => walletBalances(db));
  const data = home.data;

  const intensity = data && data.totals.income > 0 ? Math.max(0, data.left) / data.totals.income : 0;
  const saved = data ? data.totals.savingDeposit - data.totals.savingWithdrawal : 0;
  const isEmpty = data !== undefined && data.recent.length === 0 && data.totals.income === 0;

  return (
    <Screen background={<HorizonGlow intensity={intensity} />} bottomInset={DOCK_SPACE}>
      <View style={styles.topBar}>
        <Text variant="subheading" accessibilityRole="header" style={styles.greeting}>
          {t.home.hello(name.data ?? "")}
        </Text>
        <IconButton icon="settings-outline" label={t.nav.settings} onPress={() => router.push("/settings")} />
      </View>

      <View style={styles.monthRow}>
        <IconButton icon="chevron-back" label={t.home.previousMonth} onPress={() => go(-1)} />
        <Text variant="bodyLg" accessibilityLiveRegion="polite">
          {formatMonthLabel(month, t)}
        </Text>
        <IconButton icon="chevron-forward" label={t.home.nextMonth} disabled={month >= currentMonth} onPress={() => go(1)} />
      </View>

      {data === undefined ? (
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.stack}>
          <Skeleton height={300} radius={30} />
          <Skeleton height={48} radius={16} />
        </View>
      ) : (
        <Animated.View key={month} entering={reduce ? undefined : (direction === 1 ? FadeInRight : FadeInLeft).duration(200)}>
          <Surface variant="glass" radius="hero" elevated padding={20} style={styles.hero}>
            <VoidRing remaining={data.left} income={data.totals.income}>
              <Amount value={data.left} size="lg" animated maxWidth={190} />
              <Text variant="label" tone="secondary" style={styles.caption}>
                {data.left < 0 ? t.ring.overBy(formatRupiah(-data.left, "never")) : t.ring.leftThisMonth}
              </Text>
            </VoidRing>
            <View style={[styles.legend, largeText && styles.legendStacked]}>
              <LegendItem label={t.home.income} value={data.totals.income} kind="income" stacked={largeText} />
              <LegendItem label={t.home.spent} value={data.totals.expense} kind="expense" align="center" stacked={largeText} />
              <LegendItem label={t.home.saved} value={saved} kind="saving" align="flex-end" stacked={largeText} />
            </View>
            {data.safePerDay !== null && data.paydayDay !== null ? (
              <Text variant="body" tone="secondary" style={styles.center}>
                {t.home.safePerDay(formatRupiah(data.safePerDay), formatShortDate(lastDayBeforePayday(data.today, data.paydayDay), t, data.today))}
              </Text>
            ) : null}
          </Surface>

          <View style={styles.actions}>
            <Button label={t.home.recordExpense} icon="add" onPress={() => router.push("/add")} fullWidth />
            <Button label={t.scan.scanAction} icon="scan-outline" variant="secondary" onPress={() => router.push("/scan")} fullWidth />
            <Button label={t.home.recordIncome} variant="secondary" onPress={() => router.push({ pathname: "/add", params: { type: "income" } })} fullWidth />
          </View>

          {drafts.data && drafts.data.length > 0 ? (
            <Section title={t.scan.review.draftsTitle}>
              {drafts.data.slice(0, 2).map((draft) => {
                const review = reviewFromJson(draft.draftJson);
                return (
                  <Surface key={draft.id} variant="smoke" padding={16} style={styles.stack}>
                    <Text variant="body">{t.scan.review.draftItem(review.merchant || t.scan.review.draftUnknown, formatRupiah(review.total))}</Text>
                    <View style={styles.row}>
                      <Button label={t.scan.review.continue} size="sm" onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: draft.id } })} />
                    </View>
                  </Surface>
                );
              })}
            </Section>
          ) : null}

          {data.pending.length > 0 ? (
            <Section title={t.home.pendingTitle}>
              {data.pending.map(({ rule, dates }) => (
                <Surface key={rule.id} variant="smoke" padding={16} style={styles.stack}>
                  <Text variant="body">{t.home.pendingItem(rule.title, formatRupiah(rule.amount), formatShortDate(dates[0], t, data.today))}</Text>
                  <View style={styles.row}>
                    <Button
                      label={t.home.record}
                      size="sm"
                      onPress={async () => {
                        await write((db) => postOccurrence(db, rule, dates[0], getClock()));
                        show({ message: t.home.recorded });
                      }}
                    />
                    <Button
                      label={t.home.skip}
                      size="sm"
                      variant="quiet"
                      onPress={async () => {
                        await write((db) => skipOccurrence(db, rule, dates[0]));
                        show({ message: t.home.skipped });
                      }}
                    />
                    <Button label={t.detail.edit} size="sm" variant="quiet" onPress={() => router.push("/recurring")} />
                  </View>
                </Surface>
              ))}
            </Section>
          ) : null}

          {!data.hasSalaryRule ? (
            <Banner tone="info" title={t.home.salaryTitle} message={t.home.salaryBody} actionLabel={t.home.salaryAction} onAction={() => router.push("/salary")} />
          ) : null}

          {balances.data && balances.data.length > 1 ? (
            <Section title={t.wallets.homeTitle} action={{ label: t.wallets.manage, onPress: () => router.push("/wallets") }}>
              <Surface variant="smoke" padding={8}>
                {balances.data.map(({ wallet, balance }, index, all) => (
                  <ListRow
                    key={wallet.id}
                    title={walletName(wallet, t)}
                    subtitle={t.wallets.kinds[wallet.kind]}
                    trailing={<Amount value={balance} kind="neutral" size="sm" />}
                    divider={index < all.length - 1}
                  />
                ))}
              </Surface>
            </Section>
          ) : null}

          {data.budgets.length > 0 ? (
            <Section title={t.home.budgetsTitle}>
              <Surface variant="smoke" padding={8}>
                {data.budgets.slice(0, 3).map((budget, index, all) => {
                  const category = byId.get(budget.categoryId);
                  return (
                    <ListRow
                      key={budget.categoryId}
                      title={category ? categoryLabel(category, t) : ""}
                      subtitle={`${t.home.budgetLine(formatRupiah(budget.spent), formatRupiah(budget.limit))}, ${t.home.budgetStatus[budget.usage.status]}`}
                      divider={index < all.length - 1}
                    />
                  );
                })}
              </Surface>
            </Section>
          ) : null}

          <Section title={t.home.recentTitle} action={data.recent.length > 0 ? { label: t.home.seeAll, onPress: () => router.navigate("/history") } : undefined}>
            {isEmpty ? (
              <Surface variant="smoke">
                <EmptyState
                  source={require("../../assets/mascot/what2.png")}
                  title={t.home.emptyTitle}
                  body={t.home.emptyBody}
                  actionLabel={t.home.recordExpense}
                  onAction={() => router.push("/add")}
                />
              </Surface>
            ) : (
              <Surface variant="smoke" padding={8}>
                {data.recent.map((tx, index, all) => (
                  <TransactionRow key={tx.id} tx={tx} category={tx.categoryId ? byId.get(tx.categoryId) : undefined} divider={index < all.length - 1} onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: tx.id } })} />
                ))}
              </Surface>
            )}
          </Section>
        </Animated.View>
      )}
    </Screen>
  );
}

function LegendItem({ label, value, kind, align = "flex-start", stacked = false }: { label: string; value: number; kind: "income" | "expense" | "saving"; align?: "flex-start" | "center" | "flex-end"; stacked?: boolean }) {
  // With large system text the three amounts stack as rows, label on the left and amount on the right.
  return (
    <View style={stacked ? styles.legendRow : [styles.legendItem, { alignItems: align }]}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Amount value={value} kind={kind} size="sm" />
    </View>
  );
}

function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {action ? <Button label={action.label} variant="quiet" size="sm" onPress={action.onPress} /> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { flex: 1 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  stack: { gap: 12, marginTop: 12 },
  hero: { marginTop: 8, alignItems: "center", gap: 16 },
  caption: { textAlign: "center" },
  legend: { flexDirection: "row", alignSelf: "stretch", justifyContent: "space-between" },
  legendStacked: { flexDirection: "column", gap: 8 },
  legendItem: { gap: 2 },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  center: { textAlign: "center" },
  actions: { gap: 12, marginTop: 16 },
  row: { flexDirection: "row", gap: 12 },
  section: { marginTop: 24, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
