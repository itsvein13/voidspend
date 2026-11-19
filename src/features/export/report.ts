// The printable summary behind "Export PDF". The screen formats every number and
// label with the person's language, so this file only lays them out and escapes
// them. The page is white with black text on purpose: it is made for paper.
export type ReportRow = { label: string; value: string; note?: string };
export type ReportModel = {
  title: string;
  subtitle: string;
  summary: ReportRow[];
  sections: { title: string; rows: ReportRow[] }[];
  footer: string;
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const rowHtml = (row: ReportRow) =>
  `<tr><td>${escapeHtml(row.label)}</td><td class="num">${escapeHtml(row.value)}</td><td class="note">${row.note ? escapeHtml(row.note) : ""}</td></tr>`;

export function buildReportHtml(model: ReportModel, lang: string = "en"): string {
  const sections = model.sections
    .filter((section) => section.rows.length > 0)
    .map((section) => `<h2>${escapeHtml(section.title)}</h2><table>${section.rows.map(rowHtml).join("")}</table>`)
    .join("");
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title>
<style>
body{font-family:Helvetica,Arial,sans-serif;color:#111;margin:32px;}
h1{font-size:24px;margin:0 0 4px;} h2{font-size:16px;margin:28px 0 8px;} .sub{color:#444;margin:0 0 20px;}
table{width:100%;border-collapse:collapse;} td{padding:6px 4px;border-bottom:1px solid #ddd;font-size:13px;}
td.num{text-align:right;white-space:nowrap;font-weight:600;} td.note{color:#444;text-align:right;width:20%;}
footer{margin-top:32px;color:#444;font-size:11px;}
</style></head><body>
<h1>${escapeHtml(model.title)}</h1><p class="sub">${escapeHtml(model.subtitle)}</p>
<table>${model.summary.map(rowHtml).join("")}</table>${sections}
<footer>${escapeHtml(model.footer)}</footer></body></html>`;
}
