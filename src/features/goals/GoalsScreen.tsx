import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useQuery } from "@/db/DatabaseProvider";
import { listGoals, type Goal } from "@/db/repo/goals";
import { Amount, Button, EmptyState, ProgressRing, Screen, Skeleton, Surface, Text, useTheme } from "@/design";
import { DOCK_SPACE } from "@/features/shell/Dock";
import { useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { formatShortDate } from "@/lib/dateLabels";
import { formatRupiah } from "@/lib/money";

import { goalNeedPerMonth, totalSaved } from "./goals";

export function GoalCard({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const t = useT();
  const { color } = useTheme();
  const today = getClock().today;
  const pct = goal.progress.pct;
  const need = goalNeedPerMonth(goal, today);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${goal.name}, ${pct === null ? t.goals.noTarget : t.insights.percent(pct)}`} onPress={onPress}>
      <Surface variant="smoke" padding={16} style={styles.card}>
        <ProgressRing value={pct} label={goal.name} size={64}>
          <Text variant="caption">{pct === null ? "" : `${Math.round(pct)}%`}</Text>
        </ProgressRing>
        <View style={styles.cardText}>
          <Text variant="bodyLg">{goal.name}</Text>
          <Text variant="caption" tone="secondary">
            {goal.progress.target === null ? `${formatRupiah(goal.saved)}, ${t.goals.noTarget}` : t.goals.progress(formatRupiah(goal.saved), formatRupiah(goal.progress.target))}
          </Text>
          {goal.progress.reached ? (
            <Text variant="caption" style={{ color: color.accentInk }}>
              {t.goals.reached}
            </Text>
          ) : need !== null && goal.targetDate ? (
            <Text variant="caption" tone="secondary">
              {`${t.goals.dueBy(formatShortDate(goal.targetDate, t, today))}, ${t.goals.needPerMonth(formatRupiah(need))}`}
            </Text>
          ) : null}
        </View>
      </Surface>
    </Pressable>
  );
}

export function GoalsScreen() {
  const t = useT();
  const router = useRouter();
  const goals = useQuery(["goals"], (db) => listGoals(db));
  const list = goals.data;

  return (
    <Screen bottomInset={DOCK_SPACE}>
      <Text variant="title" accessibilityRole="header">
        {t.goals.title}
      </Text>
      {list === undefined ? (
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.stack}>
          <Skeleton height={96} radius={22} />
          <Skeleton height={96} radius={22} />
        </View>
      ) : list.length === 0 ? (
        <Surface variant="smoke" style={styles.stack}>
          <EmptyState
            source={require("../../assets/mascot/what2.png")}
            title={t.goals.emptyTitle}
            body={t.goals.emptyBody}
            actionLabel={t.goals.newGoal}
            onAction={() => router.push("/goal-edit")}
          />
        </Surface>
      ) : (
        <View style={styles.stack}>
          <Surface variant="glass" radius="hero" padding={20} elevated style={styles.total}>
            <Text variant="label" tone="secondary">
              {t.goals.totalSaved}
            </Text>
            <Amount value={totalSaved(list)} kind="saving" size="lg" animated maxWidth={300} />
          </Surface>
          {list.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onPress={() => router.push({ pathname: "/goal/[id]", params: { id: goal.id } })} />
          ))}
          <Button label={t.goals.newGoal} icon="add" variant="secondary" onPress={() => router.push("/goal-edit")} fullWidth />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, marginTop: 16 },
  total: { gap: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 16 },
  cardText: { flex: 1, gap: 2 },
});
