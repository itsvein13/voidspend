import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { DataProvider } from "@/db/DatabaseProvider";
import { setBudget } from "@/db/repo/budgets";
import { getCategory, listCategories } from "@/db/repo/categories";
import { createGoal } from "@/db/repo/goals";
import { listTransactions, createTransaction, type Transaction } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { en } from "@/i18n/en";
import { id as idStrings } from "@/i18n/id";
import { epochFromLocal } from "@/lib/dates";
import { formatDayLabel, formatFullDate, formatMonthLabel, formatShortDate, formatStamp } from "@/lib/dateLabels";
import { renderWithDesign } from "@/test/render";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { categoryUsage, orderByUsage } from "./categories/categories";
import { monthsLeft } from "./shell/ImportFlow";
import { AddSheet } from "./transactions/AddSheet";
import { TransactionRow } from "./transactions/components/TransactionRow";

const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@react-native-community/datetimepicker", () => ({ DateTimePickerAndroid: { open: jest.fn() } }));

const food = systemCategoryId("food");
const at = (date: string, hour = 12) => epochFromLocal(date, hour, 0, 420);

describe("date labels", () => {
  it("says today and yesterday, then a short day, with the year only when it differs", () => {
    expect(formatDayLabel("2026-11-18", "2026-11-18", en)).toBe("Today");
    expect(formatDayLabel("2026-11-17", "2026-11-18", en)).toBe("Yesterday");
    expect(formatDayLabel("2026-11-01", "2026-11-18", en)).toBe("Sun, 1 Nov");
    expect(formatDayLabel("2025-12-31", "2026-11-18", en)).toBe("Wed, 31 Dec 2025");
    expect(formatDayLabel("2026-03-01", "2026-03-02", en)).toBe("Yesterday"); // across a month boundary
    expect(formatDayLabel("2026-11-01", "2026-11-18", idStrings)).toBe("Min, 1 Nov");
    expect(formatDayLabel("2026-11-18", "2026-11-18", idStrings)).toBe("Hari ini");
  });

  it("formats months, dates and stamps from the language files", () => {
    expect(formatMonthLabel("2026-08", en)).toBe("August 2026");
    expect(formatMonthLabel("2026-08", idStrings)).toBe("Agustus 2026");
    expect(formatShortDate("2026-11-25", en, "2026-11-18")).toBe("25 Nov");
    expect(formatShortDate("2027-01-05", en, "2026-11-18")).toBe("5 Jan 2027");
    expect(formatFullDate("2026-11-18", en)).toBe("Wed, 18 November 2026");
    expect(formatStamp(Date.UTC(2026, 10, 18, 14, 3), 420, en)).toBe("18 Nov 21:03");
  });
});

describe("categories by use", () => {
  it("puts recently used categories first and keeps the shipped order for the rest", async () => {
    const db = await createMigratedDb();
    const base = { type: "expense" as const, amount: 1000, title: "x", offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" as const };
    const now = Date.UTC(2026, 10, 18);
    for (const key of ["bills", "bills", "health"]) await createTransaction(db, { ...base, categoryId: systemCategoryId(key), occurredAt: now - 86_400_000 });
    await createTransaction(db, { ...base, categoryId: systemCategoryId("transport"), occurredAt: now - 200 * 86_400_000 }); // too old to count
    const used = await categoryUsage(db, "expense", now);
    expect(used).toEqual([systemCategoryId("bills"), systemCategoryId("health")]);

    const ordered = orderByUsage(await listCategories(db, { kind: "expense" }), used).map((c) => c.systemKey);
    expect(ordered.slice(0, 3)).toEqual(["bills", "health", "food"]);
  });
});

describe("import report months", () => {
  it("works out money left per month, newest first", () => {
    expect(
      monthsLeft([
        { month: "2026-07", type: "income", count: 1, total: 5_000_000 },
        { month: "2026-07", type: "expense", count: 4, total: 84_000 },
        { month: "2026-07", type: "saving_deposit", count: 1, total: 500_000 },
        { month: "2026-08", type: "income", count: 1, total: 5_200_000 },
      ]),
    ).toEqual([
      { month: "2026-08", left: 5_200_000 },
      { month: "2026-07", left: 4_416_000 },
    ]);
  });
});

describe("TransactionRow", () => {
  const tx = (overrides: Partial<Transaction> = {}): Transaction =>
    ({
      id: "t1", type: "expense", amount: 25_000, currency: "IDR", title: "Kopi", counterparty: "Kopi Kenangan", categoryId: food,
      goalId: null, walletId: null, toWalletId: null, paymentMethod: null, note: null, occurredAt: at("2026-11-18", 7), occurredTz: "Asia/Jakarta",
      occurredOffsetMin: 420, occurredLocalDate: "2026-11-18", timePrecision: "exact", source: "manual", location: null, receiptId: null,
      recurringRuleId: null, legacyRef: null, createdAt: 1, updatedAt: 1, deletedAt: null, ...overrides,
    }) as Transaction;

  it("shows title, category, time and merchant, and says nothing twice", async () => {
    const db = await createMigratedDb();
    const category = (await getCategory(db, food))!;
    await renderWithDesign(<TransactionRow tx={tx()} category={category} onPress={jest.fn()} />);
    expect(screen.getByText("Kopi")).toBeTruthy();
    expect(screen.getByText("Food, 07:00, Kopi Kenangan")).toBeTruthy();
  });

  it("leaves the category out when the title is the category, and the time out for date-only rows", async () => {
    const db = await createMigratedDb();
    const category = (await getCategory(db, food))!;
    await renderWithDesign(<TransactionRow tx={tx({ title: "Food", counterparty: null, timePrecision: "date" })} category={category} onPress={jest.fn()} />);
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.queryByText(/Food,/)).toBeNull();
  });
});

