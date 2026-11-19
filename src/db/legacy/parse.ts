// Reads what v1 kept in AsyncStorage. v1 wrote it without validation, so every
// value is checked here: a row that cannot be imported is listed in the report
// with a reason instead of being dropped silently or aborting everything.
export const LEGACY_KEYS = ["salaries", "salary", "expenses", "savings", "budgets"] as const;
export type LegacyKey = (typeof LEGACY_KEYS)[number];
export type LegacyRaw = Record<LegacyKey, string | null>;

export type LegacyItem = {
  id: number;
  name: string;
  amount: number;
  category: string;
  /** 0-based, like v1: 6 is July. */
  month: number;
  year: number;
  target: number | null;
};

export type LegacySalary = { year: number; month: number; amount: number };

export type LegacyData = {
  salaries: LegacySalary[];
  expenses: LegacyItem[];
  savings: LegacyItem[];
  budgets: { label: string; amount: number }[];
};

export type SkippedRow = { table: LegacyKey; ref: string; reason: string };

export class LegacyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyParseError";
  }
}

export function isEmptyRaw(raw: LegacyRaw): boolean {
  return LEGACY_KEYS.every((key) => raw[key] === null || raw[key]!.trim() === "");
}

function parseJson(key: LegacyKey, text: string | null): unknown {
  if (text === null || text.trim() === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new LegacyParseError(`The saved "${key}" data is not readable.`);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMoney = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** `currentMonth` is only used for the oldest storage format, a bare `salary` number. */
export function parseLegacy(
  raw: LegacyRaw,
  currentMonth: { year: number; month: number },
): { data: LegacyData; skipped: SkippedRow[] } {
  const skipped: SkippedRow[] = [];
  const data: LegacyData = { salaries: [], expenses: [], savings: [], budgets: [] };

  const salaries = parseJson("salaries", raw.salaries);
  if (salaries !== null) {
    if (!isRecord(salaries)) throw new LegacyParseError('The saved "salaries" data has an unexpected shape.');
    for (const [key, value] of Object.entries(salaries)) {
      const match = /^(\d{4})-(\d{1,2})$/.exec(key);
      const month = match ? Number(match[2]) : -1;
      if (!match || month < 0 || month > 11) {
        skipped.push({ table: "salaries", ref: key, reason: "month_invalid" });
      } else if (!isMoney(value)) {
        // v1 stored 0 for "no salary this month", which is not an entry.
        if (value !== 0) skipped.push({ table: "salaries", ref: key, reason: "amount_invalid" });
      } else {
        data.salaries.push({ year: Number(match[1]), month, amount: value });
      }
    }
  } else if (raw.salary !== null && raw.salary.trim() !== "") {
    // The first v1 format: one number, which v1 treated as the current month's salary.
    const value = Number.parseFloat(raw.salary);
    if (isMoney(value)) data.salaries.push({ year: currentMonth.year, month: currentMonth.month, amount: value });
    else skipped.push({ table: "salary", ref: "salary", reason: "amount_invalid" });
  }

  for (const table of ["expenses", "savings"] as const) {
    const list = parseJson(table, raw[table]);
    if (list === null) continue;
    if (!Array.isArray(list)) throw new LegacyParseError(`The saved "${table}" data has an unexpected shape.`);
    list.forEach((entry, index) => {
      const ref = isRecord(entry) && entry.id !== undefined ? String(entry.id) : `#${index}`;
      if (!isRecord(entry)) return void skipped.push({ table, ref, reason: "not_an_object" });
      if (!isMoney(entry.amount)) return void skipped.push({ table, ref, reason: "amount_invalid" });
      const { month, year } = entry;
      if (typeof month !== "number" || !Number.isInteger(month) || month < 0 || month > 11) {
        return void skipped.push({ table, ref, reason: "month_invalid" });
      }
      if (typeof year !== "number" || !Number.isInteger(year) || year < 1970 || year > 2200) {
        return void skipped.push({ table, ref, reason: "year_invalid" });
      }
      (table === "expenses" ? data.expenses : data.savings).push({
        id: typeof entry.id === "number" && Number.isFinite(entry.id) ? entry.id : Number.NaN,
        name: typeof entry.name === "string" ? entry.name : "",
        amount: entry.amount,
        category: typeof entry.category === "string" ? entry.category : "",
        month,
        year,
        target: isMoney(entry.target) ? entry.target : null,
      });
    });
  }

  const budgets = parseJson("budgets", raw.budgets);
  if (budgets !== null) {
    if (!isRecord(budgets)) throw new LegacyParseError('The saved "budgets" data has an unexpected shape.');
    for (const [label, value] of Object.entries(budgets)) {
      if (isMoney(value)) data.budgets.push({ label, amount: value });
      else if (value !== 0) skipped.push({ table: "budgets", ref: label, reason: "amount_invalid" });
    }
  }

  return { data, skipped };
}
