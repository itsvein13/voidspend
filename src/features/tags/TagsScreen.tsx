import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { deleteTag, listTags, MAX_TAG_LENGTH, renameTag, type TagUsage } from "@/db/repo/tags";
import { Button, Field, Screen, SheetHeader, Skeleton, Surface, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";

/** Every tag with how many transactions carry it, and the two things to do with one: rename it or delete it. */
export function TagsScreen() {
  const t = useT();
  const router = useRouter();
  const tags = useQuery(["tags"], (db) => listTags(db));
  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.tags.title} onClose={() => router.back()} grabber={false} />
      <Text variant="body" tone="secondary">
        {t.tags.manageHint}
      </Text>
      {tags.data === undefined ? (
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.content}>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      ) : tags.data.length === 0 ? (
        <Text variant="body" tone="secondary">
          {t.tags.empty}
        </Text>
      ) : (
        tags.data.map((tag) => <TagCard key={tag.id} tag={tag} />)
      )}
    </Screen>
  );
}

function TagCard({ tag }: { tag: TagUsage }) {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      await write((db) => renameTag(db, tag.id, name));
      setMode("view");
      setError(null);
      show({ message: t.tags.renamed });
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  };
  const remove = async () => {
    await write((db) => deleteTag(db, tag.id));
    show({ message: t.tags.deleted });
  };

  return (
    <Surface variant="smoke" padding={16} style={styles.card}>
      <View style={styles.head}>
        <Text variant="bodyLg" style={styles.title}>{`#${tag.name}`}</Text>
        <Text variant="caption" tone="secondary">
          {t.tags.count(tag.count)}
        </Text>
      </View>
      {mode === "rename" ? (
        <>
          <Field label={t.tags.renameField} value={name} onChangeText={setName} maxLength={MAX_TAG_LENGTH + 1} error={error ?? undefined} />
          <View style={styles.row}>
            <Button label={t.tags.saveName} size="sm" onPress={save} disabled={name.trim() === ""} />
            <Button
              label={t.tags.cancel}
              size="sm"
              variant="quiet"
              onPress={() => {
                setMode("view");
                setName(tag.name);
                setError(null);
              }}
            />
          </View>
        </>
      ) : mode === "delete" ? (
        <>
          <Text variant="body">{t.tags.deleteTitle(tag.name)}</Text>
          <Text variant="caption" tone="secondary">
            {t.tags.deleteBody(tag.count)}
          </Text>
          <View style={styles.row}>
            <Button label={t.tags.delete} size="sm" variant="destructive" onPress={remove} />
            <Button label={t.tags.cancel} size="sm" variant="quiet" onPress={() => setMode("view")} />
          </View>
        </>
      ) : (
        <View style={styles.row}>
          {tag.count > 0 ? <Button label={t.tags.show} size="sm" onPress={() => router.push({ pathname: "/history", params: { tag: tag.id } })} /> : null}
          <Button label={t.tags.rename} size="sm" variant="secondary" onPress={() => setMode("rename")} />
          <Button label={t.tags.delete} size="sm" variant="quiet" onPress={() => setMode("delete")} />
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  card: { gap: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
