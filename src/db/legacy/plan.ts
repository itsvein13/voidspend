// Turns parsed v1 data into the rows v2 stores. Pure, so the whole mapping is
// tested on fixtures without a database.
import { epochFromLocal, fromV1Month, localDateOf, monthStart, type LocalDate, type YearMonth } from "@/lib/dates";

import { systemCategoryId } from "../systemCategories";
import { legacyCategory, normalizeLabel, shortHash } from "./labels";
import type { LegacyData, LegacyItem } from "./parse";

export type ImportContext = {
  /** The device's UTC offset in minutes, used to place the v1 ids on a local day. */
  offsetMin: number;
  tz: string;
  now: number;
};

export type PlannedCategory = { id: string; kind: "expense" | "saving"; name: string };
export type PlannedGoal = { id: string; name: string; categoryId: string; targetAmount: number | null };
export type PlannedBudget = { categoryId: string; amount: number };
export type PlannedTransaction = {
  legacyRef: string;
  type: "expense" | "income" | "saving_deposit";
  amount: number;
  title: string;
  categoryId: string | null;
  goalId: string | null;
  occurredAt: number;
  createdAt: number;
  localDate: LocalDate;
  month: YearMonth;
  precision: "estimated" | "date";
};

export type LegacyPlan = {
  categories: PlannedCategory[];
  goals: PlannedGoal[];
  budgets: PlannedBudget[];
  transactions: PlannedTransaction[];
};

/**
 * v1 month and year are the identity of a row's month. The id is the creation
 * time, so it is used as the moment when it falls inside that month on the
 * person's own day. Otherwise (a clock that was wrong, an odd id) the row
 * goes to noon on the 1st of its stored month, so month totals always match.
 */
function momentOf(item: LegacyItem, ctx: ImportContext): { occurredAt: number; createdAt: number; localDate: LocalDate; month: YearMonth } {
  const month = fromV1Month(item.year, item.month);
  if (Number.isFinite(item.id)) {
    const localDate = localDateOf(item.id, ctx.offsetMin);
    if (localDate.slice(0, 7) === month) return { occurredAt: item.id, createdAt: item.id, localDate, month };
  }
  const first = monthStart(month);
  const noon = epochFromLocal(first, 12, 0, ctx.offsetMin);
  return { occurredAt: noon, createdAt: noon, localDate: first, month };
}

function refs() {
  const seen = new Map<string, number>();
  // v1 ids were Date.now(), so two rows can share one. The second gets a suffix.
  return (table: string, id: number, index: number) => {
    const base = `${table}:${Number.isFinite(id) ? id : `n${index}`}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}#${count}`;
  };
}

const clip = (text: string, fallback: string) => (text.trim() === "" ? fallback : text.trim().slice(0, 120));

