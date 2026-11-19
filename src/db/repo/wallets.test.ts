import { systemCategoryId } from "@/db/systemCategories";
import { epochFromLocal } from "@/lib/dates";
import { createMigratedDb, type TestDb } from "@/test/sqliteDb";

import { DEFAULT_WALLET_ID } from "../types";
import { createGoal } from "./goals";
import { archiveWallet, createWallet, getWallet, listWallets, restoreWallet, updateWallet, walletBalances } from "./wallets";
import { createTransaction, getTransaction, listTransactions, monthTotals, softDeleteTransaction, updateTransaction } from "./transactions";

const base = { type: "expense" as const, amount: 10_000, title: "Kopi", categoryId: systemCategoryId("food"), occurredAt: epochFromLocal("2026-11-18", 9, 0, 420), offsetMin: 420, tz: "Asia/Jakarta", timePrecision: "exact" as const };

let db: TestDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

const balanceOf = async (id: string) => (await walletBalances(db)).find((entry) => entry.wallet.id === id)?.balance;

describe("wallets", () => {
  it("starts with one main wallet", async () => {
    const wallets = await listWallets(db);
    expect(wallets).toHaveLength(1);
    expect(wallets[0]).toMatchObject({ id: DEFAULT_WALLET_ID, isDefault: true, openingBalance: 0 });
  });

  it("creates, renames and reads back a wallet, trimming the name", async () => {
    const id = await createWallet(db, { name: "  BCA  ", kind: "bank", openingBalance: 500_000 });
    expect(await getWallet(db, id)).toMatchObject({ name: "BCA", kind: "bank", openingBalance: 500_000, isDefault: false });
    await updateWallet(db, id, { name: "BCA Tahapan", kind: "bank", openingBalance: 600_000 });
    expect(await getWallet(db, id)).toMatchObject({ name: "BCA Tahapan", openingBalance: 600_000 });
  });

  it("refuses an empty, a long or a repeated name, and a balance that is not whole", async () => {
    await createWallet(db, { name: "Cash", kind: "cash", openingBalance: 0 });
    await expect(createWallet(db, { name: " ", kind: "cash", openingBalance: 0 })).rejects.toMatchObject({ code: "name_required" });
    await expect(createWallet(db, { name: "x".repeat(41), kind: "cash", openingBalance: 0 })).rejects.toMatchObject({ code: "name_too_long" });
    await expect(createWallet(db, { name: "CASH", kind: "cash", openingBalance: 0 })).rejects.toMatchObject({ code: "wallet_exists" });
    await expect(createWallet(db, { name: "Other", kind: "cash", openingBalance: 1.5 })).rejects.toMatchObject({ code: "amount_invalid" });
  });

  it("lets a wallet keep its own name when it is edited", async () => {
    const id = await createWallet(db, { name: "Cash", kind: "cash", openingBalance: 0 });
    await expect(updateWallet(db, id, { name: "Cash", kind: "cash", openingBalance: 10 })).resolves.toBeUndefined();
  });

  it("hides and restores a wallet, but never the main one", async () => {
    const id = await createWallet(db, { name: "Old card", kind: "bank", openingBalance: 0 });
    await archiveWallet(db, id);
    expect((await listWallets(db)).map((wallet) => wallet.id)).toEqual([DEFAULT_WALLET_ID]);
    expect(await listWallets(db, { includeArchived: true })).toHaveLength(2);
    await restoreWallet(db, id);
    expect(await listWallets(db)).toHaveLength(2);
    await expect(archiveWallet(db, DEFAULT_WALLET_ID)).rejects.toMatchObject({ code: "wallet_default" });
  });
});

