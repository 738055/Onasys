import { useMemo, useState } from 'react';
import {
  groupByMonthDRE, groupByAccount, calcDREKPIs, buildDREHierarchy,
} from '../../utils/financeAggregations';
import { BRLFULL, PCTFMT, fmtMonthKey } from '../../utils/financeFormat';
import { ExportButton } from '../../components/ExportButton';
import { InfoTooltip }  from '../../components/InfoTooltip';

const TIPOCONTA_LABELS = { R: 'Resultado', A: 'Ativo', P: 'Passivo' };

export default function DREPage({ rows, loading }) {
  const [view, setView] = useState('hierarquia'); // 'mensal' | 'hierarquia' | 'conta'

  const kpi         = useMemo(() => calcDREKPIs(rows), [rows]);
  const monthSeries = useMemo(() => groupByMonthDRE(rows), [rows]);
  const receitas    = useMemo(() => groupByAccount(rows, 'receita'), [rows]);
  const despesas    = useMemo(() => groupByAccount(rows, 'despesa'), [rows]);
  const hierarchy   = useMemo(() => buildDREHierarchy(rows), [rows]);
  const months      = monthSeries.map(m => m.key);

  function buildAccountMonthMap(accounts) {
    const map = {};
    const accSet = new Set(accounts.map(a => a.account));
    for (const r of rows) {
      if (!accSet.has(r.account)) continue;
      const key = r.date ? `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2,'0')}` : null;
      if (!key) continue;
      if (!map[r.account]) map[r.account] = { total: 0 };
      map[r.account][key] = (map[r.account][key] || 0) + Math.abs(r.signed);
      map[r.account].total += Math.abs(r.signed);
    }
    return map;
  }

  const receitaMap = useMemo(() => buildAccountMonthMap(receitas), [rows, receitas]);
  const despesaMap = useMemo(() => buildAccountMonthMap(despesas), [rows, despesas]);

  // Seções para export
  const exportSections = useMemo(() => [
    {
      title: 'DRE — Evolução Mensal',
      columns: [
        { key: 'periodo',   label: 'Período',   type: 'text'     },
        { key: 'receita',   label: 'Receita',   type: 'currency' },
        { key: 'despesa',   label: 'Despesa',   type: 'currency' },
        { key: 'resultado', label: 'Resultado', type: 'currency' },
        { key: 'margem',    label: 'Margem %',  type: 'percent'  },
      ],
      rows: monthSeries.map(m => ({ ...m, periodo: fmtMonthKey(m.key) })),
    },
    {
      title: 'DRE — Receitas por Conta',
      columns: [
        { key: 'account', label: 'Conta',      type: 'text'     },
        { key: 'value',   label: 'Total',       type: 'currency' },
        { key: 'pct',     label: '% Receita',   type: 'percent'  },
        { key: 'count',   label: 'Lançamentos', type: 'number'   },
      ],
      rows: receitas.map(r => ({
        ...r,
        pct: kpi.receita > 0 ? r.value / kpi.receita * 100 : 0,
      })),
    },
    {
      title: 'DRE — Despesas por Conta',
      columns: [
        { key: 'account', label: 'Conta',       type: 'text'     },
        { key: 'value',   label: 'Total',        type: 'currency' },
        { key: 'pct',     label: '% Despesa',    type: 'percent'  },
        { key: 'count',   label: 'Lançamentos',  type: 'number'   },
      ],
      rows: despesas.map(d => ({
        ...d,
        pct: kpi.despesa > 0 ? d.value / kpi.despesa * 100 : 0,
      })),
    },
  ], [monthSeries, receitas, despesas, kpi]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            Demonstração do Resultado
            <span className="text-[11px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
              tipoconta R — {TIPOCONTA_LABELS['R']}
            </span>
            <InfoTooltip text="Lançamentos contábeis do tipo R (Resultado). Contas 3xxx = Receitas, contas 4xxx = Despesas. Op C = crédito normal; Op D = débito (pode ser reversão de receita)." />
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Receita: {BRLFULL(kpi.receita)} · Despesa: {BRLFULL(kpi.despesa)} · Resultado: <span className={kpi.resultado >= 0 ? 'text-blue-700 font-semibold' : 'text-red-600 font-semibold'}>{BRLFULL(kpi.resultado)}</span> · Margem: {PCTFMT(kpi.margem)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[['mensal','Mensal'],['hierarquia','Hierarquia'],['conta','Por Conta']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                view === v ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{l}
            </button>
          ))}
          <ExportButton title="DRE Contábil" slug="dre" sections={exportSections} />
        </div>
      </div>

      {view === 'mensal'     && <MensalView monthSeries={monthSeries} kpi={kpi} />}
      {view === 'hierarquia' && <HierarchyView hierarchy={hierarchy} kpi={kpi} months={months} rows={rows} />}
      {view === 'conta'      && (
        <ContaView
          receitas={receitas} despesas={despesas} months={months}
          receitaMap={receitaMap} despesaMap={despesaMap} kpi={kpi}
        />
      )}
    </div>
  );
}

