// Reads the text of an Indonesian receipt. Pure TypeScript with no native code,
// so every rule below is covered by a test on text fixtures. It never guesses
// silently: what it is unsure about is reported (`confidence`, `check`) and the
// review screen shows it, because a receipt is only saved after the person
// has looked at it.
import { formatLocalDate, isValidLocalDate, type LocalDate } from "@/lib/dates";

export type OcrLine = { text: string; top: number; bottom: number; left: number; right: number };

export type ItemKind = "item" | "tax" | "service" | "discount" | "fee" | "rounding";

export type ParsedItem = {
  kind: ItemKind;
  name: string;
  quantity: number;
  unitPrice: number | null;
  /** Signed: a discount is negative. */
  lineTotal: number;
};

export type PaymentGuess = "cash" | "debit" | "credit" | "qris" | "ewallet" | "bank_transfer" | null;

export type ParsedReceipt = {
  merchant: string | null;
  address: string | null;
  date: LocalDate | null;
  time: { hour: number; minute: number } | null;
  items: ParsedItem[];
  subtotal: number | null;
  total: number | null;
  paymentMethod: PaymentGuess;
  /** "high" when a total line was read and the lines add up to it. */
  totalConfidence: "high" | "low" | "none";
  check: { ok: boolean; computed: number; diff: number };
};

// ---------- amounts ----------

const MAX_AMOUNT = 10_000_000_000;

/**
 * "Rp 25.000", "25,000", "25.000,00", "25000", "(5.000)" and "5.000-" all become
 * whole rupiah. A separator followed by exactly three digits is a thousands
 * separator, one followed by one or two digits is a decimal and is rounded.
 */
export function parseAmount(raw: string): number | null {
  let text = raw.trim();
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^(?:Rp\.?|IDR)\s*/i, "").replace(/\s+/g, "");
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (text.endsWith("-")) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (!/^\d[\d.,]*$/.test(text)) return null;

  const dot = text.lastIndexOf(".");
  const comma = text.lastIndexOf(",");
  let digits: string;
  if (dot >= 0 && comma >= 0) {
    const decimalAt = Math.max(dot, comma);
    const tail = text.slice(decimalAt + 1);
    const head = text.slice(0, decimalAt).replace(/[.,]/g, "");
    digits = tail.length === 3 ? head + tail : tail.length <= 2 ? head : "";
  } else if (dot >= 0 || comma >= 0) {
    const sep = dot >= 0 ? "." : ",";
    const parts = text.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length > 2) digits = parts.every((part, index) => index === 0 || part.length === 3) ? parts.join("") : "";
    else if (tail.length === 3) digits = parts.join("");
    else if (tail.length <= 2) digits = parts[0];
    else digits = "";
  } else {
    digits = text;
  }
  if (digits === "") return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value > MAX_AMOUNT) return null;
  return negative ? -value : value;
}

export type FoundAmount = { value: number; index: number; raw: string };

// A number that is not glued to letters (so "600ML" is not an amount), with an optional Rp, sign or brackets.
const AMOUNT_TOKEN = /(?:Rp\.?\s*)?[-(]?\d[\d.,]*\)?-?(?![A-Za-z\d])/gi;

/** Money in a line. Small bare numbers (a quantity of 2) are not treated as money. */
const MASKS: RegExp[] = [
  /\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}/g,
  /\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}(?!\d)/g,
  /\d{1,2}\s*[-\s]\s*[A-Za-z]{3,9}\.?\s*[-\s]?\s*\d{2,4}/g,
  /\d{1,2}:\d{2}(?::\d{2})?/g,
  /\+?\d{3,5}[-\s]\d{3,5}[-\s]\d{3,5}/g,
  /\d{9,}/g,
];

/** Money in a line. Dates, times, phone numbers and small bare numbers (a quantity of 2) are not money. */
export function findAmounts(line: string): FoundAmount[] {
  let masked = line;
  for (const mask of MASKS) masked = masked.replace(mask, (text) => " ".repeat(text.length));
  const found: FoundAmount[] = [];
  for (const match of masked.matchAll(AMOUNT_TOKEN)) {
    const raw = match[0];
    const value = parseAmount(raw);
    if (value === null) continue;
    if (!/^(?:Rp|IDR)/i.test(raw) && Math.abs(value) < 100) continue;
    found.push({ value, index: match.index ?? 0, raw });
  }
  return found;
}

// ---------- rows ----------

