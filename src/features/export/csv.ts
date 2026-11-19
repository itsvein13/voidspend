// CSV for spreadsheets. RFC 4180 quoting, a byte order mark so Excel reads UTF-8,
// and a guard against formula injection: a text cell that starts with = + - or @
// would be run as a formula by a spreadsheet, so it gets a leading apostrophe.
import type { Transaction } from "@/db/repo/transactions";
import { localTimeOf } from "@/lib/dates";

export const CSV_HEADERS = ["Date", "Time", "Type", "Category", "Title", "Merchant", "Amount", "Payment", "Note", "Time zone", "Source"] as const;

export function csvText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export type CsvOptions = {
  /** The name shown for a row's category or goal. */
  nameOf: (tx: Transaction) => string;
  includeLocation?: boolean;
  /** The tags of a row. Given, a Tags column follows Source (names joined by semicolons). Left out, there is no such column. */
  tagsOf?: (tx: Transaction) => readonly string[];
};

/** Amounts are whole rupiah and always positive: the Type column says which way the money moved. */
export function buildCsv(rows: readonly Transaction[], options: CsvOptions): string {
  const headers: string[] = [...CSV_HEADERS];
  if (options.tagsOf) headers.push("Tags");
  if (options.includeLocation) headers.push("Place", "Latitude", "Longitude");
  const lines = [headers.join(",")];
  for (const tx of rows) {
    const cells = [
      tx.occurredLocalDate,
      tx.timePrecision === "exact" ? localTimeOf(tx.occurredAt, tx.occurredOffsetMin) : "",
      tx.type,
      csvText(options.nameOf(tx)),
      csvText(tx.title),
      csvText(tx.counterparty),
      String(tx.amount),
      csvText(tx.paymentMethod),
      csvText(tx.note),
      csvText(tx.occurredTz),
      tx.source,
    ];
    if (options.tagsOf) cells.push(csvText(options.tagsOf(tx).join("; ")));
    if (options.includeLocation) cells.push(csvText(tx.location?.name), String(tx.location?.lat ?? ""), String(tx.location?.lng ?? ""));
    lines.push(cells.join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
