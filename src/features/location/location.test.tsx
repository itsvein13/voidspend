import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { DataProvider } from "@/db/DatabaseProvider";
import { getMeta } from "@/db/repo/meta";
import { clearAllLocations, createTransaction, getTransaction, listTransactions } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { keypadFromAmount } from "@/design/primitives/keypad";
import { epochFromLocal } from "@/lib/dates";
import { renderWithDesign } from "@/test/render";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { AddSheet } from "../transactions/AddSheet";
import { buildTransaction, formForDuplicate, formFromTransaction, initialForm } from "../transactions/form";
import { geoUrl, placeName, readCurrentPlace } from "./location";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock("@react-native-community/datetimepicker", () => ({ DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Location = require("expo-location") as Record<string, jest.Mock>;

const granted = { granted: true, canAskAgain: true };
const here = { coords: { latitude: -6.2088123, longitude: 106.8456789 } };

beforeEach(() => {
  Object.values(Location).forEach((fn) => typeof fn === "function" && fn.mockReset?.());
  Location.getForegroundPermissionsAsync.mockResolvedValue(granted);
  Location.hasServicesEnabledAsync.mockResolvedValue(true);
  Location.getLastKnownPositionAsync.mockResolvedValue(null);
  Location.getCurrentPositionAsync.mockResolvedValue(here);
  Location.reverseGeocodeAsync.mockResolvedValue([{ street: "Jl. Sudirman", district: "Tanah Abang", city: "Jakarta" }]);
  mockBack.mockClear();
});

describe("place names and map links", () => {
  it("builds a short name from an address and ignores empty parts and repeats", () => {
    expect(placeName({ street: "Jl. Sudirman", district: "Tanah Abang", city: "Jakarta" })).toBe("Jl. Sudirman, Tanah Abang, Jakarta");
    expect(placeName({ name: "Indomaret", street: null as never, city: "Jakarta" })).toBe("Indomaret, Jakarta");
    expect(placeName({ street: "Jakarta", city: "Jakarta" })).toBe("Jakarta");
    expect(placeName({})).toBeNull();
    expect(placeName(null)).toBeNull();
  });

  it("makes a geo link, with the name when there is one, and none without a point", () => {
    expect(geoUrl({ lat: -6.209, lng: 106.846, name: "Warung Bu Tini" })).toBe("geo:-6.209,106.846?q=-6.209,106.846(Warung%20Bu%20Tini)");
    expect(geoUrl({ lat: -6.209, lng: 106.846, name: null })).toBe("geo:-6.209,106.846?q=-6.209,106.846");
    expect(geoUrl({ lat: null, lng: null, name: "Typed only" })).toBeNull();
  });
});

describe("reading the current place", () => {
  it("reads one balanced position and names it", async () => {
    const outcome = await readCurrentPlace();
    expect(outcome).toEqual({ status: "ok", place: { name: "Jl. Sudirman, Tanah Abang, Jakarta", lat: -6.2088123, lng: 106.8456789, source: "device" } });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("uses a recent known position instead of waiting for a new one", async () => {
    Location.getLastKnownPositionAsync.mockResolvedValue(here);
    await readCurrentPlace();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("keeps the point when the name cannot be looked up offline", async () => {
    Location.reverseGeocodeAsync.mockRejectedValue(new Error("offline"));
    expect(await readCurrentPlace()).toMatchObject({ status: "ok", place: { name: null, lat: -6.2088123 } });
  });

  it("asks once, and reports a refusal with whether it can be asked again", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await readCurrentPlace()).toEqual({ status: "denied", canAskAgain: false });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("says so when location services are off", async () => {
    Location.hasServicesEnabledAsync.mockResolvedValue(false);
    expect(await readCurrentPlace()).toEqual({ status: "unavailable" });
  });

  it("reports unavailable instead of throwing when the native side fails", async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("LocationServices.API is not available on this device"));
    expect(await readCurrentPlace()).toEqual({ status: "unavailable" });
    Location.getForegroundPermissionsAsync.mockRejectedValue(new Error("boom"));
    expect(await readCurrentPlace()).toEqual({ status: "unavailable" });
  });

  it("falls back to a fresh reading when the last known position cannot be read", async () => {
    Location.getLastKnownPositionAsync.mockRejectedValue(new Error("no cache"));
    expect(await readCurrentPlace()).toMatchObject({ status: "ok" });
  });

  it("gives up after the time limit", async () => {
    jest.useFakeTimers();
    Location.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));
    const pending = readCurrentPlace();
    await jest.advanceTimersByTimeAsync(8_100);
    expect(await pending).toEqual({ status: "timeout" });
    jest.useRealTimers();
  });
});

const base = { type: "expense" as const, amount: 10_000, title: "Kopi", categoryId: systemCategoryId("food"), occurredAt: epochFromLocal("2026-11-18", 9, 0, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" as const };
const clock = { now: Date.UTC(2026, 10, 18, 7, 0), offsetMin: 420, tz: "Asia/Jakarta" };

describe("places in the data", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createMigratedDb();
  });

  it("builds a transaction with the place, trimmed, and drops an empty one", () => {
    const form = { ...initialForm(), amount: keypadFromAmount(5_000), categoryId: systemCategoryId("food") };
    expect(buildTransaction({ ...form, location: { name: "  Warung ", lat: null, lng: null, source: "manual" } }, clock, "Food").location).toEqual({ name: "Warung", lat: null, lng: null, source: "manual" });
    expect(buildTransaction({ ...form, location: { name: " ", lat: null, lng: null, source: "manual" } }, clock, "Food").location).toBeNull();
    expect(buildTransaction(form, clock, "Food").location).toBeNull();
  });

  it("keeps the place when editing and leaves it out when duplicating", async () => {
    const id = await createTransaction(db, { ...base, location: { name: "Warung", lat: -6.2088, lng: 106.8456, source: "device" } });
    const tx = (await getTransaction(db, id))!;
    expect(formFromTransaction(tx).location).toMatchObject({ name: "Warung", source: "device" });
    expect(formForDuplicate(tx).location).toBeNull();
  });

  it("deletes every saved place but keeps the transactions", async () => {
    await createTransaction(db, { ...base, location: { name: "A", lat: 1.1234, lng: 2.1234, source: "device" } });
    await createTransaction(db, { ...base, location: { name: "B", lat: null, lng: null, source: "manual" } });
    await createTransaction(db, base);
    expect(await clearAllLocations(db)).toBe(2);
    const rows = await listTransactions(db);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.location === null)).toBe(true);
  });
});