describe("AddSheet", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createMigratedDb();
    mockBack.mockClear();
    mockParams = {};
  });

  const renderSheet = () =>
    renderWithDesign(
      <DataProvider db={db}>
        <AddSheet />
      </DataProvider>,
    );

  it("keeps Save off until there is an amount and a category", async () => {
    await renderSheet();
    const save = await screen.findByRole("button", { name: "Save" });
    expect(save.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "5" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Food" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" }).props.accessibilityState?.disabled).toBe(false));
  });

  it("records an expense with an amount and a category, then closes", async () => {
    await renderSheet();
    await fireEvent.press(await screen.findByRole("button", { name: "2" }));
    await fireEvent.press(screen.getByRole("button", { name: "5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Three zeros" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Food" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const [saved] = await listTransactions(db);
    expect(saved).toMatchObject({ type: "expense", amount: 25_000, categoryId: food, title: "Food", source: "manual", timePrecision: "exact" });
  });

  it("switches to income and offers the income categories", async () => {
    await renderSheet();
    await fireEvent.press(await screen.findByRole("radio", { name: "Income" }));
    expect(await screen.findByRole("button", { name: "Salary" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Food" })).toBeNull();
  });

  it("prefills from an existing transaction when editing, and saves the change", async () => {
    const id = await createTransaction(db, { type: "expense", amount: 40_000, title: "Makan siang", categoryId: food, occurredAt: at("2026-11-18"), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" });
    mockParams = { edit: id };
    await renderSheet();
    expect(await screen.findByText("Edit transaction")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "0" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const [edited] = await listTransactions(db);
    expect(edited).toMatchObject({ id, amount: 400_000, title: "Makan siang", categoryId: food });
  });
});

describe("AddSheet with goals", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createMigratedDb();
    mockBack.mockClear();
    mockParams = {};
  });
  const renderSheet = () =>
    renderWithDesign(
      <DataProvider db={db}>
        <AddSheet />
      </DataProvider>,
    );

  it("deposits into a goal picked from the chips, with the goal name as the title", async () => {
    const goal = await createGoal(db, { name: "Liburan", targetAmount: 2_000_000 });
    mockParams = { type: "saving_deposit", goal };
    await renderSheet();
    await fireEvent.press(await screen.findByRole("button", { name: "5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Three zeros" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const [saved] = await listTransactions(db);
    expect(saved).toMatchObject({ type: "saving_deposit", goalId: goal, categoryId: null, amount: 5000, title: "Liburan" });
  });

  it("refuses to take out more than the goal holds and says so", async () => {
    const goal = await createGoal(db, { name: "Liburan" });
    await createTransaction(db, { type: "saving_deposit", amount: 1000, title: "x", goalId: goal, occurredAt: at("2026-11-10"), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" });
    mockParams = { type: "saving_withdrawal", goal };
    await renderSheet();
    await fireEvent.press(await screen.findByRole("button", { name: "5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Three zeros" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This goal does not hold that much.")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(await listTransactions(db)).toHaveLength(1);
  });

  it("warns when an expense crosses its budget", async () => {
    await setBudget(db, { categoryId: food, effectiveFrom: "2000-01", amount: 6000 });
    await renderSheet();
    await fireEvent.press(await screen.findByRole("button", { name: "5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Three zeros" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Food" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await screen.findByText("Food budget is almost used (83 percent)")).toBeTruthy();
  });
});
