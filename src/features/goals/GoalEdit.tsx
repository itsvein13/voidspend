import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { listCategories } from "@/db/repo/categories";
import { createGoal, getGoal, updateGoal, type Goal } from "@/db/repo/goals";
import { Button, Chip, Field, Screen, SheetHeader, Skeleton, Text, useSnackbar, type IconName } from "@/design";
import { categoryLabel, useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { formatShortDate } from "@/lib/dateLabels";
import type { LocalDate } from "@/lib/dates";
import { formatNumberInput, parseFormattedNumber } from "@/utils/format";

import { canPickDateTime, pickDateTime } from "../transactions/pickDateTime";

/** Loads the goal to edit, then shows the form. A new goal shows it at once. */
export function GoalEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goal = useQuery(["goal", id ?? ""], async (db) => (id ? getGoal(db, id) : null));
  if (id && goal.loading) {
    return (
      <Screen>
        <Skeleton height={28} width="50%" />
      </Screen>
    );
  }
  return <GoalForm key={id ?? "new"} goal={goal.data ?? null} />;
}

function GoalForm({ goal }: { goal: Goal | null }) {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal?.targetAmount ? formatNumberInput(String(goal.targetAmount)) : "");
  const [date, setDate] = useState<LocalDate | null>(goal?.targetDate ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(goal?.categoryId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categories = useQuery(["saving-categories"], (db) => listCategories(db, { kind: "saving" }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input = { name, categoryId, targetAmount: target.trim() === "" ? null : parseFormattedNumber(target), targetDate: date };
      if (goal) await write((db) => updateGoal(db, goal.id, input));
      else await write((db) => createGoal(db, input));
      router.back();
      show({ message: t.goals.saved });
    } catch (cause) {
      setError(errorMessage(cause, t));
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={goal ? t.goals.editGoal : t.goals.newGoal} onClose={() => router.back()} grabber={false} />
      <Field label={t.goals.name} value={name} onChangeText={setName} maxLength={60} />
      <Field label={t.goals.target} variant="amount" value={target} onChangeText={setTarget} optional />
      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {t.goals.targetDate}
        </Text>
        <View style={styles.wrap}>
          {canPickDateTime ? (
            <Chip
              label={date ? formatShortDate(date, t) : t.goals.pickDate}
              icon="calendar-outline"
              selected={date !== null}
              onPress={async () => {
                const picked = await pickDateTime(new Date(), false);
                if (picked) setDate(picked.date);
              }}
            />
          ) : date ? (
            <Chip label={formatShortDate(date, t)} icon="calendar-outline" selected disabled onPress={() => {}} />
          ) : null}
          {date ? <Chip label={t.goals.clearDate} onPress={() => setDate(null)} /> : null}
        </View>
      </View>
      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {t.goals.category}
        </Text>
        <View style={styles.wrap}>
          {(categories.data ?? []).map((category) => (
            <Chip
              key={category.id}
              label={categoryLabel(category, t)}
              icon={category.icon as IconName}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
            />
          ))}
        </View>
      </View>
      {error ? (
        <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label={t.goals.save} onPress={save} loading={saving} disabled={name.trim() === ""} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  block: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
