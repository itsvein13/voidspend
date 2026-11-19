import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionList, StyleSheet, TextInput, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useQuery, useWrite } from "@/db/DatabaseProvider";
import { listTags, tagsFor } from "@/db/repo/tags";
import { listTransactions, restoreTransaction, softDeleteTransaction, type Transaction } from "@/db/repo/transactions";
import { Button, Chip, EmptyState, Icon, Skeleton, Text, useBreakpoint, useReduceMotion, useSnackbar, useTheme } from "@/design";
import { DOCK_SPACE } from "@/features/shell/Dock";
import { categoryLabel, useT } from "@/i18n";
import { getClock } from "@/lib/clock";
import { formatDayLabel, formatShortDate } from "@/lib/dateLabels";
import { formatRupiah } from "@/lib/money";

import { useCategories } from "../categories/categories";
import { FilterPanel } from "./FilterPanel";
import { extraCount, extraToFilter, NO_EXTRA, type ExtraFilters } from "./filters";
import { TransactionRow } from "../transactions/components/TransactionRow";
import { TransactionDetail } from "../transactions/TransactionDetail";
import { groupByDay } from "../transactions/grouping";
import { useWallets, walletName } from "../wallets/wallets";

const PAGE = 40;
type TypeFilter = "all" | "expense" | "income";

