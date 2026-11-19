import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { useDb, useQuery, useWrite } from "@/db/DatabaseProvider";
import { listGoals } from "@/db/repo/goals";
import { tagsFor } from "@/db/repo/tags";
import { clearAllLocations, listTransactions, type Transaction } from "@/db/repo/transactions";
import { useCategories } from "../categories/categories";
import { buildCsv } from "../export/csv";
import { shareTextFile } from "../export/share";
import { LEGACY_REPORT_KEY, type ImportReport } from "@/db/legacy/import";
import { getMeta, setMeta } from "@/db/repo/meta";
import { listRecurringRules } from "@/db/repo/recurring";
import { Button, Field, ListRow, Screen, Segmented, SheetHeader, Surface, SwitchRow, Text, useSnackbar, useTheme } from "@/design";
import { categoryLabel, useLanguage, useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { formatShortDate } from "@/lib/dateLabels";
import { localDateOf } from "@/lib/dates";
import { usePrefs } from "@/lib/PrefsProvider";
import type { LanguagePref, ThemeMode } from "@/lib/prefs";

import { shareBackup } from "../backup/io";
import { authenticate, canUseLock } from "../lock/lock";
import { getUsername, setUsername } from "../profile/profile";

const SAWERIA_URL = "https://saweria.co/vein13";

export function SettingsScreen() {
  const t = useT();
  const router = useRouter();
  const name = useQuery(["username"], async (db) => (await getUsername(db)) ?? "");
  const report = useQuery(["import-report"], async (db) => {
    const saved = await getMeta(db, LEGACY_REPORT_KEY);
    return saved ? (JSON.parse(saved) as ImportReport) : null;
  });
  const hasSalary = useQuery(["has-salary"], async (db) =>
    (await listRecurringRules(db)).some((rule) => rule.type === "income" && rule.categoryId === "sys_salary" && rule.pausedAt === null),
  );
  const db = useDb();
  const write = useWrite();
  const { show } = useSnackbar();
  const { byId } = useCategories();
  const exportAll = async () => {
    try {
      const [rows, goals] = await Promise.all([listTransactions(db, {}), listGoals(db, { includeArchived: true })]);
      const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]));
      const tags = await tagsFor(db, rows.map((row) => row.id));
      const nameOf = (tx: Transaction) => (tx.goalId ? (goalNames.get(tx.goalId) ?? "") : tx.categoryId && byId.get(tx.categoryId) ? categoryLabel(byId.get(tx.categoryId)!, t) : "");
      await shareTextFile("voidspend-all.csv", buildCsv(rows, { nameOf, tagsOf: (tx) => tags.get(tx.id) ?? [] }), "text/csv");
    } catch {
      show({ message: t.insights.exportFailed });
    }
  };
  const keepPhotos = useQuery(["keep-photos"], async (database) => (await getMeta(database, "keep_receipt_photos")) !== "0");
  const placesOn = useQuery(["places-enabled"], async (database) => (await getMeta(database, "location_enabled")) !== "0");
  const { mode, setMode } = useTheme();
  const { pref, setPref } = useLanguage();
  const { prefs, setPrefs } = usePrefs();

  // Turning the lock on asks the person to verify first, so a lock that cannot be opened is never saved.
  const toggleLock = async (on: boolean) => {
    if (!on) return setPrefs({ appLock: false });
    if (!(await canUseLock())) return show({ message: t.lock.unavailable });
    if (!(await authenticate(t.lock.prompt, t.common.cancel))) return show({ message: t.lock.failed });
    setPrefs({ appLock: true });
  };
  const backUp = async () => {
    try {
      await shareBackup(db, getClock().today);
    } catch {
      show({ message: t.insights.exportFailed });
    }
  };

  const themeOptions = [
    { value: "system", label: t.settings.theme.system },
    { value: "dark", label: t.settings.theme.dark },
    { value: "light", label: t.settings.theme.light },
  ] as const satisfies readonly { value: ThemeMode; label: string }[];
  const languageOptions = [
    { value: "system", label: t.settings.language.system },
    { value: "id", label: "ID" },
    { value: "en", label: "EN" },
  ] as const satisfies readonly { value: LanguagePref; label: string }[];

  const imported = report.data;
  const importedText = imported && imported.status === "imported" ? t.profile.importedOn(formatShortDate(localDateOf(imported.importedAt, 0), t)) : t.profile.noImport;

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.profile.title} onClose={() => router.back()} grabber={false} />

      {name.data !== undefined ? <NameField initial={name.data} /> : null}

      <Segmented label={t.settings.theme.title} options={themeOptions} value={mode} onChange={setMode} />
      <Segmented label={t.settings.language.title} options={languageOptions} value={pref} onChange={setPref} />
      <Surface variant="smoke" padding={12}>
        <SwitchRow label={t.settings.reduceMotion.title} description={t.settings.reduceMotion.description} value={prefs.reduceMotion} onValueChange={(value) => setPrefs({ reduceMotion: value })} />
        <SwitchRow label={t.settings.haptics.title} description={t.settings.haptics.description} value={prefs.haptics} onValueChange={(value) => setPrefs({ haptics: value })} />
        <SwitchRow label={t.lock.enable} description={t.lock.help} value={prefs.appLock} onValueChange={toggleLock} />
      </Surface>

      {hasSalary.data === false ? (
        <Surface variant="smoke" padding={8}>
          <ListRow title={t.home.salaryTitle} subtitle={t.home.salaryBody} onPress={() => router.push("/salary")} />
        </Surface>
      ) : null}

      <Surface variant="smoke" padding={8}>
        <ListRow title={t.wallets.title} onPress={() => router.push("/wallets")} divider />
        <ListRow title={t.more.budgets} onPress={() => router.push("/budgets")} divider />
        <ListRow title={t.more.categories} onPress={() => router.push("/categories")} divider />
        <ListRow title={t.tags.title} onPress={() => router.push("/tags")} divider />
        <ListRow title={t.more.recurring} onPress={() => router.push("/recurring")} divider />
        <ListRow title={t.trash.title} onPress={() => router.push("/deleted")} />
      </Surface>

      <Text variant="heading" accessibilityRole="header">
        {t.profile.data}
      </Text>
      <Surface variant="smoke" padding={16} style={styles.stack}>
        <SwitchRow label={t.place.enabled} description={t.place.enabledHelp} value={placesOn.data ?? true} onValueChange={(on) => void write((database) => setMeta(database, "location_enabled", on ? "1" : "0"))} />
        <Button label={t.place.deleteAll} variant="quiet" onPress={async () => show({ message: t.place.deleted(await write((database) => clearAllLocations(database))) })} fullWidth />
        <SwitchRow label={t.scan.review.keepPhotos} description={t.scan.review.keepPhotosHelp} value={keepPhotos.data ?? true} onValueChange={(on) => void write((database) => setMeta(database, "keep_receipt_photos", on ? "1" : "0"))} />
        <Button label={t.more.exportAll} variant="secondary" icon="download-outline" onPress={exportAll} fullWidth />
        <Button label={t.backup.create} variant="secondary" icon="save-outline" onPress={backUp} fullWidth />
        <Text variant="caption" tone="secondary">
          {t.backup.createHelp}
        </Text>
        <Button label={t.backup.restore} variant="secondary" icon="refresh-outline" onPress={() => router.push("/restore")} fullWidth />
        <Button label={t.more.reset} variant="quiet" onPress={() => router.push("/reset")} fullWidth />
        <Text variant="body">{importedText}</Text>
        {imported?.backupPath ? (
          <Text variant="caption" tone="secondary">{`${t.profile.backup}: ${imported.backupPath}`}</Text>
        ) : null}
      </Surface>

      <Text variant="heading" accessibilityRole="header">
        {t.profile.about}
      </Text>
      <Surface variant="smoke" padding={16} style={styles.stack}>
        <Text variant="body">{`VOIDSPEND ${t.profile.version(Constants.expoConfig?.version ?? "")}`}</Text>
        <Button label={t.profile.support} variant="secondary" onPress={() => Linking.openURL(SAWERIA_URL)} fullWidth />
      </Surface>
    </Screen>
  );
}

function NameField({ initial }: { initial: string }) {
  const t = useT();
  const write = useWrite();
  const [value, setValue] = useState(initial);
  return (
    <View>
      <Field label={t.profile.name} value={value} onChangeText={setValue} autoCapitalize="words" maxLength={40} onBlur={() => void write((db) => setUsername(db, value))} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  stack: { gap: 12 },
});
