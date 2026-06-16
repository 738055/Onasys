import { useMemo, useState } from 'react';
import { calcAgingKPIs, groupAgingByBucket, groupAgingByPerson } from '../../utils/financeAggregations';
import { BRLFULL, PCTFMT, FINANCE_COLORS, AGING_LABELS, AGING_ORDER } from '../../utils/financeFormat';
import { KPICard } from '../../components/KPICard';
import { ArrowUp, ArrowDown, Scale } from 'lucide-react';
import { Loader } from '../../components/Loader';

export default function PayablesPage({ rows, loading }) {
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'PAGAR' | 'RECEBER'

  const filtered = useMemo(() =>
    typeFilter === 'ALL' ? rows : rows.filter(r => r.type === typeFilter),
    [rows, typeFilter]
  );

  const kpi     = useMemo(() => calcAgingKPIs(rows), [rows]);
  const buckets = useMemo(() => groupAgingByBucket(filtered), [filtered]);
  const persons = useMemo(() => groupAgingByPerson(filtered).slice(0, 30), [filtered]);

  const totalBucket = (b) => (b.pagar || 0) + (b.receber || 0);

  if (loading) return <Loader />;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <p className="text-sm">Nenhuma conta em aberto no período selecionado.</p>
        <p className="text-xs mt-1 opacity-70">O endpoint contasAbertas retorna posição atual — sem filtro de data no backend.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="A Receber" value={kpi.receber} format="currency" icon={ArrowUp}  color="green" />
        <KPICard title="A Pagar"   value={kpi.pagar}   format="currency" icon={ArrowDown} color="red"   />
        <KPICard
          title="Posição Líquida"
          value={kpi.saldo}
          format="currency"
          icon={Scale}
          color={kpi.saldo >= 0 ? 'blue' : 'amber'}
        />
      </div>

      {/* Filtro tipo */}
      <div className="flex items-center gap-2">
        {[['ALL','Todos'],['PAGAR','A Pagar'],['RECEBER','A Receber']].map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              typeFilter === v ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>{l}
          </button>
        ))}
      </div>

      {/* Aging buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {AGING_ORDER.map(bucket => {
          const b = buckets[bucket] || { pagar: 0, receber: 0 };
          const isVencido = bucket === 'vencido';
          return (
            <div key={bucket} className={`rounded-xl border p-4 ${isVencido ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{AGING_LABELS[bucket]}</p>
              {(typeFilter === 'ALL' || typeFilter === 'RECEBER') && (
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-500">A Receber</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">{BRLFULL(b.receber)}</span>
                </div>
              )}
              {(typeFilter === 'ALL' || typeFilter === 'PAGAR') && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">A Pagar</span>
                  <span className={`font-semibold tabular-nums ${isVencido ? 'text-red-700' : 'text-red-600'}`}>{BRLFULL(b.pagar)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Por pessoa */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Por Pessoa / Empresa</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="pb-2 text-left font-semibold">Nome</th>
              <th className="pb-2 text-right font-semibold">Tipo</th>
              <th className="pb-2 text-right font-semibold text-emerald-600">A Receber</th>
              <th className="pb-2 text-right font-semibold text-red-600">A Pagar</th>
            </tr>
          </thead>
          <tbody>
            {persons.map((p, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-1.5 text-slate-700 max-w-[240px]">
                  <span className="block truncate" title={p.person}>{p.person || '(sem nome)'}</span>
                </td>
                <td className="py-1.5 text-right">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    p.type === 'PAGAR' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{p.type}</span>
                </td>
                <td className="py-1.5 text-right tabular-nums text-emerald-700">{p.receber > 0 ? BRLFULL(p.receber) : '—'}</td>
                <td className="py-1.5 text-right tabular-nums text-red-600">{p.pagar > 0 ? BRLFULL(p.pagar) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
