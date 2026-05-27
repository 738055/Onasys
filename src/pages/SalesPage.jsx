import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ComposedChart, Line,
} from 'recharts';
import { abcCurve, groupByClientOrVendor } from '../utils/aggregations';
import { BRLFULL, BRLk, PCTFMT } from '../utils/format';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';
import { PaxCompositionBar } from '../components/PaxCompositionBar';

const PAGE_SIZE = 25;

const METRIC_CFG = {
  revenue:       { label: 'Faturamento', color: '#6366f1', axisFmt: BRLk,                    fmt: BRLFULL                  },
  profitLiquido: { label: 'Líquido',     color: '#10b981', axisFmt: BRLk,                    fmt: BRLFULL                  },
  marginPct:     { label: '% Margem',    color: '#f59e0b', axisFmt: v => `${v.toFixed(0)}%`, fmt: v => `${v.toFixed(2)}%`  },
};

function VendorTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[180px]">
      <p className="font-semibold text-slate-700 mb-2 max-w-[200px] truncate">{d.name}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4"><span className="text-slate-500">Faturamento</span><span className="font-semibold tabular-nums">{BRLFULL(d.revenue)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">Líquido <span className="text-slate-400 font-normal">(total_liquido)</span></span><span className={`font-semibold tabular-nums ${d.profitLiquido < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(d.profitLiquido)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">Resultado AB <span className="text-slate-400 font-normal">(total_resultadoab)</span></span><span className={`font-semibold tabular-nums ${d.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(d.profit)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">% Margem</span><span className={`font-semibold tabular-nums ${d.marginPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{d.marginPct.toFixed(2)}%</span></div>
      </div>
    </div>
  );
}

// Tooltip de composição de pax — aparece ao hover sobre a célula Pax da tabela detalhada

