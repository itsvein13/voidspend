import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { archiveCategory, createCategory, listCategories, restoreCategory, type Category } from "@/db/repo/categories";
import { listRecurringRules, setRecurringPaused, updateRecurringRule, type RecurringRule } from "@/db/repo/recurring";
import { setMeta } from "@/db/repo/meta";
import { listWallets, type Wallet } from "@/db/repo/wallets";
import { DEFAULT_WALLET_ID } from "@/db/types";
import { Button, Chip, Field, IconButton, ListRow, Screen, Segmented, SheetHeader, Skeleton, Surface, SwitchRow, Text, useSnackbar } from "@/design";
import { categoryLabel, useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { formatShortDate } from "@/lib/dateLabels";
import { getClock } from "@/lib/clock";
import { formatRupiah } from "@/lib/money";
import { formatNumberInput, parseFormattedNumber } from "@/utils/format";

import { askForNotifications, canNotify } from "../reminders/notify";
import { REMINDERS_USED_KEY } from "../reminders/ReminderSync";
import { CategoryTile } from "../transactions/components/TransactionRow";
import { walletName } from "../wallets/wallets";

type Kind = Category["kind"];

/** The shipped categories can be hidden, the person's own can be added and hidden. */
export function CategoriesScreen() {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const [kind, setKind] = useState<Kind>("expense");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery(["manage-categories", kind], (db) => listCategories(db, { kind, includeArchived: true }));

  const add = async () => {
    setError(null);
    try {
      await write((db) => createCategory(db, { kind, name, icon: kind === "saving" ? "cube-outline" : "pricetag-outline", color: kind === "saving" ? "savings" : kind === "income" ? "accent" : "other" }));
      setName("");
      show({ message: t.manage.created });
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.manage.title} onClose={() => router.back()} grabber={false} />
      <Segmented
        label={t.manage.title}
        options={[
          { value: "expense", label: t.manage.expense },
          { value: "income", label: t.manage.income },
          { value: "saving", label: t.manage.saving },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Field label={t.manage.name} value={name} onChangeText={setName} maxLength={40} />
      {error ? (
        <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label={t.manage.add} icon="add" onPress={add} disabled={name.trim() === ""} fullWidth />
      <Text variant="caption" tone="secondary">
        {t.manage.hint}
      </Text>
      {list.data === undefined ? (
        <Skeleton height={56} radius={22} />
      ) : (
        <Surface variant="smoke" padding={8}>
          {list.data.map((category, index, all) => (
            <ListRow
              key={category.id}
              title={categoryLabel(category, t)}
              subtitle={category.archivedAt ? t.manage.hidden : undefined}
              leading={<CategoryTile category={category} />}
              trailing={
                <IconButton
                  icon={category.archivedAt ? "eye-outline" : "eye-off-outline"}
                  label={`${category.archivedAt ? t.manage.show : t.manage.hide}: ${categoryLabel(category, t)}`}
                  onPress={() => void write((db) => (category.archivedAt ? restoreCategory(db, category.id) : archiveCategory(db, category.id)))}
                />
              }
              divider={index < all.length - 1}
            />
          ))}
        </Surface>
      )}
    </Screen>
  );
}

export function RecurringScreen() {
  const t = useT();
  const router = useRouter();
  const rules = useQuery(["recurring-rules"], (db) => listRecurringRules(db));
  // Hidden wallets too: a rule that records into one still shows it as its wallet.
  const wallets = useQuery(["wallets-all"], (db) => listWallets(db, { includeArchived: true }));
  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.recurring.title} onClose={() => router.back()} grabber={false} />
      {rules.data === undefined ? (
        <Skeleton height={120} radius={22} />
      ) : rules.data.length === 0 ? (
        <Text variant="body" tone="secondary">
          {t.recurring.empty}
        </Text>
      ) : (
        rules.data.map((rule) => <RuleCard key={rule.id} rule={rule} wallets={wallets.data ?? []} />)
      )}
    </Screen>
  );
}

function RuleCard({ rule, wallets }: { rule: RecurringRule; wallets: Wallet[] }) {
  const t = useT();
  const write = useWrite();
  const { show } = useSnackbar();
  const [amount, setAmount] = useState(formatNumberInput(String(rule.amount)));
  const today = getClock().today;
  // The visible wallets, and the rule's own when it has since been hidden. One choice is no choice, so no picker.
  const currentWallet = rule.walletId ?? DEFAULT_WALLET_ID;
  const walletOptions = wallets.filter((wallet) => wallet.archivedAt === null || wallet.id === currentWallet);
  // Turning a reminder on asks the phone for permission first. Without it the switch stays off and says why.
  const toggleReminder = async (on: boolean) => {
    if (on && !(await askForNotifications())) {
      show({ message: t.reminders.denied });
      return;
    }
    try {
      await write((db) =>
        db.withTransactionAsync(async () => {
          await updateRecurringRule(db, rule.id, { remind: on });
          if (on) await setMeta(db, REMINDERS_USED_KEY, "1");
        }),
      );
    } catch (cause) {
      show({ message: errorMessage(cause, t) });
    }
  };
  const pickWallet = async (walletId: string) => {
    if (walletId === currentWallet) return;
    try {
      await write((db) => updateRecurringRule(db, rule.id, { walletId }));
      show({ message: t.recurring.saved });
    } catch (cause) {
      show({ message: errorMessage(cause, t) });
    }
  };
  const every = rule.frequency === "weekly" ? t.recurring.weekly : rule.frequency === "yearly" ? t.recurring.yearly : t.recurring.monthly(rule.dayOfMonth ?? Number(rule.startDate.slice(8, 10)));

  return (
    <Surface variant="smoke" padding={16} style={styles.card}>
      <Text variant="bodyLg">{rule.title}</Text>
      <Text variant="caption" tone="secondary">
        {`${every}, ${t.recurring.next(formatShortDate(rule.nextDueDate, t, today))}, ${formatRupiah(rule.amount)}`}
      </Text>
      <Field
        label={t.recurring.amount}
        variant="amount"
        value={amount}
        onChangeText={setAmount}
        onBlur={async () => {
          const value = parseFormattedNumber(amount);
          if (value === rule.amount) return;
          try {
            await write((db) => updateRecurringRule(db, rule.id, { amount: value }));
            show({ message: t.recurring.saved });
          } catch (cause) {
            show({ message: errorMessage(cause, t) });
            setAmount(formatNumberInput(String(rule.amount)));
          }
        }}
      />
      {walletOptions.length > 1 ? (
        <View style={styles.pick}>
          <Text variant="label" tone="secondary">
            {t.wallets.field}
          </Text>
          <View style={styles.wrap}>
            {walletOptions.map((wallet) => (
              <Chip key={wallet.id} label={walletName(wallet, t)} selected={currentWallet === wallet.id} onPress={() => pickWallet(wallet.id)} />
            ))}
          </View>
        </View>
      ) : null}
      <SwitchRow label={t.recurring.auto} description={t.recurring.autoHelp} value={rule.mode === "auto"} onValueChange={(on) => void write((db) => updateRecurringRule(db, rule.id, { mode: on ? "auto" : "confirm" }))} />
      {canNotify ? <SwitchRow label={t.reminders.switch} description={t.reminders.switchHelp} value={rule.remind} onValueChange={toggleReminder} /> : null}
      <SwitchRow label={t.recurring.paused} value={rule.pausedAt !== null} onValueChange={(on) => void write((db) => setRecurringPaused(db, rule.id, on))} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  card: { gap: 12 },
  pick: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
