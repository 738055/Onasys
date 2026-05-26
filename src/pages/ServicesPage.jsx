import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { groupByClientOrVendor, topNByField, revenuePerPax, revenuePerNight, itemsPerSale } from '../utils/aggregations';
import { BRLFULL, BRLk, PCTFMT, SEGMENT_CFG } from '../utils/format';
import { KPICard } from '../components/KPICard';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';

const PAGE_SIZE = 30;

// Tooltip customizado para gráfico Receita/Pax
function PaxTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[190px]">
      <p className="font-semibold text-slate-700 mb-2">{d.label}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Pax total</span>
          <span className="font-semibold tabular-nums">{d.passengers.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Receita/Pax</span>
          <span className="font-semibold tabular-nums">{BRLFULL(d.revPerPax)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Margem/Pax</span>
          <span className={`font-semibold tabular-nums ${d.profitPerPax < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {BRLFULL(d.profitPerPax)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">% Rent.</span>
          <span className={`font-semibold tabular-nums ${d.rentPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {d.rentPct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage({ rows }) {
  const [prodPage, setProdPage] = useState(0);
  useEffect(() => { setProdPage(0); }, [rows]);
  const segMixRef    = useRef(null);
  const top20Ref     = useRef(null);
  const revPerPaxRef = useRef(null);
  const hotelRef     = useRef(null);

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
  const itemsData      = useMemo(() => itemsPerSale(rows), [rows]);

  // Receita/Pax: mapeia código de segmento → label/cor legíveis
  const revPerPaxData  = useMemo(() =>
    revenuePerPax(rows).map(s => ({
      ...s,
      label: SEGMENT_CFG[s.segment]?.label || s.segment || '(outro)',
      color: SEGMENT_CFG[s.segment]?.color || '#94a3b8',
    })),
  [rows]);

  // Hospedagem: só para itens com num_noites > 0, com label/cor
  const revPerNightData = useMemo(() =>
    revenuePerNight(rows).map(s => ({
      ...s,
      label: SEGMENT_CFG[s.segment]?.label || s.segment || '(outro)',
      color: SEGMENT_CFG[s.segment]?.color || '#94a3b8',
    })),
  [rows]);

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

      {/* Receita & Margem por Passageiro */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Receita & Margem por Passageiro — por Segmento
            <InfoTooltip text="Receita/Pax = Σfaturamento ÷ Σnum_pax por segmento. Margem/Pax = Σ Resultado AB ÷ Σnum_pax. Cada item de serviço conta seus pax independentemente — não deduplica entre itens da mesma venda. Compara ticket médio e rentabilidade entre categorias de serviço." />
          </h2>
          <ExportButton
            title="Receita por Passageiro — por Segmento"
            slug="servicos-pax"
            chartRef={revPerPaxRef}
            sections={[{
              title: 'Receita & Margem por Passageiro',
              chartRef: revPerPaxRef,
              columns: [
                { key: 'label',        label: 'Segmento',    type: 'text'     },
                { key: 'passengers',   label: 'Pax',         type: 'number',   total: true },
                { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                { key: 'revPerPax',    label: 'Receita/Pax', type: 'currency' },
                { key: 'profitPerPax', label: 'Margem/Pax',  type: 'currency' },
                { key: 'rentPct',      label: '% Rent.',     type: 'percent'  },
              ],
              rows: revPerPaxData,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Ticket médio e rentabilidade por passageiro-serviço, por categoria
        </p>
        {revPerPaxData.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados de passageiros no período.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Gráfico */}
            <div ref={revPerPaxRef}>
              <ResponsiveContainer width="100%" height={Math.max(200, revPerPaxData.length * 52)}>
                <BarChart data={revPerPaxData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip content={<PaxTooltip />} />
                  <Bar dataKey="revPerPax" name="Receita/Pax" radius={[0, 4, 4, 0]}>
                    {revPerPaxData.map(d => (
                      <Cell key={d.label} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="pb-2 pr-3 font-semibold">Segmento</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Pax</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Rec./Pax</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Marg./Pax</th>
                    <th className="pb-2 font-semibold text-right">% Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {revPerPaxData.map(d => {
                    const mNeg   = d.profitPerPax < 0;
                    const pctNeg = d.rentPct < 0;
                    return (
                      <tr key={d.segment} className={`border-b border-slate-100 ${mNeg ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                            <span className="font-medium text-slate-700">{d.label}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right text-slate-500 tabular-nums">{d.passengers.toLocaleString('pt-BR')}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-slate-700 tabular-nums">{BRLFULL(d.revPerPax)}</td>
                        <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${mNeg ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(d.profitPerPax)}</td>
                        <td className={`py-2 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>{PCTFMT(d.rentPct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Cross-sell + Hospedagem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cross-sell */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1 mb-1">
            Cross-sell — Serviços por Venda
            <InfoTooltip text="Média de serviços distintos por venda. Usa seqId (idseqintens) quando preenchido — cada seqId diferente = serviço adicional na mesma operação. Fallback: contagem de linhas por venda quando seqId não está disponível." />
          </h2>
          <p className="text-xs text-slate-400 mb-4">Indicador de pacotes: quantos serviços distintos por reserva</p>
          {itemsData.total === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">Sem dados no período.</p>
          ) : (
            <div className="space-y-4">
              <KPICard
                title="Média de serviços por venda"
                value={itemsData.avg}
                format="number"
                color="indigo"
                sub={`em ${itemsData.total.toLocaleString('pt-BR')} vendas`}
              />
              <div className="space-y-2">
                {itemsData.dist.map(d => {
                  const pct = itemsData.total > 0 ? (d.count / itemsData.total) * 100 : 0;
                  return (
                    <div key={d.label} className="text-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-slate-600 font-medium">{d.label}</span>
                        <div className="flex gap-3 text-slate-500 tabular-nums">
                          <span>{d.count.toLocaleString('pt-BR')} vendas</span>
                          <span className="w-11 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Eficiência de Hospedagem — só aparece quando há dados de noites */}
        {revPerNightData.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                Eficiência de Hospedagem
                <InfoTooltip text="Somente itens com num_noites > 0. Receita/Noite = Σfaturamento ÷ Σnoites; Margem/Noite = Σ Resultado AB ÷ Σnoites. Permite comparar rentabilidade das acomodações vendidas por segmento." />
              </h2>
              <ExportButton
                title="Eficiência de Hospedagem"
                slug="servicos-hospedagem"
                chartRef={hotelRef}
                sections={[{
                  title: 'Eficiência de Hospedagem',
                  chartRef: hotelRef,
                  columns: [
                    { key: 'label',          label: 'Segmento',     type: 'text'     },
                    { key: 'nights',         label: 'Noites',       type: 'number',   total: true },
                    { key: 'revenue',        label: 'Faturamento',  type: 'currency', total: true },
                    { key: 'revPerNight',    label: 'Rec./Noite',   type: 'currency' },
                    { key: 'profitPerNight', label: 'Marg./Noite',  type: 'currency' },
                    { key: 'rentPct',        label: '% Rent.',      type: 'percent'  },
                  ],
                  rows: revPerNightData,
                }]}
              />
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Itens com <code className="bg-slate-100 px-1 rounded">num_noites</code> preenchido — receita e margem por noite vendida
            </p>
            <div ref={hotelRef} className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="pb-2 pr-3 font-semibold">Segmento</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Noites</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Rec./Noite</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Marg./Noite</th>
                    <th className="pb-2 font-semibold text-right">% Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {revPerNightData.map(d => {
                    const mNeg   = d.profitPerNight < 0;
                    const pctNeg = d.rentPct < 0;
                    return (
                      <tr key={d.segment} className={`border-b border-slate-100 ${mNeg ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                            <span className="font-medium text-slate-700">{d.label}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right text-slate-500 tabular-nums">{d.nights.toLocaleString('pt-BR')}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-slate-700 tabular-nums">{BRLFULL(d.revPerNight)}</td>
                        <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${mNeg ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(d.profitPerNight)}</td>
                        <td className={`py-2 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>{PCTFMT(d.rentPct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {revPerNightData.length > 1 && (() => {
                  const totNights  = revPerNightData.reduce((s, d) => s + d.nights, 0);
                  const totRev     = revPerNightData.reduce((s, d) => s + d.revenue, 0);
                  const totProfit  = revPerNightData.reduce((s, d) => s + d.profit, 0);
                  const totRevPN   = totNights > 0 ? totRev / totNights : 0;
                  const totMargPN  = totNights > 0 ? totProfit / totNights : 0;
                  const totPct     = totRev > 0 ? (totProfit / totRev) * 100 : null;
                  return (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 font-semibold text-slate-700 bg-slate-50">
                        <td className="pt-2 pr-3 text-xs">TOTAL</td>
                        <td className="pt-2 pr-3 text-right text-xs">{totNights.toLocaleString('pt-BR')}</td>
                        <td className="pt-2 pr-3 text-right text-xs">{BRLFULL(totRevPN)}</td>
                        <td className={`pt-2 pr-3 text-right text-xs ${totMargPN < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(totMargPN)}</td>
                        <td className={`pt-2 text-right text-xs ${totPct !== null && totPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{PCTFMT(totPct)}</td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel flex items-center justify-center">
            <p className="text-xs text-slate-400 text-center">
              Sem registros de hospedagem<br />
              <span className="text-slate-300">(num_noites não preenchido no período)</span>
            </p>
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
