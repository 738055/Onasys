import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { buildMetadata, buildFileName, fmtCell } from './exportMeta.js';

const BLUE = [30, 64, 175];
const RED  = [220, 38, 38];

function drawPageHeader(doc, meta, titleText, pageSize) {
  const { width } = pageSize;
  const now = meta.geradoEm;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Dashboard BI ONASYS', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${now}`, width - 14, 12, { align: 'right' });

  doc.setFontSize(8);
  doc.text(`Período: ${meta.periodo}  ·  Perfil: ${meta.perfil}  ·  ${meta.modalidade}`, 14, 17);

  if (meta.filtros !== 'Nenhum') {
    doc.text(`Filtros: ${meta.filtros}`, 14, 21);
  }

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  const lineY = meta.filtros !== 'Nenhum' ? 23 : 19;
  doc.line(14, lineY, width - 14, lineY);

  if (titleText) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(titleText, 14, lineY + 7);
  }

  return lineY + (titleText ? 13 : 5);
}

async function captureChart(ref) {
  if (!ref?.current) return null;
  try {
    const canvas = await html2canvas(ref.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function exportPDF({ title, slug, sections, ctx, pageOrientation = 'landscape' }) {
  const meta = buildMetadata(ctx);
  const doc  = new jsPDF({ orientation: pageOrientation, unit: 'mm', format: 'a4' });
  const pageSize = doc.internal.pageSize;
  const W = pageSize.getWidth();
  const MARGIN = 14;

  let isFirstSection = true;

  for (const section of sections) {
    if (!isFirstSection) doc.addPage();
    isFirstSection = false;

    const startY = drawPageHeader(doc, meta, section.title || title, { width: W });

    let currentY = startY;

    if (section.chartRef) {
      const imgData = await captureChart(section.chartRef);
      if (imgData) {
        const maxW   = W - MARGIN * 2;
        const imgW   = Math.min(maxW, 140);
        const ratio  = section.chartRef.current.offsetHeight / section.chartRef.current.offsetWidth;
        const imgH   = imgW * ratio;
        doc.addImage(imgData, 'PNG', MARGIN, currentY, imgW, imgH);
        currentY += imgH + 4;
      }
    }

    if (section.summary?.length) {
      const sumBody = section.summary.map(s => [s.label, fmtCell(s.value, s.type)]);
      autoTable(doc, {
        startY: currentY,
        head: [['Indicador', 'Valor']],
        body: sumBody,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 9 },
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
        theme: 'striped',
        didParseCell: d => {
          if (d.section === 'body' && typeof d.row.raw?.[1] === 'string' && d.row.raw[1].startsWith('-R$')) {
            d.cell.styles.textColor = RED;
          }
        },
      });
      currentY = doc.lastAutoTable.finalY + 5;
    }

    if (section.columns?.length && section.rows?.length) {
      const head    = [section.columns.map(c => c.label)];
      const body    = section.rows.map(row =>
        section.columns.map(col => fmtCell(row[col.key], col.type))
      );

      const hasTotals = section.columns.some(c => c.total);
      if (hasTotals) {
        const totRow = section.columns.map((col, i) => {
          if (i === 0) return 'TOTAL';
          if (!col.total) return '';
          const sum = section.rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
          return fmtCell(sum, col.type);
        });
        body.push(totRow);
      }

      autoTable(doc, {
        startY: currentY,
        head,
        body,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 8, overflow: 'linebreak' },
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: Object.fromEntries(
          section.columns.map((col, i) => [i, { halign: col.type === 'text' ? 'left' : 'right' }])
        ),
        theme: 'striped',
        didParseCell: d => {
          if (d.section === 'body') {
            const raw = d.row.raw[d.column.index];
            if (typeof raw === 'string' && raw.startsWith('-R$')) {
              d.cell.styles.textColor = RED;
            }
            const isTotal = hasTotals && d.row.index === body.length - 1;
            if (isTotal) {
              d.cell.styles.fontStyle  = 'bold';
              d.cell.styles.fillColor  = [224, 231, 255];
            }
          }
        },
        didDrawPage: d => {
          const pg    = doc.internal.getCurrentPageInfo().pageNumber;
          const total = doc.internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`Página ${pg} de ${total}`, W / 2, pageSize.getHeight() - 6, { align: 'center' });
        },
      });
    }
  }

  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Página ${p} de ${pages}`, W / 2, pageSize.getHeight() - 6, { align: 'center' });
  }

  doc.save(`${buildFileName(slug, ctx)}.pdf`);
}
