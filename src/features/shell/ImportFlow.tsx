import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { writeBackupFile } from "@/db/legacy/backup";
import { runLegacyImport, type ImportReport, type ImportResult } from "@/db/legacy/import";
import type { MonthLine } from "@/db/legacy/plan";
import { useDb } from "@/db/DatabaseProvider";
import { Amount, Banner, Button, ListRow, Screen, Skeleton, Surface, Text } from "@/design";
import { useT } from "@/i18n";
import { formatMonthLabel } from "@/lib/dateLabels";
import { getClock } from "@/lib/clock";

/** Money left per month, worked out from the checked totals of the report. */
export function monthsLeft(lines: readonly MonthLine[]): { month: string; left: number }[] {
  const byMonth = new Map<string, number>();
  for (const line of lines) {
    const sign = line.type === "income" ? 1 : -1;
    byMonth.set(line.month, (byMonth.get(line.month) ?? 0) + sign * line.total);
  }
  return [...byMonth.entries()].map(([month, left]) => ({ month, left })).sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Runs the one-time import of the v1 data and tells the person what moved.
 * `onDone` is called after they continue. Nothing is hidden: the counts, the
 * rows that could not be moved and where the backup copy is saved are shown.
 */
export function ImportFlow({ onDone }: { onDone: () => void }) {
  const db = useDb();
  const t = useT();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    let alive = true;
    runLegacyImport(db, { storage: AsyncStorage, writeBackup: writeBackupFile, ctx: getClock() }).then(
      (value) => alive && setResult(value),
      (error) => alive && setResult({ status: "failed", reason: "unexpected", message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      alive = false;
    };
  }, [db, attempt]);

  if (result === null) {
    return (
      <Screen>
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.stack}>
          <Text variant="title" accessibilityRole="header">
            {t.importFlow.runningTitle}
          </Text>
          <Text variant="body" tone="secondary">
            {t.importFlow.runningBody}
          </Text>
          <Skeleton height={20} width="70%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="85%" />
        </View>
      </Screen>
    );
  }

  if (result.status === "failed") {
    return (
      <Screen>
        <View style={styles.stack}>
          <Text variant="title" accessibilityRole="header">
            {t.importFlow.failedTitle}
          </Text>
          <Banner tone="danger" message={`${t.importFlow.failedBody} (${result.message})`} />
          <Button label={t.importFlow.retry} onPress={() => {
              setResult(null);
              setAttempt((n) => n + 1);
            }} fullWidth />
          <Button label={t.importFlow.later} variant="quiet" onPress={onDone} fullWidth />
        </View>
      </Screen>
    );
  }

  const report: ImportReport | null = result.report;
  if (!report || result.status === "already_done" || result.status === "nothing") {
    // Nothing to show. The gate only mounts this flow when there is v1 data, so this is a rerun.
    return (
      <Screen>
        <View style={styles.stack}>
          <Button label={t.importFlow.continue} onPress={onDone} fullWidth />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.stack}>
        <Text variant="title" accessibilityRole="header">
          {t.importFlow.doneTitle}
        </Text>
        <Text variant="body" tone="secondary">
          {t.importFlow.counts(report.counts.expenses, report.counts.savings, report.counts.salaries)}
        </Text>
        {report.skipped.length > 0 ? <Banner tone="warning" message={t.importFlow.skipped(report.skipped.length)} /> : null}
        <Text variant="heading" accessibilityRole="header">
          {t.importFlow.months}
        </Text>
        <Surface variant="smoke" padding={16}>
          {monthsLeft(report.lines).map((line, index, all) => (
            <ListRow key={line.month} title={formatMonthLabel(line.month, t)} trailing={<Amount value={line.left} size="sm" />} divider={index < all.length - 1} />
          ))}
        </Surface>
        {report.backupPath ? (
          <Text variant="caption" tone="secondary">{`${t.importFlow.backup} ${report.backupPath}`}</Text>
        ) : null}
        <Button label={t.importFlow.continue} onPress={onDone} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
});
