"use client";

// ---------------------------------------------------------------------------
// Reusable export for the shared DataTable — CSV, Excel (.xlsx), PDF, Print.
//
// Every exporter works on rows that are ALREADY in the browser (loaded by
// the module's own role-scoped API/subscription), so export never widens
// what the signed-in user can see. Scope ("current page" / "filtered" /
// "all") just chooses which of those already-loaded rows to write.
// ---------------------------------------------------------------------------

// Turn column defs + raw rows into a flat matrix: [headers, ...stringRows].
export function toMatrix(columns, rows) {
  const cols = columns.filter((col) => col.exportable !== false);
  const headers = cols.map((col) => col.exportHeader || col.header || col.key);
  const body = rows.map((row) =>
    cols.map((col) => {
      const raw = col.exportValue
        ? col.exportValue(row)
        : col.accessor
          ? col.accessor(row)
          : row[col.key];
      if (raw === null || raw === undefined) return "";
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
    }),
  );
  return [headers, ...body];
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const safeName = (name) => (name || "export").replace(/[^\w.-]+/g, "_");

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- CSV (RFC 4180) --------------------------------------------------------
export function toCsv(matrix) {
  const cell = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + matrix.map((line) => line.map(cell).join(",")).join("\r\n");
}

export function exportCsv(columns, rows, name) {
  download(new Blob([toCsv(toMatrix(columns, rows))], { type: "text/csv;charset=utf-8" }), `${safeName(name)}-${stamp()}.csv`);
}

// ---- Excel (.xlsx, real OOXML) -------------------------------------------
const xmlEscape = (value) =>
  String(value ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

const colRef = (index) => {
  let n = index + 1;
  let ref = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    ref = String.fromCharCode(65 + mod) + ref;
    n = Math.floor((n - 1) / 26);
  }
  return ref;
};

function sheetXml(matrix) {
  const rowsXml = matrix
    .map((line, r) => {
      const cells = line
        .map((value, c) => {
          const ref = `${colRef(c)}${r + 1}`;
          const numeric = value !== "" && value !== null && !Number.isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(String(value).trim());
          if (r > 0 && numeric) return `<c r="${ref}"><v>${xmlEscape(value)}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

export async function exportXlsx(columns, rows, name) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const matrix = toMatrix(columns, rows);
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  const xl = zip.folder("xl");
  xl.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape((name || "Sheet1").slice(0, 28))}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  xl.folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  xl.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);
  xl.folder("worksheets").file("sheet1.xml", sheetXml(matrix));
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  download(blob, `${safeName(name)}-${stamp()}.xlsx`);
}

// ---- PDF (pdf-lib, simple paginated grid) --------------------------------
export async function exportPdf(columns, rows, name) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const matrix = toMatrix(columns, rows);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 36;
  const pageW = 842;
  const pageH = 595; // A4 landscape
  const usableW = pageW - margin * 2;
  const colCount = matrix[0]?.length || 1;
  const colW = usableW / colCount;
  const rowH = 20;
  const size = 8;
  const clip = (text) => {
    let value = String(text ?? "");
    while (value.length && bold.widthOfTextAtSize(value, size) > colW - 6) value = value.slice(0, -1);
    return value === String(text ?? "") ? value : value.slice(0, -1) + "…";
  };

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;
  page.drawText(`${name || "Export"} — ${new Date().toLocaleString()}`, { x: margin, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= rowH;

  const drawRow = (line, isHeader) => {
    if (y < margin + rowH) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
    if (isHeader) page.drawRectangle({ x: margin, y: y - rowH + 5, width: usableW, height: rowH, color: rgb(0.90, 0.97, 0.93) });
    line.forEach((cell, index) => {
      page.drawText(clip(cell), { x: margin + index * colW + 3, y: y - 13, size, font: isHeader ? bold : font, color: rgb(0.15, 0.15, 0.15) });
    });
    page.drawLine({ start: { x: margin, y: y - rowH + 5 }, end: { x: margin + usableW, y: y - rowH + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= rowH;
  };

  matrix.forEach((line, index) => drawRow(line, index === 0));
  const bytes = await doc.save();
  download(new Blob([bytes], { type: "application/pdf" }), `${safeName(name)}-${stamp()}.pdf`);
}

// ---- Print (styled HTML in a new window) ---------------------------------
export function printRows(columns, rows, name) {
  const matrix = toMatrix(columns, rows);
  const esc = (value) => String(value ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const head = matrix[0].map((h) => `<th>${esc(h)}</th>`).join("");
  const body = matrix
    .slice(1)
    .map((line) => `<tr>${line.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
    .join("");
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${esc(name || "Export")}</title><style>
    *{font-family:-apple-system,Segoe UI,Roboto,sans-serif;box-sizing:border-box}
    body{margin:24px;color:#1e293b}
    h1{font-size:18px;margin:0 0 4px}
    p{margin:0 0 16px;color:#64748b;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
    thead th{background:#dcfce7;font-weight:700}
    tbody tr:nth-child(even){background:#f8fafc}
    @media print{body{margin:0}}
  </style></head><body>
    <h1>${esc(name || "Export")}</h1>
    <p>${matrix.length - 1} record(s) · generated ${new Date().toLocaleString()}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  win.document.close();
}

export function runExport(format, { columns, rows, name }) {
  if (!rows.length) return;
  if (format === "csv") return exportCsv(columns, rows, name);
  if (format === "xlsx") return exportXlsx(columns, rows, name);
  if (format === "pdf") return exportPdf(columns, rows, name);
  if (format === "print") return printRows(columns, rows, name);
  return undefined;
}
