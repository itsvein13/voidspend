import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { useDb } from "@/db/DatabaseProvider";
import { getMeta, setMeta } from "@/db/repo/meta";
import type { Location as Place } from "@/db/repo/transactions";
import { Banner, Button, Field, Text } from "@/design";
import { useT } from "@/i18n";

import { readCurrentPlace, type LocationOutcome } from "./location";

type Message = Extract<LocationOutcome, { status: "denied" | "unavailable" | "timeout" }>;

/**
 * Adds a place to a transaction, only when the person asks. They can type a name,
 * or tap once to read the device location. The first tap explains what happens;
 * a denied permission leaves typing available.
 */
export function PlaceField({ value, onChange }: { value: Place | null; onChange: (place: Place | null) => void }) {
  const t = useT();
  const db = useDb();
  const [explaining, setExplaining] = useState(false);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<Message | null>(null);

  const read = async () => {
    setExplaining(false);
    setProblem(null);
    setReading(true);
    try {
      const outcome = await readCurrentPlace();
      if (outcome.status === "ok") onChange({ ...outcome.place, name: outcome.place.name ?? value?.name ?? null });
      else setProblem(outcome);
    } finally {
      setReading(false);
    }
  };

  const start = async () => {
    if ((await getMeta(db, "location_explained")) === "1") return read();
    setExplaining(true);
  };

  return (
    <View style={styles.block}>
      <Field
        label={t.place.field}
        value={value?.name ?? ""}
        onChangeText={(name) => onChange(name === "" && value?.lat == null ? null : { name, lat: value?.lat ?? null, lng: value?.lng ?? null, source: value?.lat != null ? "device" : "manual" })}
        optional
        maxLength={120}
        helper={value?.lat != null ? t.place.haveCoords : undefined}
      />
      {explaining ? (
        <Banner
          tone="info"
          title={t.place.explainTitle}
          message={t.place.explainBody}
          actionLabel={t.place.continue}
          onAction={async () => {
            await setMeta(db, "location_explained", "1");
            await read();
          }}
          onDismiss={() => setExplaining(false)}
        />
      ) : null}
      {problem ? (
        <View style={styles.block}>
          <Banner tone="warning" message={problem.status === "denied" ? t.place.denied : problem.status === "unavailable" ? t.place.unavailable : t.place.timeout} />
          {problem.status === "denied" && !problem.canAskAgain ? <Button label={t.place.openSettings} variant="quiet" size="sm" onPress={() => Linking.openSettings()} /> : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <Button label={t.place.useCurrent} icon="locate-outline" variant="secondary" size="sm" loading={reading} onPress={start} />
        {value ? <Button label={t.place.clear} variant="quiet" size="sm" onPress={() => onChange(null)} /> : null}
      </View>
      {reading ? (
        <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          {t.place.reading}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
