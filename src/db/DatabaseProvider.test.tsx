import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { DataProvider, useDb, useQuery, useWrite } from "./DatabaseProvider";
import { createTransaction, monthTotals } from "./repo/transactions";
import { systemCategoryId } from "./systemCategories";

// The native module is not needed here: the provider is given a ready database.
jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));

const new25k = (db: Parameters<typeof createTransaction>[0]) =>
  createTransaction(db, {
    type: "expense",
    amount: 25_000,
    title: "Kopi",
    categoryId: systemCategoryId("food"),
    occurredAt: Date.UTC(2026, 10, 18, 5, 0),
    offsetMin: 420,
    tz: "Asia/Jakarta",
    timePrecision: "exact",
  });

function Probe({ month }: { month: string }) {
  const totals = useQuery(["totals", month], (db) => monthTotals(db, month));
  const write = useWrite();
  return (
    <>
      <Text>{totals.loading ? "loading" : `spent ${totals.data?.expense}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => write(new25k)}>
        <Text>add</Text>
      </Pressable>
    </>
  );
}

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe("database hooks", () => {
  it("loads a query, then runs it again after a write", async () => {
    await render(
      <DataProvider db={db}>
        <Probe month="2026-11" />
      </DataProvider>,
    );
    expect(await screen.findByText("spent 0")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "add" }));
    expect(await screen.findByText("spent 25000")).toBeTruthy();
  });

  it("runs the query again when its key changes", async () => {
    await new25k(db);
    const view = await render(
      <DataProvider db={db}>
        <Probe month="2026-10" />
      </DataProvider>,
    );
    expect(await screen.findByText("spent 0")).toBeTruthy();
    await view.rerender(
      <DataProvider db={db}>
        <Probe month="2026-11" />
      </DataProvider>,
    );
    await waitFor(() => expect(screen.getByText("spent 25000")).toBeTruthy());
  });

  it("hands out the database and refuses to work without a provider", async () => {
    function Reader() {
      return <Text>{useDb() === db ? "same database" : "other database"}</Text>;
    }
    await render(
      <DataProvider db={db}>
        <Reader />
      </DataProvider>,
    );
    expect(screen.getByText("same database")).toBeTruthy();

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<Reader />)).rejects.toThrow(/DatabaseProvider/);
    spy.mockRestore();
  });
});
