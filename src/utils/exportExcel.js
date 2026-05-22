import ExcelJS from 'exceljs';
import { buildMetadata, buildFileName } from './exportMeta.js';

const BLUE_HDR  = 'FF1E40AF';
const BLUE_LITE = 'FFE0E7FF';
const GREY_BG   = 'FFF8FAFC';

const NUM_FMT_BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const NUM_FMT_PCT = '0.00%';
const NUM_FMT_INT = '#,##0';

function numFmt(type) {
  if (type === 'currency') return NUM_FMT_BRL;
  if (type === 'percent')  return NUM_FMT_PCT;
  if (type === 'number')   return NUM_FMT_INT;
  return null;
}

function cellAlign(type) {
  return type === 'text' ? 'left' : 'right';
}

function addResumoSheet(wb, meta, sections) {
  const ws = wb.addWorksheet('Resumo');
  ws.columns = [{ width: 22 }, { width: 50 }];

  const title = ws.addRow(['Dashboard BI ONASYS', '']);
  title.font = { bold: true, size: 13, color: { argb: BLUE_HDR } };
  ws.mergeCells(`A1:B1`);
  ws.addRow([]);

  const pairs = [
    ['Período',      meta.periodo],
    ['Perfil',       meta.perfil],
    ['Modalidade',   meta.modalidade],
    ['Filtros',      meta.filtros],
    ['Gerado em',    meta.geradoEm],
  ];
  pairs.forEach(([k, v]) => {
    const row = ws.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } };
    row.getCell(2).alignment = { wrapText: true };
  });

  ws.addRow([]);
  const secHeader = ws.addRow(['Seções exportadas', '']);
  secHeader.font = { bold: true };
  sections.forEach(s => ws.addRow(['', s.title || '']));
}

function autoWidth(ws, columns) {
  columns.forEach((col, i) => {
    const colLetter = ws.getColumn(i + 1);
    const maxLen = Math.min(40, Math.max(col.label?.length ?? 10, 10));
    colLetter.width = maxLen + 2;
  });
}

function addDataSheet(wb, section) {
  const { title, columns, rows, summary } = section;
  const sheetName = title.slice(0, 31).replace(/[*?:/\\[\]]/g, '');
  const ws = wb.addWorksheet(sheetName);

  if (summary?.length) {
    summary.forEach(s => {
      const r = ws.addRow([s.label, s.value]);
      r.getCell(1).font = { bold: true };
    });
    ws.addRow([]);
  }

  const headers = columns.map(c => c.label);
  const hdrRow = ws.addRow(headers);
  hdrRow.eachCell(cell => {
    cell.font     = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill     = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HDR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const totals = new Array(columns.length).fill(null);

  rows.forEach(row => {
    const values = columns.map(col => {
      let v = row[col.key];
      if (col.type === 'percent' && typeof v === 'number') v = v / 100;
      return v ?? null;
    });
    const dataRow = ws.addRow(values);
    dataRow.eachCell((cell, ci) => {
      const col = columns[ci - 1];
      const fmt = numFmt(col?.type);
      if (fmt) cell.numFmt = fmt;
      cell.alignment = { horizontal: cellAlign(col?.type) };
    });

    columns.forEach((col, ci) => {
      if (col.total) {
        const v = row[col.key];
        if (typeof v === 'number') totals[ci] = (totals[ci] ?? 0) + v;
      }
    });
  });

  if (columns.some(c => c.total)) {
    const totalValues = columns.map((col, i) => col.total ? totals[i] : (i === 0 ? 'TOTAL' : null));
    const totRow = ws.addRow(totalValues.map((v, i) => {
      if (columns[i].type === 'percent' && typeof v === 'number') return v / rows.length;
      return v;
    }));
    totRow.eachCell((cell, ci) => {
      const col = columns[ci - 1];
      cell.font  = { bold: true };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_LITE } };
      const fmt  = numFmt(col?.type);
      if (fmt) cell.numFmt = fmt;
      cell.alignment = { horizontal: cellAlign(col?.type) };
    });
  }

  ws.columns = columns.map(col => ({ width: Math.min(40, Math.max(col.label.length + 2, 12)) }));
  return ws;
}

export async function exportExcel({ title, slug, sections, ctx }) {
  const meta = buildMetadata(ctx);
  const wb   = new ExcelJS.Workbook();
  wb.creator  = 'Dashboard BI ONASYS';
  wb.created  = new Date();

  addResumoSheet(wb, meta, sections);
  sections.forEach(s => addDataSheet(wb, s));

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${buildFileName(slug, ctx)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
