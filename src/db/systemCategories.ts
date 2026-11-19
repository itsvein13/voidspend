import type { CategoryKind } from "./types";

// Categories that ship with the app. Their labels come from the i18n files
// (`categories.<key>`), so a category follows the language instead of being
// stored as an emoji string like in v1. `color` is a design token key: the
// expense colors are the validated chart palette (design/tokens.ts).
export type SystemCategory = {
  key: string;
  kind: CategoryKind;
  icon: string;
  color: string;
};

export const systemCategories: readonly SystemCategory[] = [
  { key: "food", kind: "expense", icon: "restaurant-outline", color: "food" },
  { key: "transport", kind: "expense", icon: "car-outline", color: "transport" },
  { key: "entertainment", kind: "expense", icon: "game-controller-outline", color: "entertainment" },
  { key: "health", kind: "expense", icon: "medkit-outline", color: "health" },
  { key: "shopping", kind: "expense", icon: "bag-handle-outline", color: "shopping" },
  { key: "bills", kind: "expense", icon: "receipt-outline", color: "bills" },
  { key: "other", kind: "expense", icon: "ellipsis-horizontal-circle-outline", color: "other" },
  { key: "salary", kind: "income", icon: "wallet-outline", color: "accent" },
  { key: "bonus", kind: "income", icon: "gift-outline", color: "accent" },
  { key: "income_other", kind: "income", icon: "add-circle-outline", color: "accent" },
  { key: "emergency", kind: "saving", icon: "shield-checkmark-outline", color: "savings" },
  { key: "vacation", kind: "saving", icon: "airplane-outline", color: "savings" },
  { key: "house", kind: "saving", icon: "home-outline", color: "savings" },
  { key: "gadget", kind: "saving", icon: "phone-portrait-outline", color: "savings" },
  { key: "education", kind: "saving", icon: "school-outline", color: "savings" },
  { key: "investment", kind: "saving", icon: "trending-up-outline", color: "savings" },
  { key: "saving_other", kind: "saving", icon: "cube-outline", color: "savings" },
];

/** System rows use a fixed id so code and the legacy import can point at them. */
export const systemCategoryId = (key: string) => `sys_${key}`;