export function planLegacyImport(data: LegacyData, ctx: ImportContext): LegacyPlan {
  const categories = new Map<string, PlannedCategory>();
  const addCategory = (ref: ReturnType<typeof legacyCategory>) => {
    if (ref.create) categories.set(ref.categoryId, { id: ref.categoryId, kind: ref.create.kind, name: ref.create.name });
    return ref.categoryId;
  };
  const transactions: PlannedTransaction[] = [];

  const expenseRef = refs();
  data.expenses.forEach((item, index) => {
    const moment = momentOf(item, ctx);
    transactions.push({
      legacyRef: expenseRef("expenses", item.id, index),
      type: "expense",
      amount: item.amount,
      title: clip(item.name, "Expense"),
      categoryId: addCategory(legacyCategory(item.category, "expense")),
      goalId: null,
      occurredAt: moment.occurredAt,
      createdAt: moment.createdAt,
      localDate: moment.localDate,
      month: moment.month,
      precision: "estimated",
    });
  });

  // One goal per saving name and category. Its target is the latest one entered.
  const goals = new Map<string, PlannedGoal & { targetId: number }>();
  const savingRef = refs();
  data.savings.forEach((item, index) => {
    const category = legacyCategory(item.category, "saving");
    const categoryId = addCategory(category);
    const goalKey = `${normalizeLabel(item.name)}|${categoryId}`;
    let goal = goals.get(goalKey);
    if (!goal) {
      goal = { id: `leg_goal_${shortHash(goalKey)}`, name: clip(item.name, "Savings"), categoryId, targetAmount: null, targetId: Number.NEGATIVE_INFINITY };
      goals.set(goalKey, goal);
    }
    const order = Number.isFinite(item.id) ? item.id : index;
    if (item.target !== null && order >= goal.targetId) {
      goal.targetAmount = item.target;
      goal.targetId = order;
    }
    const moment = momentOf(item, ctx);
    transactions.push({
      legacyRef: savingRef("savings", item.id, index),
      type: "saving_deposit",
      amount: item.amount,
      title: clip(item.name, "Savings"),
      categoryId: null,
      goalId: goal.id,
      occurredAt: moment.occurredAt,
      createdAt: moment.createdAt,
      localDate: moment.localDate,
      month: moment.month,
      precision: "estimated",
    });
  });

  // A salary of month M (0-based) becomes income on day 1 of month M + 1, noon, date only.
  for (const salary of data.salaries) {
    const month = fromV1Month(salary.year, salary.month);
    const date = monthStart(month);
    const at = epochFromLocal(date, 12, 0, ctx.offsetMin);
    transactions.push({
      legacyRef: `salaries:${salary.year}-${salary.month}`,
      type: "income",
      amount: salary.amount,
      title: "Salary",
      categoryId: systemCategoryId("salary"),
      goalId: null,
      occurredAt: at,
      createdAt: at,
      localDate: date,
      month,
      precision: "date",
    });
  }

  // v1 budgets applied to every month, so they start in the year 2000.
  const budgets: PlannedBudget[] = data.budgets.map((budget) => ({
    categoryId: addCategory(legacyCategory(budget.label, "expense")),
    amount: budget.amount,
  }));

  return {
    categories: [...categories.values()],
    goals: [...goals.values()].map(({ targetId: _ignored, ...goal }) => goal),
    budgets,
    transactions,
  };
}

export type MonthLine = { month: YearMonth; type: PlannedTransaction["type"]; count: number; total: number };

/** What the totals have to be, derived from the plan. Compared with the database after the insert. */
export function expectedLines(transactions: readonly PlannedTransaction[]): MonthLine[] {
  const lines = new Map<string, MonthLine>();
  for (const tx of transactions) {
    const key = `${tx.month}|${tx.type}`;
    const line = lines.get(key) ?? { month: tx.month, type: tx.type, count: 0, total: 0 };
    line.count += 1;
    line.total += tx.amount;
    lines.set(key, line);
  }
  return [...lines.values()].sort((a, b) => (a.month === b.month ? a.type.localeCompare(b.type) : a.month.localeCompare(b.month)));
}

/**
 * The same totals, computed straight from the v1 arrays and never from the
 * plan, so a bug in the mapping cannot hide itself.
 */
export function expectedLinesFromV1(data: LegacyData): MonthLine[] {
  const lines = new Map<string, MonthLine>();
  const add = (month: YearMonth, type: MonthLine["type"], amount: number) => {
    const key = `${month}|${type}`;
    const line = lines.get(key) ?? { month, type, count: 0, total: 0 };
    line.count += 1;
    line.total += amount;
    lines.set(key, line);
  };
  for (const e of data.expenses) add(fromV1Month(e.year, e.month), "expense", e.amount);
  for (const s of data.savings) add(fromV1Month(s.year, s.month), "saving_deposit", s.amount);
  for (const s of data.salaries) add(fromV1Month(s.year, s.month), "income", s.amount);
  return [...lines.values()].sort((a, b) => (a.month === b.month ? a.type.localeCompare(b.type) : a.month.localeCompare(b.month)));
}
