import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { useDb } from "@/db/DatabaseProvider";
import { Banner, Button, Field, Screen, SheetHeader, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { formatShortDate } from "@/lib/dateLabels";
import { getClock } from "@/lib/clock";
import { localDateOf } from "@/lib/dates";

import { useGateRestart } from "../shell/AppGate";
import { parseBackup, restoreBackup, summarize, type Backup } from "./backup";
import { pickBackupText } from "./io";

/** Replaces everything on the phone with a backup file. The person picks the file, sees what is in it, and types a word. */
export function RestoreScreen() {
  const t = useT();
  const router = useRouter();
  const db = useDb();
  const restart = useGateRestart();
  const { show } = useSnackbar();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim().toLowerCase() === t.backup.word.toLowerCase();

  const choose = async () => {
    setError(null);
    setBackup(null);
    try {
      const text = await pickBackupText();
      if (text === null) return;
      const parsed = parseBackup(text);
      if (parsed.ok) setBackup(parsed.backup);
      else setError(parsed.reason === "newer" ? t.backup.newer : parsed.reason === "damaged" ? t.backup.damaged : t.backup.notBackup);
    } catch {
      setError(t.backup.pickFailed);
    }
  };

  const summary = backup ? summarize(backup) : null;

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.backup.restoreTitle} onClose={() => router.back()} grabber={false} />
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button label={t.backup.restore} variant={backup ? "secondary" : "primary"} icon="document-outline" onPress={choose} fullWidth />
      {backup && summary ? (
        <>
          <Text variant="body">{t.backup.summary(formatShortDate(localDateOf(summary.createdAt, getClock().offsetMin), t, getClock().today), summary.transactions, summary.goals)}</Text>
          <Banner tone="danger" message={t.backup.warning} />
          <Field label={t.backup.field} value={typed} onChangeText={setTyped} helper={t.backup.prompt(t.backup.word)} autoCapitalize="characters" autoCorrect={false} />
          <Button
            label={t.backup.action}
            variant="destructive"
            disabled={!confirmed}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await restoreBackup(db, backup);
                show({ message: t.backup.done });
                restart();
              } catch (cause) {
                setError(errorMessage(cause, t));
                setBusy(false);
              }
            }}
            fullWidth
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
});
