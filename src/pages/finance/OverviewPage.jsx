import { useMemo, useRef } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart2, Hash } from 'lucide-react';
import { KPICard }      from '../../components/KPICard';
import { InfoTooltip, TooltipFormula, TooltipTitle } from '../../components/InfoTooltip';
import { ExportButton } from '../../components/ExportButton';
import {
  calcDREKPIs, groupByMonthDRE, groupByAccount, groupByUnit, buildWaterfall,
} from '../../utils/financeAggregations';
import { BRLFULL, BRLk, PCTFMT, FINANCE_COLORS, fmtMonthKey, MONTHS_SHORT } from '../../utils/financeFormat';

// Cores do waterfall por tipo de barra
const WF_COLORS = {
  receita:     '#10b981',
  reducao:     '#f59e0b',
  subtotal:    '#3b82f6',
  csv:         '#8b5cf6',
  subtotal_mb: '#6366f1',
  despesa:     '#f43f5e',
  total_pos:   '#0ea5e9',
  total_neg:   '#ef4444',
};

function WaterfallTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const item = payload.find(p => p.dataKey === 'value');
  if (!item) return null;
  const running = item.payload?.running;
  const type    = item.payload?.type;
  const isSubtotal = type === 'subtotal' || type === 'total_pos' || type === 'total_neg';
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[180px]">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">{isSubtotal ? 'Total acumulado' : 'Valor'}</span>
        <span className="font-bold tabular-nums" style={{ color: WF_COLORS[type] || '#64748b' }}>
          {type === 'despesa' || type === 'reducao' ? '–' : ''}{BRLFULL(item.value)}
        </span>
      </div>
      {!isSubtotal && (
        <div className="flex justify-between gap-4 mt-0.5 text-slate-400">
          <span>Acumulado pós</span>
          <span className="tabular-nums">{BRLFULL(running)}</span>
        </div>
      )}
    </div>
  );
}

function MonthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[200px]">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-6 mb-0.5" style={{ color: p.color || p.fill }}>
          <span>{p.name}</span>
          <span className="font-semibold tabular-nums">
            {p.name === '% Margem' ? PCTFMT(Number(p.value)) : BRLFULL(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DeltaBadge({ value, invert = false, suffix = '%' }) {
  if (value == null) return null;
  const positive = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-[11px] font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {value >= 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

export default function OverviewPage({ rows, prevRows = [], loading, year, startMonth, endMonth }) {
  const chartRef = useRef(null);

  const kpi  = useMemo(() => calcDREKPIs(rows),    [rows]);
  const prev = useMemo(() => calcDREKPIs(prevRows), [prevRows]);

  const monthSeries = useMemo(() => groupByMonthDRE(rows).map(m => ({
    ...m,
    name: fmtMonthKey(m.key),
  })), [rows]);

  // Overhead only — CSV é exibido separadamente na Composição
  const topDespesas = useMemo(() => groupByAccount(
    rows.filter(r => r.kind === 'despesa' && r.subkind !== 'csv'), 'despesa'
  ).slice(0, 10), [rows]);
  const topReceitas = useMemo(() => groupByAccount(rows, 'receita').slice(0, 8),  [rows]);
  const byUnit      = useMemo(() => groupByUnit(rows), [rows]);
  const waterfall   = useMemo(() => buildWaterfall(rows), [rows]);

  // KPI deltas vs período anterior (mesmo meses, ano anterior)
  const deltaReceita      = prev.receita !== 0       ? ((kpi.receita      - prev.receita)      / Math.abs(prev.receita)      * 100) : null;
  const deltaCsv          = prev.csv > 0             ? ((kpi.csv          - prev.csv)          / Math.abs(prev.csv)          * 100) : null;
  const deltaMargemBruta  = prev.receita !== 0       ? (kpi.margemBrutaPct - (prev.margemBrutaPct ?? 0)) : null;
  const deltaResult       = prev.resultado !== 0     ? ((kpi.resultado    - prev.resultado)    / Math.abs(prev.resultado)    * 100) : null;
  const deltaMargem       = prev.receita !== 0       ? (kpi.margem - prev.margem) : null;

  const taxaDespesa      = kpi.taxaDespesa  ?? 0;
  const totalLancamentos = rows.length;
  const csvPct           = kpi.receita > 0 ? kpi.csv / kpi.receita * 100 : 0;
  const overheadPct      = kpi.receita > 0 ? (kpi.opex + kpi.fin + (kpi.other ?? 0)) / kpi.receita * 100 : 0;
  const overheadTotal    = (kpi.opex ?? 0) + (kpi.fin ?? 0) + (kpi.other ?? 0);

  // Período label
  const periodoLabel = startMonth && endMonth && year
    ? (startMonth === endMonth
        ? `${MONTHS_SHORT[startMonth-1]}/${year}`
        : `${MONTHS_SHORT[startMonth-1]}–${MONTHS_SHORT[endMonth-1]}/${year}`)
    : '';

  // Seções de export
  const exportSections = useMemo(() => [
    {
      title: 'KPIs do Período',
      columns: [
        { key: 'indicador', label: 'Indicador', type: 'text' },
        { key: 'valor',     label: 'Valor',     type: 'currency' },
      ],
      rows: [
        { indicador: 'Receita Total',         valor: kpi.receita        },
        { indicador: 'Custo dos Serviços',    valor: kpi.csv            },
        { indicador: 'Margem Bruta',          valor: kpi.margemBruta    },
        { indicador: 'Margem Bruta %',        valor: kpi.margemBrutaPct },
        { indicador: 'Overhead (OpEx+Fin)',   valor: kpi.opex + kpi.fin + (kpi.other ?? 0) },
        { indicador: 'Despesa Total',         valor: kpi.despesa        },
        { indicador: 'Resultado',             valor: kpi.resultado      },
        { indicador: 'Margem Líquida %',      valor: kpi.margem         },
      ],
    },
    {
      title: 'Evolução Mensal',
      columns: [
        { key: 'name',      label: 'Mês',       type: 'text'     },
        { key: 'receita',   label: 'Receita',   type: 'currency' },
        { key: 'despesa',   label: 'Despesa',   type: 'currency' },
        { key: 'resultado', label: 'Resultado', type: 'currency' },
        { key: 'margem',    label: 'Margem %',  type: 'percent'  },
      ],
      rows: monthSeries,
    },
    {
      title: 'Top Despesas',
      columns: [
        { key: 'account', label: 'Conta',    type: 'text'     },
        { key: 'value',   label: 'Despesa',  type: 'currency' },
        { key: 'count',   label: 'Lançtos',  type: 'number'   },
      ],
      rows: topDespesas,
    },
    {
      title: 'Resultado por Filial',
      columns: [
        { key: 'unit',           label: 'Filial',        type: 'text'     },
        { key: 'receita',        label: 'Receita',       type: 'currency' },
        { key: 'csv',            label: 'Custo Serv.',   type: 'currency' },
        { key: 'margemBruta',    label: 'Margem Bruta',  type: 'currency' },
        { key: 'margemBrutaPct', label: 'MB %',          type: 'percent'  },
        { key: 'despesa',        label: 'Despesa',       type: 'currency' },
        { key: 'resultado',      label: 'Resultado',     type: 'currency' },
        { key: 'margem',         label: 'Margem %',      type: 'percent'  },
      ],
      rows: byUnit,
    },
  ], [kpi, monthSeries, topDespesas, byUnit]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-800">Visão Geral — DRE</h1>
          {periodoLabel && <p className="text-xs text-slate-500 mt-0.5">{periodoLabel} · tipoconta R (Resultado)</p>}
        </div>
        <ExportButton title="Visão Geral Financeiro" slug="financeiro-overview" sections={exportSections} chartRef={chartRef} />
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title={<span className="flex items-center gap-1">Receita Bruta<InfoTooltip>
            <TooltipTitle>Receita Bruta</TooltipTitle>
            <TooltipFormula>Σ lançamentos 3xxx (receita)</TooltipFormula>
            <span className="text-slate-300">Faturamento total do período. Estornos (op=D) já estão deduzidos. É a base de 100% dos percentuais do DRE.</span>
          </InfoTooltip></span>}
          value={kpi.receita}
          format="currency"
          icon={TrendingUp}
          color="green"
          sub={deltaReceita != null ? <DeltaBadge value={deltaReceita} /> : undefined}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Custo dos Serviços<InfoTooltip>
            <TooltipTitle>Custo dos Serviços (CSV)</TooltipTitle>
            <TooltipFormula>Σ DESPESAS COM VENDAS (contabilPai 410111)</TooltipFormula>
            <span className="text-slate-300">Repasses a fornecedores, tarifas NET, passagens — custo direto dos serviços vendidos. Deduzido da Receita Bruta para chegar à Receita Líquida.</span>
          </InfoTooltip></span>}
          value={kpi.csv}
          format="currency"
          icon={TrendingDown}
          color="red"
          sub={deltaCsv != null ? <DeltaBadge value={deltaCsv} invert /> : `${csvPct.toFixed(1)}% da receita`}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Receita Líquida<InfoTooltip>
            <TooltipTitle>Receita Líquida</TooltipTitle>
            <TooltipFormula>Receita Bruta − Custo dos Serviços</TooltipFormula>
            <span className="text-slate-300">Valor que a empresa efetivamente administra após pagar fornecedores. Deve cobrir todo o overhead e gerar lucro. Comparável à margem do BI de Rentabilidade.</span>
          </InfoTooltip></span>}
          value={kpi.margemBruta}
          format="currency"
          icon={BarChart2}
          color={kpi.margemBrutaPct >= 10 ? 'indigo' : kpi.margemBrutaPct >= 0 ? 'amber' : 'red'}
          sub={deltaMargemBruta != null ? <DeltaBadge value={deltaMargemBruta} suffix="pp" /> : `${kpi.margemBrutaPct?.toFixed(1) ?? 0}% da receita`}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Resultado<InfoTooltip>
            <TooltipTitle>Resultado do Período</TooltipTitle>
            <TooltipFormula>Receita Líquida − Overhead (pessoal, encargos, financeiras…)</TooltipFormula>
            <span className="text-slate-300">Lucro ou prejuízo final. Positivo = empresa gerou caixa; negativo = overhead superou a Receita Líquida.</span>
          </InfoTooltip></span>}
          value={kpi.resultado}
          format="currency"
          icon={DollarSign}
          color={kpi.resultado >= 0 ? 'blue' : 'amber'}
          sub={deltaResult != null ? <DeltaBadge value={deltaResult} /> : undefined}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Margem Líquida<InfoTooltip>
            <TooltipTitle>Margem Líquida %</TooltipTitle>
            <TooltipFormula>Resultado ÷ Receita Bruta × 100</TooltipFormula>
            <span className="text-slate-300">Percentual de lucro sobre o faturamento. Indica eficiência global — quanto de cada R$100 faturado virou resultado.</span>
          </InfoTooltip></span>}
          value={kpi.margem}
          format="percent"
          icon={Percent}
          color={kpi.margem >= 5 ? 'indigo' : kpi.margem >= 0 ? 'amber' : 'red'}
          sub={deltaMargem != null ? <DeltaBadge value={deltaMargem} suffix="pp" /> : undefined}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Lançamentos<InfoTooltip>
            <span className="text-slate-300">Quantidade de registros importados do ERP no período. Útil para verificar se a extração foi completa.</span>
          </InfoTooltip></span>}
          value={totalLancamentos}
          format="number"
          icon={Hash}
          color="slate"
        />
      </div>

      {/* ── Composição do Resultado — 3 camadas ──────────────────────────── */}
      {kpi.receita > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Composição do Resultado
              <span className="ml-2 text-[11px] text-slate-400 font-normal">% sobre Receita Total</span>
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
              Rec. Líquida: {PCTFMT(kpi.margemBrutaPct)}
            </span>
          </div>

          {/* Barra 3 segmentos: CSV | Overhead | Resultado */}
          <div className="relative h-10 rounded-lg overflow-hidden bg-slate-100 mb-4 flex">
            {/* Custo dos Serviços (CSV) — violeta */}
            <div
              className="h-full flex items-center justify-end pr-2 flex-shrink-0"
              style={{ width: `${Math.min(csvPct, 100)}%`, backgroundColor: '#8b5cf6' }}>
              {csvPct > 12 && (
                <span className="text-[10px] text-white font-bold drop-shadow">
                  {PCTFMT(csvPct)} CSV
                </span>
              )}
            </div>
            {/* Overhead (opex+fin) — vermelho */}
            <div
              className="h-full flex items-center justify-center flex-shrink-0"
              style={{ width: `${Math.min(overheadPct, Math.max(0, 100 - csvPct))}%`, backgroundColor: '#f43f5e' }}>
              {overheadPct > 6 && (
                <span className="text-[10px] text-white font-bold">
                  {PCTFMT(overheadPct)}
                </span>
              )}
            </div>
            {/* Resultado — verde se positivo */}
            <div className="flex-1 h-full flex items-center pl-1.5"
              style={{ backgroundColor: kpi.resultado >= 0 ? '#10b981' : '#f59e0b' }}>
              {kpi.margem > 1 && (
                <span className="text-[10px] text-white font-bold">{PCTFMT(kpi.margem)}</span>
              )}
            </div>
          </div>

          {/* Legenda da barra */}
          <div className="flex gap-4 mb-4 text-[10px]">
            {[
              { color: '#8b5cf6', label: 'Custo dos Serviços (CSV)' },
              { color: '#f43f5e', label: 'Overhead (OpEx + Fin)' },
              { color: '#10b981', label: 'Resultado' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* 4 valores-chave */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Receita Total</p>
              <p className="text-sm font-bold text-slate-800 tabular-nums">{BRLFULL(kpi.receita)}</p>
              <p className="text-[10px] text-slate-400">base 100%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-violet-500 uppercase tracking-wider font-semibold">(−) Custo Serviços</p>
              <p className="text-sm font-bold text-violet-700 tabular-nums">{BRLFULL(kpi.csv)}</p>
              <p className="text-[10px] text-violet-400 font-semibold">{PCTFMT(csvPct)} da receita</p>
            </div>
            <div className="text-center rounded-lg bg-indigo-50 border border-indigo-100 px-2 py-1">
              <p className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">= Receita Líquida ★</p>
              <p className="text-sm font-bold text-indigo-700 tabular-nums">{BRLFULL(kpi.margemBruta)}</p>
              <p className="text-[10px] text-indigo-500 font-semibold">{PCTFMT(kpi.margemBrutaPct)} da rec. bruta</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Resultado Final</p>
              <p className={`text-sm font-bold tabular-nums ${kpi.resultado >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {BRLFULL(kpi.resultado)}
              </p>
              <p className={`text-[10px] font-semibold ${kpi.margem >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                {PCTFMT(Math.abs(kpi.margem))} {kpi.resultado >= 0 ? 'margem' : 'déficit'}
              </p>
            </div>
          </div>

          {/* Narrativa para reunião */}
          <div className={`mt-4 rounded-lg px-4 py-2.5 text-xs leading-relaxed ${
            kpi.resultado < 0 ? 'bg-red-50 text-red-800 border border-red-100'
            : kpi.margemBrutaPct < 10 ? 'bg-amber-50 text-amber-800 border border-amber-100'
            : 'bg-indigo-50 text-indigo-800 border border-indigo-100'
          }`}>
            {kpi.resultado < 0
              ? `Período com prejuízo: custo dos serviços de ${BRLFULL(kpi.csv)} (${PCTFMT(csvPct)}) deixou Receita Líquida de ${BRLFULL(kpi.margemBruta)} (${PCTFMT(kpi.margemBrutaPct)}), mas o overhead de ${BRLFULL(kpi.opex + kpi.fin + (kpi.other ?? 0))} (${PCTFMT(overheadPct)}) superou esse valor.`
              : `Para cada R$1,00 faturado: R$${(kpi.csv / kpi.receita).toFixed(2)} foi a fornecedores (CSV), sobrando ${PCTFMT(kpi.margemBrutaPct)} de Receita Líquida (${BRLFULL(kpi.margemBruta)}). O overhead consumiu ${PCTFMT(overheadPct)}, resultando em ${BRLFULL(kpi.resultado)} (${PCTFMT(kpi.margem)}) de resultado final.`
            }
          </div>
        </div>
      )}

      {/* ── Waterfall DRE ──────────────────────────────────────────────────── */}
      {waterfall.items.length > 3 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5" ref={chartRef}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Demonstração do Resultado — Cascata</h2>
              <p className="text-xs text-slate-400 mt-0.5">Receita Bruta → deduções → despesas por categoria → Resultado</p>
            </div>
            <span className={`text-sm font-bold tabular-nums ${waterfall.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {BRLFULL(waterfall.resultado)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={waterfall.items} margin={{ top: 8, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tickFormatter={BRLk} tick={{ fontSize: 10 }} width={72} />
              <Tooltip content={<WaterfallTooltip />} />
              {/* Spacer invisível */}
              <Bar dataKey="spacer" stackId="w" fill="transparent" stroke="none" legendType="none" />
              {/* Valor colorido */}
              <Bar dataKey="value" stackId="w" radius={[3, 3, 0, 0]} name="Valor">
                {waterfall.items.map((item, idx) => (
                  <Cell key={idx} fill={WF_COLORS[item.type] || '#94a3b8'} />
                ))}
              </Bar>
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
          {/* Legenda do waterfall */}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500 justify-center">
            {[['receita','Receita'],['reducao','Reversão'],['subtotal','Rec. Bruta Líq.'],['csv','Custo Serviços'],['subtotal_mb','Rec. Líquida'],['despesa','Overhead'],['total_pos','Resultado +']]
              .map(([type, label]) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: WF_COLORS[type] }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Evolução Mensal ─────────────────────────────────────────────────── */}
      {monthSeries.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolução Mensal — Receita × Despesa × Resultado</h2>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthSeries} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={BRLk} tick={{ fontSize: 11 }} width={72} />
              <Tooltip content={<MonthTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita"     name="Receita"      fill={FINANCE_COLORS.receita} radius={[3,3,0,0]} maxBarSize={40} />
              <Bar dataKey="despesa"     name="Despesa"      fill={FINANCE_COLORS.despesa} radius={[3,3,0,0]} maxBarSize={40} />
              <Line dataKey="margemBruta" name="Rec. Líquida" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
              <Line dataKey="resultado"   name="Resultado"    stroke={FINANCE_COLORS.resultado} strokeWidth={2.5} dot={{ r: 3 }} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top categorias ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard title="Top Overhead por Categoria" items={topDespesas} total={overheadTotal} labelBase={kpi.receita} labelSuffix="da rec." color={FINANCE_COLORS.despesa} />
        <RankingCard title="Fontes de Receita"          items={topReceitas} total={kpi.receita}  color={FINANCE_COLORS.receita} />
      </div>

      {/* ── Por filial ──────────────────────────────────────────────────────── */}
      {byUnit.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Resultado por Filial</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="pb-2 text-left font-semibold">Filial</th>
                <th className="pb-2 text-right font-semibold text-emerald-600">Receita</th>
                <th className="pb-2 text-right font-semibold text-violet-600">Custo Serv.</th>
                <th className="pb-2 text-right font-semibold text-indigo-600">Margem Bruta</th>
                <th className="pb-2 text-right font-semibold text-indigo-400">MB%</th>
                <th className="pb-2 text-right font-semibold">Resultado</th>
                <th className="pb-2 text-right font-semibold">Margem %</th>
                <th className="pb-2 text-right font-semibold">Part. Receita</th>
              </tr>
            </thead>
            <tbody>
              {byUnit.map(u => (
                <tr key={u.unit} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-1.5 font-medium text-slate-700">{u.unit}</td>
                  <td className="py-1.5 text-right tabular-nums text-emerald-700">{BRLFULL(u.receita)}</td>
                  <td className="py-1.5 text-right tabular-nums text-violet-600">{BRLFULL(u.csv)}</td>
                  <td className="py-1.5 text-right tabular-nums text-indigo-700 font-semibold">{BRLFULL(u.margemBruta)}</td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${(u.margemBrutaPct ?? 0) >= 10 ? 'text-indigo-600' : 'text-amber-500'}`}>
                    {PCTFMT(u.margemBrutaPct ?? 0)}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${u.resultado >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                    {BRLFULL(u.resultado)}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${u.margem >= 0 ? 'text-slate-600' : 'text-red-500'}`}>
                    {PCTFMT(u.margem)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">
                    {kpi.receita > 0 ? PCTFMT(u.receita / kpi.receita * 100) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200">
              <tr>
                <td className="pt-2 font-bold text-slate-700 text-xs">Total</td>
                <td className="pt-2 text-right tabular-nums font-bold text-emerald-700 text-xs">{BRLFULL(kpi.receita)}</td>
                <td className="pt-2 text-right tabular-nums font-bold text-violet-600 text-xs">{BRLFULL(kpi.csv)}</td>
                <td className="pt-2 text-right tabular-nums font-bold text-indigo-700 text-xs">{BRLFULL(kpi.margemBruta)}</td>
                <td className={`pt-2 text-right tabular-nums font-bold text-xs ${kpi.margemBrutaPct >= 10 ? 'text-indigo-600' : 'text-amber-500'}`}>{PCTFMT(kpi.margemBrutaPct)}</td>
                <td className={`pt-2 text-right tabular-nums font-bold text-xs ${kpi.resultado >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>{BRLFULL(kpi.resultado)}</td>
                <td className="pt-2 text-right tabular-nums font-bold text-slate-600 text-xs">{PCTFMT(kpi.margem)}</td>
                <td className="pt-2 text-right text-xs text-slate-400">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// labelBase: base para o % exibido no label (padrão = total, para % dentro da categoria)
// labelSuffix: texto após o % (ex: "da rec.")
function RankingCard({ title, items, total, labelBase, labelSuffix, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      <div className="space-y-2.5">
        {items.map(item => {
          const barPct   = total > 0 ? (item.value / total) * 100 : 0;
          const base     = labelBase ?? total;
          const labelPct = base > 0 ? (item.value / base) * 100 : 0;
          return (
            <div key={item.account}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-slate-600 truncate max-w-[200px]" title={item.account}>{item.account}</span>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {labelPct.toFixed(1)}%{labelSuffix ? ` ${labelSuffix}` : ''}
                  </span>
                  <span className="tabular-nums text-slate-700 font-semibold">{BRLFULL(item.value)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(barPct, 100)}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
