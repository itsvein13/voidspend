// v1 stored a category as its display label, an emoji plus a word in English or
// Indonesian ("🍔 Food", "🍔 Makan"). This maps those labels to the category
// keys of v2. Anything unknown becomes a category the person owns, so no
// history is lost or merged by guesswork.
import { systemCategoryId } from "../systemCategories";

/** Drops emoji and symbols, collapses spaces and lowercases: "🍔 Food" becomes "food". */
export function normalizeLabel(label: string): string {
  return label
    .replace(/[^A-Za-z0-9À-ɏ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const EXPENSE: Record<string, string> = {
  food: "food",
  makan: "food",
  transport: "transport",
  transportasi: "transport",
  entertainment: "entertainment",
  hiburan: "entertainment",
  health: "health",
  kesehatan: "health",
  shopping: "shopping",
  belanja: "shopping",
  bills: "bills",
  tagihan: "bills",
  others: "other",
  other: "other",
  lainnya: "other",
};

const SAVING: Record<string, string> = {
  "emergency fund": "emergency",
  "dana darurat": "emergency",
  vacation: "vacation",
  liburan: "vacation",
  house: "house",
  rumah: "house",
  gadget: "gadget",
  education: "education",
  pendidikan: "education",
  investment: "investment",
  investasi: "investment",
  others: "saving_other",
  other: "saving_other",
  lainnya: "saving_other",
};

export type LegacyCategoryRef = {
  /** The id to store on the row. A system id, or the id of a category created for the label. */
  categoryId: string;
  /** Set when the label is not a known one and a category has to be created. */
  create: { kind: "expense" | "saving"; name: string } | null;
};

/** A stable short id from text (FNV-1a, 32 bit), so a rerun of the import produces the same ids. */
export function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function legacyCategory(label: string, kind: "expense" | "saving"): LegacyCategoryRef {
  const normalized = normalizeLabel(label);
  const key = (kind === "expense" ? EXPENSE : SAVING)[normalized];
  if (key) return { categoryId: systemCategoryId(key), create: null };
  // Unknown label: the word without its emoji is the name. A label that is only an emoji keeps it.
  const name = (normalized === "" ? label.trim() : label.replace(/[^A-Za-z0-9À-ɏ\s]/g, " ").replace(/\s+/g, " ").trim()) || "Other";
  return { categoryId: `leg_cat_${shortHash(`${kind}:${name.toLowerCase()}`)}`, create: { kind, name: name.slice(0, 40) } };
}
