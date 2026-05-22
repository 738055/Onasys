import { useMemo, useRef } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, DollarSign, Percent, Users, ShoppingCart, CreditCard } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { ExportButton } from '../components/ExportButton';
import { calcKPIs, groupByMonth, topNByField, groupByClientOrVendor, groupByMonthAndField } from '../utils/aggregations';
import { BRLFULL, BRLk, SEGMENT_CFG } from '../utils/format';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtMonth(key) {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
}

function MonthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[180px]">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-6 mb-0.5" style={{ color: p.color || p.fill }}>
          <span>{p.name}</span>
          <span className="font-semibold tabular-nums">
            {p.name === '% Margem' ? `${Number(p.value).toFixed(2)}%` : BRLFULL(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SegmentTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  const nonZero = payload.filter(p => (p.value || 0) > 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[180px]">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {nonZero.map(p => (
        <div key={p.name} className="flex justify-between gap-6 mb-0.5" style={{ color: p.fill }}>
          <span>{p.name}</span>
          <span className="font-semibold tabular-nums">{BRLk(p.value)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-6 mt-1 pt-1 border-t border-slate-100 font-semibold text-slate-700">
        <span>Total</span>
        <span className="tabular-nums">{BRLFULL(total)}</span>
      </div>
    </div>
  );
}

export default function ExecutivePage({ rows }) {
  const timelineRef      = useRef(null);
  const segTimelineRef   = useRef(null);
  const topSuppliersRef  = useRef(null);
  const segMixRef        = useRef(null);

  const kpis         = useMemo(() => calcKPIs(rows), [rows]);
  const timeline     = useMemo(() =>
    groupByMonth(rows).map(m => ({
      ...m,
      label: fmtMonth(m.month),
      marginPct: m.revenue !== 0 ? (m.profitLiquido / m.revenue) * 100 : 0,
    })),
  [rows]);
  const topSuppliers = useMemo(() => topNByField(rows, 'supplier', 'profitLiquido', 10), [rows]);
  const segmentData  = useMemo(() => {
    const groups = groupByClientOrVendor(rows, 'segment').filter(s => s.revenue > 0);
    return groups.map(s => ({
      ...s,
      color: SEGMENT_CFG[s.name]?.color || '#94a3b8',
      label: SEGMENT_CFG[s.name]?.label || s.name || '(outro)',
    }));
  }, [rows]);
  const segmentTimeline = useMemo(() => {
    const { data, keys } = groupByMonthAndField(rows, 'segment');
    return {
      data: data.map(m => ({ ...m, label: fmtMonth(m.month) })),
      segments: keys,
    };
  }, [rows]);

  const kpiColor = kpis.profitLiquido >= 0 ? 'green' : 'red';
  const segTotal = segmentData.reduce((s, x) => s + x.revenue, 0);

  const kpiSummary = [
    { label: 'Faturamento Total', value: kpis.revenue,          type: 'currency' },
    { label: 'Líquido',           value: kpis.profitLiquido,    type: 'currency' },
    { label: '% Rentabilidade',   value: kpis.margin,           type: 'percent'  },
    { label: 'Passageiros',       value: kpis.uniquePassengers, type: 'number'   },
    { label: 'Ticket Médio',      value: kpis.ticketMedio,      type: 'currency' },
    { label: 'Nº Vendas',         value: kpis.uniqueSales,      type: 'number'   },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="relative">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title="Faturamento Total"  value={kpis.revenue}           format="currency" icon={DollarSign}  color="blue"    />
          <KPICard title="Líquido"            value={kpis.profitLiquido}     format="currency" icon={TrendingUp}   color={kpiColor} />
          <KPICard title="% Rentabilidade"    value={kpis.margin}            format="percent"  icon={Percent}      color="amber"   />
          <KPICard title="Passageiros"        value={kpis.uniquePassengers}  format="number"   icon={Users}        color="slate"   sub="por venda única" />
          <KPICard title="Ticket Médio"       value={kpis.ticketMedio}       format="currency" icon={CreditCard}   color="indigo"  sub="receita / pax" />
          <KPICard title="Nº Vendas"          value={kpis.uniqueSales}       format="number"   icon={ShoppingCart} color="slate"   sub="vendas únicas" />
        </div>
        <div className="absolute top-0 right-0">
          <ExportButton
            title="Resumo Executivo — KPIs"
            slug="executivo-kpis"
            sections={[{ title: 'KPIs', summary: kpiSummary, columns: [], rows: [] }]}
          />
        </div>
      </div>

      {/* Monthly Revenue + Margin combo */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700">Evolução Mensal — Faturamento & Margem</h2>
          <ExportButton
            title="Evolução Mensal — Faturamento & Margem"
            slug="executivo-evolucao-mensal"
            chartRef={timelineRef}
            sections={[{
              title: 'Evolução Mensal',
              chartRef: timelineRef,
              columns: [
                { key: 'label',        label: 'Mês',          type: 'text'     },
                { key: 'revenue',      label: 'Faturamento',  type: 'currency', total: true },
                { key: 'profitLiquido',label: 'Líquido',      type: 'currency', total: true },
                { key: 'marginPct',    label: '% Margem',     type: 'percent'  },
              ],
              rows: timeline,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Barras = Faturamento · Linha verde = Líquido · Linha pontilhada = % Margem (eixo direito)</p>
        {timeline.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados no período.</p>
        ) : (
          <div ref={timelineRef}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={timeline} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="money" tickFormatter={BRLk} tick={{ fontSize: 11 }} width={62} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} width={38} />
              <Tooltip content={<MonthTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar      yAxisId="money" dataKey="revenue"      name="Faturamento" fill="#3b82f6" opacity={0.85} radius={[3,3,0,0]} />
              <Line     yAxisId="money" dataKey="profitLiquido" name="Líquido"    stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
              <Line     yAxisId="pct"   dataKey="marginPct"     name="% Margem"   stroke="#f59e0b" strokeWidth={2} dot={false} type="monotone" strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Segment stacked timeline — only when multi-month */}
      {segmentTimeline.data.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-700">Faturamento por Segmento — Evolução Mensal</h2>
            <ExportButton
              title="Faturamento por Segmento — Evolução Mensal"
              slug="executivo-seg-timeline"
              chartRef={segTimelineRef}
              sections={[{
                title: 'Faturamento por Segmento',
                chartRef: segTimelineRef,
                columns: [
                  { key: 'label', label: 'Mês', type: 'text' },
                  ...segmentTimeline.segments.map(seg => ({
                    key: seg, label: SEGMENT_CFG[seg]?.label || seg, type: 'currency', total: true,
                  })),
                ],
                rows: segmentTimeline.data,
              }]}
            />
          </div>
          <p className="text-xs text-slate-400 mb-4">Composição mensal do faturamento por categoria de serviço</p>
          <div ref={segTimelineRef}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={segmentTimeline.data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={BRLk} tick={{ fontSize: 11 }} width={62} />
              <Tooltip content={<SegmentTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {segmentTimeline.segments.map(seg => (
                <Bar
                  key={seg}
                  dataKey={seg}
                  name={SEGMENT_CFG[seg]?.label || seg}
                  stackId="a"
                  fill={SEGMENT_CFG[seg]?.color || '#94a3b8'}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Suppliers by profit */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Top 10 Fornecedores — Lucro Líquido</h2>
            <ExportButton
              title="Top 10 Fornecedores — Lucro Líquido"
              slug="executivo-top-fornecedores"
              chartRef={topSuppliersRef}
              sections={[{
                title: 'Top 10 Fornecedores',
                chartRef: topSuppliersRef,
                columns: [
                  { key: 'name',         label: 'Fornecedor',   type: 'text'     },
                  { key: 'value',        label: 'Lucro Líquido',type: 'currency', total: true },
                  { key: 'revenue',      label: 'Faturamento',  type: 'currency', total: true },
                  { key: 'profitLiquido',label: 'Líquido',      type: 'currency'  },
                ],
                rows: topSuppliers,
              }]}
            />
          </div>
          {topSuppliers.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div ref={topSuppliersRef}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topSuppliers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                <Tooltip formatter={v => [BRLFULL(v), 'Lucro Líquido']} />
                <Bar dataKey="value" name="Lucro Líquido" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Segment Mix */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Mix por Segmento — Faturamento</h2>
            <ExportButton
              title="Mix por Segmento — Faturamento"
              slug="executivo-mix-segmento"
              chartRef={segMixRef}
              sections={[{
                title: 'Mix por Segmento',
                chartRef: segMixRef,
                columns: [
                  { key: 'label',        label: 'Segmento',    type: 'text'     },
                  { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                  { key: 'profitLiquido',label: 'Líquido',     type: 'currency', total: true },
                  { key: 'rentPct',      label: '% Rent.',     type: 'percent'  },
                ],
                rows: segmentData.map(s => ({
                  ...s,
                  rentPct: s.revenue > 0 ? (s.profitLiquido / s.revenue) * 100 : 0,
                })),
              }]}
            />
          </div>
          {segmentData.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div ref={segMixRef} className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={segmentData} dataKey="revenue" nameKey="label" cx="50%" cy="50%" outerRadius={88} innerRadius={42}>
                    {segmentData.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [BRLFULL(v), name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5 overflow-hidden">
                {segmentData.map(s => {
                  const pct = segTotal > 0 ? (s.revenue / segTotal * 100) : 0;
                  return (
                    <div key={s.name} className="text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="font-medium text-slate-700 truncate">{s.label}</span>
                        </div>
                        <span className="text-slate-500 tabular-nums flex-shrink-0 ml-2">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
