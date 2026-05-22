import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { groupByClientOrVendor, topNByField } from '../utils/aggregations';
import { BRLFULL, BRLk, PCTFMT, SEGMENT_CFG } from '../utils/format';

const PAGE_SIZE = 30;

export default function ServicesPage({ rows }) {
  const [prodPage, setProdPage] = useState(0);
  useEffect(() => { setProdPage(0); }, [rows]);

  const segmentData = useMemo(() => {
    const groups = groupByClientOrVendor(rows, 'segment').filter(s => s.revenue > 0);
    return groups.map(s => ({
      ...s,
      color: SEGMENT_CFG[s.name]?.color || '#94a3b8',
      label: SEGMENT_CFG[s.name]?.label || s.name || '(outro)',
    }));
  }, [rows]);

  const topProducts  = useMemo(() => topNByField(rows, 'product', 'revenue', 20), [rows]);
  const allProducts  = useMemo(() => groupByClientOrVendor(rows, 'product'), [rows]);

  const pageCount   = Math.ceil(allProducts.length / PAGE_SIZE);
  const prodRows    = allProducts.slice(prodPage * PAGE_SIZE, (prodPage + 1) * PAGE_SIZE);

  const segTotal = segmentData.reduce((s, x) => s + x.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Segment overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Mix por Segmento — Faturamento</h2>
          <p className="text-xs text-slate-400 mb-4">Composição do faturamento por categoria de serviço</p>
          {segmentData.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={segmentData} dataKey="revenue" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                    {segmentData.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [BRLFULL(v), name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {segmentData.map(s => {
                  const pct = segTotal > 0 ? (s.revenue / segTotal * 100) : 0;
                  return (
                    <div key={s.name} className="text-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="font-medium text-slate-700">{s.label}</span>
                        </div>
                        <span className="text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Segment table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Detalhe por Segmento</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="pb-2 pr-3 font-semibold">Segmento</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Pax</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Líquido</th>
                  <th className="pb-2 font-semibold text-right">% Rent</th>
                </tr>
              </thead>
              <tbody>
                {segmentData.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Sem dados.</td></tr>
                )}
                {segmentData.map(s => (
                  <tr key={s.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="font-medium text-slate-700">{s.label}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-700">{BRLFULL(s.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">{s.uniquePassengers.toLocaleString('pt-BR')}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${s.profitLiquido < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {BRLFULL(s.profitLiquido)}
                    </td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${s.rentPct !== null && s.rentPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {PCTFMT(s.rentPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {segmentData.length > 0 && (() => {
                const totRev     = segmentData.reduce((s, x) => s + x.revenue, 0);
                const totLiq     = segmentData.reduce((s, x) => s + x.profitLiquido, 0);
                const totPax     = segmentData.reduce((s, x) => s + x.uniquePassengers, 0);
                const totPct     = totRev !== 0 ? (totLiq / totRev) * 100 : null;
                return (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold text-slate-700 bg-slate-50">
                      <td className="pt-2 pr-3 text-xs">TOTAL</td>
                      <td className="pt-2 pr-3 text-right text-xs">{BRLFULL(totRev)}</td>
                      <td className="pt-2 pr-3 text-right text-xs">{totPax.toLocaleString('pt-BR')}</td>
                      <td className={`pt-2 pr-3 text-right text-xs ${totLiq < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(totLiq)}</td>
                      <td className={`pt-2 text-right text-xs ${totPct !== null && totPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{PCTFMT(totPct)}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      </div>

      {/* Top 20 Products bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Top 20 Serviços — Faturamento</h2>
        <p className="text-xs text-slate-400 mb-4">Ranking dos serviços com maior volume</p>
        {topProducts.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={180} />
              <Tooltip formatter={v => [BRLFULL(v), 'Faturamento']} labelStyle={{ fontWeight: 600 }} />
              <Bar dataKey="value" name="Faturamento" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Full product ranking table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Ranking Completo de Serviços
          <span className="ml-2 text-slate-400 font-normal text-xs">({allProducts.length.toLocaleString('pt-BR')} serviços)</span>
        </h2>
        <p className="text-[10px] text-slate-400 mb-3">Pax = soma de passageiros por item de serviço (cada ocorrência conta independentemente)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-left">
                <th className="pb-2 pr-3 font-semibold">#</th>
                <th className="pb-2 pr-3 font-semibold">Serviço</th>
                <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                <th className="pb-2 pr-3 font-semibold text-right">Pax (itens)</th>
                <th className="pb-2 pr-3 font-semibold text-right">Líquido</th>
                <th className="pb-2 pr-3 font-semibold text-right">% Rent</th>
                <th className="pb-2 font-semibold text-right">Resultado AB</th>
              </tr>
            </thead>
            <tbody>
              {prodRows.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Sem dados no período.</td></tr>
              )}
              {prodRows.map((g, i) => {
                const isNeg   = g.profitLiquido < 0;
                const pctNeg  = g.rentPct !== null && g.rentPct < 0;
                const abIsNeg = g.profit < 0;
                const rank    = prodPage * PAGE_SIZE + i + 1;
                return (
                  <tr key={g.name} className={`border-b border-slate-100 ${isNeg ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                    <td className="py-2 pr-3 text-slate-400">{rank}</td>
                    <td className="py-2 pr-3 font-medium text-slate-700 max-w-[20rem] truncate" title={g.name}>{g.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{BRLFULL(g.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">{g.passengers.toLocaleString('pt-BR')}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${isNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {BRLFULL(g.profitLiquido)}
                    </td>
                    <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {PCTFMT(g.rentPct)}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${abIsNeg ? 'text-red-500' : 'text-slate-500'}`}>
                      {BRLFULL(g.profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">Página {prodPage + 1} de {pageCount} ({allProducts.length.toLocaleString('pt-BR')} serviços)</p>
            <div className="flex gap-2">
              <button
                onClick={() => setProdPage(p => Math.max(0, p - 1))}
                disabled={prodPage === 0}
                className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
              >
                ‹ Anterior
              </button>
              <button
                onClick={() => setProdPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={prodPage === pageCount - 1}
                className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
              >
                Próxima ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
