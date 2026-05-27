import { useMemo, useState } from 'react';
import { X, ChevronDown, ChevronRight, Search, AlertTriangle } from 'lucide-react';
import { BRLFULL, PAX_CATEGORY_CFG } from '../utils/format';
import { PaxCompositionBar, PaxBreakdownChips } from './PaxCompositionBar';

const PAGE_SIZE = 30;

// Campos de breakdown rastreados por venda (max entre itens)
const PAX_MAX_FIELDS = ['paxAdt', 'paxChd', 'paxColo', 'paxRed', 'paxSen', 'paxFree'];

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
        // Breakdown por venda (max de cada categoria entre os itens)
        maxPaxAdt:  0, maxPaxChd:  0, maxPaxColo: 0,
        maxPaxRed:  0, maxPaxSen:  0, maxPaxFree:  0,
        revenue:      0,
        profitLiquido:0,
        items:        [],
      };
    }
    const entry = map[r.id];
    if ((r.passengers || 0) > entry.maxPax) entry.maxPax = r.passengers || 0;
    // Max por categoria — mesmo critério do num_pax (max entre itens da venda)
    for (const f of PAX_MAX_FIELDS) {
      const key = 'max' + f.charAt(0).toUpperCase() + f.slice(1); // ex: 'maxPaxAdt'
      if ((r[f] || 0) > entry[key]) entry[key] = r[f] || 0;
    }
    entry.revenue       += r.revenue       || 0;
    entry.profitLiquido += r.profitLiquido || 0;
    entry.items.push({
      product:    r.product    || '(sem produto)',
      segment:    r.segment    || '',
      supplier:   r.supplier   || '',
      passengers: r.passengers || 0,
      paxAdt:     r.paxAdt     || 0,
      paxChd:     r.paxChd     || 0,
      paxColo:    r.paxColo    || 0,
      paxRed:     r.paxRed     || 0,
      paxSen:     r.paxSen     || 0,
      paxFree:    r.paxFree    || 0,
      revenue:    r.revenue    || 0,
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
              Por venda, conta apenas o <strong>maior <code className="bg-slate-100 px-1 rounded">num_pax</code></strong> entre os itens —
              evita duplicar o mesmo grupo quando uma venda tem Transfer + Almoço + Ingresso.
              Vendas diferentes podem ter os mesmos pax (contagem separada por venda é intencional).
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="text-emerald-600 font-semibold">✓ contado</span> = pax usado na soma &nbsp;·&nbsp;
              <span className="text-slate-400">= mesmo grupo</span> = item repetido, não soma &nbsp;·&nbsp;
              <span className="text-amber-500">⚠</span> = itens com pax divergente (MAX foi aplicado) &nbsp;·&nbsp;
              <span className="text-slate-400 text-[10px]">×N</span> = N itens com mesmo pax (grupo único)
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Composição por categoria (ADT/CHD/COL/RED/SEN/FREE) exibida ao expandir cada venda.
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
                const isExpanded   = expandedIds.has(v.id);
                // hasMultiPax: algum item tem pax diferente do max → precisou usar MAX
                const hasMultiPax  = v.items.some(it => it.passengers !== v.maxPax);
                // allSame: todos os itens têm o mesmo pax (sem divergência)
                const allSame      = !hasMultiPax && v.items.length > 1;
                // firstMaxIdx: índice do 1º item que atinge o max (o "representante" do grupo)
                const firstMaxIdx  = v.items.findIndex(it => it.passengers === v.maxPax);
                // Verificação de qualidade do breakdown: ADT+CHD+COL+RED+SEN+FREE deve = maxPax
                const breakdownSum = v.maxPaxAdt + v.maxPaxChd + v.maxPaxColo + v.maxPaxRed + v.maxPaxSen + v.maxPaxFree;
                const hasBreakdownMismatch = breakdownSum > 0 && breakdownSum !== v.maxPax;
                // Shape para PaxCompositionBar
                const paxBreakdown = { adt: v.maxPaxAdt, chd: v.maxPaxChd, colo: v.maxPaxColo, red: v.maxPaxRed, sen: v.maxPaxSen, free: v.maxPaxFree };
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
                      <td className="py-2 pr-3 text-right tabular-nums">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-700">
                              {v.maxPax.toLocaleString('pt-BR')}
                            </span>
                            {hasMultiPax && (
                              <span
                                className="text-amber-500 text-[10px]"
                                title="Itens com pax divergente — contando o maior"
                              >⚠</span>
                            )}
                            {allSame && (
                              <span
                                className="text-slate-400 text-[10px]"
                                title="Todos os itens com mesmo pax — grupo único, contando 1×"
                              >×{v.items.length}</span>
                            )}
                            {hasBreakdownMismatch && (
                              <span
                                title={`Soma do breakdown (${breakdownSum}) ≠ pax contado (${v.maxPax}) — possível inconsistência na API`}
                                className="text-orange-400"
                              >
                                <AlertTriangle size={10} />
                              </span>
                            )}
                          </div>
                          {/* Mini-bar de composição */}
                          {breakdownSum > 0 && (
                            <PaxCompositionBar
                              breakdown={paxBreakdown}
                              height={4}
                              className="w-16"
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-right text-slate-700 tabular-nums">{BRLFULL(v.revenue)}</td>
                    </tr>

                    {isExpanded && (
                      <>
                        {/* Legenda rápida dentro da venda expandida */}
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <td colSpan={9} className="py-1.5 px-4 text-[10px] text-slate-400 italic">
                            <div className="flex items-center gap-4 flex-wrap">
                              <span>
                                {hasMultiPax
                                  ? `Itens com pax diferentes → contando apenas o maior (${v.maxPax} pax)`
                                  : allSame
                                    ? `Todos os ${v.items.length} itens têm ${v.maxPax} pax → mesmo grupo, contando 1× = ${v.maxPax} pax`
                                    : `1 item → ${v.maxPax} pax`
                                }
                              </span>
                              {breakdownSum > 0 && (
                                <PaxBreakdownChips breakdown={paxBreakdown} />
                              )}
                              {hasBreakdownMismatch && (
                                <span className="text-orange-500 flex items-center gap-0.5">
                                  <AlertTriangle size={10} />
                                  Soma breakdown ({breakdownSum}) ≠ num_pax ({v.maxPax})
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {v.items.map((it, j) => {
                          const isMax      = it.passengers === v.maxPax;
                          const isFirstMax = j === firstMaxIdx;

                          // Regra única para todos os casos:
                          // 1º item que atinge o MAX → verde + "✓ contado"
                          // demais itens com mesmo pax → cinza + "= mesmo grupo"
                          // itens com pax menor       → cinza + "não contado"
                          let paxColor, paxSuffix;
                          if (isFirstMax) {
                            paxColor  = 'font-semibold text-emerald-700';
                            paxSuffix = v.items.length > 1
                              ? <span className="ml-1 text-[10px] text-emerald-600 font-semibold">✓ contado</span>
                              : null;
                          } else if (isMax) {
                            paxColor  = 'text-slate-400';
                            paxSuffix = <span className="ml-1 text-[10px] text-slate-400">= mesmo grupo</span>;
                          } else {
                            paxColor  = 'text-slate-400';
                            paxSuffix = <span className="ml-1 text-[10px] text-slate-300">não contado</span>;
                          }

                          // Breakdown por item (campos individuais)
                          const itemBreakdown = {
                            adt: it.paxAdt, chd: it.paxChd, colo: it.paxColo,
                            red: it.paxRed, sen: it.paxSen, free: it.paxFree,
                          };
                          const itemBreakdownSum = it.paxAdt + it.paxChd + it.paxColo + it.paxRed + it.paxSen + it.paxFree;

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
                              {/* Breakdown por item em chips — substitui 2 TDs vazios */}
                              <td colSpan={2} className="py-1.5 pr-3">
                                {itemBreakdownSum > 0
                                  ? <PaxBreakdownChips breakdown={itemBreakdown} />
                                  : <span className="text-slate-200">—</span>
                                }
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                <span className={paxColor}>
                                  {it.passengers.toLocaleString('pt-BR')}
                                </span>
                                {paxSuffix}
                              </td>
                              <td className="py-1.5 text-right tabular-nums text-slate-500">{BRLFULL(it.revenue)}</td>
                            </tr>
                          );
                        })}
                      </>
                    )}
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
