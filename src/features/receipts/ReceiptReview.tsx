import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useDb, useQuery, useWrite } from "@/db/DatabaseProvider";
import { listCategories } from "@/db/repo/categories";
import { getMeta } from "@/db/repo/meta";
import { confirmReceipt, discardReceipt, getReceipt, saveDraft } from "@/db/repo/receipts";
import { softDeleteTransaction } from "@/db/repo/transactions";
import { Amount, Banner, Button, Chip, Field, IconButton, ListRow, Screen, SheetHeader, Skeleton, SwitchRow, Text, useSnackbar, useTheme, ZoomableImage, type IconName } from "@/design";
import { categoryLabel, useT } from "@/i18n";
import { errorMessage } from "@/i18n/errors";
import { getClock } from "@/lib/clock";
import { formatShortDate } from "@/lib/dateLabels";
import { haptic } from "@/lib/haptics";
import { localDateOf } from "@/lib/dates";
import { newId } from "@/lib/ids";
import { formatRupiah } from "@/lib/money";
import { formatNumberInput, parseFormattedNumber } from "@/utils/format";

import { categoryUsage, orderByUsage } from "../categories/categories";
import { PAYMENT_METHODS } from "../transactions/form";
import { canPickDateTime, pickDateTime } from "../transactions/pickDateTime";
import { findSimilarExpense } from "./duplicates";
import { deleteReceiptImage } from "./images";
import { canSaveReview, checkReview, reviewFromJson, reviewToTransaction, type ReviewItem, type ReviewState } from "./review";

/** Loads the draft, then shows the review. The review itself keeps its own copy and saves it as it changes. */
export function ReceiptReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const receipt = useQuery(["receipt", id], (db) => getReceipt(db, id));

  if (receipt.loading) {
    return (
      <Screen>
        <Skeleton height={28} width="50%" />
      </Screen>
    );
  }
  const data = receipt.data;
  if (!data || data.status !== "draft") {
    return (
      <Screen>
        <SheetHeader title={t.scan.review.title} onClose={() => router.back()} grabber={false} />
        <Text variant="body" tone="secondary">
          {t.scan.review.notFound}
        </Text>
      </Screen>
    );
  }
  return <Review key={id} id={id} imagePath={data.imagePath} hadText={data.ocrText !== null} initial={reviewFromJson(data.draftJson)} />;
}

