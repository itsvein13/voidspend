// Dev-only screen for the data layer (milestone M2). It uses its own database
// file (voidspend-dev.db), so it never touches the real data, and it reads the
// real v1 keys only when you press the "real" import. Hidden from the tab bar,
// redirects away in a release build. Open: exp://<host>:<port>/--/dev-data
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Amount, Banner, Button, DesignProvider, ListRow, Screen, Surface, Text } from "@/design";
import { DatabaseProvider, useDb, useQuery, useWrite } from "@/db/DatabaseProvider";
import { writeBackupFile } from "@/db/legacy/backup";
import { runLegacyImport, type ImportResult, type ImportStorage } from "@/db/legacy/import";
import { sampleLegacyRaw } from "@/db/legacy/sample";
import { listBudgetRules } from "@/db/repo/budgets";
import { listGoals } from "@/db/repo/goals";
import {
  createRecurringRule,
  listRecurringRules,
  pendingOccurrences,
  postOccurrence,
  skipOccurrence,
  type Clock,
} from "@/db/repo/recurring";
import { createTransaction, listTransactions, monthTotals } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { currentOffsetMinutes, localDateOf, localTimeOf, monthOf } from "@/lib/dates";
import { deviceTimeZone } from "@/lib/device";
import { remaining } from "@/lib/finance";
import { formatRupiah } from "@/lib/money";

export default function DevDataRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <DesignProvider>
      <DatabaseProvider
        name="voidspend-dev.db"
        loading={<Notice text="Opening the dev database" />}
        renderError={(error) => <Notice text={`The database could not be opened: ${error.message}`} />}
      >
        <DevData />
      </DatabaseProvider>
    </DesignProvider>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <DesignProvider>
      <Screen>
        <Text variant="body">{text}</Text>
      </Screen>
    </DesignProvider>
  );
}

const sampleStorage: ImportStorage = { getItem: async (key) => sampleLegacyRaw()[key as keyof ReturnType<typeof sampleLegacyRaw>] ?? null };

function clockNow(): Clock {
  return { offsetMin: currentOffsetMinutes(), tz: deviceTimeZone() ?? "UTC", now: Date.now() };
}

