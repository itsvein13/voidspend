import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { budgetStatuses, listBudgetRules, setBudget } from "@/db/repo/budgets";
import { listCategories } from "@/db/repo/categories";
import { Button, Chip, Field, ListRow, Screen, SheetHeader, Skeleton, Surface, Text, useSnackbar } from "@/design";
import { categoryLabel, useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { getClock } from "@/lib/clock";
import { formatMonthLabel } from "@/lib/dateLabels";
import { monthOf } from "@/lib/dates";
import { effectiveBudget } from "@/lib/finance";
import { formatRupiah } from "@/lib/money";
import { formatNumberInput, parseFormattedNumber } from "@/utils/format";

import { CategoryTile } from "../transactions/components/TransactionRow";

export function BudgetsScreen() {
  const t = useT();
  const router = useRouter();
  const month = monthOf(getClock().today);
  const list = useQuery(["budgets-screen", month], async (db) => {
    const [categories, statuses] = await Promise.all([listCategories(db, { kind: "expense" }), budgetStatuses(db, month)]);
    return categories.map((category) => ({ category, status: statuses.find((status) => status.categoryId === category.id) ?? null }));
  });

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.budgets.title} onClose={() => router.back()} grabber={false} />
      <Text variant="body" tone="secondary">
        {t.budgets.intro}
      </Text>
      {list.data === undefined ? (
        <Skeleton height={64} radius={22} />
      ) : (
        <Surface variant="smoke" padding={8}>
          {list.data.map(({ category, status }, index, all) => (
            <ListRow
              key={category.id}
              title={categoryLabel(category, t)}
              subtitle={status ? `${t.budgets.limitOf(formatRupiah(status.spent), formatRupiah(status.limit))}, ${t.home.budgetStatus[status.usage.status]}` : t.budgets.none}
              leading={<CategoryTile category={category} />}
              onPress={() => router.push({ pathname: "/budget-edit", params: { category: category.id } })}
              divider={index < all.length - 1}
            />
          ))}
        </Surface>
      )}
    </Screen>
  );
}

const ALERTS = [70, 80, 90] as const;

export function BudgetEdit() {
  const { category: categoryId } = useLocalSearchParams<{ category: string }>();
  const t = useT();
  const month = monthOf(getClock().today);
  const loaded = useQuery(["budget-edit", categoryId, month], async (db) => {
    const [categories, rules] = await Promise.all([listCategories(db, { kind: "expense", includeArchived: true }), listBudgetRules(db)]);
    return { category: categories.find((item) => item.id === categoryId) ?? null, rule: effectiveBudget(rules, categoryId, month) };
  });
  if (!loaded.data) {
    return (
      <Screen>
        <Skeleton height={28} width="50%" />
      </Screen>
    );
  }
  return <BudgetForm key={categoryId} categoryId={categoryId} month={month} name={loaded.data.category ? categoryLabel(loaded.data.category, t) : ""} initial={loaded.data.rule} />;
}

function BudgetForm({ categoryId, month, name, initial }: { categoryId: string; month: string; name: string; initial: { amount: number | null; alertPct: number } | null }) {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const [amount, setAmount] = useState(initial?.amount ? formatNumberInput(String(initial.amount)) : "");
  const [alertPct, setAlertPct] = useState<number>(initial?.alertPct ?? 80);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: number | null) => {
    setError(null);
    try {
      await write((db) => setBudget(db, { categoryId, effectiveFrom: month, amount: value, alertPct }));
      router.back();
      show({ message: value === null ? t.budgets.removed : t.budgets.saved });
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={`${t.budgets.edit}: ${name}`} onClose={() => router.back()} grabber={false} />
      <Field label={t.budgets.amount} variant="amount" value={amount} onChangeText={setAmount} helper={t.budgets.from(formatMonthLabel(month, t))} />
      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {t.budgets.alert}
        </Text>
        <View style={styles.wrap}>
          {ALERTS.map((pct) => (
            <Chip key={pct} label={t.budgets.alertPct(pct)} selected={alertPct === pct} onPress={() => setAlertPct(pct)} />
          ))}
        </View>
      </View>
      {error ? (
        <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label={t.budgets.save} onPress={() => save(amount.trim() === "" ? 0 : parseFormattedNumber(amount))} disabled={amount.trim() === ""} fullWidth />
      {initial?.amount ? <Button label={t.budgets.remove} variant="quiet" onPress={() => save(null)} fullWidth /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  block: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