/** Joins OCR lines that sit at the same height into one row, left to right, so a name stays next to its price. */
export function rowsFromOcr(lines: readonly OcrLine[]): string[] {
  const sorted = [...lines].sort((a, b) => a.top - b.top || a.left - b.left);
  const heights = sorted.map((line) => line.bottom - line.top).sort((a, b) => a - b);
  const median = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0;
  const tolerance = Math.max(2, median * 0.6);
  const rows: OcrLine[][] = [];
  for (const line of sorted) {
    const center = (line.top + line.bottom) / 2;
    const row = rows[rows.length - 1];
    const rowCenter = row ? row.reduce((sum, item) => sum + (item.top + item.bottom) / 2, 0) / row.length : 0;
    if (row && Math.abs(center - rowCenter) <= tolerance) row.push(line);
    else rows.push([line]);
  }
  return rows.map((row) => row.sort((a, b) => a.left - b.left).map((line) => line.text.trim()).join(" ")).filter((text) => text !== "");
}

export const rowsFromText = (text: string): string[] => text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line !== "");

// ---------- dates ----------

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agus: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, nop: 11, november: 11, des: 12, dec: 12, desember: 12, december: 12,
};

const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

function makeDate(year: number, month: number, day: number): LocalDate | null {
  const y = fullYear(year);
  if (y < 2000 || y > 2100) return null;
  const value = formatLocalDate(y, month, day);
  return isValidLocalDate(value) ? value : null;
}

export function findDate(text: string): LocalDate | null {
  const iso = /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/.exec(text);
  if (iso) {
    const value = makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (value) return value;
  }
  const numeric = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(text);
  if (numeric) {
    const [a, b, y] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
    // Indonesian receipts write day first. Fall back to month first only when day first is impossible.
    const value = makeDate(y, b, a) ?? makeDate(y, a, b);
    if (value) return value;
  }
  const named = /(\d{1,2})\s*[-\s]\s*([A-Za-z]{3,9})\.?\s*[-\s]?\s*(\d{2,4})/.exec(text);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) {
      const value = makeDate(Number(named[3]), month, Number(named[1]));
      if (value) return value;
    }
  }
  return null;
}

export function findTime(text: string): { hour: number; minute: number } | null {
  const match = /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\d)/.exec(text);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

// ---------- merchant ----------

const CHAINS: [RegExp, string][] = [
  [/INDOMARET/, "Indomaret"], [/ALFAMART/, "Alfamart"], [/ALFAMIDI/, "Alfamidi"], [/STARBUCKS/, "Starbucks"],
  [/KOPI\s*KENANGAN/, "Kopi Kenangan"], [/JANJI\s*JIWA/, "Janji Jiwa"], [/\bKFC\b/, "KFC"], [/MC\s*DONALD/, "McDonald's"],
  [/PERTAMINA/, "Pertamina"], [/\bSHELL\b/, "Shell"], [/SUPER\s*INDO/, "Superindo"], [/HYPERMART/, "Hypermart"],
  [/GUARDIAN/, "Guardian"], [/KIMIA\s*FARMA/, "Kimia Farma"], [/\bK24\b/, "K24"], [/LAWSON/, "Lawson"], [/CIRCLE\s*K/, "Circle K"],
  [/GRAB/, "Grab"], [/GOJEK|GO-JEK/, "Gojek"], [/BREADTALK/, "BreadTalk"], [/J\.?CO/, "J.Co"], [/PIZZA\s*HUT/, "Pizza Hut"],
];

const NOT_A_NAME = /(\bJL\b|JALAN|\bNO\b|TELP|\bTEL\b|\bHP\b|NPWP|\bRT\b|\bRW\b|KEC\b|KOTA|KODE\s*POS|WWW|HTTP|@|STRUK|RECEIPT|INVOICE|KASIR|CASHIER)/i;
const ADDRESS = /(\bJL\b|JALAN|\bRT\b|\bRW\b|KEC\b|KEL\b|KOTA|KAB\b|\bNO\.?\s*\d)/i;

const titleCase = (text: string) =>
  text === text.toUpperCase() ? text.toLowerCase().replace(/(^|\s|-)([a-z])/g, (_m, lead: string, letter: string) => lead + letter.toUpperCase()) : text;

export function findMerchant(rows: readonly string[]): { merchant: string | null; address: string | null } {
  const head = rows.slice(0, 10);
  for (const row of head) {
    for (const [pattern, name] of CHAINS) if (pattern.test(row.toUpperCase())) return { merchant: name, address: findAddress(head) };
  }
  for (const row of head.slice(0, 6)) {
    const letters = row.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 3 && row.length <= 42 && !NOT_A_NAME.test(row) && !findDate(row) && findAmounts(row).length === 0) {
      return { merchant: titleCase(row.replace(/\s+/g, " ").trim()), address: findAddress(head) };
    }
  }
  return { merchant: null, address: findAddress(head) };
}

