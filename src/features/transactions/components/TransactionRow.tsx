import { StyleSheet, View } from "react-native";

import type { Category } from "@/db/repo/categories";
import type { Transaction } from "@/db/repo/transactions";
import { Amount, Icon, ListRow, useTheme, type AmountKind } from "@/design";
import { categoryLabel, useT } from "@/i18n";
import { localTimeOf } from "@/lib/dates";

import { categoryColor, categoryIcon } from "../../categories/categories";

const KIND: Record<Transaction["type"], AmountKind> = {
  expense: "expense",
  income: "income",
  saving_deposit: "saving",
  saving_withdrawal: "saving",
  transfer: "neutral",
  adjustment: "neutral",
};

/** A round-cornered tile with the category icon. Decorative: the row's text names the category. */
export function CategoryTile({ category }: { category: Category | undefined }) {
  const { color } = useTheme();
  const tint = category ? categoryColor(color, category.color) : color.textSecondary;
  return (
    <View style={[styles.tile, { backgroundColor: color.surface3 }]}>
      <Icon name={categoryIcon(category)} size={22} color={tint} />
    </View>
  );
}

export type TransactionRowProps = {
  tx: Transaction;
  category: Category | undefined;
  onPress: () => void;
  divider?: boolean;
  /** Shown after the category when the time is known: "Food, 14:32". */
  showTime?: boolean;
  /** The tags of the transaction, shown last as "#liburan #kantor". */
  tags?: readonly string[];
};

export function TransactionRow({ tx, category, onPress, divider = false, showTime = true, tags }: TransactionRowProps) {
  const t = useT();
  const name = category ? categoryLabel(category, t) : t.detail.types[tx.type];
  // The category name is left out when the title already is it, so "Food" is not said twice.
  const parts = [
    tx.title === name ? null : name,
    showTime && tx.timePrecision === "exact" ? localTimeOf(tx.occurredAt, tx.occurredOffsetMin) : null,
    tx.counterparty && tx.counterparty !== tx.title ? tx.counterparty : null,
    tags && tags.length > 0 ? tags.map((tag) => `#${tag}`).join(" ") : null,
  ].filter(Boolean);
  return (
    <ListRow
      title={tx.title}
      subtitle={parts.length > 0 ? parts.join(", ") : undefined}
      leading={<CategoryTile category={category} />}
      trailing={<Amount value={tx.amount} kind={KIND[tx.type]} size="sm" />}
      onPress={onPress}
      chevron={false}
      divider={divider}
    />
  );
}

const styles = StyleSheet.create({
  tile: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
