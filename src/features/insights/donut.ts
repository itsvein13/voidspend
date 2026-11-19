// Turns spending per category into donut slices. Color follows the category,
// never its rank, and every category that has no color of its own (Other and the
// ones people made) folds into one gray slice, so no two slices look alike.
export type DonutCategory = { id: string; label: string; colorToken: string };
export type DonutSlice = { key: string; categoryId: string | null; label: string; colorToken: string; value: number; share: number };

export function donutSlices(
  totals: readonly { categoryId: string | null; total: number }[],
  categories: ReadonlyMap<string, DonutCategory>,
  otherLabel: string,
): DonutSlice[] {
  const sum = totals.reduce((acc, item) => acc + item.total, 0);
  if (sum <= 0) return [];
  const slices: DonutSlice[] = [];
  let folded = 0;
  for (const item of totals) {
    const category = item.categoryId ? categories.get(item.categoryId) : undefined;
    if (!category || category.colorToken === "other") {
      folded += item.total;
      continue;
    }
    slices.push({ key: category.id, categoryId: category.id, label: category.label, colorToken: category.colorToken, value: item.total, share: item.total / sum });
  }
  slices.sort((a, b) => b.value - a.value);
  if (folded > 0) slices.push({ key: "other", categoryId: null, label: otherLabel, colorToken: "other", value: folded, share: folded / sum });
  return slices;
}
