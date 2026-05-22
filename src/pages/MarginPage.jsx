import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import { scatterBySupplier } from '../utils/aggregations';
import { BRLFULL, BRLk } from '../utils/format';
import { ExportButton } from '../components/ExportButton';

const PAGE_SIZE = 20;

const DIST_BUCKETS = [
  { label: '< −20%',       min: -Infinity, max: -20,       color: '#ef4444' },
  { label: '−20% a −10%',  min: -20,       max: -10,       color: '#f97316' },
  { label: '−10% a 0%',    min: -10,       max: 0,         color: '#fbbf24' },
  { label: '0% a 10%',     min: 0,         max: 10,        color: '#a3e635' },
  { label: '10% a 20%',    min: 10,        max: 20,        color: '#34d399' },
  { label: '20% a 30%',    min: 20,        max: 30,        color: '#10b981' },
  { label: '> 30%',        min: 30,        max: Infinity,  color: '#059669' },
];

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
      <p>Faturamento: {BRLFULL(d.revenue)}</p>
      <p>Líquido: {BRLFULL(d.profitLiquido)}</p>
      <p>Margem: {d.margin.toFixed(2)}%</p>
    </div>
  );
}

function DistTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.label}</p>
      <p>{d.count.toLocaleString('pt-BR')} itens</p>
      <p>Faturamento: {BRLFULL(d.revenue)}</p>
    </div>
  );
}