const findAddress = (rows: readonly string[]): string | null => rows.find((row) => ADDRESS.test(row) && row.length > 8) ?? null;

// ---------- payment ----------

export function findPayment(rows: readonly string[]): PaymentGuess {
  const text = rows.join("\n").toUpperCase();
  if (/\bQRIS\b/.test(text)) return "qris";
  if (/GOPAY|\bOVO\b|\bDANA\b|SHOPEE\s*PAY|LINK\s*AJA/.test(text)) return "ewallet";
  if (/\bDEBIT\b/.test(text)) return "debit";
  if (/KREDIT|CREDIT|\bVISA\b|MASTERCARD/.test(text)) return "credit";
  if (/TRANSFER/.test(text)) return "bank_transfer";
  if (/\bTUNAI\b|\bCASH\b/.test(text)) return "cash";
  return null;
}

// ---------- lines ----------

const GRAND_TOTAL = /(GRAND\s*TOTAL|TOTAL\s*(BAYAR|BELANJA|TAGIHAN|AKHIR|PEMBAYARAN)|AMOUNT\s*DUE|NET\s*TOTAL|TOTAL\s*DUE)/;
const SUBTOTAL = /SUB\s*-?\s*TOTAL/;
const PLAIN_TOTAL = /\b(TOTAL|JUMLAH)\b/;
const NOT_TOTAL = /TOTAL\s*(ITEM|ITM|QTY|BARANG|PRODUK|PCS)|JUMLAH\s*(ITEM|QTY|BARANG)/;
const DISCOUNT = /\b(DISKON|DISC|POTONGAN|HEMAT|PROMO|VOUCHER|CASHBACK)\b/;
const TAX = /\b(PPN|PB\s*1|PB1|PAJAK|TAX|VAT)\b/;
const TAX_INCLUDED = /(INCL|INCLUDED|TERMASUK|INC\.|SUDAH\s*TERMASUK)/;
const SERVICE = /\b(SERVICE|SERVIS|SVC|SC)\b/;
const ROUNDING = /\b(PEMBULATAN|ROUNDING|ROUND)\b/;
const PAYMENT_LINE = /\b(TUNAI|CASH|KEMBALI|KEMBALIAN|CHANGE|BAYAR|DIBAYAR|DEBIT|KREDIT|CREDIT|QRIS|GOPAY|OVO|DANA|TRANSFER|PAID|TENDER)\b/;
const NOISE = /(VOLUME|HARGA\s*\/|LITER|NOZZLE|POMPA|TERIMA\s*KASIH|THANK|NPWP|KASIR|CASHIER|NO\.?\s*(STRUK|TRX|TRANSAKSI|BILL)|TGL|TANGGAL|WAKTU|PELANGGAN|MEMBER|POIN|POINT|BARANG\s*YANG|TIDAK\s*DAPAT|KRITIK|SARAN|WIFI|IG\s*:|WWW)/;

const QTY_UNIT = /(\d+(?:[.,]\d+)?)\s*[xX*]\s*@?\s*(?:Rp\.?\s*)?(\d[\d.,]*)/;

type Classified = { kind: "total" | "grand" | "subtotal" | "payment" | "noise" | "taxIncluded" } | { kind: "item"; item: ParsedItem } | { kind: "nameOnly"; name: string } | { kind: "qtyOnly"; quantity: number; unitPrice: number | null; lineTotal: number };

