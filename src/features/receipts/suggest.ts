import { systemCategoryId } from "@/db/systemCategories";
import type { Db } from "@/db/types";

const RULES: [RegExp, string][] = [
  [/SPBU|PERTAMINA|SHELL|BENSIN|PERTALITE|PERTAMAX|SOLAR|PARKIR|TOL\b|TRANSJAKARTA|KRL|GRAB|GOJEK|MRT|LRT|TAXI|BLUEBIRD/i, "transport"],
  [/APOTEK|KIMIA\s*FARMA|\bK24\b|GUARDIAN|KLINIK|RUMAH\s*SAKIT|\bRS\b|DOKTER|OBAT|VITAMIN/i, "health"],
  [/PLN|PDAM|TELKOM|INDIHOME|PULSA|TOKEN\s*LISTRIK|BPJS|ASURANSI|PAJAK\s*KENDARAAN/i, "bills"],
  [/BIOSKOP|CINEMA|\bXXI\b|\bCGV\b|NETFLIX|SPOTIFY|KARAOKE|TIMEZONE|GAME|STEAM/i, "entertainment"],
  [/KOPI|COFFEE|CAFE|KEDAI|WARUNG|RESTO|RESTORAN|BAKSO|AYAM|NASI|MIE|SATE|SATAY|PIZZA|BURGER|KFC|MCDONALD|STARBUCKS|JANJI\s*JIWA|BREADTALK|J\.?CO|BAKERY|ROTI|TEH|JUS/i, "food"],
  [/INDOMARET|ALFAMART|ALFAMIDI|SUPERINDO|HYPERMART|LOTTE|CIRCLE\s*K|LAWSON|MINIMARKET|SUPERMARKET|MATAHARI|UNIQLO|ZARA|H&M|TOKO/i, "shopping"],
];

/** A category key from the merchant and the item names, or null when nothing fits. No AI: a small table. */
export function categoryKeyFromText(merchant: string, itemNames: readonly string[]): string | null {
  for (const text of [merchant, itemNames.join(" ")]) {
    if (text.trim() === "") continue;
    for (const [pattern, key] of RULES) if (pattern.test(text)) return key;
  }
  return null;
}

/** The category last used for the same merchant, else the keyword table, else null. */
export async function suggestCategory(db: Db, merchant: string, itemNames: readonly string[]): Promise<string | null> {
  const name = merchant.trim();
  if (name !== "") {
    const row = await db.getFirstAsync<{ category_id: string }>(
      `SELECT category_id FROM transactions
       WHERE deleted_at IS NULL AND type = 'expense' AND category_id IS NOT NULL AND lower(counterparty) = lower(?)
       GROUP BY category_id ORDER BY COUNT(*) DESC, MAX(occurred_at) DESC LIMIT 1`,
      [name],
    );
    if (row) return row.category_id;
  }
  const key = categoryKeyFromText(name, itemNames);
  return key ? systemCategoryId(key) : null;
}
