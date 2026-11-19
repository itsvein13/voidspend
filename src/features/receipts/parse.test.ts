import { findAmounts, findDate, findTime, parseAmount, parseReceipt, rowsFromOcr, type OcrLine } from "./parse";

// Made-up receipts that follow the shapes of real ones.
const MINIMARKET = `INDOMARET
JL. SUDIRMAN NO. 12 JAKARTA
NPWP: 01.234.567.8-012.000
18/11/2026 14:32 KASIR: 02
INDOMIE GORENG 2 x 3.500 7.000
AQUA 600ML 3.500
TEH BOTOL SOSRO 5.000
SUBTOTAL 15.500
PPN (TERMASUK) 1.536
TOTAL 15.500
TUNAI 20.000
KEMBALI 4.500
TERIMA KASIH`;

const RESTAURANT = `WARUNG BU TINI
Jl. Melati No. 5, Bandung
Tgl: 05-11-2026  19:05
Nasi Goreng Spesial 2 x 28.000 56.000
Es Teh Manis 2 x 6.000 12.000
Ayam Bakar 35.000
Subtotal 103.000
Service 5% 5.150
PB1 10% 10.815
Pembulatan 35
TOTAL 119.000
Debit BCA 119.000`;

const FUEL = `PERTAMINA
SPBU 34.12345
JL. RAYA BOGOR KM 30
15/11/26 07:48
PERTALITE
VOLUME : 5,45 L
HARGA/L : 10.000
TOTAL : 54.500
TUNAI`;

const COFFEE = `KOPI KENANGAN
Jl. Kemang Raya 8
2026-11-17 08:12:45
Kopi Kenangan Mantan 1 x 22.000 22.000
Es Kopi Susu 1 x 18.000 18.000
Voucher Promo -5.000
Total 35.000
QRIS 35.000`;

const SPLIT_LINES = `ALFAMART
MIE INSTAN SOTO
 3 x 3.000 9.000
KOPI SACHET
 2 x 1.500 3.000
TOTAL 12.000
CASH 15.000`;

const FADED = `ALFAMART
..#$
ROTI TAWAR 12.500
SUSU UHT 18.7`;

describe("parseAmount", () => {
  it.each([
    ["Rp 25.000", 25_000],
    ["Rp25.000", 25_000],
    ["25,000", 25_000],
    ["25.000,00", 25_000],
    ["25,000.00", 25_000],
    ["1.250.000", 1_250_000],
    ["25000", 25_000],
    ["(5.000)", -5_000],
    ["-5.000", -5_000],
    ["5.000-", -5_000],
    ["12,50", 12],
  ])("reads %s as %d", (raw, value) => {
    expect(parseAmount(raw)).toBe(value);
  });

  it("refuses what is not money", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12.34.5")).toBeNull();
    expect(parseAmount("1.23456")).toBeNull();
    expect(parseAmount("99999999999")).toBeNull();
  });
});

describe("findAmounts", () => {
  it("skips quantities, dates, times, phone numbers and sizes", () => {
    expect(findAmounts("INDOMIE 2 x 3.500 7.000").map((a) => a.value)).toEqual([3_500, 7_000]);
    expect(findAmounts("AQUA 600ML 3.500").map((a) => a.value)).toEqual([3_500]);
    expect(findAmounts("18/11/2026 14:32 KASIR: 02")).toEqual([]);
    expect(findAmounts("TELP 0812-3456-7890")).toEqual([]);
    expect(findAmounts("NPWP: 01.234.567.8-012.000")).toEqual([]);
  });
});

describe("dates and times", () => {
  it("reads the formats that receipts use, day first", () => {
    expect(findDate("18/11/2026")).toBe("2026-11-18");
    expect(findDate("18-11-26")).toBe("2026-11-18");
    expect(findDate("2026-11-17 08:12")).toBe("2026-11-17");
    expect(findDate("Tgl 18.11.2026")).toBe("2026-11-18");
    expect(findDate("18 Nov 2026")).toBe("2026-11-18");
    expect(findDate("3-Agu-2026")).toBe("2026-08-03");
    expect(findDate("21 Mei 2026")).toBe("2026-05-21");
    expect(findDate("31 Oktober 2026")).toBe("2026-10-31");
    expect(findDate("11/18/2026")).toBe("2026-11-18"); // month first only when day first is impossible
  });

  it("refuses impossible dates", () => {
    expect(findDate("31/02/2026")).toBeNull();
    expect(findDate("99/99/2026")).toBeNull();
    expect(findDate("no date here")).toBeNull();
  });

  it("reads a time with or without seconds", () => {
    expect(findTime("18/11/2026 14:32")).toEqual({ hour: 14, minute: 32 });
    expect(findTime("2026-11-17 08:12:45")).toEqual({ hour: 8, minute: 12 });
    expect(findTime("total 25:61")).toBeNull();
  });
});

