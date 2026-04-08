import ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const EXPORTS_DIR = path.resolve("exports");
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

export async function generateXlsx(rows: Record<string, unknown>[], title = "Relatório"): Promise<string> {
  if (!rows.length) throw new Error("Nenhum dado para exportar.");

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));
  const headers = Object.keys(rows[0]);

  // Header row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0056B3" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFDDDDDD" } },
      bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
      left: { style: "thin", color: { argb: "FFDDDDDD" } },
      right: { style: "thin", color: { argb: "FFDDDDDD" } },
    };
  });

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const values = headers.map((h) => {
      const v = row[h];
      if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
      return v;
    });
    const dataRow = ws.addRow(values);
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
      if (i % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F7FC" } };
      }
    });
  }

  // Auto-fit columns
  for (let i = 0; i < headers.length; i++) {
    let maxLen = headers[i].length;
    for (const row of rows.slice(0, 100)) {
      maxLen = Math.max(maxLen, Math.min(String(row[headers[i]] ?? "").length, 50));
    }
    ws.getColumn(i + 1).width = maxLen + 4;
  }

  // Freeze header & auto-filter
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + headers.length)}${rows.length + 1}` };

  const fileId = uuidv4();
  const filepath = path.join(EXPORTS_DIR, `${fileId}.xlsx`);
  await wb.xlsx.writeFile(filepath);
  return fileId;
}

export function getExportPath(fileId: string): string | null {
  const filepath = path.join(EXPORTS_DIR, `${fileId}.xlsx`);
  return fs.existsSync(filepath) ? filepath : null;
}

export function cleanupOldExports(maxAgeHours = 24): void {
  const now = Date.now();
  for (const f of fs.readdirSync(EXPORTS_DIR)) {
    if (!f.endsWith(".xlsx")) continue;
    const filepath = path.join(EXPORTS_DIR, f);
    const age = (now - fs.statSync(filepath).mtimeMs) / 3600000;
    if (age > maxAgeHours) fs.unlinkSync(filepath);
  }
}
