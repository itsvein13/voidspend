import type { Strings } from "@/i18n/id";
import { formatMonthLabel } from "@/lib/dateLabels";
import { formatRupiah } from "@/lib/money";

import type { InsightsData } from "../insights/insights";
import type { ReportModel } from "./report";

const percent = (value: number | null, strings: Strings): string => {
  if (value === null) return strings.insights.noBaseline;
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
};

/** The label of the period: "November 2026" or "2026". */
export function periodLabel(period: InsightsData["period"], strings: Strings): string {
  return period.kind === "month" ? formatMonthLabel(period.month, strings) : String(period.year);
}

/** Lays the insights out for the PDF, with every number already in the person's language. */
export function buildInsightsReport(data: InsightsData, strings: Strings, categoryName: (id: string | null) => string, walletLabel: string | null = null): ReportModel {
  const { totals } = data;
  const saved = totals.savingDeposit - totals.savingWithdrawal;
  const expenseTotal = data.categories.reduce((sum, item) => sum + item.total, 0);
  return {
    title: strings.insights.pdfTitle,
    // A report for one wallet says so, so it is never mistaken for the whole picture.
    subtitle: walletLabel ? `${periodLabel(data.period, strings)}, ${walletLabel}` : periodLabel(data.period, strings),
    summary: [
      { label: strings.insights.income, value: formatRupiah(totals.income), note: percent(data.changes.income, strings) },
      { label: strings.insights.spent, value: formatRupiah(totals.expense), note: percent(data.changes.expense, strings) },
      { label: strings.insights.saved, value: formatRupiah(saved), note: percent(data.changes.saving, strings) },
      { label: data.walletId ? strings.insights.net : strings.insights.left, value: formatRupiah(data.left) },
      ...(data.savingsRate === null ? [] : [{ label: strings.insights.savingsRate, value: strings.insights.percent(data.savingsRate * 100) }]),
    ],
    sections: [
      {
        title: strings.insights.categories,
        rows: data.categories.map((item) => ({
          label: categoryName(item.categoryId),
          value: formatRupiah(item.total),
          note: expenseTotal > 0 ? `${Math.round((item.total / expenseTotal) * 100)}%` : "",
        })),
      },
      { title: strings.insights.merchants, rows: data.merchants.map((item) => ({ label: item.name, value: formatRupiah(item.total), note: strings.insights.merchantCount(item.count) })) },
      {
        title: strings.insights.trend,
        rows: data.bars.map((bar) => ({ label: formatMonthLabel(bar.month, strings), value: formatRupiah(bar.expense), note: formatRupiah(bar.income) })),
      },
    ],
    footer: strings.insights.pdfFooter,
  };
}
