import { useMemo, useRef } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart2, Hash } from 'lucide-react';
import { KPICard }      from '../../components/KPICard';
import { InfoTooltip }  from '../../components/InfoTooltip';
import { ExportButton } from '../../components/ExportButton';
import {
  calcDREKPIs, groupByMonthDRE, groupByAccount, groupByUnit, buildWaterfall,
} from '../../utils/financeAggregations';
import { BRLFULL, BRLk, PCTFMT, FINANCE_COLORS, fmtMonthKey, MONTHS_SHORT } from '../../utils/financeFormat';

// Cores do waterfall por tipo de barra
const WF_COLORS = {
  receita:   '#10b981',
  reducao:   '#f59e0b',
  subtotal:  '#3b82f6',
  despesa:   '#f43f5e',
  total_pos: '#0ea5e9',
  total_neg: '#ef4444',
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

  const topDespesas = useMemo(() => groupByAccount(rows, 'despesa').slice(0, 10), [rows]);
  const topReceitas = useMemo(() => groupByAccount(rows, 'receita').slice(0, 8),  [rows]);
  const byUnit      = useMemo(() => groupByUnit(rows), [rows]);
  const waterfall   = useMemo(() => buildWaterfall(rows), [rows]);

  // KPI deltas vs período anterior (mesmo meses, ano anterior)
  const deltaReceita  = prev.receita !== 0   ? ((kpi.receita   - prev.receita)   / Math.abs(prev.receita)   * 100) : null;
  const deltaDespesa  = prev.despesa !== 0   ? ((kpi.despesa   - prev.despesa)   / Math.abs(prev.despesa)   * 100) : null;
  const deltaResult   = prev.resultado !== 0 ? ((kpi.resultado - prev.resultado) / Math.abs(prev.resultado) * 100) : null;
  const deltaMargem   = prev.receita !== 0   ? (kpi.margem - prev.margem) : null;

  // Ratios adicionais
  const taxaDespesa   = kpi.receita > 0 ? (kpi.despesa   / kpi.receita * 100) : 0;
  const totalLancamentos = rows.length;

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
        { indicador: 'Receita Total',   valor: kpi.receita   },
        { indicador: 'Despesa Total',   valor: kpi.despesa   },
        { indicador: 'Resultado',       valor: kpi.resultado },
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
        { key: 'unit',      label: 'Filial',    type: 'text'     },
        { key: 'receita',   label: 'Receita',   type: 'currency' },
        { key: 'despesa',   label: 'Despesa',   type: 'currency' },
        { key: 'resultado', label: 'Resultado', type: 'currency' },
        { key: 'margem',    label: 'Margem %',  type: 'percent'  },
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
          title={<span className="flex items-center gap-1">Receita Total<InfoTooltip text="Soma de todos os lançamentos de receita (contas 3xxx, op=C) no período. Reversões (op=D) já deduzidas." /></span>}
          value={kpi.receita}
          format="currency"
          icon={TrendingUp}
          color="green"
          sub={deltaReceita != null ? <DeltaBadge value={deltaReceita} /> : undefined}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Despesa Total<InfoTooltip text="Soma de todos os lançamentos de despesa (contas 4xxx) no período." /></span>}
          value={kpi.despesa}
          format="currency"
          icon={TrendingDown}
          color="red"
          sub={deltaDespesa != null ? <DeltaBadge value={deltaDespesa} invert /> : undefined}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Resultado<InfoTooltip text="Receita Total − Despesa Total. Resultado positivo = lucro; negativo = prejuízo." /></span>}
          value={kpi.resultado}
          format="currency"
          icon={DollarSign}
          color={kpi.resultado >= 0 ? 'blue' : 'amber'}
          sub={deltaResult != null ? <DeltaBadge value={deltaResult} /> : undefined}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Margem %<InfoTooltip text="Resultado / Receita Total × 100. Indica quanto do faturamento se transforma em resultado líquido após todas as despesas." /></span>}
          value={kpi.margem}
          format="percent"
          icon={Percent}
          color={kpi.margem >= 10 ? 'indigo' : kpi.margem >= 0 ? 'amber' : 'red'}
          sub={deltaMargem != null ? <DeltaBadge value={deltaMargem} suffix="pp" /> : undefined}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Taxa de Despesa<InfoTooltip text="Despesa Total / Receita Total × 100. Mostra qual percentual da receita é consumido por despesas. Meta: abaixo de 90%." /></span>}
          value={taxaDespesa}
          format="percent"
          icon={BarChart2}
          color={taxaDespesa < 80 ? 'green' : taxaDespesa < 95 ? 'amber' : 'red'}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Lançamentos<InfoTooltip text="Total de lançamentos contábeis no período (linhas DRE brutas, tipoconta=R)." /></span>}
          value={totalLancamentos}
          format="number"
          icon={Hash}
          color="slate"
        />
      </div>

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
            {[['receita','Receita'],['reducao','Reversão'],['subtotal','Subtotal'],['despesa','Despesa'],['total_pos','Resultado +']]
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
              <Bar dataKey="receita" name="Receita" fill={FINANCE_COLORS.receita} radius={[3,3,0,0]} maxBarSize={40} />
              <Bar dataKey="despesa" name="Despesa" fill={FINANCE_COLORS.despesa} radius={[3,3,0,0]} maxBarSize={40} />
              <Line dataKey="resultado" name="Resultado" stroke={FINANCE_COLORS.resultado} strokeWidth={2.5} dot={{ r: 3 }} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top categorias ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard title="Top Despesas por Categoria" items={topDespesas} total={kpi.despesa} color={FINANCE_COLORS.despesa} />
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
                <th className="pb-2 text-right font-semibold text-red-500">Despesa</th>
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
                  <td className="py-1.5 text-right tabular-nums text-red-600">{BRLFULL(u.despesa)}</td>
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
                <td className="pt-2 text-right tabular-nums font-bold text-red-600 text-xs">{BRLFULL(kpi.despesa)}</td>
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

function RankingCard({ title, items, total, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      <div className="space-y-2.5">
        {items.map(item => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.account}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-slate-600 truncate max-w-[200px]" title={item.account}>{item.account}</span>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-[10px] text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>
                  <span className="tabular-nums text-slate-700 font-semibold">{BRLFULL(item.value)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
