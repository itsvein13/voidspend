// A made-up v1 phone for tests and the dev data screen. It mirrors what v1 wrote
// to AsyncStorage: English and Indonesian labels, 0-based months, a duplicate
// id, an id outside its month, a zero salary, a blank name, an unknown
// category, and savings with and without targets. Not real data.
import type { LegacyRaw } from "./parse";

/** 10:00 on 16 July 2026 in Jakarta. */
export const JULY_ID = Date.UTC(2026, 6, 16, 3, 0);

export const sampleExpenses = [
  { id: JULY_ID, name: "Kopi", amount: 25_000, category: "🍔 Food", month: 6, year: 2026 },
  { id: JULY_ID, name: "Makan siang", amount: 40_000, category: "🍔 Makan", month: 6, year: 2026 },
  { id: 123, name: "Odd id", amount: 10_000, category: "🚗 Transport", month: 6, year: 2026 },
  // 00:30 on 1 August in Jakarta, filed under July by v1.
  { id: Date.UTC(2026, 6, 31, 17, 30), name: "Late night", amount: 9_000, category: "🎮 Hiburan", month: 6, year: 2026 },
  { id: Date.UTC(2026, 7, 3, 3, 0), name: "Serum", amount: 150_000, category: "🧴 Skincare", month: 7, year: 2026 },
  { id: Date.UTC(2026, 7, 4, 3, 0), name: "", amount: 7_000, category: "📦 Lainnya", month: 7, year: 2026 },
  { id: 1, name: "Broken", amount: 0, category: "🍔 Food", month: 6, year: 2026 },
];

export const sampleSavings = [
  { id: Date.UTC(2026, 6, 20, 3, 0), name: "Liburan Bali", amount: 500_000, category: "✈️ Liburan", target: 5_000_000, month: 6, year: 2026 },
  { id: Date.UTC(2026, 7, 20, 3, 0), name: "liburan bali", amount: 300_000, category: "✈️ Vacation", month: 7, year: 2026 },
  { id: Date.UTC(2026, 7, 21, 3, 0), name: "Dana", amount: 200_000, category: "🎯 Dana Darurat", month: 7, year: 2026 },
];

export const sampleSalaries = { "2026-6": 5_000_000, "2026-7": 5_200_000, "2026-8": 0 };
export const sampleBudgets = { "🍔 Food": 1_000_000, "📱 Bills": 0, "🧴 Skincare": 200_000 };

export function sampleLegacyRaw(): LegacyRaw {
  return {
    salaries: JSON.stringify(sampleSalaries),
    salary: null,
    expenses: JSON.stringify(sampleExpenses),
    savings: JSON.stringify(sampleSavings),
    budgets: JSON.stringify(sampleBudgets),
  };
}