export function HistoryScreen() {
  const t = useT();
  const router = useRouter();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, widthClass } = useBreakpoint();
  const wide = widthClass === "expanded";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const write = useWrite();
  const { show } = useSnackbar();
  const reduce = useReduceMotion();
  const { byId } = useCategories();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const today = getClock().today;
  const params = useLocalSearchParams<{ category?: string; from?: string; to?: string; wallet?: string; tag?: string }>();
  const filterCategory = params.category || undefined;
  const filterFrom = params.from || undefined;
  const filterTo = params.to || undefined;
  const filterWallet = params.wallet || undefined;
  const filterTag = params.tag || undefined;
  // The filters that do not come from a link live here. The panel is closed until the person opens it.
  const [extra, setExtra] = useState<ExtraFilters>(NO_EXTRA);
  const [panelOpen, setPanelOpen] = useState(false);

  // Search runs a moment after typing stops, so each letter does not query the database.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text);
      setLimit(PAGE);
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);

  const wallets = useWallets();
  // The wallet lives in the route, like the category, so Insights can open History on the same one.
  // One that has been hidden since stops filtering, so a list is never narrowed by something the person cannot see.
  const walletId = filterWallet && (wallets.data === undefined || wallets.data.some((wallet) => wallet.id === filterWallet)) ? filterWallet : null;
  const pickWallet = (id: string) => {
    router.setParams({ wallet: id });
    setLimit(PAGE);
  };
  const tags = useQuery(["tags"], (db) => listTags(db));
  // A tag that was deleted since stops filtering, for the same reason as a hidden wallet.
  const tagId = filterTag && (tags.data === undefined || tags.data.some((tag) => tag.id === filterTag)) ? filterTag : undefined;
  const tagName = tagId ? tags.data?.find((tag) => tag.id === tagId)?.name : undefined;
  const list = useQuery(["history", search, type, limit, filterCategory, filterFrom, filterTo, walletId, tagId, extra], (db) =>
    listTransactions(db, {
      search,
      types: type === "all" ? undefined : [type],
      categoryId: filterCategory,
      fromDate: filterFrom,
      toDate: filterTo,
      walletId: walletId ?? undefined,
      tagId,
      ...extraToFilter(extra),
      limit,
    }),
  );
  const rows = list.data;
  // The tags of the rows on screen, in one read.
  const rowIds = (rows ?? []).map((row) => row.id);
  const tagNames = useQuery(["history-tags", rowIds.join(",")], (db) => tagsFor(db, rowIds));
  const sections = useMemo(
    () => groupByDay(rows ?? []).map((group) => ({ date: group.date, spent: group.spent, data: group.items })),
    [rows],
  );

  const remove = async (tx: Transaction) => {
    await write((db) => softDeleteTransaction(db, tx.id));
    show({ message: t.history.deleted, actionLabel: t.common.undo, onAction: () => void write((db) => restoreTransaction(db, tx.id)) });
  };
  // Beside the list on a wide window, a screen of its own on a phone.
  const open = (tx: Transaction) => (wide ? setSelectedId(tx.id) : router.push({ pathname: "/transaction/[id]", params: { id: tx.id } }));
  // A transfer has its own screen: two wallets and an amount, no category.
  const edit = (tx: Transaction) => router.push({ pathname: tx.type === "transfer" ? "/transfer" : "/add", params: { edit: tx.id } });

  const filters: { value: TypeFilter; label: string }[] = [
    { value: "all", label: t.history.all },
    { value: "expense", label: t.history.expenses },
    { value: "income", label: t.history.income },
  ];
  const datesOn = filterFrom !== undefined || filterTo !== undefined;
  const filtersOn = extraCount(extra) + (datesOn ? 1 : 0) + (tagId ? 1 : 0);
  const searching = search.trim() !== "" || type !== "all" || filterCategory !== undefined || walletId !== null || filtersOn > 0;

  // One chip for each filter of the panel that is on, so the list never narrows without saying so. Tapping one lifts it.
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (datesOn) {
    active.push({
      key: "dates",
      // One day, as from the calendar, reads as that day and not as a range from it to itself.
      label:
        filterFrom && filterFrom === filterTo
          ? formatShortDate(filterFrom, t, today)
          : t.history.datesSummary(filterFrom ? formatShortDate(filterFrom, t, today) : null, filterTo ? formatShortDate(filterTo, t, today) : null),
      clear: () => router.setParams({ from: "", to: "" }),
    });
  }
  if (extra.min.trim() !== "" || extra.max.trim() !== "") {
    const { minAmount, maxAmount } = extraToFilter(extra);
    active.push({
      key: "amount",
      label: t.history.amountSummary(minAmount === undefined ? null : formatRupiah(minAmount), maxAmount === undefined ? null : formatRupiah(maxAmount)),
      clear: () => setExtra({ ...extra, min: "", max: "" }),
    });
  }
  if (tagId && tagName) active.push({ key: "tag", label: `#${tagName}`, clear: () => router.setParams({ tag: "" }) });
  if (extra.hasReceipt) active.push({ key: "receipt", label: t.history.receiptSummary, clear: () => setExtra({ ...extra, hasReceipt: false }) });
  if (extra.hasLocation) active.push({ key: "location", label: t.history.placeSummary, clear: () => setExtra({ ...extra, hasLocation: false }) });
  if (extra.place.trim() !== "") active.push({ key: "place", label: t.history.placeNamed(extra.place.trim()), clear: () => setExtra({ ...extra, place: "" }) });

  const clearAll = () => {
    setExtra(NO_EXTRA);
    setType("all");
    setText("");
    setSearch("");
    setLimit(PAGE);
    router.setParams({ category: "", from: "", to: "", wallet: "", tag: "" });
  };

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header">
        {t.history.title}
      </Text>
      <View style={[styles.search, { backgroundColor: color.surface1, borderColor: color.outline }]}>
        <Icon name="search-outline" size={20} color={color.textSecondary} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t.history.search}
          placeholderTextColor={color.textTertiary}
          accessibilityLabel={t.history.search}
          returnKeyType="search"
          autoCorrect={false}
          selectionColor={color.accentInk}
          cursorColor={color.accentInk}
          style={[styles.searchInput, { color: color.text }]}
        />
      </View>
      {filterCategory ? (
        <View style={styles.chips}>
          <Chip label={`${t.insights.filteredBy(byId.get(filterCategory) ? categoryLabel(byId.get(filterCategory)!, t) : "")} - ${t.insights.clearFilter}`} icon="close" selected onPress={() => router.setParams({ category: "", from: "", to: "" })} />
        </View>
      ) : null}
      <View style={styles.chips}>
        {filters.map((filter) => (
          <Chip key={filter.value} label={filter.label} selected={type === filter.value} onPress={() => { setType(filter.value); setLimit(PAGE); }} />
        ))}
      </View>
      {wallets.data && wallets.data.length > 1 ? (
        <View style={styles.chips}>
          <Chip label={t.wallets.filterAll} selected={walletId === null} onPress={() => pickWallet("")} />
          {wallets.data.map((wallet) => (
            <Chip key={wallet.id} label={walletName(wallet, t)} selected={walletId === wallet.id} onPress={() => pickWallet(wallet.id)} />
          ))}
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip label={filtersOn > 0 ? t.history.filtersOn(filtersOn) : t.history.filters} icon="options-outline" selected={panelOpen} onPress={() => setPanelOpen((open) => !open)} />
        {active.map((chip) => (
          <Chip key={chip.key} label={chip.label} selected onPress={chip.clear} />
        ))}
      </View>
      {panelOpen ? (
        <FilterPanel
          extra={extra}
          onExtra={(next) => {
            setExtra(next);
            setLimit(PAGE);
          }}
          from={filterFrom}
          to={filterTo}
          onDates={(from, to) => router.setParams({ from: from ?? "", to: to ?? "" })}
          tags={tags.data ?? []}
          tagId={tagId}
          onTag={(id) => router.setParams({ tag: id ?? "" })}
          today={today}
          onClear={clearAll}
        />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, wide && styles.split, { backgroundColor: color.canvas }]}>
      <View style={[wide ? styles.listPane : styles.fill, { paddingTop: insets.top + 12 }]}>
      <SectionList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        // On a wide window the rail takes the place of the dock, so the list needs no room at the bottom for it.
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + (wide ? 0 : DOCK_SPACE) + 24, gap: 0 }}
        renderSectionHeader={({ section }) => (
          <View style={[styles.dayHeader, { backgroundColor: color.canvas }]}>
            <Text variant="label" tone="secondary">
              {formatDayLabel(section.date, today, t)}
            </Text>
            {section.spent > 0 ? (
              <Text variant="caption" tone="secondary">
                {t.history.dayTotal(formatRupiah(section.spent))}
              </Text>
            ) : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          // A deleted row fades out and the rows below close the gap. Reduced motion removes it at once.
          <Animated.View layout={reduce ? undefined : LinearTransition.duration(200)} exiting={reduce ? undefined : FadeOut.duration(120)}>
            <SwipeRow labels={{ edit: t.history.edit, delete: t.history.delete }} editable={item.type === "expense" || item.type === "income" || item.type === "transfer"} onEdit={() => edit(item)} onDelete={() => remove(item)}>
              <View style={[styles.rowBox, { backgroundColor: wide && item.id === selectedId ? color.surface3 : color.surface1 }, index === 0 && styles.first, index === section.data.length - 1 && styles.last]}>
                <TransactionRow tx={item} category={item.categoryId ? byId.get(item.categoryId) : undefined} tags={tagNames.data?.get(item.id)} divider={index < section.data.length - 1} onPress={() => open(item)} />
              </View>
            </SwipeRow>
          </Animated.View>
        )}
        ListEmptyComponent={
          list.loading ? (
            <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.skeletons}>
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </View>
          ) : (
            <EmptyState
              source={require("../../assets/mascot/what2.png")}
              title={searching ? t.history.noResultsTitle : t.history.emptyTitle}
              body={searching ? t.history.noResultsBody : t.history.emptyBody}
              actionLabel={searching ? undefined : t.home.recordExpense}
              onAction={searching ? undefined : () => router.push("/add")}
            />
          )
        }
        ListFooterComponent={rows && rows.length >= limit ? <Button label={t.history.loadMore} variant="secondary" onPress={() => setLimit((n) => n + PAGE)} fullWidth /> : null}
      />
      </View>
      {wide ? (
        <View style={[styles.detailPane, { borderLeftColor: color.hairline }]}>
          {selectedId ? (
            <TransactionDetail key={selectedId} id={selectedId} beside onClose={() => setSelectedId(null)} />
          ) : (
            <View style={styles.pickOne}>
              <Text variant="body" tone="secondary" style={styles.pickOneText}>
                {t.history.pickOne}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function SwipeRow({
  children,
  labels,
  editable,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  labels: { edit: string; delete: string };
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { color } = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={editable ? () => <Action icon="create-outline" label={labels.edit} background={color.surface3} foreground={color.text} /> : undefined}
      renderRightActions={() => <Action icon="trash-outline" label={labels.delete} background={color.danger} foreground={color.onDanger} />}
      onSwipeableOpen={(direction) => {
        ref.current?.close();
        // The direction is the way the row was swiped: right reveals Edit on the left, left reveals Delete on the right.
        if (direction === "right") onEdit();
        else onDelete();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function Action({ icon, label, background, foreground }: { icon: "create-outline" | "trash-outline"; label: string; background: string; foreground: string }) {
  return (
    <View style={[styles.action, { backgroundColor: background }]}>
      <Icon name={icon} size={22} color={foreground} />
      <Text variant="caption" style={{ color: foreground }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  // A wide window shows the list and, beside it, the transaction that was picked.
  split: { flexDirection: "row" },
  listPane: { flex: 2, maxWidth: 520 },
  detailPane: { flex: 3, borderLeftWidth: StyleSheet.hairlineWidth },
  pickOne: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  pickOneText: { textAlign: "center" },
  header: { gap: 12, paddingBottom: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderRadius: 16 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 8 },
  rowBox: { paddingHorizontal: 8 },
  first: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8 },
  last: { borderBottomLeftRadius: 22, borderBottomRightRadius: 22, paddingBottom: 8 },
  action: { width: 92, alignItems: "center", justifyContent: "center", gap: 4 },
  skeletons: { gap: 12, marginTop: 24 },
});
