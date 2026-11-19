// The starting balance of a wallet as the form shows it. The amount field only takes digits, so a balance
// below zero (a credit card, a loan) is a switch next to it and not a minus sign typed into the number.
import { formatNumberInput, parseFormattedNumber } from "@/utils/format";

/** What is typed and whether it is owed, as the number stored on the wallet. Blank means zero. */
export function openingFromInput(text: string, owed: boolean): number {
  const value = text.trim() === "" ? 0 : parseFormattedNumber(text);
  // Zero stays zero: "owed" with nothing typed must not store minus zero.
  return owed && value > 0 ? -value : value;
}

/** The inverse, for opening a saved wallet in the form. */
export function inputFromOpening(balance: number): { text: string; owed: boolean } {
  return { text: balance === 0 ? "" : formatNumberInput(String(Math.abs(balance))), owed: balance < 0 };
}