function Review({ id, imagePath, hadText, initial }: { id: string; imagePath: string | null; hadText: boolean; initial: ReviewState }) {
  const t = useT();
  const s = t.scan.review;
  const router = useRouter();
  const db = useDb();
  const write = useWrite();
  const { show } = useSnackbar();
  const { color } = useTheme();
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [similar, setSimilar] = useState<string | null>(null);
  const today = getClock().today;

  const categories = useQuery(["pick-category", "expense"], async (database) => {
    const [list, used] = await Promise.all([listCategories(database, { kind: "expense" }), categoryUsage(database, "expense", Date.now())]);
    return orderByUsage(list, used);
  });

  const update = (patch: Partial<ReviewState>) => setState((current) => ({ ...current, ...patch }));
  const setItem = (itemId: string, patch: Partial<ReviewItem>) => setState((current) => ({ ...current, items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }));

  // The draft is saved as it changes, so closing the app does not lose the review.
  useEffect(() => {
    const timer = setTimeout(() => void saveDraft(db, id, JSON.stringify(state)), 700);
    return () => clearTimeout(timer);
  }, [state, db, id]);

  // A soft warning when the same total was already recorded around that day.
  useEffect(() => {
    if (state.total <= 0) return;
    let alive = true;
    const timer = setTimeout(() => {
      findSimilarExpense(db, { total: state.total, date: state.date ?? today, merchant: state.merchant }).then((tx) => {
        if (alive) setSimilar(tx ? s.dupSimilar(tx.counterparty ?? tx.title, formatRupiah(tx.amount), formatShortDate(tx.occurredLocalDate, t, today)) : null);
      });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [state.total, state.date, state.merchant, db, today, s, t]);

  const check = checkReview(state);
  const goods = state.items.filter((item) => item.kind === "item");
  const extras = state.items.filter((item) => item.kind !== "item");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const transaction = reviewToTransaction(state, getClock(), id, "Receipt");
      const items = state.items.map(({ kind, name, quantity, unitPrice, lineTotal }) => ({ kind, name, quantity, unitPrice, lineTotal }));
      const transactionId = await write((database) => confirmReceipt(database, id, transaction, items));
      if ((await getMeta(db, "keep_receipt_photos")) === "0") await deleteReceiptImage(imagePath);
      haptic.success();
      router.dismissAll();
      show({ message: s.saved, actionLabel: t.common.undo, onAction: () => void write((database) => softDeleteTransaction(database, transactionId)) });
    } catch (cause) {
      setError(errorMessage(cause, t));
      setSaving(false);
    }
  };

  const discard = async () => {
    const path = await write((database) => discardReceipt(database, id));
    await deleteReceiptImage(path);
    router.dismissAll();
    show({ message: s.discarded });
  };

  const pickDate = async () => {
    const picked = await pickDateTime(new Date(), false);
    if (picked) update({ date: picked.date });
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={s.title} onClose={() => router.back()} grabber={false} />

      {imagePath ? (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={s.openPhoto} onPress={() => setZoom(true)}>
          <Image source={{ uri: imagePath }} style={[styles.photo, { backgroundColor: color.surface2 }]} contentFit="contain" accessibilityLabel={s.photo} />
        </Pressable>
      ) : null}
      {!hadText ? <Banner tone="info" message={s.readerMissing} /> : null}

      <Field
        label={s.merchant}
        value={state.merchant}
        onChangeText={(merchant) => update({ merchant })}
        helper={state.merchant.trim() === "" && !state.flags.merchant ? s.notRead : undefined}
        maxLength={80}
      />

      <View>
        <Field
          label={s.total}
          variant="amount"
          value={state.total > 0 ? formatNumberInput(String(state.total)) : ""}
          onChangeText={(text) => update({ total: text.trim() === "" ? 0 : parseFormattedNumber(text) })}
          error={state.flags.total === "none" && state.total === 0 ? s.totalNone : undefined}
        />
        {state.items.length > 0 && !check.ok ? (
          <View style={styles.gap}>
            <Banner tone="warning" title={s.totalLow} message={s.mismatch(formatRupiah(Math.abs(check.diff)))} />
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {s.date}
        </Text>
        <View style={styles.wrap}>
          {state.date ? <Chip label={`${s.printedDate}: ${formatShortDate(state.date, t, today)}`} selected={state.date !== today} onPress={() => {}} disabled /> : null}
          <Chip label={s.today} selected={state.date === today || state.date === null} onPress={() => update({ date: localDateOf(Date.now(), getClock().offsetMin) })} />
          {canPickDateTime ? <Chip label={t.add.pick} icon="calendar-outline" selected={false} onPress={pickDate} /> : null}
        </View>
        {!state.flags.date && state.date === null ? (
          <Text variant="caption" tone="secondary">
            {s.dateNotRead}
          </Text>
        ) : null}
        {state.time ? <SwitchRow label={s.timeNone} value={!state.timeKnown} onValueChange={(none) => update({ timeKnown: !none })} /> : null}
      </View>

      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {s.items}
        </Text>
        {goods.map((item) => (
          <View key={item.id} style={styles.item}>
            <Field label={s.itemName} value={item.name} onChangeText={(name) => setItem(item.id, { name })} maxLength={80} />
            <View style={styles.itemRow}>
              <View style={styles.itemPrice}>
                <Field label={s.itemPrice} variant="amount" value={formatNumberInput(String(item.lineTotal))} onChangeText={(text) => setItem(item.id, { lineTotal: text.trim() === "" ? 0 : parseFormattedNumber(text), unitPrice: null, quantity: 1 })} />
              </View>
              <IconButton icon="close" label={s.removeItem(item.name || s.itemName)} onPress={() => update({ items: state.items.filter((other) => other.id !== item.id) })} />
            </View>
          </View>
        ))}
        {extras.map((item) => (
          <ListRow
            key={item.id}
            title={item.name}
            subtitle={t.scan.review.items}
            trailing={<Amount value={item.lineTotal} kind={item.lineTotal < 0 ? "income" : "neutral"} size="sm" />}
            chevron={false}
            accessibilityLabel={`${item.name}, ${formatRupiah(item.lineTotal)}`}
          />
        ))}
        <Button
          label={s.addItem}
          icon="add"
          variant="secondary"
          onPress={() => update({ items: [...state.items, { id: newId(), kind: "item", name: "", quantity: 1, unitPrice: null, lineTotal: 0 }] })}
          fullWidth
        />
      </View>

      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {t.add.category}
        </Text>
        <View style={styles.wrap}>
          {(categories.data ?? []).map((category) => (
            <Chip
              key={category.id}
              label={categoryLabel(category, t)}
              icon={category.icon as IconName}
              selected={state.categoryId === category.id}
              onPress={() => update({ categoryId: category.id })}
            />
          ))}
        </View>
        {initial.categoryId !== null && state.categoryId === initial.categoryId ? (
          <Text variant="caption" tone="secondary">
            {s.suggested}
          </Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          {t.add.payment}
        </Text>
        <View style={styles.wrap}>
          {PAYMENT_METHODS.map((method) => (
            <Chip key={method} label={t.add.paymentMethods[method]} selected={state.paymentMethod === method} onPress={() => update({ paymentMethod: state.paymentMethod === method ? null : method })} />
          ))}
        </View>
      </View>

      <Field label={t.add.note} value={state.note} onChangeText={(note) => update({ note })} optional multiline maxLength={500} />

      {similar ? <Banner tone="warning" message={similar} /> : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button label={similar ? s.saveAnyway : s.save} onPress={save} disabled={!canSaveReview(state)} loading={saving} fullWidth />
      <Button label={s.discard} variant="quiet" onPress={discard} fullWidth />

      {/* A modal is a window of its own, so it needs its own gesture root for the pinch and the drag. */}
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <GestureHandlerRootView style={styles.zoom}>
          {imagePath ? <ZoomableImage uri={imagePath} label={s.photo} zoomInLabel={s.zoomIn} zoomOutLabel={s.zoomOut} closeLabel={s.closePhoto} onClose={() => setZoom(false)} /> : null}
        </GestureHandlerRootView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  photo: { height: 220, borderRadius: 16 },
  gap: { marginTop: 12 },
  block: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: { gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  itemPrice: { flex: 1 },
  zoom: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
});
