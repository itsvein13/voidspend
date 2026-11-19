import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { createTransaction, getTransaction, updateTransaction, type Transaction } from "@/db/repo/transactions";
import { listWallets, type Wallet } from "@/db/repo/wallets";
import { DEFAULT_WALLET_ID } from "@/db/types";
import { Banner, Button, Chip, Field, Screen, SheetHeader, Skeleton, Text, useSnackbar } from "@/design";
import { useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { getClock } from "@/lib/clock";
import { formatShortDate } from "@/lib/dateLabels";
import { localTimeOf } from "@/lib/dates";
import { formatNumberInput, parseFormattedNumber } from "@/utils/format";

import { resolveMoment, type When } from "../transactions/form";
import { canPickDateTime, pickDateTime } from "../transactions/pickDateTime";
import { walletName } from "./wallets";

/**
 * Moves money from one wallet to another. It changes what each wallet holds and nothing in income, spending or
 * savings. With an `edit` parameter it changes an existing transfer instead.
 */
export function TransferScreen() {
  const t = useT();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const existing = useQuery(["tx", edit ?? ""], async (db) => (edit ? getTransaction(db, edit) : null));
  // Hidden wallets too: an edited transfer keeps its wallets even when one of them has been hidden since.
  const wallets = useQuery(["wallets-all"], (db) => listWallets(db, { includeArchived: true }));

  if (wallets.data === undefined || (edit && existing.loading)) {
    return (
      <Screen>
        <Skeleton height={28} width="50%" />
      </Screen>
    );
  }
  const tx = existing.data ?? null;
  if (edit && (!tx || tx.deletedAt !== null || tx.type !== "transfer")) {
    return (
      <Screen>
        <SheetHeader title={t.wallets.transfer} onClose={() => router.back()} grabber={false} />
        <Text variant="body" tone="secondary">
          {t.detail.notFound}
        </Text>
      </Screen>
    );
  }
  return <TransferForm key={edit ?? "new"} wallets={wallets.data} existing={tx} />;
}

function TransferForm({ wallets, existing }: { wallets: Wallet[]; existing: Transaction | null }) {
  const t = useT();
  const router = useRouter();
  const write = useWrite();
  const { show } = useSnackbar();
  const [fromPick, setFromPick] = useState<string | null>(existing ? (existing.walletId ?? DEFAULT_WALLET_ID) : null);
  const [toPick, setToPick] = useState<string | null>(existing?.toWalletId ?? null);
  const [amount, setAmount] = useState(existing ? formatNumberInput(String(existing.amount)) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // When it happened. A new transfer is now. An edited one starts as the moment it has, and keeps it exactly
  // (seconds included) unless the person picks another, so an edit that is not about the time never moves it.
  const [when, setWhen] = useState<When>(() => {
    if (!existing) return { kind: "now" };
    const [hour, minute] = localTimeOf(existing.occurredAt, existing.occurredOffsetMin).split(":").map(Number);
    return { kind: "custom", date: existing.occurredLocalDate, hour, minute };
  });
  const [whenChanged, setWhenChanged] = useState(false);
  const zone = existing ? { tz: existing.occurredTz, offsetMin: existing.occurredOffsetMin } : null;
  const changeWhen = (next: When) => {
    setWhen(next);
    setWhenChanged(true);
  };
  const pickMoment = async () => {
    const base = when.kind === "custom" ? new Date(Number(when.date.slice(0, 4)), Number(when.date.slice(5, 7)) - 1, Number(when.date.slice(8, 10)), when.hour, when.minute) : new Date();
    const picked = await pickDateTime(base, true);
    if (picked) changeWhen({ kind: "custom", ...picked });
  };

  // The wallets that can be picked: the visible ones, and the two a transfer being edited already uses.
  const list = wallets.filter((wallet) => wallet.archivedAt === null || wallet.id === (existing?.walletId ?? DEFAULT_WALLET_ID) || wallet.id === existing?.toWalletId);
  if (list.length < 2) {
    return (
      <Screen contentStyle={styles.content}>
        <SheetHeader title={t.wallets.transfer} onClose={() => router.back()} grabber={false} />
        <Banner tone="info" message={t.wallets.needTwo} />
        <Button label={t.wallets.newWallet} onPress={() => router.replace("/wallet-edit")} fullWidth />
      </Screen>
    );
  }

  const fromId = fromPick && list.some((wallet) => wallet.id === fromPick) ? fromPick : list[0].id;
  const toId = toPick && toPick !== fromId && list.some((wallet) => wallet.id === toPick) ? toPick : (list.find((wallet) => wallet.id !== fromId) ?? list[1]).id;
  const nameOf = (id: string) => walletName(list.find((wallet) => wallet.id === id)!, t);
  const value = parseFormattedNumber(amount);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const title = t.wallets.transferTitle(nameOf(fromId), nameOf(toId));
      const clock = getClock();
      const moment = resolveMoment({ when, timeKnown: true, zone }, clock);
      if (existing) {
        await write((database) =>
          updateTransaction(database, existing.id, {
            amount: value,
            title,
            walletId: fromId,
            toWalletId: toId,
            note: note.trim() || null,
            ...(whenChanged ? { occurredAt: moment.occurredAt, offsetMin: moment.offsetMin, tz: moment.tz, timePrecision: moment.precision } : {}),
          }),
        );
        router.back();
        show({
          message: t.wallets.updated,
          actionLabel: t.common.undo,
          onAction: () =>
            void write((database) =>
              updateTransaction(database, existing.id, {
                amount: existing.amount,
                title: existing.title,
                walletId: existing.walletId,
                toWalletId: existing.toWalletId,
                note: existing.note,
                occurredAt: existing.occurredAt,
                offsetMin: existing.occurredOffsetMin,
                tz: existing.occurredTz,
                timePrecision: existing.timePrecision,
              }),
            ),
        });
        return;
      }
      await write((database) =>
        createTransaction(database, {
          type: "transfer",
          amount: value,
          title,
          walletId: fromId,
          toWalletId: toId,
          note: note.trim() || null,
          occurredAt: moment.occurredAt,
          offsetMin: moment.offsetMin,
          tz: moment.tz,
          timePrecision: moment.precision,
        }),
      );
      router.back();
      show({ message: t.wallets.moved });
    } catch (cause) {
      setError(errorMessage(cause, t));
      setSaving(false);
    }
  };

  const picker = (label: string, selected: string, onPick: (id: string) => void) => (
    <View style={styles.block}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <View style={styles.wrap}>
        {list.map((wallet) => (
          <Chip key={wallet.id} label={walletName(wallet, t)} selected={selected === wallet.id} onPress={() => onPick(wallet.id)} />
        ))}
      </View>
    </View>
  );

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={existing ? t.wallets.editTransfer : t.wallets.transfer} onClose={() => router.back()} grabber={false} />
      {picker(t.wallets.from, fromId, (id) => {
        setFromPick(id);
        if (id === toId) setToPick(fromId);
      })}
      {picker(t.wallets.to, toId, (id) => {
        setToPick(id);
        if (id === fromId) setFromPick(toId);
      })}
      <Field label={t.wallets.amount} variant="amount" value={amount} onChangeText={setAmount} />
      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {t.add.when}
        </Text>
        <View style={styles.wrap}>
          <Chip label={t.add.now} selected={when.kind === "now"} onPress={() => changeWhen({ kind: "now" })} />
          <Chip label={t.add.yesterday} selected={when.kind === "yesterday"} onPress={() => changeWhen({ kind: "yesterday" })} />
          {canPickDateTime || when.kind === "custom" ? (
            <Chip
              label={when.kind === "custom" ? `${formatShortDate(when.date, t)} ${String(when.hour).padStart(2, "0")}:${String(when.minute).padStart(2, "0")}` : t.add.pick}
              icon="calendar-outline"
              selected={when.kind === "custom"}
              disabled={!canPickDateTime}
              onPress={pickMoment}
            />
          ) : null}
        </View>
      </View>
      <Field label={t.wallets.note} value={note} onChangeText={setNote} optional maxLength={200} />
      {error ? (
        <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label={existing ? t.wallets.saveTransfer : t.wallets.move} onPress={save} loading={saving} disabled={!(value > 0)} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  block: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
