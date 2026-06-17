import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from 'recharts';
import { Search } from 'lucide-react';
import { groupByAccount, buildHeatMap, buildAccountTrend, calcDREKPIs, groupByUnit } from '../../utils/financeAggregations';
import { BRLFULL, BRLk, PCTFMT, FINANCE_COLORS, fmtMonthKey, accountColor } from '../../utils/financeFormat';
import { ExportButton } from '../../components/ExportButton';
import { InfoTooltip, TooltipFormula, TooltipTitle } from '../../components/InfoTooltip';

export default function ExpensesPage({ rows, loading }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('value');
  const [sortDir, setSortDir] = useState('desc');

  const kpi = useMemo(() => calcDREKPIs(rows), [rows]);

  // CSV (DESPESAS COM VENDAS) é custo direto — excluído da análise de overhead
  const overheadRows = useMemo(() => rows.filter(r => r.kind === 'despesa' && r.subkind !== 'csv'), [rows]);

  const despesas = useMemo(() => groupByAccount(overheadRows, 'despesa'), [overheadRows]);
  const heatMap  = useMemo(() => buildHeatMap(overheadRows, 'despesa', 10), [overheadRows]);
  const trend    = useMemo(() => buildAccountTrend(overheadRows, 'despesa', 6), [overheadRows]);
  const byUnit   = useMemo(() => groupByUnit(rows), [rows]);

  const overheadTotal = useMemo(() => overheadRows.reduce((s, r) => s + r.signed, 0), [overheadRows]);

  const filtered = useMemo(() => {
    let list = despesas;
    if (search) list = list.filter(d => d.account.toLowerCase().includes(search.toLowerCase()));
    list = [...list].sort((a, b) => {
      const v = sortDir === 'asc' ? 1 : -1;
      return (a[sortCol] > b[sortCol] ? 1 : -1) * v;
    });
    return list;
  }, [despesas, search, sortCol, sortDir]);

  function onSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const barData = despesas.slice(0, 15).map(d => ({ name: d.account, value: d.value }));

  // Export sections
  const exportSections = useMemo(() => [
    {
      title: 'Despesas por Categoria',
      columns: [
        { key: 'account', label: 'Conta',       type: 'text'     },
        { key: 'value',   label: 'Total',        type: 'currency' },
        { key: 'pct',     label: '% Despesa',    type: 'percent'  },
        { key: 'count',   label: 'Lançamentos',  type: 'number'   },
      ],
      rows: filtered.map(d => ({
        ...d, pct: kpi.receita > 0 ? d.value / kpi.receita * 100 : 0,
      })),
    },
  ], [filtered, kpi]);

  // Heatmap max for color scaling
  const heatMax = useMemo(() => {
    let max = 0;
    for (const acc of heatMap.accounts)
      for (const m of heatMap.months)
        max = Math.max(max, heatMap.matrix[acc]?.[m] || 0);
    return max;
  }, [heatMap]);

  function heatColor(value) {
    if (!value || heatMax === 0) return '#f8fafc';
    const t = Math.sqrt(value / heatMax);
    const r = Math.round(239 + (220 - 239) * t);
    const g = Math.round(68  + (38  - 68)  * t);
    const b = Math.round(68  + (38  - 68)  * t);
    return `rgb(${r},${g},${b})`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
          Análise de Overhead
          <InfoTooltip>
            <TooltipTitle>Overhead — Despesas Gerenciais</TooltipTitle>
            <TooltipFormula>Despesas 4xxx exceto DESPESAS COM VENDAS (CSV)</TooltipFormula>
            <span className="text-slate-300">Pessoal, encargos, despesas financeiras e outras. O Custo dos Serviços (repasses a fornecedores) é tratado separadamente como CSV na Visão Geral. Os percentuais aqui são sempre em relação à Receita Bruta.</span>
          </InfoTooltip>
        </h1>
        <ExportButton title="Despesas Financeiro" slug="financeiro-despesas" sections={exportSections} />
      </div>

      {/* Banner CSV separado */}
      {kpi.csv > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="text-xs text-violet-800">
            <span className="font-bold">Custo dos Serviços (CSV)</span>
            {' '}excluído desta análise — contabilizado separadamente na Visão Geral.
            <span className="ml-2 text-violet-600">{BRLFULL(kpi.csv)} · {PCTFMT(kpi.csv / kpi.receita * 100)} da receita bruta</span>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-violet-400 uppercase tracking-wider">Receita Líquida</p>
            <p className="text-sm font-bold text-violet-700 tabular-nums">{PCTFMT(kpi.margemBrutaPct)}</p>
          </div>
        </div>
      )}

      {/* Ranking bar */}
      {barData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 15 Categorias de Despesa</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} layout="vertical" margin={{ left: 160, right: 20, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={156} />
              <Tooltip formatter={v => BRLFULL(v)} />
              <Bar dataKey="value" name="Despesa" fill={FINANCE_COLORS.despesa} radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tendência top categorias */}
      {trend.series.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Tendência — Top Categorias de Despesa</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend.series.map(s => ({ ...s, name: fmtMonthKey(s.key) }))} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={BRLk} tick={{ fontSize: 10 }} width={64} />
              <Tooltip formatter={v => BRLFULL(v)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              {trend.accounts.map(acc => (
                <Line key={acc} dataKey={acc} name={acc.length > 28 ? acc.slice(0, 28) + '…' : acc}
                  stroke={accountColor(acc)} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heat map mês × categoria */}
      {heatMap.months.length > 1 && heatMap.accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Heat Map — Despesa por Mês × Categoria</h2>
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="pb-2 pr-3 text-left font-semibold text-slate-500 min-w-[180px]">Conta</th>
                {heatMap.months.map(m => (
                  <th key={m} className="pb-2 px-1 text-center font-semibold text-slate-500 min-w-[64px]">{fmtMonthKey(m)}</th>
                ))}
                <th className="pb-2 px-2 text-right font-semibold text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {heatMap.accounts.map(acc => {
                const total = heatMap.months.reduce((s, m) => s + (heatMap.matrix[acc]?.[m] || 0), 0);
                return (
                  <tr key={acc}>
                    <td className="pr-3 py-0.5 text-slate-700 max-w-[180px]">
                      <span className="block truncate" title={acc}>{acc}</span>
                    </td>
                    {heatMap.months.map(m => {
                      const v = heatMap.matrix[acc]?.[m] || 0;
                      return (
                        <td key={m} className="px-1 py-0.5 text-center tabular-nums rounded"
                          style={{ backgroundColor: heatColor(v), color: v / heatMax > 0.5 ? '#fff' : '#374151' }}
                          title={v > 0 ? BRLFULL(v) : ''}>
                          {v > 0 ? BRLk(v) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-0.5 text-right tabular-nums font-semibold text-slate-800">{BRLFULL(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela detalhada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-700">Detalhamento — Overhead por Categoria</h2>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conta..."
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                {[['account','Conta','left'],['value','Total','right'],['count','Qtd','right']].map(([col,label,align]) => (
                  <th key={col} onClick={() => onSort(col)}
                    className={`pb-2 pr-3 font-semibold cursor-pointer select-none hover:text-slate-700 ${align === 'right' ? 'text-right' : ''}`}>
                    {label}
                    <span className="ml-0.5 text-[10px] text-slate-300">
                      {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </th>
                ))}
                <th className="pb-2 text-right font-semibold text-slate-500">% Receita</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.account} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-1.5 text-slate-700 max-w-[260px]">
                    <span className="block truncate" title={d.account}>{d.account}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-red-600 font-semibold">{BRLFULL(d.value)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">{d.count}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">
                    {kpi.receita > 0 ? PCTFMT(d.value / kpi.receita * 100) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200">
              <tr className="font-bold text-slate-800">
                <td className="py-2">Total Overhead</td>
                <td className="py-2 text-right tabular-nums text-red-700">{BRLFULL(overheadTotal)}</td>
                <td className="py-2 text-right tabular-nums">{filtered.reduce((s,d) => s + d.count, 0)}</td>
                <td className="py-2 text-right tabular-nums text-slate-500">
                  {kpi.receita > 0 ? PCTFMT(overheadTotal / kpi.receita * 100) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
