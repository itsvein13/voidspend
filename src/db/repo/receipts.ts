import { newId } from "@/lib/ids";

import { ValidationError, type Db } from "../types";
import { createTransaction, type NewTransaction } from "./transactions";

export type ReceiptStatus = "draft" | "confirmed" | "discarded";

export type Receipt = {
  id: string;
  imagePath: string | null;
  imageHash: string | null;
  ocrText: string | null;
  /** The review state as JSON, so a draft survives the app being closed. */
  draftJson: string | null;
  status: ReceiptStatus;
  createdAt: number;
  updatedAt: number;
};

type Row = {
  id: string;
  image_path: string | null;
  image_hash: string | null;
  ocr_text: string | null;
  parsed_json: string | null;
  status: ReceiptStatus;
  created_at: number;
  updated_at: number;
};

const map = (row: Row): Receipt => ({
  id: row.id,
  imagePath: row.image_path,
  imageHash: row.image_hash,
  ocrText: row.ocr_text,
  draftJson: row.parsed_json,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export type ReceiptItemInput = { kind: string; name: string; quantity: number; unitPrice: number | null; lineTotal: number };

export async function createReceiptDraft(
  db: Db,
  input: { imagePath: string | null; imageHash: string | null; ocrText: string | null; draftJson: string },
  now: number = Date.now(),
): Promise<string> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO receipts (id, image_path, image_hash, ocr_text, parsed_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [id, input.imagePath, input.imageHash, input.ocrText, input.draftJson, now, now],
  );
  return id;
}

export async function getReceipt(db: Db, id: string): Promise<Receipt | null> {
  const row = await db.getFirstAsync<Row>("SELECT * FROM receipts WHERE id = ?", [id]);
  return row ? map(row) : null;
}

/** Scans that were read but not yet saved, newest first. They come back as a "finish reviewing" card. */
export async function listDrafts(db: Db): Promise<Receipt[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM receipts WHERE status = 'draft' ORDER BY created_at DESC");
  return rows.map(map);
}

export async function saveDraft(db: Db, id: string, draftJson: string, now: number = Date.now()): Promise<void> {
  await db.runAsync("UPDATE receipts SET parsed_json = ?, updated_at = ? WHERE id = ? AND status = 'draft'", [draftJson, now, id]);
}

/** Marks a draft discarded and returns the photo to delete. The text and photo path are cleared. */
export async function discardReceipt(db: Db, id: string, now: number = Date.now()): Promise<string | null> {
  const receipt = await getReceipt(db, id);
  if (!receipt) return null;
  await db.runAsync("UPDATE receipts SET status = 'discarded', image_path = NULL, ocr_text = NULL, parsed_json = NULL, updated_at = ? WHERE id = ? AND status = 'draft'", [now, id]);
  return receipt.status === "draft" ? receipt.imagePath : null;
}

export async function listReceiptItems(db: Db, receiptId: string): Promise<(ReceiptItemInput & { id: string })[]> {
  const rows = await db.getAllAsync<{ id: string; kind: string; name: string; quantity: number; unit_price: number | null; line_total: number }>(
    "SELECT id, kind, name, quantity, unit_price, line_total FROM receipt_items WHERE receipt_id = ? ORDER BY sort_order",
    [receiptId],
  );
  return rows.map((row) => ({ id: row.id, kind: row.kind, name: row.name, quantity: row.quantity, unitPrice: row.unit_price, lineTotal: row.line_total }));
}

/**
 * Saves a reviewed receipt: its lines, the transaction and the status change in
 * one database transaction, so a crash leaves the draft as it was. Confirming a
 * receipt twice is refused, which is what stops a double tap from adding two
 * expenses.
 */
export async function confirmReceipt(db: Db, id: string, transaction: NewTransaction, items: readonly ReceiptItemInput[], now: number = Date.now()): Promise<string> {
  let transactionId = "";
  await db.withTransactionAsync(async () => {
    const receipt = await getReceipt(db, id);
    if (!receipt || receipt.status !== "draft") throw new ValidationError("receipt_not_draft", "This receipt was already saved or discarded.");
    for (const [index, item] of items.entries()) {
      await db.runAsync(
        "INSERT INTO receipt_items (id, receipt_id, kind, name, quantity, unit_price, line_total, sort_order) VALUES (?,?,?,?,?,?,?,?)",
        [newId(), id, item.kind, item.name.trim() || "-", item.quantity, item.unitPrice, item.lineTotal, index],
      );
    }
    transactionId = await createTransaction(db, { ...transaction, receiptId: id, source: "receipt" }, now);
    await db.runAsync("UPDATE receipts SET status = 'confirmed', parsed_json = NULL, updated_at = ? WHERE id = ?", [now, id]);
  });
  return transactionId;
}
