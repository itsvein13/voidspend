import { useMemo } from "react";

import { useQuery } from "@/db/DatabaseProvider";
import { listCategories, type Category } from "@/db/repo/categories";
import type { Db } from "@/db/types";
import type { IconName, Palette } from "@/design";

/** Category ids ordered by how often they were used in the last 90 days, most used first. */
export async function categoryUsage(db: Db, type: "expense" | "income", now: number): Promise<string[]> {
  const rows = await db.getAllAsync<{ category_id: string }>(
    `SELECT category_id FROM transactions
     WHERE deleted_at IS NULL AND type = ? AND category_id IS NOT NULL AND occurred_at > ?
     GROUP BY category_id ORDER BY COUNT(*) DESC, MAX(occurred_at) DESC`,
    [type, now - 90 * 86_400_000],
  );
  return rows.map((row) => row.category_id);
}

/** Puts the recently used categories first and keeps the shipped order for the rest. */
export function orderByUsage(categories: readonly Category[], usedIds: readonly string[]): Category[] {
  const rank = new Map(usedIds.map((id, index) => [id, index]));
  return [...categories].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.POSITIVE_INFINITY;
    const rb = rank.get(b.id) ?? Number.POSITIVE_INFINITY;
    return ra === rb ? a.sortOrder - b.sortOrder : ra - rb;
  });
}

/** Every category, archived ones included, so old rows always have a label. */
export function useCategories() {
  const query = useQuery(["categories", "all"], (db) => listCategories(db, { includeArchived: true }));
  const byId = useMemo(() => new Map((query.data ?? []).map((category) => [category.id, category])), [query.data]);
  return { categories: query.data ?? [], byId, loading: query.loading };
}

/** The color of a category: a chart color for expenses, the accent or savings color for the rest. */
export function categoryColor(color: Palette, token: string): string {
  if (token === "accent") return color.accentInk;
  if (token === "savings") return color.savingsInk;
  return (color.category as Record<string, string>)[token] ?? color.textSecondary;
}

export const categoryIcon = (category: Pick<Category, "icon"> | undefined): IconName => ((category?.icon ?? "pricetag-outline") as IconName);
