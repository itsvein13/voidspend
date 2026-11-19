// The state of the add and edit sheet, and how it becomes a transaction. Pure
// and free of React, so the rules (what can be saved, how "now" and "yesterday"
// turn into a moment, what an edit keeps) are covered by unit tests.
import type { Location, NewTransaction, Transaction, TransactionPatch } from "@/db/repo/transactions";
import { DEFAULT_WALLET_ID, ValidationError } from "@/db/types";
import { addDays, epochFromLocal, localDateOf, localTimeOf, type LocalDate } from "@/lib/dates";
import { emptyKeypad, keypadFromAmount, keypadTotal, type KeypadState } from "@/design/primitives/keypad";

export type FormType = "expense" | "income" | "saving_deposit" | "saving_withdrawal";

export const isSavingType = (type: FormType): boolean => type === "saving_deposit" || type === "saving_withdrawal";

export type When =
  | { kind: "now" }
  | { kind: "yesterday" }
  | { kind: "custom"; date: LocalDate; hour: number; minute: number };

export const PAYMENT_METHODS = ["cash", "debit", "credit", "qris", "ewallet", "bank_transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type FormState = {
  type: FormType;
  amount: KeypadState;
  categoryId: string | null;
  /** For saving types: the goal the money goes into or comes out of. */
  goalId: string | null;
  title: string;
  counterparty: string;
  when: When;
  /** Off means "I only know the day": stored as a date at noon. */
  timeKnown: boolean;
  note: string;
  paymentMethod: PaymentMethod | null;
  /** The wallet the money moves in. The main wallet unless the person picks another. */
  walletId: string;
  /** Tags the person put on it, as typed. Saved together with the transaction. */
  tags: string[];
  /** A place the person added: typed, or one reading of the device location. Never added by itself. */
  location: Location | null;
  /** The zone an edited transaction was recorded in. Null means the phone's current zone. */
  zone: { tz: string; offsetMin: number } | null;
};

export type FormClock = { now: number; offsetMin: number; tz: string };

export function initialForm(type: FormType = "expense"): FormState {
  return {
    type,
    amount: emptyKeypad,
    categoryId: null,
    goalId: null,
    title: "",
    counterparty: "",
    when: { kind: "now" },
    timeKnown: true,
    note: "",
    paymentMethod: null,
    walletId: DEFAULT_WALLET_ID,
    tags: [],
    location: null,
    zone: null,
  };
}

/** Fills the form from an existing expense or income, for Edit. Its tags are read separately and passed in. */
export function formFromTransaction(tx: Transaction, tags: readonly string[] = []): FormState {
  const date = tx.occurredLocalDate;
  const [hour, minute] = localTimeOf(tx.occurredAt, tx.occurredOffsetMin).split(":").map(Number);
  return {
    type: tx.type === "income" || tx.type === "saving_deposit" || tx.type === "saving_withdrawal" ? tx.type : "expense",
    amount: keypadFromAmount(tx.amount),
    categoryId: tx.categoryId,
    goalId: tx.goalId,
    title: tx.title,
    counterparty: tx.counterparty ?? "",
    when: { kind: "custom", date, hour, minute },
    timeKnown: tx.timePrecision === "exact",
    note: tx.note ?? "",
    paymentMethod: (PAYMENT_METHODS as readonly string[]).includes(tx.paymentMethod ?? "") ? (tx.paymentMethod as PaymentMethod) : null,
    walletId: tx.walletId ?? DEFAULT_WALLET_ID,
    tags: [...tags],
    location: tx.location,
    zone: { tz: tx.occurredTz, offsetMin: tx.occurredOffsetMin },
  };
}

/** Duplicate: the same fields, recorded now in the phone's zone. */
export function formForDuplicate(tx: Transaction, tags: readonly string[] = []): FormState {
  // The place is where the first one happened, not where this one does, so it is not copied. The tags are.
  return { ...formFromTransaction(tx, tags), when: { kind: "now" }, timeKnown: true, location: null, zone: null };
}

export function formAmount(form: FormState): number {
  return keypadTotal(form.amount);
}

/** What the Save button needs: an amount above zero and a category. */
export function isSavable(form: FormState): boolean {
  return formAmount(form) > 0 && (isSavingType(form.type) ? form.goalId !== null : form.categoryId !== null);
}

export function resolveMoment(form: Pick<FormState, "when" | "timeKnown" | "zone">, clock: FormClock): { occurredAt: number; precision: "exact" | "date"; offsetMin: number; tz: string } {
  const zone = form.zone ?? { tz: clock.tz, offsetMin: clock.offsetMin };
  const today = localDateOf(clock.now, zone.offsetMin);
  const [nowHour, nowMinute] = localTimeOf(clock.now, zone.offsetMin).split(":").map(Number);

  let date: LocalDate;
  let hour: number;
  let minute: number;
  switch (form.when.kind) {
    case "now":
      date = today;
      [hour, minute] = [nowHour, nowMinute];
      break;
    case "yesterday":
      date = addDays(today, -1);
      [hour, minute] = [nowHour, nowMinute];
      break;
    case "custom":
      ({ date, hour, minute } = form.when);
      break;
  }

  if (!form.timeKnown) {
    return { occurredAt: epochFromLocal(date, 12, 0, zone.offsetMin), precision: "date", ...zone, offsetMin: zone.offsetMin };
  }
  // "Now" keeps the exact instant, seconds included, so two entries in one minute still sort.
  const occurredAt = form.when.kind === "now" ? clock.now : epochFromLocal(date, hour, minute, zone.offsetMin);
  return { occurredAt, precision: "exact", ...zone, offsetMin: zone.offsetMin };
}

/**
 * Turns the form into a transaction ready for the repository. A blank title
 * becomes the category's name, so the fastest entry is an amount and a category.
 */
export function buildTransaction(form: FormState, clock: FormClock, fallbackTitle: string): NewTransaction {
  const amount = formAmount(form);
  if (amount <= 0) throw new ValidationError("amount_invalid", "The amount must be above zero.");
  const saving = isSavingType(form.type);
  if (saving && !form.goalId) throw new ValidationError("goal_required", "Pick a goal.");
  if (!saving && !form.categoryId) throw new ValidationError("category_required", "Pick a category.");
  const moment = resolveMoment(form, clock);
  return {
    type: form.type,
    amount,
    title: form.title.trim() || fallbackTitle,
    counterparty: form.counterparty.trim() || null,
    categoryId: saving ? null : form.categoryId,
    goalId: saving ? form.goalId : null,
    paymentMethod: form.paymentMethod,
    walletId: form.walletId,
    location: form.location &&(form.location.name?.trim() || form.location.lat !== null) ? { ...form.location, name: form.location.name?.trim() || null } : null,
    note: form.note.trim() || null,
    occurredAt: moment.occurredAt,
    offsetMin: moment.offsetMin,
    tz: moment.tz,
    timePrecision: moment.precision,
  };
}

/** The fields of a saved transaction as an edit, so Undo can put an edited row back. */
export function patchFromTransaction(tx: Transaction): TransactionPatch {
  return {
    type: tx.type,
    amount: tx.amount,
    title: tx.title,
    counterparty: tx.counterparty,
    categoryId: tx.categoryId,
    goalId: tx.goalId,
    paymentMethod: tx.paymentMethod,
    walletId: tx.walletId,
    location: tx.location,
    note: tx.note,
    occurredAt: tx.occurredAt,
    offsetMin: tx.occurredOffsetMin,
    tz: tx.occurredTz,
    timePrecision: tx.timePrecision,
  };
}