describe("a minimarket receipt", () => {
  const parsed = parseReceipt(MINIMARKET);
  it("finds the merchant, date, time, payment and total", () => {
    expect(parsed).toMatchObject({ merchant: "Indomaret", date: "2026-11-18", time: { hour: 14, minute: 32 }, paymentMethod: "cash", subtotal: 15_500, total: 15_500 });
    expect(parsed.address).toContain("SUDIRMAN");
  });
  it("reads the items with their quantities and ignores payment and noise lines", () => {
    expect(parsed.items.map((i) => [i.kind, i.name, i.quantity, i.lineTotal])).toEqual([
      ["item", "INDOMIE GORENG", 2, 7_000],
      ["item", "AQUA 600ML", 1, 3_500],
      ["item", "TEH BOTOL SOSRO", 1, 5_000],
    ]);
    expect(parsed.items[0].unitPrice).toBe(3_500);
  });
  it("trusts the total because the lines add up, and does not count tax that is already inside", () => {
    expect(parsed.check).toEqual({ ok: true, computed: 15_500, diff: 0 });
    expect(parsed.totalConfidence).toBe("high");
  });
});

describe("a restaurant receipt with service, tax and rounding", () => {
  const parsed = parseReceipt(RESTAURANT);
  it("reads the header", () => {
    expect(parsed).toMatchObject({ merchant: "Warung Bu Tini", date: "2026-11-05", time: { hour: 19, minute: 5 }, paymentMethod: "debit", total: 119_000, subtotal: 103_000 });
    expect(parsed.address).toContain("Melati");
  });
  it("keeps the extra lines apart from the goods", () => {
    expect(parsed.items.map((i) => [i.kind, i.lineTotal])).toEqual([
      ["item", 56_000],
      ["item", 12_000],
      ["item", 35_000],
      ["service", 5_150],
      ["tax", 10_815],
      ["rounding", 35],
    ]);
    expect(parsed.check.ok).toBe(true);
    expect(parsed.totalConfidence).toBe("high");
  });
});

describe("a fuel receipt", () => {
  const parsed = parseReceipt(FUEL);
  it("reads the total and leaves the pump details out of the items", () => {
    expect(parsed).toMatchObject({ merchant: "Pertamina", date: "2026-11-15", time: { hour: 7, minute: 48 }, total: 54_500, paymentMethod: "cash", items: [] });
    expect(parsed.totalConfidence).toBe("high");
  });
});

describe("a coffee shop receipt with a voucher", () => {
  const parsed = parseReceipt(COFFEE);
  it("reads a discount as a negative line and still adds up", () => {
    expect(parsed).toMatchObject({ merchant: "Kopi Kenangan", date: "2026-11-17", time: { hour: 8, minute: 12 }, total: 35_000, paymentMethod: "qris" });
    expect(parsed.items.map((i) => [i.kind, i.lineTotal])).toEqual([["item", 22_000], ["item", 18_000], ["discount", -5_000]]);
    expect(parsed.check.ok).toBe(true);
  });
});

describe("a quantity on its own line", () => {
  it("belongs to the name above it", () => {
    const parsed = parseReceipt(SPLIT_LINES);
    expect(parsed.items.map((i) => [i.name, i.quantity, i.unitPrice, i.lineTotal])).toEqual([
      ["MIE INSTAN SOTO", 3, 3_000, 9_000],
      ["KOPI SACHET", 2, 1_500, 3_000],
    ]);
    expect(parsed.total).toBe(12_000);
    expect(parsed.check.ok).toBe(true);
  });
});

describe("a faded or partial receipt", () => {
  it("reports what it could not read instead of guessing", () => {
    const parsed = parseReceipt(FADED);
    expect(parsed.merchant).toBe("Alfamart");
    expect(parsed.total).toBeNull();
    expect(parsed.totalConfidence).toBe("none");
    expect(parsed.items.map((i) => i.name)).toEqual(["ROTI TAWAR"]);
    expect(parsed.date).toBeNull();
  });

  it("marks the total low when the lines do not add up", () => {
    const parsed = parseReceipt(`KIOS\nBERAS 50.000\nGULA 20.000\nTOTAL 90.000`);
    expect(parsed.check).toMatchObject({ ok: false, diff: 20_000 });
    expect(parsed.totalConfidence).toBe("low");
  });

  it("copes with empty input and receipts in English", () => {
    expect(parseReceipt("")).toMatchObject({ merchant: null, total: null, items: [], totalConfidence: "none" });
    const english = parseReceipt(`SUNRISE CAFE\n18 Nov 2026 12:30\nLatte 54,300\nTOTAL 54,300\nCash`);
    expect(english).toMatchObject({ merchant: "Sunrise Cafe", date: "2026-11-18", total: 54_300, paymentMethod: "cash" });
  });
});

describe("rows from OCR frames", () => {
  const line = (text: string, top: number, left: number): OcrLine => ({ text, top, bottom: top + 20, left, right: left + 100 });
  it("puts a name and its price on one row, even when OCR returned them separately and out of order", () => {
    const rows = rowsFromOcr([line("7.000", 102, 400), line("TOTAL", 202, 10), line("INDOMIE", 100, 10), line("15.500", 204, 400), line("2 x 3.500", 99, 200)]);
    expect(rows).toEqual(["INDOMIE 2 x 3.500 7.000", "TOTAL 15.500"]);
    expect(parseReceipt([line("INDOMIE", 100, 10), line("2 x 3.500", 99, 200), line("7.000", 102, 400), line("TOTAL", 202, 10), line("7.000", 204, 400)]).total).toBe(7_000);
  });
});
