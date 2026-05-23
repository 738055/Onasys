import { useMemo, useState } from 'react';
import { X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { BRLFULL } from '../utils/format';

const PAGE_SIZE = 30;

function buildAudit(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.id) continue;
    if (!map[r.id]) {
      map[r.id] = {
        id:           r.id,
        client:       r.client       || '(sem cliente)',
        vendor:       r.vendor       || '(sem emissor)',
        filial:       r.filial       || '',
        channel:      r.channel      || '',
        emissionDate: r.emissionDate,
        maxPax:       0,
        revenue:      0,
        profitLiquido:0,
        items:        [],
      };
    }
    const entry = map[r.id];
    if ((r.passengers || 0) > entry.maxPax) entry.maxPax = r.passengers || 0;
    entry.revenue       += r.revenue       || 0;
    entry.profitLiquido += r.profitLiquido || 0;
    entry.items.push({
      product:    r.product   || '(sem produto)',
      segment:    r.segment   || '',
      supplier:   r.supplier  || '',
      passengers: r.passengers || 0,
      revenue:    r.revenue   || 0,
    });
  }
  return Object.values(map).sort((a, b) => b.maxPax - a.maxPax || b.revenue - a.revenue);
}

function fmtDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function PaxAuditModal({ rows, onClose }) {
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(0);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const audit = useMemo(() => buildAudit(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return audit;
    return audit.filter(v =>
      v.id.toLowerCase().includes(q) ||
      v.client.toLowerCase().includes(q) ||
      v.vendor.toLowerCase().includes(q)
    );
  }, [audit, search]);

  const totalPax     = useMemo(() => filtered.reduce((s, v) => s + v.maxPax, 0), [filtered]);
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows     = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSearch(v) {
    setSearch(v);
    setPage(0);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Auditoria de Passageiros</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Por venda, conta apenas o maior <code className="bg-slate-100 px-1 rounded">num_pax</code> entre todos os itens —
              evita duplicar o mesmo grupo de pax quando a venda tem Transfer + Hotel + Ingresso.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + summary */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por venda, cliente ou emissor…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex gap-4 text-xs text-slate-500 ml-auto">
            <span><b className="text-slate-700">{filtered.length.toLocaleString('pt-BR')}</b> vendas</span>
            <span><b className="text-slate-700">{totalPax.toLocaleString('pt-BR')}</b> pax (deduplicado)</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-2">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-slate-500 text-left">
                <th className="py-2 pr-2 w-6" />
                <th className="py-2 pr-3 font-semibold">Venda</th>
                <th className="py-2 pr-3 font-semibold">Cliente</th>
                <th className="py-2 pr-3 font-semibold">Emissor</th>
                <th className="py-2 pr-3 font-semibold">Filial</th>
                <th className="py-2 pr-3 font-semibold">Emissão</th>
                <th className="py-2 pr-3 font-semibold text-center">Itens</th>
                <th className="py-2 pr-3 font-semibold text-right">Pax contado</th>
                <th className="py-2 font-semibold text-right">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Nenhuma venda encontrada.</td></tr>
              )}
              {pageRows.map((v, i) => {
                const isExpanded = expandedIds.has(v.id);
                const hasMultiPax = v.items.some(it => it.passengers !== v.maxPax);
                return (
                  <>
                    <tr
                      key={v.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleExpand(v.id)}
                    >
                      <td className="py-2 pr-2 text-slate-400">
                        {isExpanded
                          ? <ChevronDown size={12} />
                          : <ChevronRight size={12} />
                        }
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-600">{v.id}</td>
                      <td className="py-2 pr-3 font-medium text-slate-700 max-w-[160px] truncate">{v.client}</td>
                      <td className="py-2 pr-3 text-slate-500 max-w-[120px] truncate">{v.vendor}</td>
                      <td className="py-2 pr-3 text-slate-400">{v.filial}</td>
                      <td className="py-2 pr-3 text-slate-500 tabular-nums">{fmtDate(v.emissionDate)}</td>
                      <td className="py-2 pr-3 text-center text-slate-500">{v.items.length}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-700 tabular-nums">
                        {v.maxPax.toLocaleString('pt-BR')}
                        {hasMultiPax && (
                          <span className="ml-1 text-amber-500 text-[10px]" title="Itens com pax divergente">⚠</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-slate-700 tabular-nums">{BRLFULL(v.revenue)}</td>
                    </tr>

                    {isExpanded && v.items.map((it, j) => {
                      const isMax = it.passengers === v.maxPax;
                      return (
                        <tr
                          key={`${v.id}-${j}`}
                          className="bg-slate-50 border-b border-slate-100 text-slate-500"
                        >
                          <td colSpan={2} />
                          <td className="py-1.5 pr-3 pl-2 italic text-slate-500 truncate max-w-[160px]">
                            {it.product}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-400 truncate">{it.supplier}</td>
                          <td className="py-1.5 pr-3 text-slate-400">{it.segment}</td>
                          <td />
                          <td />
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            <span className={isMax ? 'font-semibold text-emerald-700' : 'text-slate-400'}>
                              {it.passengers.toLocaleString('pt-BR')}
                            </span>
                            {isMax && (
                              <span className="ml-1 text-[10px] text-emerald-600 font-semibold">✓</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-500">{BRLFULL(it.revenue)}</td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination + footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length.toLocaleString('pt-BR')} vendas
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
            >
              ←
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = totalPages <= 7 ? i : Math.max(0, Math.min(totalPages - 7, page - 3)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2 py-1 rounded border ${p === page ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
