import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useDb, useQuery } from "@/db/DatabaseProvider";
import { listGoals } from "@/db/repo/goals";
import { tagsFor } from "@/db/repo/tags";
import { listTransactions, type Transaction } from "@/db/repo/transactions";
import { Amount, Bars, Button, CalendarHeat, Chip, Donut, EmptyState, IconButton, ListRow, Screen, Segmented, Skeleton, Surface, SwitchRow, Text, useBreakpoint, useSnackbar, useTheme } from "@/design";
import { DOCK_SPACE } from "@/features/shell/Dock";
import { categoryLabel, useT } from "@/i18n";
import { addDays, monthOf } from "@/lib/dates";
import { getClock } from "@/lib/clock";
import { formatFullDate, formatMonthLabel } from "@/lib/dateLabels";
import { formatRupiah } from "@/lib/money";

import { categoryColor, useCategories } from "../categories/categories";
import { useWallets, walletName } from "../wallets/wallets";
import { buildCsv } from "../export/csv";
import { buildInsightsReport, periodLabel } from "../export/insightsReport";
import { buildReportHtml } from "../export/report";
import { shareHtmlAsPdf, shareTextFile } from "../export/share";
import { buildMonthGrid, mondayFirst } from "./calendar";
import { donutSlices } from "./donut";
import { loadInsights, periodRange, shiftPeriod, type Period } from "./insights";

type Kind = Period["kind"];