export default function SalesPage({ rows }) {
  const [page, setPage] = useState(0);
  const [groupField, setGroupField] = useState('client');
  const [topN,       setTopN]       = useState(10);
  const [topMetric,  setTopMetric]  = useState('revenue');
  useEffect(() => { setPage(0); }, [rows]);
  const topVendorsRef = useRef(null);
  const abcRef        = useRef(null);

  const commercialRef = useRef(null);
  const topVendors = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = r.vendor || '(sem nome)';
      if (!map[key]) map[key] = { name: key, revenue: 0, profitLiquido: 0, profit: 0 };
      map[key].revenue       += r.revenue       || 0;
      map[key].profitLiquido += r.profitLiquido || 0;
      map[key].profit        += r.profit        || 0;
    }
    return Object.values(map)
      .map(v => ({
        ...v,
        // marginPct usa profit (total_resultadoab) — valor final após todos os custos
        marginPct: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0,
        value: topMetric === 'revenue'       ? v.revenue
             : topMetric === 'profitLiquido' ? v.profitLiquido
             : v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
  }, [rows, topN, topMetric]);
  const abc        = useMemo(() => abcCurve(rows), [rows]);
  const sorted     = useMemo(() => [...rows].sort((a, b) => b.revenue - a.revenue), [rows]);
  const grouped    = useMemo(() => groupByClientOrVendor(rows, groupField), [rows, groupField]);
  const commercial = useMemo(() => groupByClientOrVendor(rows, 'commercial'), [rows]);

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                Top <span className="text-blue-600 mx-1">{topN}</span> Emissores
                {' — '}<span className="text-blue-600 mx-1">{METRIC_CFG[topMetric].label}</span>
                <InfoTooltip text="Ranking por emissor (nomeemissor). Líquido = total_liquido (antes da comissão do emissor). % Margem = Σ Resultado AB ÷ Σ Faturamento — nunca média de percentuais individuais." />
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* N selector */}
              <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
                {[5, 10, 15, 20].map((n, i) => (
                  <button
                    key={n}
                    onClick={() => setTopN(n)}
                    className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                      topN === n ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
              {/* Metric selector */}
              <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
                {Object.entries(METRIC_CFG).map(([key, cfg], i) => (
                  <button
                    key={key}
                    onClick={() => setTopMetric(key)}
                    className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                      topMetric === key ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    style={topMetric === key ? { backgroundColor: cfg.color } : {}}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
              <ExportButton
                title={`Top ${topN} Emissores — ${METRIC_CFG[topMetric].label}`}
                slug="vendas-top-emissores"
                chartRef={topVendorsRef}
                sections={[{
                  title: `Top ${topN} Emissores`,
                  chartRef: topVendorsRef,
                  columns: [
                    { key: 'name',         label: 'Emissor',     type: 'text'     },
                    { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                    { key: 'profitLiquido',label: 'Líquido',     type: 'currency', total: true },
                    { key: 'marginPct',    label: '% Margem',    type: 'percent'  },
                  ],
                  rows: topVendors,
                }]}
              />
            </div>
          </div>
          {topVendors.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div ref={topVendorsRef}>
            <ResponsiveContainer width="100%" height={Math.max(220, topN * 28)}>
              <BarChart data={topVendors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={METRIC_CFG[topMetric].axisFmt} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip content={<VendorTooltip />} />
                <Bar dataKey="value" name={METRIC_CFG[topMetric].label} radius={[0, 4, 4, 0]}>
                  {topVendors.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={entry.value < 0 ? '#ef4444' : METRIC_CFG[topMetric].color}
                      fillOpacity={1 - (idx / (topVendors.length * 1.6))}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ABC Curve */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Curva ABC — Clientes por Faturamento
              <InfoTooltip text="Top 30 clientes por faturamento decrescente. A linha amarela é o % acumulado — quando cruza 80%, os clientes à esquerda formam a Classe A (poucos clientes, maior parte do faturamento). Parceto 80/20." />
            </h2>
            <ExportButton
              title="Curva ABC — Clientes"
              slug="vendas-abc-clientes"
              chartRef={abcRef}
              sections={[{
                title: 'Curva ABC — Clientes',
                chartRef: abcRef,
                columns: [
                  { key: 'name',   label: 'Cliente',        type: 'text'     },
                  { key: 'revenue',label: 'Faturamento',    type: 'currency', total: true },
                  { key: 'cumPct', label: '% Acumulado',    type: 'percent'  },
                ],
                rows: abc,
              }]}
            />
          </div>
          <p className="text-xs text-slate-400 mb-4">Top 30 clientes | linha amarela = % acumulado</p>
          {abc.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div ref={abcRef}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={abc}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={false} />
                <YAxis yAxisId="left"  tickFormatter={BRLk}               tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v, name) => name === '% Acumulado' ? `${Number(v).toFixed(1)}%` : BRLFULL(v)}
                  labelFormatter={(_, p) => p?.[0]?.payload?.name || ''}
                />
                <Bar     yAxisId="left"  dataKey="revenue" name="Faturamento" fill="#3b82f6" />
                <Line    yAxisId="right" type="monotone" dataKey="cumPct" name="% Acumulado" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Detalhamento de Vendas
            <span className="ml-2 text-slate-400 font-normal text-xs">({rows.length.toLocaleString('pt-BR')} registros)</span>
          </h2>
          <ExportButton
            title="Detalhamento de Vendas"
            slug="vendas-detalhe"
            sections={[{
              title: 'Detalhamento de Vendas',
              columns: [
                { key: 'id',           label: 'Venda',       type: 'text'     },
                { key: 'emissionDate', label: 'Emitido',     type: 'text'     },
                { key: 'filial',       label: 'Filial',      type: 'text'     },
                { key: 'client',       label: 'Cliente',     type: 'text'     },
                { key: 'supplier',     label: 'Fornecedor',  type: 'text'     },
                { key: 'vendor',       label: 'Emissor',     type: 'text'     },
                { key: 'passengers',   label: 'Pax',         type: 'number'   },
                { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                { key: 'profitLiquido',label: 'Líquido',     type: 'currency', total: true },
              ],
              rows: sorted.map(r => ({
                ...r,
                emissionDate: r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-',
              })),
            }]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-left">
                <th className="pb-2 pr-3 font-semibold">Venda</th>
                <th className="pb-2 pr-3 font-semibold">Emitido</th>
                <th className="pb-2 pr-3 font-semibold">Filial</th>
                <th className="pb-2 pr-3 font-semibold">Cliente</th>
                <th className="pb-2 pr-3 font-semibold">Fornecedor</th>
                <th className="pb-2 pr-3 font-semibold">Emissor</th>
                <th className="pb-2 pr-3 font-semibold text-center">Pax</th>
                <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                <th className="pb-2 font-semibold text-right">Líquido</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr
                  key={`${r.id}-${i}`}
                  className={`border-b border-slate-100 ${r.profitLiquido < 0 ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="py-2 pr-3 font-mono text-slate-500">{r.id}</td>
                  <td className="py-2 pr-3">{r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="py-2 pr-3 max-w-[6rem] truncate">{r.filial}</td>
                  <td className="py-2 pr-3 max-w-[8rem] truncate">{r.client}</td>
                  <td className="py-2 pr-3 max-w-[8rem] truncate">{r.supplier}</td>
                  <td className="py-2 pr-3 max-w-[6rem] truncate">{r.vendor}</td>
                  <td className="py-2 pr-3 text-center tabular-nums text-slate-600">
                    {r.passengers || '—'}
                  </td>
                  <td className="py-2 pr-3 text-right">{BRLFULL(r.revenue)}</td>
                  <td className={`py-2 text-right font-semibold ${r.profitLiquido < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {BRLFULL(r.profitLiquido)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">Página {page + 1} de {pageCount} ({rows.length.toLocaleString('pt-BR')} registros)</p>
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
      </div>

      {/* Agrupamento por Clientes / Emissores / Fornecedor / Serviço */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {(() => {
            const LABELS = { client: 'Clientes', vendor: 'Emissores', supplier: 'Fornecedores', product: 'Serviços' };
            const label  = LABELS[groupField] || groupField;
            return (
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                Agrupamento por <span className="text-blue-600 mx-1">{label}</span>
                <InfoTooltip text="Cada linha agrega todos os itens do período. Líquido = total_liquido (antes de deduzir comissão do emissor). Resultado AB = total_resultadoab (valor final). % Rent. = Resultado AB ÷ Faturamento." />
                <span className="ml-1 text-slate-400 font-normal text-xs">
                  ({grouped.length.toLocaleString('pt-BR')} {label.toLowerCase()})
                </span>
              </h2>
            );
          })()}
          <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
            {[
              { value: 'client',   label: 'Cliente'    },
              { value: 'vendor',   label: 'Emissor'    },
              { value: 'supplier', label: 'Fornecedor' },
              { value: 'product',  label: 'Serviço'    },
            ].map((opt, i) => (
              <button
                key={opt.value}
                onClick={() => setGroupField(opt.value)}
                className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                  groupField === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <ExportButton
            title={`Agrupamento por ${{ client: 'Cliente', vendor: 'Emissor', supplier: 'Fornecedor', product: 'Serviço' }[groupField]}`}
            slug="vendas-agrupamento"
            sections={[{
              title: 'Agrupamento por ' + groupField,
              columns: [
                { key: 'name',             label: { client: 'Cliente', vendor: 'Emissor', supplier: 'Fornecedor', product: 'Serviço' }[groupField], type: 'text' },
                { key: 'revenue',          label: 'Faturamento',        type: 'currency', total: true },
                { key: 'pax',              label: 'Pax',                type: 'number'   },
                { key: 'profitLiquido',    label: 'Líquido',            type: 'currency', total: true },
                { key: 'rentPct',          label: '% Rent.',            type: 'percent'  },
                { key: 'commissionEmissor',label: 'Comissão Emissor',   type: 'currency'  },
                { key: 'profit',           label: 'Resultado AB',       type: 'currency', total: true },
              ],
              rows: grouped.map(g => ({
                ...g,
                pax: groupField === 'product' ? g.passengers : g.uniquePassengers,
              })),
            }]}
          />
          </div>
        </div>

        {/* Legenda do contador de pax */}
        <p className="text-[10px] text-slate-400 mb-3">
          {groupField === 'product'
            ? 'Pax = soma de passageiros por item de serviço (cada ocorrência conta independentemente)'
            : 'Pax = passageiros únicos por venda (sem duplicar itens da mesma venda)'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-left">
                <th className="pb-2 pr-3 font-semibold">#</th>
                <th className="pb-2 pr-3 font-semibold">
                  {{ client: 'Cliente', vendor: 'Emissor', supplier: 'Fornecedor', product: 'Serviço' }[groupField]}
                </th>
                <th className="pb-2 pr-3 font-semibold text-right">Total Vendido</th>
                <th className="pb-2 pr-3 font-semibold text-right">
                  {groupField === 'product' ? 'Pax (itens)' : 'Pax (vendas)'}
                </th>
                <th className="pb-2 pr-3 font-semibold text-center">
                  Composição
                  <span className="block text-[10px] font-normal text-slate-400 leading-tight">ADT/CHD/…</span>
                </th>
                <th className="pb-2 pr-3 font-semibold text-right">Líquido</th>
                <th className="pb-2 pr-3 font-semibold text-right">% Rent</th>
                <th className="pb-2 pr-3 font-semibold text-right">
                  <span>Comissão Emissor</span>
                  <span className="block text-[10px] font-normal text-slate-400 leading-tight">a pagar no período</span>
                </th>
                <th className="pb-2 font-semibold text-right">
                  <span>Resultado AB</span>
                  <span className="block text-[10px] font-normal text-slate-400 leading-tight">c/ comissão deduzida</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Sem dados no período.</td>
                </tr>
              )}
              {grouped.map((g, i) => {
                // isNeg usa profit (total_resultadoab) — valor definitivo para highlight de linha
                const isNeg   = g.profit < 0;
                const liqNeg  = g.profitLiquido < 0;  // cor da célula Líquido (total_liquido)
                const pctNeg  = g.rentPct !== null && g.rentPct < 0;
                const paxValue = groupField === 'product' ? g.passengers : g.uniquePassengers;
                // Para composição: SUM bruto (paxBreakdown) em produto/fornecedor;
                // dedup único (paxBreakdownUnique) em cliente/emissor.
                const composition = (groupField === 'product' || groupField === 'supplier')
                  ? g.paxBreakdown
                  : g.paxBreakdownUnique;
                return (
                  <tr
                    key={g.name}
                    className={`border-b border-slate-100 ${isNeg ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium text-slate-700 max-w-[16rem] truncate" title={g.name}>{g.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{BRLFULL(g.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">{paxValue.toLocaleString('pt-BR')}</td>
                    <td className="py-2 pr-3">
                      {composition && (
                        <PaxCompositionBar
                          breakdown={composition}
                          height={6}
                          className="w-20 mx-auto"
                        />
                      )}
                    </td>
                    <td className={`py-2 pr-3 text-right font-semibold ${liqNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {BRLFULL(g.profitLiquido)}
                    </td>
                    <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {PCTFMT(g.rentPct)}
                    </td>
                    <td className="py-2 pr-3 text-right text-amber-700 tabular-nums">
                      {g.commissionEmissor !== 0 ? BRLFULL(g.commissionEmissor) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${isNeg ? 'text-red-500' : 'text-slate-500'}`}>
                      {BRLFULL(g.profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {grouped.length > 0 && (() => {
              const totRevenue = grouped.reduce((s, g) => s + g.revenue, 0);
              const totLiquido = grouped.reduce((s, g) => s + g.profitLiquido, 0);
              const totProfit  = grouped.reduce((s, g) => s + g.profit, 0);
              const totComm    = grouped.reduce((s, g) => s + g.commissionEmissor, 0);
              const totPax     = grouped.reduce((s, g) => s + (groupField === 'product' ? g.passengers : g.uniquePassengers), 0);
              const totPct     = totRevenue !== 0 ? (totProfit  / totRevenue) * 100 : null;
              return (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-semibold text-slate-700 bg-slate-50">
                    <td className="pt-2 pr-3" />
                    <td className="pt-2 pr-3 text-xs">TOTAL</td>
                    <td className="pt-2 pr-3 text-right text-xs">{BRLFULL(totRevenue)}</td>
                    <td className="pt-2 pr-3 text-right text-xs">{totPax.toLocaleString('pt-BR')}</td>
                    <td className="pt-2 pr-3" />{/* Composição — sem total */}
                    <td className={`pt-2 pr-3 text-right text-xs ${totLiquido < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {BRLFULL(totLiquido)}
                    </td>
                    <td className={`pt-2 pr-3 text-right text-xs ${totPct !== null && totPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {PCTFMT(totPct)}
                    </td>
                    <td className="pt-2 pr-3 text-right text-xs text-amber-700">
                      {BRLFULL(totComm)}
                    </td>
                    <td className={`pt-2 text-right text-xs ${totProfit < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {BRLFULL(totProfit)}
                    </td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      </div>

      {/* Performance Comercial */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Performance Comercial
            <InfoTooltip text="Agrupamento por responsável comercial (campo nomecomercial da API). Diferente do emissor (quem operou a venda), o comercial é o responsável estratégico pela conta — útil para avaliação de equipe comercial." />
            <span className="ml-1 text-slate-400 font-normal text-xs">({commercial.length.toLocaleString('pt-BR')} comerciais)</span>
          </h2>
          <ExportButton
            title="Performance Comercial"
            slug="vendas-comercial"
            chartRef={commercialRef}
            sections={[{
              title: 'Performance por Comercial',
              columns: [
                { key: 'name',          label: 'Comercial',   type: 'text'     },
                { key: 'revenue',       label: 'Faturamento', type: 'currency', total: true },
                { key: 'profitLiquido', label: 'Líquido',     type: 'currency', total: true },
                { key: 'rentPct',       label: '% Rent.',     type: 'percent'  },
                { key: 'uniquePassengers', label: 'Pax',      type: 'number'   },
              ],
              rows: commercial,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Ranking por responsável comercial (campo nomecomercial) — distinto do emissor operacional</p>
        {commercial.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados de comercial no período.</p>
        ) : (
          <div ref={commercialRef} className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="pb-2 pr-3 font-semibold">#</th>
                  <th className="pb-2 pr-3 font-semibold">Comercial</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Pax</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Líquido</th>
                  <th className="pb-2 font-semibold text-right">% Rent</th>
                </tr>
              </thead>
              <tbody>
                {commercial.map((c, i) => {
                  const isNeg  = c.profit < 0;          // profit = total_resultadoab — define highlight
                  const liqNeg = c.profitLiquido < 0;   // cor da célula Líquido (total_liquido)
                  const pctNeg = c.rentPct !== null && c.rentPct < 0;
                  return (
                    <tr key={c.name} className={`border-b border-slate-100 ${isNeg ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                      <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium text-slate-700 max-w-[16rem] truncate" title={c.name}>{c.name}</td>
                      <td className="py-2 pr-3 text-right text-slate-700">{BRLFULL(c.revenue)}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{c.uniquePassengers.toLocaleString('pt-BR')}</td>
                      <td className={`py-2 pr-3 text-right font-semibold ${liqNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                        {BRLFULL(c.profitLiquido)}
                      </td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                        {PCTFMT(c.rentPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {commercial.length > 0 && (() => {
                const totRev    = commercial.reduce((s, c) => s + c.revenue, 0);
                const totLiq    = commercial.reduce((s, c) => s + c.profitLiquido, 0);
                const totProfit = commercial.reduce((s, c) => s + c.profit, 0);
                const totPax    = commercial.reduce((s, c) => s + c.uniquePassengers, 0);
                // totPct usa profit (total_resultadoab) — regra de ouro: Σprofit / Σrevenue
                const totPct    = totRev !== 0 ? (totProfit / totRev) * 100 : null;
                return (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold text-slate-700 bg-slate-50">
                      <td className="pt-2 pr-3" />
                      <td className="pt-2 pr-3 text-xs">TOTAL</td>
                      <td className="pt-2 pr-3 text-right text-xs">{BRLFULL(totRev)}</td>
                      <td className="pt-2 pr-3 text-right text-xs">{totPax.toLocaleString('pt-BR')}</td>
                      <td className={`pt-2 pr-3 text-right text-xs ${totLiq < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {BRLFULL(totLiq)}
                      </td>
                      <td className={`pt-2 text-right text-xs ${totPct !== null && totPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {PCTFMT(totPct)}
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