describe("balances and transfers", () => {
  it("adds income and withdrawals, subtracts spending, deposits and transfers out, and adds transfers in", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 1_000_000 });
    const goal = await createGoal(db, { name: "Trip", targetAmount: null, categoryId: null });
    await createTransaction(db, { ...base, type: "income", amount: 5_000_000, categoryId: systemCategoryId("salary"), walletId: bank });
    await createTransaction(db, { ...base, amount: 200_000, walletId: bank });
    await createTransaction(db, { ...base, type: "saving_deposit", amount: 300_000, categoryId: null, goalId: goal, walletId: bank });
    await createTransaction(db, { ...base, type: "saving_withdrawal", amount: 50_000, categoryId: null, goalId: goal, walletId: bank });
    await createTransaction(db, { ...base, type: "transfer", amount: 1_000_000, title: "Move", categoryId: null, walletId: bank, toWalletId: DEFAULT_WALLET_ID });
    expect(await balanceOf(bank)).toBe(1_000_000 + 5_000_000 - 200_000 - 300_000 + 50_000 - 1_000_000);
    expect(await balanceOf(DEFAULT_WALLET_ID)).toBe(1_000_000);
  });

  it("does not count a deleted transaction, and counts a row with no wallet for the main wallet", async () => {
    const gone = await createTransaction(db, { ...base, amount: 40_000 });
    await createTransaction(db, { ...base, amount: 10_000, walletId: null });
    expect(await balanceOf(DEFAULT_WALLET_ID)).toBe(-50_000);
    await softDeleteTransaction(db, gone);
    expect(await balanceOf(DEFAULT_WALLET_ID)).toBe(-10_000);
  });

  it("keeps the sum across wallets equal to what moved in and out, because a transfer only moves money", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    await createTransaction(db, { ...base, type: "income", amount: 700_000, categoryId: systemCategoryId("salary") });
    await createTransaction(db, { ...base, type: "transfer", amount: 250_000, title: "Move", categoryId: null, walletId: DEFAULT_WALLET_ID, toWalletId: bank });
    const total = (await walletBalances(db)).reduce((sum, entry) => sum + entry.balance, 0);
    expect(total).toBe(700_000);
    expect(await balanceOf(bank)).toBe(250_000);
  });

  it("leaves a transfer out of the month's income, spending and savings", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    await createTransaction(db, { ...base, type: "transfer", amount: 250_000, title: "Move", categoryId: null, walletId: DEFAULT_WALLET_ID, toWalletId: bank });
    expect(await monthTotals(db, "2026-11")).toMatchObject({ income: 0, expense: 0, savingDeposit: 0, savingWithdrawal: 0 });
  });

  it("refuses a transfer to the same wallet or to none", async () => {
    const move = { ...base, type: "transfer" as const, title: "Move", categoryId: null, walletId: DEFAULT_WALLET_ID };
    await expect(createTransaction(db, { ...move, toWalletId: DEFAULT_WALLET_ID })).rejects.toMatchObject({ code: "transfer_wallets" });
    await expect(createTransaction(db, move)).rejects.toMatchObject({ code: "transfer_wallets" });
  });

  it("filters the list to one wallet, counting transfers in and out", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    await createTransaction(db, { ...base, title: "Main spend" });
    await createTransaction(db, { ...base, title: "Bank spend", walletId: bank });
    await createTransaction(db, { ...base, type: "transfer", title: "Move", categoryId: null, walletId: DEFAULT_WALLET_ID, toWalletId: bank });
    const titles = async (walletId: string) => (await listTransactions(db, { walletId })).map((tx) => tx.title).sort();
    expect(await titles(bank)).toEqual(["Bank spend", "Move"]);
    expect(await titles(DEFAULT_WALLET_ID)).toEqual(["Main spend", "Move"]);
  });

  it("edits a transfer: a new amount and new wallets move the balances to match", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    const gopay = await createWallet(db, { name: "GoPay", kind: "ewallet", openingBalance: 0 });
    const id = await createTransaction(db, { ...base, type: "transfer", amount: 250_000, title: "Move", categoryId: null, walletId: DEFAULT_WALLET_ID, toWalletId: bank });
    expect(await balanceOf(bank)).toBe(250_000);

    await updateTransaction(db, id, { amount: 400_000, walletId: bank, toWalletId: gopay, title: "Bank to GoPay", note: "split" });

    expect(await getTransaction(db, id)).toMatchObject({ type: "transfer", amount: 400_000, walletId: bank, toWalletId: gopay, title: "Bank to GoPay", note: "split" });
    expect(await balanceOf(DEFAULT_WALLET_ID)).toBe(0);
    expect(await balanceOf(bank)).toBe(-400_000);
    expect(await balanceOf(gopay)).toBe(400_000);
    expect(await monthTotals(db, "2026-11")).toMatchObject({ income: 0, expense: 0 });
  });

  it("refuses to edit a transfer into one wallet or a zero amount, and leaves it as it was", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    const id = await createTransaction(db, { ...base, type: "transfer", amount: 100_000, title: "Move", categoryId: null, walletId: DEFAULT_WALLET_ID, toWalletId: bank });
    await expect(updateTransaction(db, id, { toWalletId: DEFAULT_WALLET_ID })).rejects.toMatchObject({ code: "transfer_wallets" });
    await expect(updateTransaction(db, id, { amount: 0 })).rejects.toMatchObject({ code: "amount_invalid" });
    expect(await getTransaction(db, id)).toMatchObject({ amount: 100_000, walletId: DEFAULT_WALLET_ID, toWalletId: bank });
  });

  it("puts an edited transfer back with the values it had, for Undo", async () => {
    const bank = await createWallet(db, { name: "Bank", kind: "bank", openingBalance: 0 });
    const id = await createTransaction(db, { ...base, type: "transfer", amount: 100_000, title: "Main to Bank", categoryId: null, walletId: DEFAULT_WALLET_ID, toWalletId: bank, note: "first" });
    const before = (await getTransaction(db, id))!;
    await updateTransaction(db, id, { amount: 300_000, note: null });
    await updateTransaction(db, id, { amount: before.amount, title: before.title, walletId: before.walletId, toWalletId: before.toWalletId, note: before.note });
    expect(await getTransaction(db, id)).toMatchObject({ amount: 100_000, note: "first", walletId: DEFAULT_WALLET_ID, toWalletId: bank });
  });
});

describe("a starting balance below zero", () => {
  it("is kept, counts in the balance, and lowers the total across wallets", async () => {
    const card = await createWallet(db, { name: "Kartu kredit", kind: "bank", openingBalance: -750_000 });
    expect((await getWallet(db, card))?.openingBalance).toBe(-750_000);
    await createTransaction(db, { ...base, amount: 100_000, walletId: card });
    expect(await balanceOf(card)).toBe(-850_000);

    await updateWallet(db, card, { name: "Kartu kredit", kind: "bank", openingBalance: -500_000 });
    expect(await balanceOf(card)).toBe(-600_000);
    const total = (await walletBalances(db)).reduce((sum, entry) => sum + entry.balance, 0);
    expect(total).toBe(-600_000);
  });

  it("is paid down by a transfer in", async () => {
    const card = await createWallet(db, { name: "Kartu kredit", kind: "bank", openingBalance: -500_000 });
    await createTransaction(db, { ...base, type: "income", amount: 800_000, categoryId: systemCategoryId("salary") });
    await createTransaction(db, { ...base, type: "transfer", amount: 500_000, title: "Pay the card", categoryId: null, walletId: DEFAULT_WALLET_ID, toWalletId: card });
    expect(await balanceOf(card)).toBe(0);
    expect(await balanceOf(DEFAULT_WALLET_ID)).toBe(300_000);
  });
});
