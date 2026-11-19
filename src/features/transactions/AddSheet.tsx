import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useDb, useQuery, useWrite } from "@/db/DatabaseProvider";
import { listCategories } from "@/db/repo/categories";
import { listGoals } from "@/db/repo/goals";
import { getMeta } from "@/db/repo/meta";
import { setTransactionTags, tagsFor } from "@/db/repo/tags";
import { createTransaction, getTransaction, softDeleteTransaction, updateTransaction, type Transaction } from "@/db/repo/transactions";
import { assertCanWithdraw } from "../goals/goals";
import { budgetSnapshot, crossingBetween } from "../budgets/alerts";
import {
  Amount,
  AmountKeypad,
  Button,
  Chip,
  Field,
  Screen,
  Segmented,
  SheetHeader,
  Skeleton,
  SwitchRow,
  Text,
  useSnackbar,
  useTheme,
  keypadExpression,
  keypadHasOperator,
  type IconName,
} from "@/design";
import { categoryLabel, useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { getClock } from "@/lib/clock";
import { formatShortDate } from "@/lib/dateLabels";
import { localDateOf, monthOf } from "@/lib/dates";
import { haptic } from "@/lib/haptics";

import { categoryUsage, orderByUsage } from "../categories/categories";
import { PlaceField } from "../location/PlaceField";
import { TagField } from "../tags/TagField";
import { useWallets, walletName } from "../wallets/wallets";
import {
  buildTransaction,
  formAmount,
  formForDuplicate,
  formFromTransaction,
  initialForm,
  isSavable,
  isSavingType,
  patchFromTransaction,
  PAYMENT_METHODS,
  type FormState,
  type FormType,
} from "./form";
import { canPickDateTime, pickDateTime } from "./pickDateTime";

const formTypeOf = (value: string | undefined): FormType => (value === "income" || value === "saving_deposit" || value === "saving_withdrawal" ? value : "expense");

/** Loads the transaction to edit or duplicate, then shows the form. A new transaction shows it at once. */
export function AddSheet() {
  const params = useLocalSearchParams<{ edit?: string; copy?: string; type?: string; goal?: string }>();
  const sourceId = params.edit ?? params.copy ?? null;
  const source = useQuery(["tx", sourceId ?? ""], async (db) => (sourceId ? getTransaction(db, sourceId) : null));
  const sourceTags = useQuery(["tx-tags", sourceId ?? ""], async (db) => (sourceId ? (await tagsFor(db, [sourceId])).get(sourceId) ?? [] : []));

  if (sourceId && (source.loading || sourceTags.loading)) {
    return (
      <Screen>
        <Skeleton height={28} width="60%" />
      </Screen>
    );
  }
  const found = source.data ?? null;
  const tags = sourceTags.data ?? [];
  const editing = params.edit && found ? found : null;
  const initial = found ? (params.edit ? formFromTransaction(found, tags) : formForDuplicate(found, tags)) : { ...initialForm(formTypeOf(params.type)), goalId: params.goal ?? null };
  return <AddForm key={sourceId ?? "new"} initial={initial} editing={editing} />;
}

function AddForm({ initial, editing }: { initial: FormState; editing: Transaction | null }) {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const db = useDb();
  const { show } = useSnackbar();
  const { color } = useTheme();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savingType = isSavingType(form.type);
  const categories = useQuery(["pick-category", form.type], async (database) => {
    if (form.type !== "expense" && form.type !== "income") return [];
    const [list, used] = await Promise.all([listCategories(database, { kind: form.type }), categoryUsage(database, form.type, Date.now())]);
    return orderByUsage(list, used);
  });
  const goals = useQuery(["pick-goal"], (database) => listGoals(database));
  const wallets = useWallets();
  const placesOn = useQuery(["places-enabled"], async (database) => (await getMeta(database, "location_enabled")) !== "0");

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const typeOptions = [
    { value: "expense", label: t.add.expense },
    { value: "income", label: t.add.income },
    { value: "saving_deposit", label: t.add.savingTypes.saving_deposit },
    { value: "saving_withdrawal", label: t.add.savingTypes.saving_withdrawal },
  ] as const satisfies readonly { value: FormType; label: string }[];

  const pick = async () => {
    const current = form.when.kind === "custom" ? form.when : null;
    const base = current ? new Date(Number(current.date.slice(0, 4)), Number(current.date.slice(5, 7)) - 1, Number(current.date.slice(8, 10)), current.hour, current.minute) : new Date();
    const picked = await pickDateTime(base, form.timeKnown);
    if (picked) update({ when: { kind: "custom", ...picked } });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const category = categories.data?.find((item) => item.id === form.categoryId);
      const goal = goals.data?.find((item) => item.id === form.goalId);
      const input = buildTransaction(form, getClock(), savingType ? (goal?.name ?? "") : category ? categoryLabel(category, t) : "");
      const month = monthOf(localDateOf(input.occurredAt, input.offsetMin));
      const watchBudget = input.type === "expense" && input.categoryId;
      const before = watchBudget ? await write((database) => budgetSnapshot(database, input.categoryId!, month)) : null;
      let undo: () => void;
      // The transaction and its tags go in together, so a refused tag does not leave half a save behind.
      if (editing) {
        if (input.type === "saving_withdrawal" && input.goalId) await assertCanWithdraw(db, input.goalId, input.amount, editing.id);
        await write((database) =>
          database.withTransactionAsync(async () => {
            await updateTransaction(database, editing.id, input);
            await setTransactionTags(database, editing.id, form.tags);
          }),
        );
        undo = () =>
          void write((database) =>
            database.withTransactionAsync(async () => {
              await updateTransaction(database, editing.id, patchFromTransaction(editing));
              await setTransactionTags(database, editing.id, initial.tags);
            }),
          );
      } else {
        if (input.type === "saving_withdrawal" && input.goalId) await assertCanWithdraw(db, input.goalId, input.amount);
        let id = "";
        await write((database) =>
          database.withTransactionAsync(async () => {
            id = await createTransaction(database, input);
            await setTransactionTags(database, id, form.tags);
          }),
        );
        const createdId = id;
        undo = () => void write((database) => softDeleteTransaction(database, createdId));
      }
      const after = watchBudget ? await write((database) => budgetSnapshot(database, input.categoryId!, month)) : null;
      const crossing = crossingBetween(before, after);
      if (crossing) haptic.warning();
      else haptic.success();
      router.back();
      const name = category ? categoryLabel(category, t) : "";
      show({
        message: crossing === "over" ? t.budgets.crossedOver(name) : crossing === "near" && after ? t.budgets.crossedNear(name, Math.round((after.spent / after.limit) * 100)) : input.type === "saving_deposit" ? t.moves.savedDeposit : input.type === "saving_withdrawal" ? t.moves.savedWithdraw : editing ? t.add.updated : t.add.saved,
        actionLabel: t.common.undo,
        onAction: undo,
      });
    } catch (cause) {
      setError(errorMessage(cause, t));
      setSaving(false);
    }
  };

  const expression = keypadHasOperator(form.amount) ? keypadExpression(form.amount) : null;
  const customWhen = form.when.kind === "custom" ? form.when : null;
  const customLabel = customWhen ? `${formatShortDate(customWhen.date, t)}${form.timeKnown ? ` ${String(customWhen.hour).padStart(2, "0")}:${String(customWhen.minute).padStart(2, "0")}` : ""}` : t.add.pick;

  return (
    <View style={[styles.root, { backgroundColor: color.canvas }]}>
      <Screen contentStyle={styles.content}>
        <SheetHeader title={editing ? t.add.titleEdit : t.add.titleNew} onClose={() => router.back()} grabber={false} />

        <Segmented label={t.add.type} options={typeOptions} value={form.type} onChange={(type) => update({ type, categoryId: null, goalId: isSavingType(type) ? form.goalId : null })} />

        <View style={styles.amount}>
          <Amount value={formAmount(form)} kind={form.type === "income" ? "income" : isSavingType(form.type) ? "saving" : "neutral"} size="lg" maxWidth={300} />
          {expression ? (
            <Text variant="caption" tone="secondary">
              {expression}
            </Text>
          ) : null}
        </View>
        <AmountKeypad state={form.amount} onChange={(amount) => update({ amount })} />

        {savingType ? (
          <Section title={t.moves.goal}>
            <View style={styles.wrap}>
              {(goals.data ?? []).map((goal) => (
                <Chip key={goal.id} label={goal.name} icon="flag-outline" selected={form.goalId === goal.id} onPress={() => update({ goalId: goal.id })} />
              ))}
              <Chip label={t.moves.newGoal} icon="add" selected={false} onPress={() => router.push("/goal-edit")} />
            </View>
            {goals.data && goals.data.length === 0 ? (
              <Text variant="caption" tone="secondary">
                {t.moves.noGoals}
              </Text>
            ) : null}
          </Section>
        ) : (
          <Section title={t.add.category}>
            <View style={styles.wrap}>
              {(categories.data ?? []).map((category) => (
                <Chip
                  key={category.id}
                  label={categoryLabel(category, t)}
                  icon={category.icon as IconName}
                  selected={form.categoryId === category.id}
                  onPress={() => update({ categoryId: category.id })}
                />
              ))}
            </View>
          </Section>
        )}

        <Field label={t.add.titleField} value={form.title} onChangeText={(title) => update({ title })} helper={savingType ? undefined : t.add.titleHelper} optional maxLength={120} />
        <Field label={t.add.counterparty} value={form.counterparty} onChangeText={(counterparty) => update({ counterparty })} placeholder={t.add.counterpartyPlaceholder} optional maxLength={80} />

        <Section title={t.add.when}>
          <View style={styles.wrap}>
            <Chip label={t.add.now} selected={form.when.kind === "now"} onPress={() => update({ when: { kind: "now" } })} />
            <Chip label={t.add.yesterday} selected={form.when.kind === "yesterday"} onPress={() => update({ when: { kind: "yesterday" } })} />
            {canPickDateTime || customWhen ? (
              <Chip label={customLabel} icon="calendar-outline" selected={customWhen !== null} disabled={!canPickDateTime} onPress={pick} />
            ) : null}
          </View>
          <SwitchRow label={t.add.timeUnknown} value={!form.timeKnown} onValueChange={(unknown) => update({ timeKnown: !unknown })} />
        </Section>

        <Section title={t.add.payment}>
          <View style={styles.wrap}>
            {PAYMENT_METHODS.map((method) => (
              <Chip
                key={method}
                label={t.add.paymentMethods[method]}
                selected={form.paymentMethod === method}
                onPress={() => update({ paymentMethod: form.paymentMethod === method ? null : method })}
              />
            ))}
          </View>
        </Section>

        <TagField value={form.tags} onChange={(next) => update({ tags: next })} />

        {wallets.data && wallets.data.length > 1 ? (
          <Section title={t.wallets.field}>
            <View style={styles.wrap}>
              {wallets.data.map((wallet) => (
                <Chip key={wallet.id} label={walletName(wallet, t)} selected={form.walletId === wallet.id} onPress={() => update({ walletId: wallet.id })} />
              ))}
            </View>
          </Section>
        ) : null}

        {placesOn.data !== false && !savingType ? (
          <Section title={t.place.title}>
            <PlaceField value={form.location} onChange={(location) => update({ location })} />
          </Section>
        ) : null}

        <Field label={t.add.note} value={form.note} onChangeText={(note) => update({ note })} optional multiline maxLength={500} />
      </Screen>

      <View style={[styles.footer, { backgroundColor: color.canvas, borderTopColor: color.hairline }]}>
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label={editing ? t.add.saveChanges : t.add.save} onPress={save} disabled={!isSavable(form)} loading={saving} fullWidth />
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 16 },
  amount: { alignItems: "center", gap: 4, paddingVertical: 8 },
  section: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