function DevData() {
  const db = useDb();
  const write = useWrite();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const overview = useQuery(["overview"], async (database) => {
    const clock = clockNow();
    const today = localDateOf(clock.now, clock.offsetMin);
    const version = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const months = await database.getAllAsync<{ month: string }>(
      "SELECT DISTINCT substr(occurred_local_date, 1, 7) AS month FROM transactions WHERE deleted_at IS NULL ORDER BY month DESC LIMIT 6",
    );
    const monthLines = await Promise.all(
      months.map(async ({ month }) => {
        const totals = await monthTotals(database, month);
        return { month, totals, left: remaining(totals) };
      }),
    );
    return {
      today,
      version: version?.user_version ?? 0,
      monthLines,
      recent: await listTransactions(database, { limit: 8 }),
      goals: await listGoals(database),
      budgets: await listBudgetRules(database),
      rules: await listRecurringRules(database),
      pending: await pendingOccurrences(database, today),
    };
  });
  const data = overview.data;

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await write(task);
    } finally {
      setBusy(null);
    }
  };

  const importFrom = (label: string, storage: ImportStorage) =>
    run(label, async () => {
      setResult(await runLegacyImport(db, { storage, writeBackup: writeBackupFile, ctx: clockNow() }));
    });

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        Data layer
      </Text>
      <Text variant="body" tone="secondary">
        {`Dev database, schema version ${data?.version ?? "..."}. Today is ${data?.today ?? "..."}.`}
      </Text>

      <View style={styles.stack}>
        <Button label="Import sample v1 data" loading={busy === "sample"} onPress={() => importFrom("sample", sampleStorage)} />
        <Button label="Import real v1 data (read only)" variant="secondary" loading={busy === "real"} onPress={() => importFrom("real", AsyncStorage)} />
        <Button
          label="Add expense Rp 25.000 now"
          variant="secondary"
          onPress={() =>
            run("expense", async () => {
              const clock = clockNow();
              await createTransaction(db, {
                type: "expense",
                amount: 25_000,
                title: "Kopi",
                categoryId: systemCategoryId("food"),
                occurredAt: clock.now,
                offsetMin: clock.offsetMin,
                tz: clock.tz,
                timePrecision: "exact",
              });
            })
          }
        />
        <Button
          label="Create salary rule (day 25, asks first)"
          variant="secondary"
          onPress={() =>
            run("rule", async () => {
              await createRecurringRule(db, {
                type: "income",
                amount: 5_000_000,
                title: "Salary",
                categoryId: systemCategoryId("salary"),
                frequency: "monthly",
                dayOfMonth: 25,
                startDate: monthOf(data?.today ?? "2026-11-01") + "-01",
              });
            })
          }
        />
        <Button
          label="Clear dev data"
          variant="quiet"
          onPress={() =>
            run("clear", async () => {
              await db.withTransactionAsync(async () => {
                await db.execAsync(
                  `DELETE FROM transaction_tags; DELETE FROM transactions; DELETE FROM receipt_items; DELETE FROM receipts;
                   DELETE FROM budgets; DELETE FROM recurring_rules; DELETE FROM goals;
                   DELETE FROM categories WHERE system_key IS NULL; DELETE FROM app_meta;`,
                );
              });
              setResult(null);
            })
          }
        />
      </View>

      {result ? <ResultBanner result={result} /> : null}

      <Section title="Months">
        {data?.monthLines.length ? (
          data.monthLines.map((line) => (
            <ListRow
              key={line.month}
              title={line.month}
              subtitle={`Income ${formatRupiah(line.totals.income)}, spent ${formatRupiah(line.totals.expense)}, saved ${formatRupiah(line.totals.savingDeposit - line.totals.savingWithdrawal)}`}
              trailing={<Amount value={line.left} size="sm" />}
              divider
            />
          ))
        ) : (
          <Text variant="body" tone="secondary">
            No transactions yet. Import the sample data or add an expense.
          </Text>
        )}
      </Section>

      <Section title="Recent">
        {data?.recent.map((tx) => (
          <ListRow
            key={tx.id}
            title={tx.title}
            subtitle={`${tx.occurredLocalDate}${tx.timePrecision === "exact" ? ` ${localTimeOf(tx.occurredAt, tx.occurredOffsetMin)}` : ""}, ${tx.source}, ${(tx.categoryId ?? "goal").replace("sys_", "")}`}
            trailing={<Amount value={tx.type === "income" ? tx.amount : tx.type === "expense" ? tx.amount : tx.amount} kind={tx.type === "income" ? "income" : tx.type === "expense" ? "expense" : "saving"} size="sm" />}
            divider
          />
        ))}
      </Section>

      <Section title="Goals">
        {data?.goals.length ? (
          data.goals.map((goal) => (
            <ListRow
              key={goal.id}
              title={goal.name}
              subtitle={goal.progress.pct === null ? "No target" : `${Math.round(goal.progress.pct)} percent of ${formatRupiah(goal.targetAmount ?? 0)}`}
              trailing={<Amount value={goal.saved} kind="saving" size="sm" />}
              divider
            />
          ))
        ) : (
          <Text variant="body" tone="secondary">
            No goals.
          </Text>
        )}
        <Text variant="caption" tone="secondary">{`${data?.budgets.length ?? 0} budget rules`}</Text>
      </Section>

      <Section title="Recurring">
        {data?.pending.length ? (
          data.pending.map(({ rule, dates }) => (
            <View key={rule.id} style={styles.stack}>
              <Text variant="body">{`${rule.title} ${formatRupiah(rule.amount)} is due: ${dates.join(", ")}`}</Text>
              <View style={styles.row}>
                <Button
                  label="Record"
                  size="sm"
                  onPress={() => run("record", async () => void (await postOccurrence(db, rule, dates[0], clockNow())))}
                />
                <Button
                  label="Skip"
                  size="sm"
                  variant="quiet"
                  onPress={() => run("skip", async () => skipOccurrence(db, rule, dates[0]))}
                />
              </View>
            </View>
          ))
        ) : (
          <Text variant="body" tone="secondary">{`${data?.rules.length ?? 0} rules, nothing due.`}</Text>
        )}
      </Section>
    </Screen>
  );
}

function ResultBanner({ result }: { result: ImportResult }) {
  if (result.status === "failed") {
    return <Banner tone="danger" title={`Import stopped: ${result.reason}`} message={result.message} />;
  }
  if (result.status === "already_done") {
    return <Banner tone="info" title="Already imported" message="The v1 data was imported before. Clear the dev data to try again." />;
  }
  const { report } = result;
  if (result.status === "nothing") {
    return <Banner tone="info" title="Nothing to import" message="No v1 data was found on this device." />;
  }
  const c = report.counts;
  return (
    <Banner
      tone={report.skipped.length ? "warning" : "success"}
      title="Imported and checked"
      message={`${c.expenses} expenses, ${c.savings} savings in ${c.goals} goals, ${c.salaries} salaries, ${c.budgets} budgets, ${c.newCategories} new categories. Counts and totals per month match v1. ${report.skipped.length} rows skipped${report.skipped.length ? ` (${report.skipped.map((s) => `${s.table} ${s.ref}: ${s.reason}`).join("; ")})` : ""}. Backup: ${report.backupPath}`}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Surface variant="smoke" padding={16} style={styles.stack}>
        {children}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, marginTop: 12 },
  row: { flexDirection: "row", gap: 12 },
  section: { marginTop: 24, gap: 4 },
});