function changeText(value: number | null): string | null {
  if (value === null) return null;
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function InsightsScreen() {
  const t = useT();
  const router = useRouter();
  const db = useDb();
  const { color } = useTheme();
  const { show } = useSnackbar();
  const { byId } = useCategories();
  const { largeText } = useBreakpoint();
  const clock = getClock();
  const currentMonth = monthOf(clock.today);
  const currentYear = Number(currentMonth.slice(0, 4));
  const [period, setPeriod] = useState<Period>({ kind: "month", month: currentMonth });
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [includePlaces, setIncludePlaces] = useState(false);
  const wallets = useWallets();
  const [walletPick, setWalletPick] = useState<string | null>(null);
  // A wallet that was hidden since it was picked no longer filters, so the numbers never describe a wallet the person cannot see.
  const walletList = wallets.data ?? [];
  const wallet = walletPick ? walletList.find((item) => item.id === walletPick) : undefined;
  const walletId = wallet ? wallet.id : null;
  const walletLabel = wallet ? walletName(wallet, t) : null;

  const insights = useQuery(["insights", JSON.stringify(period), walletId], (database) => loadInsights(database, period, walletId));
  const data = insights.data;

  const atLatest = period.kind === "month" ? period.month >= currentMonth : period.year >= currentYear;
  const changeKind = (kind: Kind) => {
    if (kind === period.kind) return;
    setPeriod(kind === "year" ? { kind: "year", year: Number(period.kind === "month" ? period.month.slice(0, 4) : period.year) } : { kind: "month", month: period.kind === "year" && period.year < currentYear ? `${period.year}-12` : currentMonth });
  };

  const slices = useMemo(() => {
    const categories = new Map([...byId].map(([id, category]) => [id, { id, label: categoryLabel(category, t), colorToken: category.color }]));
    return data ? donutSlices(data.categories, categories, t.insights.other) : [];
  }, [data, byId, t]);

  const nameOf = (categoryId: string | null) => {
    const category = categoryId ? byId.get(categoryId) : undefined;
    return category ? categoryLabel(category, t) : t.insights.other;
  };

  const runExport = async (kind: "csv" | "pdf") => {
    if (!data) return;
    setBusy(kind);
    try {
      const label = [periodLabel(period, t), walletLabel ?? ""].join(" ").trim().replace(/\s+/g, "-").toLowerCase();
      if (kind === "pdf") {
        await shareHtmlAsPdf(buildReportHtml(buildInsightsReport(data, t, nameOf, walletLabel), "en"), `voidspend-${label}.pdf`);
      } else {
        const { from, endExclusive } = periodRange(period);
        const [rows, goals] = await Promise.all([
          listTransactions(db, { fromDate: from, toDate: addDays(endExclusive, -1), walletId: walletId ?? undefined }),
          listGoals(db, { includeArchived: true }),
        ]);
        const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]));
        const tags = await tagsFor(db, rows.map((row) => row.id));
        const name = (tx: Transaction) => (tx.goalId ? (goalNames.get(tx.goalId) ?? "") : nameOf(tx.categoryId));
        await shareTextFile(`voidspend-${label}.csv`, buildCsv(rows, { nameOf: name, includeLocation: includePlaces, tagsOf: (tx) => tags.get(tx.id) ?? [] }), "text/csv");
      }
    } catch (error) {
      console.warn("Export failed", error);
      show({ message: t.insights.exportFailed });
    } finally {
      setBusy(null);
    }
  };

  const openCategory = (categoryId: string) => {
    const { from, endExclusive } = periodRange(period);
    // History opens on the same wallet, so the list adds up to the slice that was tapped.
    router.navigate({ pathname: "/history", params: { category: categoryId, from, to: addDays(endExclusive, -1), wallet: walletId ?? "" } });
  };

  const saved = data ? data.totals.savingDeposit - data.totals.savingWithdrawal : 0;

  // The calendar: only for a month with spending. The day shown below it is the one tapped, or the busiest one.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const grid = useMemo(() => (data && period.kind === "month" && data.totals.expense > 0 ? buildMonthGrid(period.month, data.daily) : null), [data, period]);
  const cells = grid ? grid.weeks.flat().flatMap((cell) => (cell ? [cell] : [])) : [];
  const shown = cells.find((cell) => cell.date === pickedDay) ?? grid?.busiest ?? null;
  const openDay = (date: string) =>
    router.navigate({ pathname: "/history", params: { category: "", from: date, to: date, wallet: walletId ?? "", tag: "" } });

  return (
    <Screen bottomInset={DOCK_SPACE}>
      <Text variant="title" accessibilityRole="header">
        {t.insights.title}
      </Text>
      <View style={styles.gap}>
        <Segmented
          label={t.insights.period}
          options={[
            { value: "month", label: t.insights.month },
            { value: "year", label: t.insights.year },
          ]}
          value={period.kind}
          onChange={changeKind}
        />
        <View style={styles.periodRow}>
          <IconButton icon="chevron-back" label={t.insights.previous} onPress={() => setPeriod(shiftPeriod(period, -1))} />
          <Text variant="bodyLg" accessibilityLiveRegion="polite">
            {periodLabel(period, t)}
          </Text>
          <IconButton icon="chevron-forward" label={t.insights.next} disabled={atLatest} onPress={() => setPeriod(shiftPeriod(period, 1))} />
        </View>
        {walletList.length > 1 ? (
          <View style={styles.chips}>
            <Chip label={t.wallets.filterAll} selected={walletId === null} onPress={() => setWalletPick(null)} />
            {walletList.map((item) => (
              <Chip key={item.id} label={walletName(item, t)} selected={walletId === item.id} onPress={() => setWalletPick(item.id)} />
            ))}
          </View>
        ) : null}
      </View>

      {data === undefined ? (
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.gap}>
          <Skeleton height={120} radius={22} />
          <Skeleton height={220} radius={22} />
        </View>
      ) : !data.hasData ? (
        <Surface variant="smoke" style={styles.gap}>
          <EmptyState source={require("../../assets/mascot/what2.png")} title={t.insights.emptyTitle} body={t.insights.emptyBody} />
        </Surface>
      ) : (
        <>
          <Surface variant="glass" radius="hero" elevated padding={20} style={[styles.gap, styles.summary]}>
            {/* For one wallet this is what moved through it in the period, not what it holds, so it is named that and not shown as a warning. */}
            <Text variant="label" tone="secondary">
              {walletId ? t.insights.net : t.insights.left}
            </Text>
            <Amount value={data.left} size="lg" maxWidth={300} tone={walletId ? "primary" : undefined} />
            {data.savingsRate !== null ? (
              <Text variant="caption" tone="secondary">
                {`${t.insights.savingsRate}: ${t.insights.percent(data.savingsRate * 100)}`}
              </Text>
            ) : null}
            <View style={[styles.stats, largeText && styles.statsStacked]}>
              <Stat label={t.insights.income} value={data.totals.income} kind="income" change={changeText(data.changes.income)} stacked={largeText} />
              <Stat label={t.insights.spent} value={data.totals.expense} kind="expense" change={changeText(data.changes.expense)} stacked={largeText} />
              <Stat label={t.insights.saved} value={saved} kind="saving" change={changeText(data.changes.saving)} stacked={largeText} />
            </View>
            {data.changes.income === null && data.changes.expense === null && data.changes.saving === null ? (
              <Text variant="micro" tone="secondary">
                {t.insights.noBaseline}
              </Text>
            ) : null}
          </Surface>

          {slices.length > 0 ? (
            <Section title={t.insights.categories}>
              <Surface variant="smoke" padding={16} style={styles.donutBox}>
                <Donut
                  size={200}
                  strokeWidth={26}
                  label={t.insights.donutLabel(formatRupiah(data.totals.expense))}
                  slices={slices.map((slice) => ({ key: slice.key, value: slice.value, color: categoryColor(color, slice.colorToken) }))}
                  onSelect={(key) => slices.find((slice) => slice.key === key)?.categoryId && openCategory(key)}
                >
                  <Text variant="caption" tone="secondary">
                    {t.insights.spent}
                  </Text>
                  <Amount value={data.totals.expense} size="md" kind="neutral" />
                </Donut>
              </Surface>
              <Surface variant="smoke" padding={8}>
                {slices.map((slice, index) => (
                  <ListRow
                    key={slice.key}
                    title={slice.label}
                    subtitle={t.insights.percent(slice.share * 100)}
                    leading={<View style={[styles.swatch, { backgroundColor: categoryColor(color, slice.colorToken) }]} />}
                    trailing={<Amount value={slice.value} size="sm" kind="neutral" />}
                    onPress={slice.categoryId ? () => openCategory(slice.categoryId!) : undefined}
                    chevron={false}
                    accessibilityLabel={slice.categoryId ? t.insights.openCategory(slice.label) : undefined}
                    divider={index < slices.length - 1}
                  />
                ))}
              </Surface>
            </Section>
          ) : null}

          <Section title={t.insights.trend}>
            <Surface variant="smoke" padding={16} style={styles.gap}>
              <Bars
                groups={data.bars.map((bar) => ({
                  key: bar.month,
                  label: t.dates.monthsShort[Number(bar.month.slice(5, 7)) - 1],
                  income: bar.income,
                  expense: bar.expense,
                  description: t.insights.barSummary(formatMonthLabel(bar.month, t), formatRupiah(bar.income), formatRupiah(bar.expense)),
                }))}
              />
              <View style={styles.legend}>
                <Legend color={color.accent} label={t.insights.income} />
                <Legend color={color.textSecondary} label={t.insights.spent} />
              </View>
            </Surface>
          </Section>

          {grid ? (
            <Section title={t.insights.calendarTitle}>
              <Surface variant="smoke" padding={16} style={styles.gap}>
                <CalendarHeat
                  weekdays={mondayFirst(t.dates.weekdaysShort)}
                  weeks={grid.weeks.map((week) =>
                    week.map((cell) =>
                      cell
                        ? {
                            date: cell.date,
                            day: cell.day,
                            step: cell.step,
                            today: cell.date === clock.today,
                            label: t.insights.calendarDayLabel(formatFullDate(cell.date, t), cell.total > 0 ? formatRupiah(cell.total) : null, cell.date === clock.today),
                          }
                        : null,
                    ),
                  )}
                  selected={shown?.date ?? null}
                  onSelect={setPickedDay}
                  lessLabel={t.insights.calendarLess}
                  moreLabel={t.insights.calendarMore}
                />
                {shown ? (
                  <View style={styles.readout} accessibilityLiveRegion="polite">
                    <Text variant="body">{t.insights.calendarReadout(formatFullDate(shown.date, t), shown.total > 0 ? formatRupiah(shown.total) : null)}</Text>
                    {grid.busiest && shown.date !== grid.busiest.date ? (
                      <Text variant="caption" tone="secondary">
                        {t.insights.calendarBusiest(formatFullDate(grid.busiest.date, t), formatRupiah(grid.busiest.total))}
                      </Text>
                    ) : null}
                    {shown.total > 0 ? <Button label={t.insights.calendarOpenDay} variant="secondary" size="sm" onPress={() => openDay(shown.date)} /> : null}
                  </View>
                ) : null}
              </Surface>
            </Section>
          ) : null}

          {data.merchants.length > 0 ? (
            <Section title={t.insights.merchants}>
              <Surface variant="smoke" padding={8}>
                {data.merchants.map((merchant, index) => (
                  <ListRow key={merchant.name} title={merchant.name} subtitle={t.insights.merchantCount(merchant.count)} trailing={<Amount value={merchant.total} size="sm" kind="neutral" />} divider={index < data.merchants.length - 1} />
                ))}
              </Surface>
            </Section>
          ) : null}

          <Section title={t.insights.export}>
            <View style={styles.gap}>
              <SwitchRow label={t.place.includeInExport} value={includePlaces} onValueChange={setIncludePlaces} />
              <Button label={t.insights.csv} icon="document-text-outline" variant="secondary" loading={busy === "csv"} onPress={() => runExport("csv")} fullWidth />
              <Button label={t.insights.pdf} icon="print-outline" variant="secondary" loading={busy === "pdf"} onPress={() => runExport("pdf")} fullWidth />
            </View>
          </Section>
        </>
      )}

      <Surface variant="smoke" padding={8} style={styles.section}>
        <ListRow title={t.insights.budgets} subtitle={t.insights.openBudgets} onPress={() => router.push("/budgets")} />
      </Surface>
    </Screen>
  );
}

function Stat({ label, value, kind, change, stacked }: { label: string; value: number; kind: "income" | "expense" | "saving"; change: string | null; stacked: boolean }) {
  // With large system text the three stats stack, each as a row with the label on the left and the amount on the right.
  return (
    <View style={stacked ? styles.statRow : styles.stat}>
      <View style={styles.statLabel}>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        {change ? (
          <Text variant="micro" tone="secondary">
            {change}
          </Text>
        ) : null}
      </View>
      <Amount value={value} kind={kind} size="sm" />
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12, marginTop: 12 },
  periodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  readout: { gap: 8, alignItems: "flex-start" },
  summary: { alignItems: "center" },
  stats: { flexDirection: "row", alignSelf: "stretch", justifyContent: "space-between", marginTop: 8 },
  statsStacked: { flexDirection: "column", gap: 12 },
  stat: { gap: 2 },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  statLabel: { gap: 2, flexShrink: 1 },
  section: { marginTop: 24, gap: 12 },
  donutBox: { alignItems: "center" },
  swatch: { width: 16, height: 16, borderRadius: 5 },
  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
