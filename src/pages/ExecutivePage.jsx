import { useMemo, useRef, useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ReferenceArea,
} from 'recharts';
import { TrendingUp, DollarSign, Percent, Users, ShoppingCart, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';
import { calcKPIs, groupByMonth, topNByField, groupByClientOrVendor, groupByMonthAndField, lossDiagnosticTotals } from '../utils/aggregations';
import { BRLFULL, BRLk, SEGMENT_CFG, resolveLossReason } from '../utils/format';
import { useExportContext } from '../contexts/ExportContext';
import { useYearData } from '../hooks/useYearData';
import { PaxAuditModal } from '../components/PaxAuditModal';

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

function YearNav({ selectedYear, filterYear, loading, onPrev, onNext, onReset }) {
  return (
    <div className="flex items-center gap-1">
      {loading && <span className="text-[10px] text-slate-400 mr-1">carregando...</span>}
      {selectedYear !== filterYear && (
        <button
          onClick={onReset}
          className="text-[10px] text-blue-500 hover:text-blue-700 mr-1 underline underline-offset-2"
        >
          Período filtrado
        </button>
      )}
      <button onClick={onPrev} className="p-0.5 rounded hover:bg-slate-100 text-slate-500" title="Ano anterior">
        <ChevronLeft size={13} />
      </button>
      <span className="text-xs font-semibold text-slate-700 tabular-nums w-10 text-center">{selectedYear}</span>
      <button onClick={onNext} className="p-0.5 rounded hover:bg-slate-100 text-slate-500" title="Próximo ano">
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

export default function ExecutivePage({ rows }) {
  const timelineRef      = useRef(null);
  const segTimelineRef   = useRef(null);
  const topSuppliersRef  = useRef(null);
  const segMixRef        = useRef(null);

  // Year navigation
  const { startDate, endDate, qualPeriodo, nSistema } = useExportContext();
  const filterYear = startDate
    ? new Date(`${startDate}T12:00:00`).getFullYear()
    : new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(filterYear);
  useEffect(() => setSelectedYear(filterYear), [filterYear]);

  const { rows: yearRows, loading: yearLoading } = useYearData({ year: selectedYear, qualPeriodo, nSistema });

  // Filtered-period computations (KPIs, exports)
  const kpis         = useMemo(() => calcKPIs(rows), [rows]);
  // Diagnóstico de perda para callout executivo
  const lossDiag     = useMemo(() => lossDiagnosticTotals(rows), [rows]);
  const lossInsight  = useMemo(() => {
    if (!lossDiag.length) return null;
    const totalLoss = lossDiag.reduce((s, g) => s + g.absloss, 0);
    if (totalLoss === 0) return null;
    const top = lossDiag[0]; // já ordenado por absloss desc
    return { top, totalLoss, lossDiag };
  }, [lossDiag]);
  const timeline     = useMemo(() =>
    groupByMonth(rows).map(m => ({
      ...m,
      label: fmtMonth(m.month),
      marginPct: m.revenue !== 0 ? (m.profit / m.revenue) * 100 : 0,
    })),
  [rows]);
  const topSuppliers = useMemo(() => topNByField(rows, 'supplier', 'profit', 10), [rows]);
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

  // Full-year computations (charts)
  const monthKeys = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`),
  [selectedYear]);

  const yearTimeline = useMemo(() => {
    const map = {};
    groupByMonth(yearRows).forEach(m => { map[m.month] = m; });
    return monthKeys.map(key => {
      const m = map[key] || { month: key, revenue: 0, profitLiquido: 0, profit: 0, passengers: 0 };
      return {
        ...m,
        label: fmtMonth(key),
        marginPct: m.revenue !== 0 ? (m.profit / m.revenue) * 100 : 0,
      };
    });
  }, [yearRows, monthKeys]);

  const yearSegmentTimeline = useMemo(() => {
    const { data, keys } = groupByMonthAndField(yearRows, 'segment');
    const monthMap = {};
    data.forEach(m => { monthMap[m.month] = m; });
    const filledData = monthKeys.map(key => {
      const m = monthMap[key] || { month: key };
      const entry = { ...m, label: fmtMonth(key) };
      keys.forEach(k => { if (entry[k] === undefined) entry[k] = 0; });
      return entry;
    });
    return { data: filledData, segments: keys };
  }, [yearRows, monthKeys]);

  // Highlight filter period on the year charts
  const highlightLabels = useMemo(() => {
    if (selectedYear !== filterYear || !startDate || !endDate) return null;
    const start = new Date(`${startDate}T12:00:00`);
    const end   = new Date(`${endDate}T12:00:00`);
    const x1 = fmtMonth(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`);
    const x2 = fmtMonth(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`);
    return { x1, x2 };
  }, [selectedYear, filterYear, startDate, endDate]);

  const [paxAuditOpen, setPaxAuditOpen] = useState(false);

  const kpiColor = kpis.profit >= 0 ? 'green' : 'red';
  const segTotal = segmentData.reduce((s, x) => s + x.revenue, 0);

  const kpiSummary = [
    { label: 'Faturamento Total', value: kpis.revenue,          type: 'currency' },
    { label: 'Líquido',           value: kpis.profit,           type: 'currency' },
    { label: '% Rentabilidade',   value: kpis.margin,           type: 'percent'  },
    { label: 'Passageiros',       value: kpis.uniquePassengers, type: 'number'   },
    { label: 'Ticket Médio',      value: kpis.ticketMedio,      type: 'currency' },
    { label: 'Nº Vendas',         value: kpis.uniqueSales,      type: 'number'   },
  ];

  const yearNavProps = {
    selectedYear,
    filterYear,
    loading: yearLoading,
    onPrev:  () => setSelectedYear(y => y - 1),
    onNext:  () => setSelectedYear(y => y + 1),
    onReset: () => setSelectedYear(filterYear),
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="relative">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title="Faturamento Total"  value={kpis.revenue}           format="currency" icon={DollarSign}  color="blue"
            tooltip="Faturamento bruto do período — campo total_vendas da API. Valor antes de qualquer dedução de custo, comissão ou desconto." />
          <KPICard title="Líquido"            value={kpis.profit}            format="currency" icon={TrendingUp}   color={kpiColor}
            tooltip="Resultado AB do período — campo total_resultadoab da API. Valor final após deduzir: custo de fornecedor, comissões repassadas, taxas, descontos e comissão do emissor. É o lucro real da operação." />
          <KPICard title="% Rentabilidade"    value={kpis.margin}            format="percent"  icon={Percent}      color="amber"
            tooltip="Resultado AB ÷ Faturamento × 100. Calculada sobre os totais do período, nunca como média dos percentuais individuais — evita distorção por itens com valores muito diferentes." />
          <KPICard title="Passageiros"        value={kpis.uniquePassengers}  format="number"   icon={Users}        color="slate"   sub="por venda única"
            tooltip="Passageiros únicos por venda (campo Num_pax / num_pax da API). Uma venda pode ter vários itens — Transfer + Hotel + Ingresso. Conta-se apenas o maior num_pax do grupo, evitando duplicar o mesmo grupo de pax."
            onClick={() => setPaxAuditOpen(true)} />
          <KPICard title="Ticket Médio"       value={kpis.ticketMedio}       format="currency" icon={CreditCard}   color="indigo"  sub="receita / pax"
            tooltip="Faturamento Total ÷ Passageiros únicos. Indica o valor médio recebido por passageiro no período. Usa a contagem de pax únicos (sem duplicação por itens da mesma venda)." />
          <KPICard title="Nº Vendas"          value={kpis.uniqueSales}       format="number"   icon={ShoppingCart} color="slate"   sub="vendas únicas"
            tooltip="Contagem de IDs de venda únicos (campo venda da API). Um ID representa uma operação comercial completa que pode conter vários itens de serviço (Transfer, Hotel, Ingresso etc.)." />
        </div>
        <div className="absolute top-0 right-0">
          <ExportButton
            title="Resumo Executivo — KPIs"
            slug="executivo-kpis"
            sections={[{ title: 'KPIs', summary: kpiSummary, columns: [], rows: [] }]}
          />
        </div>
      </div>

      {/* ── Callout de diagnóstico de perda — só aparece quando há prejuízo ── */}
      {lossInsight && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs">
          <span className="text-lg">⚠️</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-amber-800">
              Principal causa de perdas no período:{' '}
              <span style={{ color: lossInsight.top.color }}>{lossInsight.top.group}</span>
              {' '}({lossInsight.top.share.toFixed(0)}% — {BRLFULL(-lossInsight.top.absloss)})
            </span>
            <span className="text-amber-600 ml-2">
              {lossInsight.top.group === 'Venda'
                ? '→ Revisar precificação dos emissores'
                : lossInsight.top.group === 'Escala'
                ? '→ Auditar custo operacional das escalas deficitárias'
                : lossInsight.top.group === 'Financeira'
                ? '→ Revisar exposição a taxas de cartão e provisões'
                : lossInsight.top.group === 'Comercial'
                ? '→ Revisar repasses, comissões e descontos concedidos'
                : '→ Ver diagnóstico completo em Margens'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {lossInsight.lossDiag.map(g => (
              <div
                key={g.group}
                className="flex items-center gap-0.5 text-[10px] font-medium whitespace-nowrap px-1.5 py-0.5 rounded-full"
                style={{ background: g.color + '20', color: g.color }}
                title={`${g.group}: ${BRLFULL(-g.absloss)} (${g.items} itens)`}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: g.color }} />
                {g.group} {g.share.toFixed(0)}%
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Revenue + Margin combo */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Evolução Mensal — Faturamento &amp; Margem
            <InfoTooltip text="Barras = Faturamento (total_vendas). Linha verde = Resultado AB (total_resultadoab). Linha pontilhada = % Rent. (eixo direito). Agrupado por data de emissão ou check-in, conforme o modo ativo. Área azul = filtro de datas aplicado." />
          </h2>
          <div className="flex items-center gap-3 flex-shrink-0">
            <YearNav {...yearNavProps} />
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
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Barras = Faturamento · Linha verde = Líquido · Linha pontilhada = % Margem (eixo direito)
          {highlightLabels && (
            <span className="ml-2 text-blue-400">· Área azul = período filtrado ({highlightLabels.x1}–{highlightLabels.x2})</span>
          )}
        </p>
        <div ref={timelineRef}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={yearTimeline} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="money" tickFormatter={BRLk} tick={{ fontSize: 11 }} width={62} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} width={38} />
              <Tooltip content={<MonthTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {highlightLabels && (
                <ReferenceArea
                  yAxisId="money"
                  x1={highlightLabels.x1}
                  x2={highlightLabels.x2}
                  fill="#3b82f6"
                  fillOpacity={0.08}
                  stroke="#3b82f6"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                />
              )}
              <Bar      yAxisId="money" dataKey="revenue"       name="Faturamento" fill="#3b82f6" opacity={0.85} radius={[3,3,0,0]} />
              <Line     yAxisId="money" dataKey="profitLiquido"  name="Líquido"    stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
              <Line     yAxisId="pct"   dataKey="marginPct"      name="% Margem"   stroke="#f59e0b" strokeWidth={2} dot={false} type="monotone" strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Segment stacked timeline */}
      {yearSegmentTimeline.segments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Faturamento por Segmento — Evolução Mensal
              <InfoTooltip text="Faturamento mensal empilhado por categoria de serviço (campo dsCateg da API). Permite ver quais segmentos crescem ou encolhem sua participação ao longo do tempo. A área destacada em azul representa o intervalo de datas do filtro ativo." />
            </h2>
            <div className="flex items-center gap-3 flex-shrink-0">
              <YearNav {...yearNavProps} />
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
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Composição mensal do faturamento por categoria de serviço
            {highlightLabels && (
              <span className="ml-2 text-blue-400">· Área azul = período filtrado ({highlightLabels.x1}–{highlightLabels.x2})</span>
            )}
          </p>
          <div ref={segTimelineRef}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={yearSegmentTimeline.data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={BRLk} tick={{ fontSize: 11 }} width={62} />
                <Tooltip content={<SegmentTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {highlightLabels && (
                  <ReferenceArea
                    x1={highlightLabels.x1}
                    x2={highlightLabels.x2}
                    fill="#3b82f6"
                    fillOpacity={0.08}
                    stroke="#3b82f6"
                    strokeOpacity={0.25}
                    strokeWidth={1}
                  />
                )}
                {yearSegmentTimeline.segments.map(seg => (
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
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Top 10 Fornecedores — Lucro Líquido
              <InfoTooltip text="Top 10 fornecedores por Resultado AB (total_resultadoab). Um fornecedor grande com margem baixa pode ficar abaixo de fornecedores menores e mais rentáveis." />
            </h2>
            <ExportButton
              title="Top 10 Fornecedores — Resultado AB"
              slug="executivo-top-fornecedores"
              chartRef={topSuppliersRef}
              sections={[{
                title: 'Top 10 Fornecedores',
                chartRef: topSuppliersRef,
                columns: [
                  { key: 'name',         label: 'Fornecedor',   type: 'text'     },
                  { key: 'value',        label: 'Resultado AB',  type: 'currency', total: true },
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
                  <Tooltip formatter={v => [BRLFULL(v), 'Resultado AB']} />
                  <Bar dataKey="value" name="Resultado AB" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Segment Mix */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Mix por Segmento — Faturamento
              <InfoTooltip text="Participação percentual de cada categoria de serviço no faturamento total. Calculada como: receita do segmento ÷ receita total × 100. Agrupado pelo campo dsCateg da API." />
            </h2>
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
                  // rentPct já calculado em groupByClientOrVendor como profit/revenue
                  rentPct: s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0,
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

      {paxAuditOpen && (
        <PaxAuditModal rows={rows} onClose={() => setPaxAuditOpen(false)} />
      )}
    </div>
  );
}
