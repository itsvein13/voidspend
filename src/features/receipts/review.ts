// The state of the review screen, and how it becomes a transaction. Nothing from
// a scan is saved until the person has looked at this state, so everything here
// is editable data, and every field that came from a guess keeps a flag.
import type { NewTransaction } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { addDays, epochFromLocal, localDateOf, type LocalDate } from "@/lib/dates";

import type { PaymentMethod } from "../transactions/form";
import type { ItemKind, ParsedReceipt } from "./parse";

export type ReviewItem = {
  id: string;
  kind: ItemKind;
  name: string;
  quantity: number;
  unitPrice: number | null;
  /** Signed: a discount is negative. */
  lineTotal: number;
};

export type ReviewState = {
  merchant: string;
  address: string | null;
  date: LocalDate | null;
  time: { hour: number; minute: number } | null;
  /** Off means the receipt has no time: the day is stored at noon. */
  timeKnown: boolean;
  total: number;
  items: ReviewItem[];
  categoryId: string | null;
  note: string;
  paymentMethod: PaymentMethod | null;
  /** What the reader was sure about, so the screen can mark the rest. */
  flags: { merchant: boolean; date: boolean; total: "high" | "low" | "none" };
};

export function reviewFromParsed(parsed: ParsedReceipt, newId: () => string): ReviewState {
  const items = parsed.items.map((item) => ({ id: newId(), ...item }));
  return {
    merchant: parsed.merchant ?? "",
    address: parsed.address,
    date: parsed.date,
    time: parsed.time,
    timeKnown: parsed.time !== null,
    // A missing total falls back to what the lines add up to, flagged so the person checks it.
    total: parsed.total ?? Math.max(0, items.reduce((sum, item) => sum + item.lineTotal, 0)),
    items,
    categoryId: null,
    note: "",
    paymentMethod: parsed.paymentMethod,
    flags: { merchant: parsed.merchant !== null, date: parsed.date !== null, total: parsed.totalConfidence },
  };
}

export const emptyReview = (): ReviewState => ({
  merchant: "",
  address: null,
  date: null,
  time: null,
  timeKnown: false,
  total: 0,
  items: [],
  categoryId: null,
  note: "",
  paymentMethod: null,
  flags: { merchant: false, date: false, total: "none" },
});

export const itemsSum = (items: readonly ReviewItem[]): number => items.reduce((sum, item) => sum + item.lineTotal, 0);

const tolerance = (total: number) => Math.max(500, Math.round(total * 0.005));

/** Do the lines add up to the total, within what a rounding line could explain? Receipts without lines cannot be checked. */
export function checkReview(state: ReviewState): { ok: boolean; computed: number; diff: number } {
  if (state.items.length === 0) return { ok: true, computed: 0, diff: state.total };
  const computed = itemsSum(state.items);
  const diff = state.total - computed;
  return { ok: Math.abs(diff) <= tolerance(state.total), computed, diff };
}

/** Save stays off until there is a total. Nothing else is required. */
export const canSaveReview = (state: ReviewState): boolean => Number.isSafeInteger(state.total) && state.total > 0;

export type ReviewClock = { now: number; offsetMin: number; tz: string };

export function reviewMoment(state: ReviewState, clock: ReviewClock): { occurredAt: number; precision: "exact" | "date"; date: LocalDate } {
  const today = localDateOf(clock.now, clock.offsetMin);
  // A receipt dated in the future is a misread. Fall back to today instead of recording tomorrow.
  const date = state.date && state.date <= addDays(today, 1) ? state.date : today;
  if (state.timeKnown && state.time) return { occurredAt: epochFromLocal(date, state.time.hour, state.time.minute, clock.offsetMin), precision: "exact", date };
  return { occurredAt: epochFromLocal(date, 12, 0, clock.offsetMin), precision: "date", date };
}

export function reviewToTransaction(state: ReviewState, clock: ReviewClock, receiptId: string, fallbackTitle: string): NewTransaction {
  const moment = reviewMoment(state, clock);
  const merchant = state.merchant.trim();
  return {
    type: "expense",
    amount: state.total,
    title: merchant || fallbackTitle,
    counterparty: merchant || null,
    // No category chosen means "Other", so a quick save is never blocked by it.
    categoryId: state.categoryId ?? systemCategoryId("other"),
    paymentMethod: state.paymentMethod,
    note: state.note.trim() || null,
    occurredAt: moment.occurredAt,
    offsetMin: clock.offsetMin,
    tz: clock.tz,
    timePrecision: moment.precision,
    source: "receipt",
    receiptId,
    location: state.address ? { name: state.address, lat: null, lng: null, source: "receipt" } : null,
  };
}

/** Reads a saved draft back. A draft that cannot be read becomes an empty review instead of an error. */
export function reviewFromJson(json: string | null): ReviewState {
  if (!json) return emptyReview();
  try {
    const value = JSON.parse(json) as Partial<ReviewState>;
    if (typeof value !== "object" || value === null || !Array.isArray(value.items)) return emptyReview();
    return { ...emptyReview(), ...value, flags: { ...emptyReview().flags, ...(value.flags ?? {}) } };
  } catch {
    return emptyReview();
  }
}
