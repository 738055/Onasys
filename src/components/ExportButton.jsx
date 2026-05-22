import { useState, useEffect, useRef } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useExportContext } from '../contexts/ExportContext';
import { exportExcel } from '../utils/exportExcel';
import { exportPDF }   from '../utils/exportPDF';

const TOAST_MS = 3000;

let toastTimeout;

function Toast({ status, onClose }) {
  useEffect(() => {
    clearTimeout(toastTimeout);
    if (status) toastTimeout = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(toastTimeout);
  }, [status, onClose]);

  if (!status) return null;
  const ok = status === 'ok';
  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
        ${ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
    >
      {ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {ok ? 'Arquivo gerado com sucesso' : 'Erro ao gerar arquivo'}
    </div>
  );
}

/**
 * @param {{ title: string, slug: string, sections: Section[], chartRef?: React.Ref }} props
 *
 * Section shape:
 *   { title, columns: [{ key, label, type, total? }], rows, summary?, chartRef? }
 */
export function ExportButton({ title, slug, sections, chartRef, className = '' }) {
  const ctx = useExportContext();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(null); // 'excel' | 'pdf' | null
  const [toast,   setToast]   = useState(null); // 'ok' | 'err' | null
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    const escape  = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', escape); };
  }, [open]);

  async function run(type) {
    setOpen(false);
    setLoading(type);
    const enrichedSections = sections.map(s => ({
      ...s,
      chartRef: s.chartRef ?? chartRef,
    }));
    try {
      if (type === 'excel') {
        await exportExcel({ title, slug, sections: enrichedSections, ctx });
      } else {
        await exportPDF({ title, slug, sections: enrichedSections, ctx });
      }
      setToast('ok');
    } catch (err) {
      console.error('Export error', err);
      setToast('err');
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <>
      <div ref={menuRef} className={`relative ${className}`}>
        <button
          onClick={() => !busy && setOpen(o => !o)}
          disabled={busy}
          aria-label="Exportar seção"
          title="Exportar"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
            border border-slate-200
            ${busy
              ? 'bg-slate-50 text-slate-300 cursor-wait'
              : 'bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'
            }`}
        >
          {busy
            ? <Loader2 size={13} className="animate-spin" />
            : <Download size={13} />
          }
          {busy ? (loading === 'excel' ? 'Gerando Excel…' : 'Gerando PDF…') : 'Exportar'}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[160px]">
            <button
              onClick={() => run('excel')}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              Excel (.xlsx)
            </button>
            <button
              onClick={() => run('pdf')}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <FileText size={15} className="text-red-500" />
              PDF
            </button>
          </div>
        )}
      </div>

      <Toast status={toast} onClose={() => setToast(null)} />
    </>
  );
}
