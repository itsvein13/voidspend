import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { useDb } from "@/db/DatabaseProvider";
import { Banner, Button, Field, Screen, SheetHeader } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";

import { useGateRestart } from "../shell/AppGate";
import { resetAllData } from "./reset";

/** Deleting everything needs the person to type a word, so it cannot happen by a stray tap. */
export function ResetScreen() {
  const t = useT();
  const router = useRouter();
  const db = useDb();
  const restart = useGateRestart();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim().toLowerCase() === t.reset.word.toLowerCase();

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.reset.title} onClose={() => router.back()} grabber={false} />
      <Banner tone="danger" message={t.reset.body} />
      <Field label={t.reset.field} value={typed} onChangeText={setTyped} helper={t.reset.prompt(t.reset.word)} autoCapitalize="characters" autoCorrect={false} />
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button
        label={t.reset.action}
        variant="destructive"
        disabled={!confirmed}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await resetAllData(db);
            restart();
          } catch (cause) {
            setError(errorMessage(cause, t));
            setBusy(false);
          }
        }}
        fullWidth
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
});