const cleanName = (text: string) =>
  text
    .replace(QTY_UNIT, " ")
    .replace(/^\s*\d{3,}\s+/, "")
    .replace(/[@*:|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function classify(row: string): Classified & { amount?: number } {
  const upper = row.toUpperCase();
  const amounts = findAmounts(row);
  const last = amounts[amounts.length - 1];

  if (!last && ROUNDING.test(upper)) {
    const small = /(-?\(?\d+\)?-?)\s*$/.exec(row);
    const value = small ? parseAmount(small[1]) : null;
    if (value !== null) return { kind: "item", amount: value, item: { kind: "rounding", name: "Rounding", quantity: 1, unitPrice: null, lineTotal: value } };
  }
  if (NOISE.test(upper) && !last) return { kind: "noise" };
  if (!last) {
    const name = cleanName(row);
    return name.replace(/[^A-Za-z]/g, "").length >= 3 && !NOISE.test(upper) && !findDate(row) ? { kind: "nameOnly", name } : { kind: "noise" };
  }
  const amount = last.value;

  if (NOT_TOTAL.test(upper)) return { kind: "noise" };
  if (GRAND_TOTAL.test(upper)) return { kind: "grand", amount };
  if (DISCOUNT.test(upper)) return { kind: "item", amount, item: { kind: "discount", name: cleanName(row.slice(0, last.index)) || "Discount", quantity: 1, unitPrice: null, lineTotal: -Math.abs(amount) } };
  if (TAX.test(upper)) {
    if (TAX_INCLUDED.test(upper)) return { kind: "taxIncluded", amount };
    return { kind: "item", amount, item: { kind: "tax", name: cleanName(row.slice(0, last.index)) || "Tax", quantity: 1, unitPrice: null, lineTotal: Math.abs(amount) } };
  }
  if (SERVICE.test(upper)) return { kind: "item", amount, item: { kind: "service", name: cleanName(row.slice(0, last.index)) || "Service", quantity: 1, unitPrice: null, lineTotal: Math.abs(amount) } };
  if (ROUNDING.test(upper)) return { kind: "item", amount, item: { kind: "rounding", name: cleanName(row.slice(0, last.index)) || "Rounding", quantity: 1, unitPrice: null, lineTotal: amount } };
  if (SUBTOTAL.test(upper)) return { kind: "subtotal", amount };
  if (PLAIN_TOTAL.test(upper)) return { kind: "total", amount };
  if (PAYMENT_LINE.test(upper)) return { kind: "payment", amount };
  if (NOISE.test(upper)) return { kind: "noise" };

  const qty = QTY_UNIT.exec(row);
  const name = cleanName(row.slice(0, qty ? Math.min(qty.index, last.index) : last.index));
  const quantity = qty ? Number(qty[1].replace(",", ".")) : 1;
  const unitPrice = qty ? parseAmount(qty[2]) : null;
  // A line that is only "2 x 12.500   25.000" belongs to the name on the line above.
  if (name.replace(/[^A-Za-z]/g, "").length < 2) return { kind: "qtyOnly", quantity, unitPrice, lineTotal: amount };
  return { kind: "item", amount, item: { kind: "item", name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, unitPrice, lineTotal: amount } };
}

const tolerance = (total: number) => Math.max(500, Math.round(total * 0.005));

export function parseReceiptRows(rows: readonly string[]): ParsedReceipt {
  const { merchant, address } = findMerchant(rows);
  let date: LocalDate | null = null;
  let time: { hour: number; minute: number } | null = null;
  for (const row of rows) {
    date ??= findDate(row);
    if (!time && (findDate(row) || /JAM|TIME|WAKTU|\d{1,2}:\d{2}/i.test(row))) time = findTime(row);
    if (date && time) break;
  }

  const items: ParsedItem[] = [];
  let pendingName: string | null = null;
  let subtotal: number | null = null;
  let grand: number | null = null;
  let plain: number | null = null;
  let taxIncluded = false;

  for (const row of rows) {
    const result = classify(row);
    switch (result.kind) {
      case "grand":
        grand = result.amount ?? grand;
        pendingName = null;
        break;
      case "total":
        plain = result.amount ?? plain;
        pendingName = null;
        break;
      case "subtotal":
        subtotal = result.amount ?? subtotal;
        pendingName = null;
        break;
      case "taxIncluded":
        taxIncluded = true;
        break;
      case "item":
        items.push(result.item);
        pendingName = null;
        break;
      case "nameOnly":
        pendingName = result.name;
        break;
      case "qtyOnly":
        if (pendingName) items.push({ kind: "item", name: pendingName, quantity: result.quantity, unitPrice: result.unitPrice, lineTotal: result.lineTotal });
        pendingName = null;
        break;
      default:
        break;
    }
  }

  const total = grand ?? plain;
  const computed = items.reduce((sum, item) => sum + item.lineTotal, 0);

  let check = { ok: false, computed, diff: total === null ? 0 : total - computed };
  if (total !== null && items.length === 0) check = { ok: true, computed: 0, diff: total };
  else if (total !== null) {
    const tol = tolerance(total);
    const withoutTax = items.filter((item) => item.kind !== "tax").reduce((sum, item) => sum + item.lineTotal, 0);
    // Tax that is already inside the prices must not be added a second time.
    const included = taxIncluded || (subtotal !== null && Math.abs(subtotal - total) <= tol && items.some((item) => item.kind === "tax"));
    const used = included ? withoutTax : computed;
    check = { ok: Math.abs(total - used) <= tol, computed: used, diff: total - used };
  }

  return {
    merchant,
    address,
    date,
    time,
    items,
    subtotal,
    total,
    paymentMethod: findPayment(rows),
    totalConfidence: total === null ? "none" : check.ok ? "high" : "low",
    check,
  };
}

/** Parses OCR text, either plain lines or lines with their frames. */
export function parseReceipt(input: string | readonly OcrLine[]): ParsedReceipt {
  return parseReceiptRows(typeof input === "string" ? rowsFromText(input) : rowsFromOcr(input));
}
