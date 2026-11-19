import type { Transaction } from "@/db/repo/transactions";
import type { LocalDate } from "@/lib/dates";

export type DayGroup = {
  date: LocalDate;
  items: Transaction[];
  /** Expenses of that day. */
  spent: number;
  income: number;
};

/**
 * Groups a list that is already newest first into days, using the local date
 * stored with each row. A 23:30 purchase made in another time zone stays on the
 * day it happened.
 */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of transactions) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== tx.occurredLocalDate) {
      group = { date: tx.occurredLocalDate, items: [], spent: 0, income: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    if (tx.type === "expense") group.spent += tx.amount;
    else if (tx.type === "income") group.income += tx.amount;
  }
  return groups;
}
