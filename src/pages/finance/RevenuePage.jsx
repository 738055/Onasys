import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend,
} from 'recharts';
import { Search } from 'lucide-react';
import { groupByAccount, buildAccountTrend, calcDREKPIs, groupByUnit, groupByMonthDRE } from '../../utils/financeAggregations';
import { BRLFULL, BRLk, PCTFMT, FINANCE_COLORS, fmtMonthKey, accountColor } from '../../utils/financeFormat';
import { ExportButton } from '../../components/ExportButton';
import { InfoTooltip }  from '../../components/InfoTooltip';

export default function RevenuePage({ rows, loading }) {
  const [search, setSearch]   = useState('');
  const [sortCol, setSortCol] = useState('value');
  const [sortDir, setSortDir] = useState('desc');

  const kpi      = useMemo(() => calcDREKPIs(rows), [rows]);
  const receitas = useMemo(() => groupByAccount(rows, 'receita'), [rows]);
  const trend    = useMemo(() => buildAccountTrend(rows, 'receita', 6), [rows]);
  const byUnit   = useMemo(() => groupByUnit(rows), [rows]);
  const months   = useMemo(() => groupByMonthDRE(rows), [rows]);

  const filtered = useMemo(() => {
    let list = receitas;
    if (search) list = list.filter(d => d.account.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => {
      const v = sortDir === 'asc' ? 1 : -1;
      return (a[sortCol] > b[sortCol] ? 1 : -1) * v;
    });
  }, [receitas, search, sortCol, sortDir]);

  function onSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const barData = receitas.slice(0, 15).map(d => ({ name: d.account, value: d.value }));

  const exportSections = useMemo(() => [
    {
      title: 'Receita Mensal',
      columns: [
        { key: 'periodo',  label: 'Período',  type: 'text'     },
        { key: 'receita',  label: 'Receita',  type: 'currency' },
        { key: 'margem',   label: 'Margem %', type: 'percent'  },
      ],
      rows: months.map(m => ({ periodo: fmtMonthKey(m.key), receita: m.receita, margem: m.margem })),
    },
    {
      title: 'Receitas por Conta',
      columns: [
        { key: 'account', label: 'Conta',      type: 'text'     },
        { key: 'value',   label: 'Total',       type: 'currency' },
        { key: 'pct',     label: '% Receita',   type: 'percent'  },
        { key: 'count',   label: 'Lançamentos', type: 'number'   },
      ],
      rows: filtered.map(d => ({
        ...d, pct: kpi.receita > 0 ? d.value / kpi.receita * 100 : 0,
      })),
    },
    {
      title: 'Receita por Filial',
      columns: [
        { key: 'unit',    label: 'Filial',   type: 'text'     },
        { key: 'receita', label: 'Receita',  type: 'currency' },
        { key: 'pct',     label: '% Total',  type: 'percent'  },
      ],
      rows: byUnit.map(u => ({
        ...u, pct: kpi.receita > 0 ? u.receita / kpi.receita * 100 : 0,
      })),
    },
  ], [months, filtered, byUnit, kpi]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
          Análise de Receitas
          <InfoTooltip text="Todos os lançamentos de receita (contas 3xxx) no período. Op=C são entradas normais; Op=D são reversões que reduzem a receita líquida." />
        </h1>
        <ExportButton title="Receitas Financeiro" slug="financeiro-receitas" sections={exportSections} />
      </div>

      {/* Receita mensal */}
      {months.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Receita Mensal</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={months.map(m => ({ name: fmtMonthKey(m.key), value: m.receita }))} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={BRLk} tick={{ fontSize: 11 }} width={64} />
              <Tooltip formatter={v => BRLFULL(v)} />
              <Bar dataKey="value" name="Receita" fill={FINANCE_COLORS.receita} radius={[3,3,0,0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top fontes */}
      {barData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 15 Fontes de Receita</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} layout="vertical" margin={{ left: 160, right: 20, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={156} />
              <Tooltip formatter={v => BRLFULL(v)} />
              <Bar dataKey="value" name="Receita" fill={FINANCE_COLORS.receita} radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tendência */}
      {trend.series.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Tendência — Top Fontes de Receita</h2>
          <ResponsiveContainer width="100%" height={220}>
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

      {/* Por filial */}
      {byUnit.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Receita por Filial</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="pb-2 text-left font-semibold">Filial</th>
                <th className="pb-2 text-right font-semibold">Receita</th>
                <th className="pb-2 text-right font-semibold">% Total</th>
                <th className="pb-2 text-right font-semibold">Margem</th>
              </tr>
            </thead>
            <tbody>
              {byUnit.map(u => (
                <tr key={u.unit} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-1.5 text-slate-700">{u.unit}</td>
                  <td className="py-1.5 text-right tabular-nums text-emerald-700 font-semibold">{BRLFULL(u.receita)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">
                    {kpi.receita > 0 ? PCTFMT(u.receita / kpi.receita * 100) : '—'}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${u.margem >= 0 ? 'text-slate-500' : 'text-red-500'}`}>
                    {PCTFMT(u.margem)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela detalhada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-700">Detalhamento por Conta de Receita</h2>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conta..."
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              {[['account','Conta','left'],['value','Total','right'],['count','Qtd','right']].map(([col,label,align]) => (
                <th key={col} onClick={() => onSort(col)}
                  className={`pb-2 pr-3 font-semibold cursor-pointer hover:text-slate-700 ${align === 'right' ? 'text-right' : ''}`}>
                  {label} <span className="text-[10px] text-slate-300">{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
              ))}
              <th className="pb-2 text-right font-semibold">% Receita</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.account} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-1.5 text-slate-700 max-w-[260px]"><span className="block truncate" title={d.account}>{d.account}</span></td>
                <td className="py-1.5 text-right tabular-nums text-emerald-700 font-semibold">{BRLFULL(d.value)}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">{d.count}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">
                  {kpi.receita > 0 ? PCTFMT(d.value / kpi.receita * 100) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200">
            <tr className="font-bold">
              <td className="py-2 text-slate-800">Total</td>
              <td className="py-2 text-right tabular-nums text-emerald-700">{BRLFULL(kpi.receita)}</td>
              <td className="py-2 text-right">{filtered.reduce((s,d) => s + d.count, 0)}</td>
              <td className="py-2 text-right">100,00%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
