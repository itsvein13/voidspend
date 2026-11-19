import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery } from "@/db/DatabaseProvider";
import { cleanTagNames, listTags, MAX_TAG_LENGTH } from "@/db/repo/tags";
import { Button, Chip, Field, Text } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";

/**
 * The tags of a transaction: the ones applied (tap to take one off), a box to type a new one, and the ones used
 * before as suggestions. Nothing is saved here. The sheet saves them with the transaction.
 */
export function TagField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const t = useT();
  const known = useQuery(["tags"], (db) => listTags(db));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = (raw: string) => {
    if (raw.trim() === "") return;
    try {
      onChange(cleanTagNames([...value, raw]));
      setDraft("");
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  };
  const remove = (name: string) => onChange(value.filter((item) => item !== name));

  const applied = new Set(value.map((name) => name.toLowerCase()));
  const suggestions = (known.data ?? []).filter((tag) => tag.count > 0 && !applied.has(tag.name.toLowerCase())).slice(0, 8);

  return (
    <View style={styles.box}>
      <Field
        label={t.tags.field}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setError(null);
        }}
        placeholder={t.tags.placeholder}
        optional
        maxLength={MAX_TAG_LENGTH + 1}
        error={error ?? undefined}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={() => add(draft)}
      />
      {draft.trim() !== "" ? (
        <View style={styles.start}>
          <Button label={t.tags.add} icon="add" variant="secondary" size="sm" onPress={() => add(draft)} />
        </View>
      ) : null}
      {value.length > 0 ? (
        <View style={styles.wrap}>
          {value.map((name) => (
            <Chip key={name} label={`#${name}`} selected onPress={() => remove(name)} />
          ))}
        </View>
      ) : null}
      {suggestions.length > 0 ? (
        <View style={styles.box}>
          <Text variant="caption" tone="secondary">
            {t.tags.usedBefore}
          </Text>
          <View style={styles.wrap}>
            {suggestions.map((tag) => (
              <Chip key={tag.id} label={`#${tag.name}`} icon="add" onPress={() => add(tag.name)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  start: { alignItems: "flex-start" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
