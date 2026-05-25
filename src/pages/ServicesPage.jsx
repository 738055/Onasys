import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { groupByClientOrVendor, topNByField, revenuePerNight, itemsPerSale } from '../utils/aggregations';
import { BRLFULL, BRLk, PCTFMT, SEGMENT_CFG } from '../utils/format';
import { KPICard } from '../components/KPICard';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';

const PAGE_SIZE = 30;

export default function ServicesPage({ rows }) {
  const [prodPage, setProdPage] = useState(0);
  useEffect(() => { setProdPage(0); }, [rows]);
  const segMixRef    = useRef(null);
  const top20Ref     = useRef(null);
  const efficiencyRef = useRef(null);

  const segmentData = useMemo(() => {
    const groups = groupByClientOrVendor(rows, 'segment').filter(s => s.revenue > 0);
    return groups.map(s => ({
      ...s,
      color: SEGMENT_CFG[s.name]?.color || '#94a3b8',
      label: SEGMENT_CFG[s.name]?.label || s.name || '(outro)',
    }));
  }, [rows]);

  const topProducts    = useMemo(() => topNByField(rows, 'product', 'revenue', 20), [rows]);
  const allProducts    = useMemo(() => groupByClientOrVendor(rows, 'product'), [rows]);
  const revPerNight    = useMemo(() => revenuePerNight(rows), [rows]);
  const itemsData      = useMemo(() => itemsPerSale(rows), [rows]);

  const pageCount   = Math.ceil(allProducts.length / PAGE_SIZE);
  const prodRows    = allProducts.slice(prodPage * PAGE_SIZE, (prodPage + 1) * PAGE_SIZE);

  const segTotal = segmentData.reduce((s, x) => s + x.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Segment overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Mix por Segmento — Faturamento
              <InfoTooltip text="Composição do faturamento por categoria de serviço (campo dsCateg da API). % Fat. = faturamento do segmento ÷ total × 100. % Rent. = Resultado AB ÷ Faturamento do segmento." />
            </h2>
            <ExportButton
              title="Mix por Segmento — Faturamento"
              slug="servicos-mix-segmento"
              chartRef={segMixRef}
              sections={[{
                title: 'Mix por Segmento',
                chartRef: segMixRef,
                columns: [
                  { key: 'label',        label: 'Segmento',    type: 'text'     },
                  { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                  { key: 'uniquePassengers', label: 'Pax',     type: 'number'   },
                  { key: 'profitLiquido',label: 'Líquido',     type: 'currency', total: true },
                  { key: 'rentPct',      label: '% Rent.',     type: 'percent'  },
                ],
                rows: segmentData,
              }]}
            />
          </div>
          <p className="text-xs text-slate-400 mb-4">Composição do faturamento por categoria de serviço</p>
          {segmentData.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div ref={segMixRef} className="flex items-center gap-6">
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
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Detalhe por Segmento</h2>
            <ExportButton
              title="Detalhe por Segmento"
              slug="servicos-detalhe-segmento"
              sections={[{
                title: 'Detalhe por Segmento',
                columns: [
                  { key: 'label',        label: 'Segmento',    type: 'text'     },
                  { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                  { key: 'uniquePassengers', label: 'Pax',     type: 'number'   },
                  { key: 'profitLiquido',label: 'Líquido',     type: 'currency', total: true },
                  { key: 'rentPct',      label: '% Rent.',     type: 'percent'  },
                ],
                rows: segmentData,
              }]}
            />
          </div>
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
                const totRev    = segmentData.reduce((s, x) => s + x.revenue, 0);
                const totLiq    = segmentData.reduce((s, x) => s + x.profitLiquido, 0);
                const totProfit = segmentData.reduce((s, x) => s + x.profit, 0);
                const totPax    = segmentData.reduce((s, x) => s + x.uniquePassengers, 0);
                // totPct usa profit (total_resultadoab) — regra de ouro: Σprofit / Σrevenue
                const totPct    = totRev !== 0 ? (totProfit / totRev) * 100 : null;
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

      {/* Eficiência por Estadia */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Eficiência por Estadia
            <InfoTooltip text="Receita/Noite = Σfaturamento ÷ Σnum_noites por segmento (apenas itens com num_noites > 0). Itens/Venda = média de seqId distintos por ID de venda — um seqId diferente = um serviço adicional na mesma operação (cross-sell)." />
          </h2>
          <ExportButton
            title="Eficiência por Estadia"
            slug="servicos-eficiencia"
            chartRef={efficiencyRef}
            sections={[{
              title: 'Receita por Noite — por Segmento',
              chartRef: efficiencyRef,
              columns: [
                { key: 'segment',     label: 'Segmento',        type: 'text'     },
                { key: 'revenue',     label: 'Faturamento',     type: 'currency', total: true },
                { key: 'nights',      label: 'Noites',          type: 'number'   },
                { key: 'revPerNight', label: 'Receita/Noite',   type: 'currency' },
              ],
              rows: revPerNight,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Receita por noite por segmento (itens com num_noites preenchido) · média de itens por venda = indicador de cross-sell
        </p>
        {revPerNight.length === 0 && itemsData.total === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados de noites / itens por venda no período.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div ref={efficiencyRef}>
              {revPerNight.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Sem dados de hospedagem no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={revPerNight} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="segment" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip
                      formatter={(v, name) => [name === 'Receita/Noite' ? BRLFULL(v) : v, name]}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Bar dataKey="revPerNight" name="Receita/Noite" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-3">
              <KPICard
                title="Média de itens por venda"
                value={itemsData.avg}
                format="number"
                color="indigo"
                sub={`em ${(itemsData.total || 0).toLocaleString('pt-BR')} vendas com itens`}
              />
              {itemsData.dist && (
                <div className="space-y-2">
                  {itemsData.dist.map(d => {
                    const total = itemsData.total || 1;
                    const pct = (d.count / total) * 100;
                    return (
                      <div key={d.label} className="text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-slate-600 font-medium">{d.label}</span>
                          <div className="flex gap-3 text-slate-500 tabular-nums">
                            <span>{d.count.toLocaleString('pt-BR')} vendas</span>
                            <span className="w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top 20 Products bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700">Top 20 Serviços — Faturamento</h2>
          <ExportButton
            title="Top 20 Serviços"
            slug="servicos-top20"
            chartRef={top20Ref}
            sections={[{
              title: 'Top 20 Serviços',
              chartRef: top20Ref,
              columns: [
                { key: 'name',  label: 'Serviço',     type: 'text'     },
                { key: 'value', label: 'Faturamento', type: 'currency', total: true },
              ],
              rows: topProducts,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Ranking dos serviços com maior volume</p>
        {topProducts.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <div ref={top20Ref}>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={180} />
              <Tooltip formatter={v => [BRLFULL(v), 'Faturamento']} labelStyle={{ fontWeight: 600 }} />
              <Bar dataKey="value" name="Faturamento" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Full product ranking table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Ranking Completo de Serviços
            <span className="ml-2 text-slate-400 font-normal text-xs">({allProducts.length.toLocaleString('pt-BR')} serviços)</span>
          </h2>
          <ExportButton
            title="Ranking Completo de Serviços"
            slug="servicos-ranking"
            sections={[{
              title: 'Ranking de Serviços',
              columns: [
                { key: 'name',         label: 'Serviço',     type: 'text'     },
                { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                { key: 'passengers',   label: 'Pax (itens)', type: 'number'   },
                { key: 'profitLiquido', label: 'Líquido',      type: 'currency', total: true },
                { key: 'rentPct',      label: '% Rent.',      type: 'percent'  },
                { key: 'profit',       label: 'Resultado AB', type: 'currency', total: true },
              ],
              rows: allProducts,
            }]}
          />
        </div>
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
                const isNeg   = g.profit < 0;
                const liqNeg  = g.profitLiquido < 0;
                const pctNeg  = g.rentPct !== null && g.rentPct < 0;
                const rank    = prodPage * PAGE_SIZE + i + 1;
                return (
                  <tr key={g.name} className={`border-b border-slate-100 ${isNeg ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                    <td className="py-2 pr-3 text-slate-400">{rank}</td>
                    <td className="py-2 pr-3 font-medium text-slate-700 max-w-[20rem] truncate" title={g.name}>{g.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{BRLFULL(g.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">{g.passengers.toLocaleString('pt-BR')}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${liqNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {BRLFULL(g.profitLiquido)}
                    </td>
                    <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {PCTFMT(g.rentPct)}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${isNeg ? 'text-red-600' : 'text-slate-600'}`}>
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
