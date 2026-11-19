// Money is whole rupiah. Amounts always read "Rp 25.000" so they match what is
// printed on receipts, in both languages.
const NBSP = " "; // keeps "Rp" and the number on one line
const MINUS = "−"; // a real minus sign, not a hyphen

export type SignMode = "auto" | "always" | "never";

/** 1250000 becomes "1.250.000". Sign and decimals are dropped. */
export function groupThousands(value: number): string {
  const whole = Number.isFinite(value) ? Math.abs(Math.round(value)) : 0;
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * `auto` marks only negative amounts, `always` marks positive ones too, and
 * `never` shows the size alone. Zero never carries a sign.
 */
export function formatRupiah(value: number, sign: SignMode = "auto"): string {
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  const body = `Rp${NBSP}${groupThousands(rounded)}`;
  if (sign === "never" || rounded === 0) return body;
  if (rounded < 0) return `${MINUS}${body}`;
  return sign === "always" ? `+${body}` : body;
}

export type FormattedChar = { char: string; digit: number | null };

/** Splits a formatted amount into characters, marking which ones are digits. */
export function splitFormatted(text: string): FormattedChar[] {
  return Array.from(text).map((char) => ({
    char,
    digit: /[0-9]/.test(char) ? Number(char) : null,
  }));
}