export default function MarginPage({ rows }) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [rows]);
  const distRef    = useRef(null);
  const scatterRef = useRef(null);

  const scatter = useMemo(() => scatterBySupplier(rows), [rows]);
  const losses  = useMemo(() => rows.filter(r => r.profitLiquido < 0).sort((a, b) => a.profitLiquido - b.profitLiquido), [rows]);

  const totalPrejuizo = useMemo(() => losses.reduce((s, r) => s + r.profitLiquido, 0), [losses]);
  const piorResultado = useMemo(() => losses.length > 0 ? losses[0].profitLiquido : 0, [losses]);
  const pctNeg        = rows.length > 0 ? (losses.length / rows.length * 100) : 0;

  const distribution = useMemo(() => {
    const counts = DIST_BUCKETS.map(b => ({ ...b, count: 0, revenue: 0 }));
    for (const r of rows) {
      if (!r.revenue || r.revenue === 0) continue;
      const m = (r.profitLiquido / r.revenue) * 100;
      for (const b of counts) {
        if (m >= b.min && m < b.max) {
          b.count++;
          b.revenue += r.revenue;
          break;
        }
      }
    }
    return counts;
  }, [rows]);

  const pageCount = Math.ceil(losses.length / PAGE_SIZE);
  const pageRows  = losses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* KPI summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-700 opacity-70">Total Prejuízo</p>
          <p className="mt-2 text-xl font-bold text-red-800 tabular-nums">{BRLFULL(totalPrejuizo)}</p>
          <p className="mt-0.5 text-xs text-red-600 opacity-60">soma do período</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-700 opacity-70">Itens Negativos</p>
          <p className="mt-2 text-xl font-bold text-red-800 tabular-nums">{losses.length.toLocaleString('pt-BR')}</p>
          <p className="mt-0.5 text-xs text-red-600 opacity-60">{pctNeg.toFixed(1)}% dos itens</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 opacity-70">Pior Resultado</p>
          <p className="mt-2 text-xl font-bold text-amber-800 tabular-nums">{BRLFULL(piorResultado)}</p>
          <p className="mt-0.5 text-xs text-amber-600 opacity-60">único item</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 opacity-70">Total de Itens</p>
          <p className="mt-2 text-xl font-bold text-slate-700 tabular-nums">{rows.length.toLocaleString('pt-BR')}</p>
          <p className="mt-0.5 text-xs text-slate-500 opacity-60">no período</p>
        </div>
      </div>

      {/* Distribution histogram */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700">Distribuição de Margem por Item</h2>
          <ExportButton
            title="Distribuição de Margem por Item"
            slug="margens-distribuicao"
            chartRef={distRef}
            sections={[{
              title: 'Distribuição de Margem',
              chartRef: distRef,
              columns: [
                { key: 'label',   label: 'Faixa de Margem',  type: 'text'     },
                { key: 'count',   label: 'Nº Itens',         type: 'number'   },
                { key: 'revenue', label: 'Faturamento Total', type: 'currency', total: true },
              ],
              rows: distribution,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Quantidade de itens por faixa de rentabilidade — vermelho = prejuízo, verde = lucro</p>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <div ref={distRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribution} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<DistTooltip />} />
                <Bar dataKey="count" name="Nº Itens" radius={[4,4,0,0]}>
                  {distribution.map(b => <Cell key={b.label} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {distribution.map(b => {
                const totalItems = distribution.reduce((s, x) => s + x.count, 0);
                const pct = totalItems > 0 ? (b.count / totalItems * 100) : 0;
                return (
                  <div key={b.label} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: b.color }} />
                        <span className="text-slate-600 font-medium">{b.label}</span>
                      </div>
                      <div className="flex gap-4 text-slate-500 tabular-nums">
                        <span>{b.count.toLocaleString('pt-BR')} itens</span>
                        <span className="w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: b.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scatter */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700">Margem vs Faturamento por Fornecedor</h2>
          <ExportButton
            title="Margem vs Faturamento por Fornecedor"
            slug="margens-scatter-fornecedor"
            chartRef={scatterRef}
            sections={[{
              title: 'Scatter — Margem vs Faturamento',
              chartRef: scatterRef,
              columns: [
                { key: 'name',         label: 'Fornecedor',   type: 'text'     },
                { key: 'revenue',      label: 'Faturamento',  type: 'currency', total: true },
                { key: 'profitLiquido',label: 'Líquido',      type: 'currency', total: true },
                { key: 'margin',       label: '% Margem',     type: 'percent'  },
              ],
              rows: scatter,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Cada ponto = 1 fornecedor agregado no período. Abaixo da linha vermelha = prejuízo.</p>
        {scatter.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <div ref={scatterRef}>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="revenue"
                name="Faturamento"
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10 }}
                label={{ value: 'Faturamento (R$)', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                dataKey="margin"
                name="Margem %"
                tick={{ fontSize: 10 }}
                label={{ value: 'Margem %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={scatter} fill="#3b82f6" opacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Loss table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Itens com Resultado Negativo
            <span className="ml-2 text-red-500 font-normal text-xs">({losses.length.toLocaleString('pt-BR')} itens)</span>
          </h2>
          <ExportButton
            title="Itens com Resultado Negativo"
            slug="margens-prejuizos"
            sections={[{
              title: 'Itens com Resultado Negativo',
              columns: [
                { key: 'id',           label: 'Venda',        type: 'text'     },
                { key: 'emissionDate', label: 'Emitido',      type: 'text'     },
                { key: 'client',       label: 'Cliente',      type: 'text'     },
                { key: 'supplier',     label: 'Fornecedor',   type: 'text'     },
                { key: 'product',      label: 'Produto',      type: 'text'     },
                { key: 'revenue',      label: 'Faturamento',  type: 'currency', total: true },
                { key: 'profitLiquido',label: 'Lucro Líquido',type: 'currency', total: true },
                { key: 'marginPctStr', label: '% Rent.',      type: 'text'     },
              ],
              rows: losses.map(r => ({
                ...r,
                emissionDate: r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-',
                marginPctStr: r.revenue > 0 ? `${(r.profitLiquido / r.revenue * 100).toFixed(2)}%` : '-',
              })),
            }]}
          />
        </div>
        {losses.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Nenhum item com resultado negativo no período.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="pb-2 pr-3 font-semibold">Venda</th>
                    <th className="pb-2 pr-3 font-semibold">Emitido</th>
                    <th className="pb-2 pr-3 font-semibold">Cliente</th>
                    <th className="pb-2 pr-3 font-semibold">Fornecedor</th>
                    <th className="pb-2 pr-3 font-semibold">Produto</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Lucro Líquido</th>
                    <th className="pb-2 font-semibold text-right">% Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const marginPct = r.revenue > 0 ? (r.profitLiquido / r.revenue * 100) : 0;
                    return (
                      <tr key={`${r.id}-${i}`} className="border-b border-slate-100 bg-red-50">
                        <td className="py-2 pr-3 font-mono text-slate-600">{r.id}</td>
                        <td className="py-2 pr-3">{r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="py-2 pr-3 max-w-[8rem] truncate">{r.client}</td>
                        <td className="py-2 pr-3 max-w-[8rem] truncate">{r.supplier}</td>
                        <td className="py-2 pr-3 max-w-[8rem] truncate">{r.product}</td>
                        <td className="py-2 pr-3 text-right">{BRLFULL(r.revenue)}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-red-600">{BRLFULL(r.profitLiquido)}</td>
                        <td className="py-2 text-right font-semibold text-red-600 tabular-nums">{marginPct.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">Página {page + 1} de {pageCount} ({losses.length.toLocaleString('pt-BR')} itens)</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
                  >
                    ‹ Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={page === pageCount - 1}
                    className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
                  >
                    Próxima ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
