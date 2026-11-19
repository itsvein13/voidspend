import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { DataProvider } from "@/db/DatabaseProvider";
import { createReceiptDraft, getReceipt, listReceiptItems } from "@/db/repo/receipts";
import { createTransaction, listTransactions } from "@/db/repo/transactions";
import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { renderWithDesign } from "@/test/render";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { ReceiptReview } from "./ReceiptReview";
import { parseReceipt } from "./parse";
import { emptyReview, reviewFromParsed } from "./review";

const mockDismissAll = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), dismissAll: mockDismissAll }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@react-native-community/datetimepicker", () => ({ DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  EncodingType: { Base64: "base64" },
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(() => Promise.resolve()),
}));

const RECEIPT = `INDOMARET\n18/11/2026 14:32\nINDOMIE GORENG 2 x 3.500 7.000\nAQUA 600ML 3.500\nTOTAL 10.500\nTUNAI 20.000`;
let db: TestDb;
let n = 0;

beforeEach(async () => {
  db = await createMigratedDb();
  mockDismissAll.mockClear();
});

async function draftFrom(text: string | null, imagePath: string | null = null) {
  const review = text ? reviewFromParsed(parseReceipt(text), () => `item${++n}`) : emptyReview();
  const id = await createReceiptDraft(db, { imagePath, imageHash: "h", ocrText: text, draftJson: JSON.stringify(review) });
  mockParams = { id };
  return id;
}

const renderReview = () =>
  renderWithDesign(
    <DataProvider db={db}>
      <ReceiptReview />
    </DataProvider>,
  );

describe("ReceiptReview", () => {
  it("shows what was read, and saving makes one expense with the lines and closes", async () => {
    const id = await draftFrom(RECEIPT);
    await renderReview();
    expect(await screen.findByDisplayValue("Indomaret")).toBeTruthy();
    expect(screen.getByDisplayValue("10.500")).toBeTruthy();
    expect(screen.getByDisplayValue("INDOMIE GORENG")).toBeTruthy();

    await fireEvent.press(await screen.findByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());

    const [saved] = await listTransactions(db);
    expect(saved).toMatchObject({ amount: 10_500, title: "Indomaret", source: "receipt", receiptId: id, occurredLocalDate: "2026-11-18", paymentMethod: "cash" });
    expect(saved.categoryId).toBe(systemCategoryId("other")); // nothing chosen means Other
    expect((await listReceiptItems(db, id)).map((i) => i.name)).toEqual(["INDOMIE GORENG", "AQUA 600ML"]);
    expect((await getReceipt(db, id))?.status).toBe("confirmed");
  });

  it("starts from an empty review when no text was read, says so, and keeps Save off until there is a total", async () => {
    await draftFrom(null);
    await renderReview();
    expect(await screen.findByText(/Text reading is not available/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save expense" }).props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(screen.getByLabelText("Total"), "25000");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save expense" }).props.accessibilityState?.disabled).toBe(false));
  });

  it("lets the person remove a line, and warns when the lines no longer add up to the total", async () => {
    await draftFrom(RECEIPT);
    await renderReview();
    await fireEvent.press(await screen.findByRole("button", { name: "Remove AQUA 600ML" }));
    expect(await screen.findByText("The items differ from the total by Rp 3.500.")).toBeTruthy();
  });

  it("warns softly about an expense that looks the same, and still lets it be saved", async () => {
    await createTransaction(db, { type: "expense", amount: 10_500, title: "Indomaret", counterparty: "Indomaret Sudirman", categoryId: systemCategoryId("shopping"), occurredAt: epochFromLocal("2026-11-18", 9, 0, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" });
    await draftFrom(RECEIPT);
    await renderReview();
    expect(await screen.findByText(/Looks like Indomaret Sudirman, 18 Nov, Rp 10.500/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save anyway" })).toBeTruthy();
  });

  it("says so when the receipt is gone", async () => {
    mockParams = { id: "nope" };
    await renderReview();
    expect(await screen.findByText("This receipt no longer exists.")).toBeTruthy();
  });
});
