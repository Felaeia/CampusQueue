import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ApiError } from "./http.ts";

type Cell = string | number | null;
export type Report = {
  title: string;
  filename: string;
  filters: Record<string, string | null>;
  generatedAt: string;
  headers: string[];
  rows: Cell[][];
};

export function csvCell(value: Cell): string {
  if (typeof value === "number") return String(value);
  if (value === null) return "";
  const safe = /^[\u0000-\u0020\uFEFF]*[=+@-]|^[\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function download(report: Report, format: string) {
  if (!["csv", "pdf"].includes(format)) throw new ApiError(400, "Format must be csv or pdf");
  const headers = {
    "Content-Disposition": `attachment; filename="${report.filename}.${format}"`,
    "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
  };
  if (format === "csv") {
    const csv = [report.headers, ...report.rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new Response(csv + "\r\n", { headers });
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle(report.title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const characterSet = new Set(font.getCharacterSet());
  const printable = (value: Cell) => Array.from(String(value ?? "").replace(/\s+/gu, " "),
    (character) => characterSet.has(character.codePointAt(0) ?? 0) ? character : "?").join("");
  const width = 842;
  const height = 595;
  const margin = 36;
  const columnWidths = report.headers.map((_, index) =>
    index < 2 ? (width - margin * 2) * 0.19 : (width - margin * 2) * 0.62 / (report.headers.length - 2));
  const fit = (value: Cell, cellWidth: number) => {
    let result = printable(value);
    if (font.widthOfTextAtSize(result, 9) <= cellWidth) return result;
    while (result.length && font.widthOfTextAtSize(result + "...", 9) > cellWidth) result = result.slice(0, -1);
    return result + "...";
  };
  let page = pdf.addPage([width, height]);
  let top = 0;
  const row = (cells: Cell[], heading: boolean) => {
    let left = margin;
    page.drawRectangle({ x: margin, y: top - 6, width: width - margin * 2, height: 17,
      color: heading ? rgb(0.91, 0.94, 0.92) : rgb(0.98, 0.98, 0.98) });
    cells.forEach((value, index) => {
      page.drawText(fit(value, columnWidths[index] - 8), { x: left + 4, y: top, size: 9, font: heading ? bold : font });
      left += columnWidths[index];
    });
    top -= 19;
  };
  const start = () => {
    top = height - margin;
    page.drawText(printable(report.title), { x: margin, y: top, size: 18, font: bold });
    top -= 22;
    page.drawText("Generated " + report.generatedAt, { x: margin, y: top, size: 9, font });
    for (const [key, value] of Object.entries(report.filters)) {
      top -= 13;
      page.drawText(fit(key + ": " + (value ?? "All"), width - margin * 2), { x: margin, y: top, size: 9, font });
    }
    top -= 22;
    row(report.headers, true);
    page.drawText("Page " + pdf.getPageCount(), { x: margin, y: 20, size: 9, font });
  };
  start();
  if (!report.rows.length) {
    page.drawText("No records for the selected filters.", { x: margin, y: top - 6, size: 10, font });
  }
  for (const cells of report.rows) {
    if (top < margin + 12) { page = pdf.addPage([width, height]); start(); }
    row(cells, false);
  }
  return new Response(Uint8Array.from(await pdf.save()), { headers });
}
