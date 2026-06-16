import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { ArrowDown, ArrowUp, TrendingUp, Search } from 'lucide-react';
import { KPICard }      from '../../components/KPICard';
import { ExportButton } from '../../components/ExportButton';
import { InfoTooltip }  from '../../components/InfoTooltip';
import { calcCashKPIs, groupCashByMonth, groupCashByDay, groupCashByPerson } from '../../utils/financeAggregations';
import { BRLFULL, BRLk, FINANCE_COLORS, fmtMonthKey, fmtDateKey } from '../../utils/financeFormat';

function CashTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[200px]">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-6 mb-0.5" style={{ color: p.color || p.fill }}>
          <span>{p.name}</span>
          <span className="font-semibold tabular-nums">{BRLFULL(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export default function CashFlowPage({ rows, loading }) {
  const [granularity, setGranularity] = useState('mes'); // 'mes' | 'dia'
  const [search, setSearch]           = useState('');

  const kpi       = useMemo(() => calcCashKPIs(rows), [rows]);
  const monthly   = useMemo(() => groupCashByMonth(rows), [rows]);
  const daily     = useMemo(() => groupCashByDay(rows), [rows]);
  const byPerson  = useMemo(() => groupCashByPerson(rows), [rows]);

  const chartData = (granularity === 'mes' ? monthly : daily).map(m => ({
    ...m,
    name: granularity === 'mes' ? fmtMonthKey(m.key) : fmtDateKey(m.key),
  }));

  const filteredPersons = useMemo(() => {
    if (!search) return byPerson.slice(0, 30);
    return byPerson.filter(p => p.person.toLowerCase().includes(search.toLowerCase())).slice(0, 50);
  }, [byPerson, search]);

  const exportSections = useMemo(() => [
    {
      title: 'Fluxo de Caixa Mensal',
      columns: [
        { key: 'name',       label: 'Período',   type: 'text'     },
        { key: 'entradas',   label: 'Entradas',  type: 'currency' },
        { key: 'saidas',     label: 'Saídas',    type: 'currency' },
        { key: 'saldo',      label: 'Saldo',     type: 'currency' },
        { key: 'saldoAcum',  label: 'Acumulado', type: 'currency' },
      ],
      rows: monthly.map(m => ({ ...m, name: fmtMonthKey(m.key) })),
    },
    {
      title: 'Por Pessoa / Fornecedor',
      columns: [
        { key: 'person',   label: 'Pessoa',    type: 'text'     },
        { key: 'entradas', label: 'Entradas',  type: 'currency' },
        { key: 'saidas',   label: 'Saídas',    type: 'currency' },
        { key: 'saldo',    label: 'Saldo',     type: 'currency' },
      ],
      rows: byPerson.slice(0, 50),
    },
  ], [monthly, byPerson]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
          Fluxo de Caixa Realizado
          <InfoTooltip text="Contas baixadas (pagas/recebidas) no período. Entradas = contas a receber liquidadas; Saídas = contas a pagar liquidadas. Saldo = Entradas − Saídas." />
        </h1>
        <ExportButton title="Fluxo de Caixa" slug="financeiro-cashflow" sections={exportSections} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Entradas (Receber)" value={kpi.entradas} format="currency" icon={ArrowUp}  color="green" />
        <KPICard title="Saídas (Pagar)"    value={kpi.saidas}   format="currency" icon={ArrowDown} color="red"   />
        <KPICard
          title="Saldo Líquido"
          value={kpi.saldo}
          format="currency"
          icon={TrendingUp}
          color={kpi.saldo >= 0 ? 'blue' : 'amber'}
        />
      </div>

      {/* Gráfico fluxo */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Fluxo de Caixa — Entradas × Saídas</h2>
            <div className="flex gap-1">
              {['mes', 'dia'].map(g => (
                <button key={g} onClick={() => setGranularity(g)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    granularity === g ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {g === 'mes' ? 'Mensal' : 'Diário'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={granularity === 'dia' ? 'preserveStartEnd' : 0} />
              <YAxis tickFormatter={BRLk} tick={{ fontSize: 10 }} width={64} />
              <Tooltip content={<CashTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="entradas" name="Entradas" fill={FINANCE_COLORS.entrada} radius={[3,3,0,0]} maxBarSize={36} />
              <Bar dataKey="saidas"   name="Saídas"   fill={FINANCE_COLORS.saida}   radius={[3,3,0,0]} maxBarSize={36} />
              <Line dataKey="saldoAcum" name="Saldo Acumulado" stroke={FINANCE_COLORS.saldo} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Por pessoa/fornecedor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-700">Por Pessoa / Fornecedor</h2>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="pb-2 text-left font-semibold">Pessoa / Fornecedor</th>
                <th className="pb-2 text-right font-semibold text-emerald-600">Entradas</th>
                <th className="pb-2 text-right font-semibold text-red-600">Saídas</th>
                <th className="pb-2 text-right font-semibold">Saldo</th>
                <th className="pb-2 text-right font-semibold text-slate-400">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersons.map(p => (
                <tr key={p.person} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-1.5 text-slate-700 max-w-[240px]">
                    <span className="block truncate" title={p.person}>{p.person || '(sem nome)'}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-emerald-700">{p.entradas > 0 ? BRLFULL(p.entradas) : '—'}</td>
                  <td className="py-1.5 text-right tabular-nums text-red-600">{p.saidas > 0 ? BRLFULL(p.saidas) : '—'}</td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${p.saldo >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>{BRLFULL(p.saldo)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-400">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