// ── Mensal ──────────────────────────────────────────────────────────────────

function MensalView({ monthSeries, kpi }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="pb-2 text-left font-semibold w-28">Período</th>
            <th className="pb-2 text-right font-semibold text-emerald-600">Receita</th>
            <th className="pb-2 text-right font-semibold text-red-500">Despesa</th>
            <th className="pb-2 text-right font-semibold">Resultado</th>
            <th className="pb-2 text-right font-semibold">Margem %</th>
            <th className="pb-2 text-right font-semibold">Taxa Despesa</th>
          </tr>
        </thead>
        <tbody>
          {monthSeries.map(m => (
            <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-1.5 font-medium text-slate-700">{fmtMonthKey(m.key)}</td>
              <td className="py-1.5 text-right tabular-nums text-emerald-700">{BRLFULL(m.receita)}</td>
              <td className="py-1.5 text-right tabular-nums text-red-600">{BRLFULL(m.despesa)}</td>
              <td className={`py-1.5 text-right tabular-nums font-semibold ${m.resultado >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                {BRLFULL(m.resultado)}
              </td>
              <td className={`py-1.5 text-right tabular-nums ${m.margem >= 0 ? 'text-slate-600' : 'text-red-500'}`}>
                {PCTFMT(m.margem)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-500">
                {m.receita > 0 ? PCTFMT(m.despesa / m.receita * 100) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200">
          <tr className="font-bold text-slate-800">
            <td className="py-2">Total</td>
            <td className="py-2 text-right tabular-nums text-emerald-700">{BRLFULL(kpi.receita)}</td>
            <td className="py-2 text-right tabular-nums text-red-600">{BRLFULL(kpi.despesa)}</td>
            <td className={`py-2 text-right tabular-nums ${kpi.resultado >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>{BRLFULL(kpi.resultado)}</td>
            <td className={`py-2 text-right tabular-nums ${kpi.margem >= 0 ? 'text-slate-600' : 'text-red-500'}`}>{PCTFMT(kpi.margem)}</td>
            <td className="py-2 text-right tabular-nums text-slate-500">{kpi.receita > 0 ? PCTFMT(kpi.despesa / kpi.receita * 100) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Hierarquia (grupos de conta contaextendida) ──────────────────────────────

function HierarchyView({ hierarchy, kpi, months, rows }) {
  return (
    <div className="space-y-4">
      {/* Receitas */}
      <HierarchySection
        title="RECEITAS"
        groups={hierarchy.receitas.groups}
        total={hierarchy.receitas.total}
        color="text-emerald-800 bg-emerald-50 border-emerald-200"
        barColor="#10b981"
        revenueBase={kpi.receita}
      />

      {/* Resultado (linha de resumo) */}
      <div className={`rounded-xl border-2 px-5 py-4 flex items-center justify-between ${
        kpi.resultado >= 0 ? 'border-blue-300 bg-blue-50' : 'border-amber-300 bg-amber-50'
      }`}>
        <div>
          <p className="text-sm font-bold text-slate-700">RESULTADO DO PERÍODO</p>
          <p className="text-xs text-slate-500 mt-0.5">Receitas − Despesas</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold tabular-nums ${kpi.resultado >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
            {BRLFULL(kpi.resultado)}
          </p>
          <p className={`text-xs font-semibold ${kpi.margem >= 0 ? 'text-slate-500' : 'text-red-500'}`}>
            Margem {PCTFMT(kpi.margem)}
          </p>
        </div>
      </div>

      {/* Despesas */}
      <HierarchySection
        title="DESPESAS"
        groups={hierarchy.despesas.groups}
        total={hierarchy.despesas.total}
        color="text-red-800 bg-red-50 border-red-200"
        barColor="#f43f5e"
        revenueBase={kpi.receita}
      />
    </div>
  );
}

function HierarchySection({ title, groups, total, color, barColor, revenueBase }) {
  const [openGroups, setOpenGroups] = useState({});
  const toggle = (code) => setOpenGroups(prev => ({ ...prev, [code]: !prev[code] }));

  return (
    <div className={`rounded-xl border overflow-hidden ${color}`}>
      <div className="px-5 py-3 flex items-center justify-between">
        <p className="text-sm font-bold tracking-wide">{title}</p>
        <p className="text-sm font-bold tabular-nums">{BRLFULL(total)}</p>
      </div>

      {groups.map(g => {
        const isOpen   = openGroups[g.code] !== false; // abre por padrão
        const groupPct = total > 0 ? g.subtotal / total * 100 : 0;
        const revPct   = revenueBase > 0 ? g.subtotal / revenueBase * 100 : 0;

        return (
          <div key={g.code} className="border-t border-slate-100 bg-white">
            <button
              onClick={() => toggle(g.code)}
              className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2 text-left">
                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{g.code}</span>
                <span className="text-xs font-semibold text-slate-700">{g.label}</span>
                <span className="text-[10px] text-slate-400">({g.accounts.length} contas)</span>
              </div>
              <div className="flex items-center gap-4 text-xs flex-shrink-0">
                <span className="text-slate-400 tabular-nums">{PCTFMT(revPct)} da receita</span>
                <span className="font-semibold text-slate-700 tabular-nums">{BRLFULL(g.subtotal)}</span>
                <span className="text-slate-400">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="bg-slate-50 border-t border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="pb-1.5 pt-2 px-8 text-left font-medium">Conta</th>
                      <th className="pb-1.5 pt-2 px-4 text-right font-medium">Lançtos</th>
                      <th className="pb-1.5 pt-2 px-4 text-right font-medium">Valor</th>
                      <th className="pb-1.5 pt-2 px-4 text-right font-medium">% Grupo</th>
                      <th className="pb-1.5 pt-2 px-4 text-right font-medium">% Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.accounts.map(acc => (
                      <tr key={acc.name} className="border-b border-slate-100 hover:bg-white">
                        <td className="py-1.5 px-8 text-slate-700 max-w-[240px]">
                          <span className="block truncate" title={acc.name}>{acc.name}</span>
                          <div className="mt-0.5 h-1 bg-slate-200 rounded-full overflow-hidden w-full">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(acc.pct, 100)}%`, backgroundColor: barColor, opacity: 0.7 }} />
                          </div>
                        </td>
                        <td className="py-1.5 px-4 text-right tabular-nums text-slate-400">{acc.count}</td>
                        <td className="py-1.5 px-4 text-right tabular-nums font-semibold text-slate-800">{BRLFULL(acc.value)}</td>
                        <td className="py-1.5 px-4 text-right tabular-nums text-slate-500">{PCTFMT(acc.pct)}</td>
                        <td className="py-1.5 px-4 text-right tabular-nums text-slate-400">
                          {revenueBase > 0 ? PCTFMT(acc.value / revenueBase * 100) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td className="py-1.5 px-8 font-semibold text-slate-600">Subtotal {g.label}</td>
                      <td />
                      <td className="py-1.5 px-4 text-right tabular-nums font-bold text-slate-800">{BRLFULL(g.subtotal)}</td>
                      <td className="py-1.5 px-4 text-right tabular-nums font-semibold text-slate-500">{PCTFMT(groupPct)}</td>
                      <td className="py-1.5 px-4 text-right tabular-nums font-semibold text-slate-400">{PCTFMT(revPct)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <div className="px-5 py-2 bg-slate-50 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-600">
        <span>TOTAL {title}</span>
        <span className="tabular-nums">{BRLFULL(total)}</span>
      </div>
    </div>
  );
}

// ── Por Conta (visão tabular original) ──────────────────────────────────────

function ContaSection({ title, items, map, months, total, color }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-panel overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-3 text-sm font-semibold ${color} hover:opacity-90 transition-opacity`}>
        <span>{title}</span>
        <span className="flex items-center gap-4">
          <span className="text-xs font-normal opacity-80">Total: {BRLFULL(total)}</span>
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 bg-slate-50">
                <th className="pb-2 pt-2 px-4 text-left font-semibold">Conta</th>
                {months.map(m => (
                  <th key={m} className="pb-2 pt-2 px-2 text-right font-semibold whitespace-nowrap">{fmtMonthKey(m)}</th>
                ))}
                <th className="pb-2 pt-2 px-4 text-right font-semibold">Total</th>
                <th className="pb-2 pt-2 px-4 text-right font-semibold">% Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <tr key={item.account} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-1.5 px-4 text-slate-700 max-w-[200px]" title={item.account}>
                      <span className="block truncate">{item.account}</span>
                    </td>
                    {months.map(m => (
                      <td key={m} className="py-1.5 px-2 text-right tabular-nums text-slate-600">
                        {map[item.account]?.[m] ? BRLFULL(map[item.account][m]) : '—'}
                      </td>
                    ))}
                    <td className="py-1.5 px-4 text-right tabular-nums font-semibold text-slate-800">{BRLFULL(item.value)}</td>
                    <td className="py-1.5 px-4 text-right tabular-nums text-slate-500">{PCTFMT(pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContaView({ receitas, despesas, months, receitaMap, despesaMap, kpi }) {
  return (
    <div className="space-y-4">
      <ContaSection title="Receitas" items={receitas} map={receitaMap} months={months} total={kpi.receita} color="bg-emerald-50 text-emerald-800" />
      <ContaSection title="Despesas" items={despesas} map={despesaMap} months={months} total={kpi.despesa} color="bg-red-50 text-red-800" />
    </div>
  );
}