describe("the place field in the add sheet", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createMigratedDb();
  });
  const renderSheet = () =>
    renderWithDesign(
      <DataProvider db={db}>
        <AddSheet />
      </DataProvider>,
    );

  it("saves a typed place with no coordinates", async () => {
    await renderSheet();
    await fireEvent.press(await screen.findByRole("button", { name: "5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Three zeros" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Food" }));
    await fireEvent.changeText(screen.getByLabelText("Place name"), "Warung Bu Tini");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await listTransactions(db))[0].location).toEqual({ name: "Warung Bu Tini", lat: null, lng: null, source: "manual" });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled(); // never read by itself
  });

  it("explains before the first reading, then reads once and rounds what it stores", async () => {
    await renderSheet();
    await fireEvent.press(await screen.findByRole("button", { name: "5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Three zeros" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Food" }));
    await fireEvent.press(screen.getByRole("button", { name: "Use current location" }));
    expect(await screen.findByText("Your location is read once")).toBeTruthy();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1));
    expect(await screen.findByDisplayValue("Jl. Sudirman, Tanah Abang, Jakarta")).toBeTruthy();
    expect(await getMeta(db, "location_explained")).toBe("1");

    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await listTransactions(db))[0].location).toEqual({ name: "Jl. Sudirman, Tanah Abang, Jakarta", lat: -6.209, lng: 106.846, source: "device" });
  });

  it("leaves typing available when the permission is denied", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    await db.runAsync("INSERT INTO app_meta (key, value) VALUES ('location_explained', '1')");
    await renderSheet();
    await fireEvent.press(await screen.findByRole("button", { name: "Use current location" }));
    expect(await screen.findByText("Location permission was denied. You can still type a place name.")).toBeTruthy();
    expect(screen.getByLabelText("Place name")).toBeTruthy();
  });

  it("hides the whole section when the feature is turned off", async () => {
    await db.runAsync("INSERT INTO app_meta (key, value) VALUES ('location_enabled', '0')");
    await renderSheet();
    await screen.findByRole("button", { name: "Food" });
    expect(screen.queryByLabelText("Place name")).toBeNull();
  });
});
