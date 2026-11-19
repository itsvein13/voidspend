// The amount keypad as a small calculator, so the system keyboard never has to
// open for an amount. Pure functions: tokens are digit strings and "+" or "-".
import { groupThousands } from "@/lib/money";

export type KeypadKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "000" | "+" | "-" | "back" | "clear" | "equals";

export type KeypadState = { tokens: string[] };

export const emptyKeypad: KeypadState = { tokens: [] };

/** Longest number one term may have. Twelve digits is far past any salary. */
export const MAX_DIGITS = 12;

const isOperator = (token: string | undefined): boolean => token === "+" || token === "-";

/** Start from an amount that already exists, to edit it. */
export function keypadFromAmount(value: number): KeypadState {
  const whole = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  return whole > 0 ? { tokens: [String(whole)] } : emptyKeypad;
}

/** Left to right, never below zero. A trailing operator is ignored. */
export function keypadTotal(state: KeypadState): number {
  let total = 0;
  let operator = "+";
  for (const token of state.tokens) {
    if (isOperator(token)) {
      operator = token;
    } else {
      total += operator === "+" ? Number(token) : -Number(token);
    }
  }
  return Math.max(0, total);
}

export function keypadHasOperator(state: KeypadState): boolean {
  return state.tokens.some(isOperator);
}

/** "25.000 + 12.500", for the line above the total. */
export function keypadExpression(state: KeypadState): string {
  return state.tokens
    .map((token) => (isOperator(token) ? (token === "+" ? "+" : "−") : groupThousands(Number(token))))
    .join(" ");
}

export function pressKey(state: KeypadState, key: KeypadKey): KeypadState {
  const tokens = state.tokens;
  const last = tokens[tokens.length - 1];

  if (key === "clear") return emptyKeypad;

  if (key === "back") {
    if (last === undefined) return state;
    if (isOperator(last)) return { tokens: tokens.slice(0, -1) };
    const shorter = last.slice(0, -1);
    return { tokens: shorter ? [...tokens.slice(0, -1), shorter] : tokens.slice(0, -1) };
  }

  if (key === "+" || key === "-") {
    if (last === undefined) return state; // an amount cannot start with an operator
    if (isOperator(last)) return { tokens: [...tokens.slice(0, -1), key] };
    return { tokens: [...tokens, key] };
  }

  if (key === "equals") {
    if (!keypadHasOperator(state)) return state;
    const total = keypadTotal(state);
    return total > 0 ? { tokens: [String(total)] } : emptyKeypad;
  }

  // Digits. "000" is three zeros at once, but never a leading zero.
  const digits = key;
  if (last === undefined || isOperator(last)) {
    return { tokens: [...tokens, digits === "000" ? "0" : digits] };
  }
  if (last === "0") {
    return digits === "000" || digits === "0" ? state : { tokens: [...tokens.slice(0, -1), digits] };
  }
  const room = MAX_DIGITS - last.length;
  if (room <= 0) return state;
  return { tokens: [...tokens.slice(0, -1), last + digits.slice(0, room)] };
}
