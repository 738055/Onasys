import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { compareKPIs, compareByAccount } from '../../utils/financeAggregations';
import { BRLFULL, BRLk, PCTFMT, FINANCE_COLORS, MONTHS_SHORT } from '../../utils/financeFormat';
import { useFinanceSeries } from '../../hooks/useFinanceSeries';
import { Loader }       from '../../components/Loader';
import { ExportButton } from '../../components/ExportButton';
import { ExportProvider } from '../../contexts/ExportContext';

function DeltaBadge({ value, invert = false }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={`font-semibold ${good ? 'text-emerald-600' : 'text-red-500'}`}>
      {value >= 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function PeriodSelector({ label, color, year, setYear, startMonth, setStartMonth, endMonth, setEndMonth }) {
  const currentYear = new Date().getFullYear();
  const cls = 'text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400';
  return (
    <div className={`bg-white rounded-xl border-2 shadow-panel p-4 space-y-3 ${color}`}>
      <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className={cls}>
          {[currentYear-3,currentYear-2,currentYear-1,currentYear,currentYear+1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))} className={cls}>
          {MONTHS_SHORT.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <span className="text-xs text-slate-400">até</span>
        <select value={endMonth} onChange={e => {
          const v = Number(e.target.value);
          setEndMonth(v < startMonth ? startMonth : v);
        }} className={cls}>
          {MONTHS_SHORT.map((m, i) => (
            <option key={i+1} value={i+1} disabled={i+1 < startMonth}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // ── Draft states — editáveis sem disparar fetch ────────────────────────────
  const [draftYearA,       setDraftYearA]       = useState(currentYear);
  const [draftStartMonthA, setDraftStartMonthA] = useState(1);
  const [draftEndMonthA,   setDraftEndMonthA]   = useState(currentMonth);
  const [draftYearB,       setDraftYearB]       = useState(currentYear - 1);
  const [draftStartMonthB, setDraftStartMonthB] = useState(1);
  const [draftEndMonthB,   setDraftEndMonthB]   = useState(currentMonth);

  // ── Committed states — disparam useFinanceSeries ───────────────────────────
  const [yearA,       setYearA]       = useState(currentYear);
  const [startMonthA, setStartMonthA] = useState(1);
  const [endMonthA,   setEndMonthA]   = useState(currentMonth);
  const [yearB,       setYearB]       = useState(currentYear - 1);
  const [startMonthB, setStartMonthB] = useState(1);
  const [endMonthB,   setEndMonthB]   = useState(currentMonth);

  const hasPending =
    draftYearA !== yearA || draftStartMonthA !== startMonthA || draftEndMonthA !== endMonthA ||
    draftYearB !== yearB || draftStartMonthB !== startMonthB || draftEndMonthB !== endMonthB;

  function applyChanges() {
    setYearA(draftYearA);       setStartMonthA(draftStartMonthA); setEndMonthA(draftEndMonthA);
    setYearB(draftYearB);       setStartMonthB(draftStartMonthB); setEndMonthB(draftEndMonthB);
  }

  const seriesA = useFinanceSeries({ year: yearA, startMonth: startMonthA, endMonth: endMonthA, recurso: 'resultado' });
  const seriesB = useFinanceSeries({ year: yearB, startMonth: startMonthB, endMonth: endMonthB, recurso: 'resultado' });

  const compare = useMemo(() => compareKPIs(seriesA.rows, seriesB.rows), [seriesA.rows, seriesB.rows]);
  const byAccA  = useMemo(() => compareByAccount(seriesA.rows, seriesB.rows, 'despesa'), [seriesA.rows, seriesB.rows]);

  const labelA = startMonthA === endMonthA
    ? `${MONTHS_SHORT[startMonthA-1]}/${yearA}`
    : `${MONTHS_SHORT[startMonthA-1]}–${MONTHS_SHORT[endMonthA-1]}/${yearA}`;
  const labelB = startMonthB === endMonthB
    ? `${MONTHS_SHORT[startMonthB-1]}/${yearB}`
    : `${MONTHS_SHORT[startMonthB-1]}–${MONTHS_SHORT[endMonthB-1]}/${yearB}`;

  const loading = seriesA.loading || seriesB.loading;

  const exportSections = useMemo(() => [
    {
      title: `KPIs Comparativos — ${labelA} vs ${labelB}`,
      columns: [
        { key: 'indicador', label: 'Indicador',  type: 'text'    },
        { key: 'valorA',    label: labelA,        type: 'currency' },
        { key: 'valorB',    label: labelB,        type: 'currency' },
      ],
      rows: [
        { indicador: 'Receita',   valorA: compare.a.receita,   valorB: compare.b.receita   },
        { indicador: 'Despesa',   valorA: compare.a.despesa,   valorB: compare.b.despesa   },
        { indicador: 'Resultado', valorA: compare.a.resultado, valorB: compare.b.resultado },
      ],
    },
    {
      title: 'Variação de Despesas por Conta',
      columns: [
        { key: 'account',  label: 'Conta',   type: 'text'     },
        { key: 'valueA',   label: labelA,    type: 'currency' },
        { key: 'valueB',   label: labelB,    type: 'currency' },
        { key: 'delta',    label: 'Δ Valor', type: 'currency' },
        { key: 'deltaPct', label: 'Δ %',     type: 'percent'  },
      ],
      rows: byAccA.slice(0, 50).map(a => ({
        ...a,
        deltaPct: a.deltaPct ?? 0,
      })),
    },
  ], [compare, byAccA, labelA, labelB]);

  const exportCtx = {
    startDate: `${yearA}-${String(startMonthA).padStart(2,'0')}-01`,
    endDate:   `${yearA}-${String(endMonthA).padStart(2,'0')}-28`,
    qualPeriodo: 'DRE',
    nSistema:    'Financeiro',
    filters:     {},
  };

  const kpiRows = [
    { label: 'Receita',           a: compare.a.receita,         b: compare.b.receita,         delta: compare.deltaReceita,     color: 'text-emerald-700', invert: false },
    { label: 'Custo Serviços',    a: compare.a.csv,             b: compare.b.csv,             delta: compare.deltaCsv,         color: 'text-violet-700',  invert: true  },
    { label: 'Rec. Líquida %',    a: compare.a.margemBrutaPct,  b: compare.b.margemBrutaPct,  delta: compare.deltaMargemBruta, color: 'text-indigo-700',  invert: false, isPct: true },
    { label: 'Despesa Total',     a: compare.a.despesa,         b: compare.b.despesa,         delta: compare.deltaDespesa,     color: 'text-red-600',     invert: true  },
    { label: 'Resultado',         a: compare.a.resultado,       b: compare.b.resultado,       delta: compare.deltaResultado,   color: 'text-blue-700',    invert: false },
    { label: 'Margem Líquida %',  a: compare.a.margem,          b: compare.b.margem,          delta: compare.deltaMargem,      color: 'text-indigo-600',  invert: false, isPct: true },
  ];

  return (
    <ExportProvider value={exportCtx}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-800">Comparativos de Período</h1>
        {!loading && <ExportButton title="Comparativos Financeiro" slug="financeiro-compare" sections={exportSections} />}
      </div>

      {/* Seletores + Aplicar */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PeriodSelector
            label="Período A" color="border-blue-200"
            year={draftYearA}       setYear={setDraftYearA}
            startMonth={draftStartMonthA} setStartMonth={setDraftStartMonthA}
            endMonth={draftEndMonthA}     setEndMonth={setDraftEndMonthA}
          />
          <PeriodSelector
            label="Período B" color="border-slate-200"
            year={draftYearB}       setYear={setDraftYearB}
            startMonth={draftStartMonthB} setStartMonth={setDraftStartMonthB}
            endMonth={draftEndMonthB}     setEndMonth={setDraftEndMonthB}
          />
        </div>

        <div className="flex items-center justify-between">
          {hasPending ? (
            <p className="text-xs text-amber-600 font-medium">
              Alterações pendentes — clique em Aplicar para carregar os dados.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              {!loading && seriesA.rows.length > 0
                ? `${labelA}: ${seriesA.rows.length} lançtos · ${labelB}: ${seriesB.rows.length} lançtos`
                : ' '}
            </p>
          )}
          <button
            onClick={applyChanges}
            disabled={!hasPending}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
              hasPending
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-default'
            }`}>
            Aplicar
          </button>
        </div>
      </div>

      {loading && <Loader />}

      {!loading && (
        <>
          {/* Tabela KPI comparativo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">KPIs — {labelA} vs {labelB}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs">
                  <th className="pb-2 text-left font-semibold">Indicador</th>
                  <th className="pb-2 text-right font-semibold text-blue-600">{labelA}</th>
                  <th className="pb-2 text-right font-semibold text-slate-500">{labelB}</th>
                  <th className="pb-2 text-right font-semibold">Variação</th>
                </tr>
              </thead>
              <tbody>
                {kpiRows.map(row => (
                  <tr key={row.label} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-700">{row.label}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${row.color}`}>
                      {row.isPct ? PCTFMT(row.a) : BRLFULL(row.a)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {row.isPct ? PCTFMT(row.b) : BRLFULL(row.b)}
                    </td>
                    <td className="py-2 text-right text-xs">
                      {row.isPct
                        ? <span className={`font-semibold ${(row.delta ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(row.delta ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(row.delta ?? 0).toFixed(2)}pp</span>
                        : <DeltaBadge value={row.delta} invert={row.invert} />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gráfico comparativo de despesas por conta */}
          {byAccA.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Despesas por Categoria — {labelA} vs {labelB}</h2>
              <ResponsiveContainer width="100%" height={Math.max(260, byAccA.slice(0,15).length * 28)}>
                <BarChart
                  data={byAccA.slice(0, 15).map(a => ({
                    name: a.account.length > 30 ? a.account.slice(0, 30) + '…' : a.account,
                    [labelA]: a.valueA,
                    [labelB]: a.valueB,
                  }))}
                  layout="vertical"
                  margin={{ left: 180, right: 20, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={176} />
                  <Tooltip formatter={v => BRLFULL(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey={labelA} fill={FINANCE_COLORS.despesa}  radius={[0,2,2,0]} />
                  <Bar dataKey={labelB} fill="#94a3b8"                  radius={[0,2,2,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela variação por conta */}
          {byAccA.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5 overflow-x-auto">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Variação de Despesas por Conta</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="pb-2 text-left font-semibold">Conta</th>
                    <th className="pb-2 text-right font-semibold text-blue-600">{labelA}</th>
                    <th className="pb-2 text-right font-semibold text-slate-500">{labelB}</th>
                    <th className="pb-2 text-right font-semibold">Δ Valor</th>
                    <th className="pb-2 text-right font-semibold">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {byAccA.slice(0, 30).map(a => (
                    <tr key={a.account} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1.5 text-slate-700 max-w-[220px]"><span className="block truncate" title={a.account}>{a.account}</span></td>
                      <td className="py-1.5 text-right tabular-nums text-red-600 font-semibold">{BRLFULL(a.valueA)}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-500">{BRLFULL(a.valueB)}</td>
                      <td className={`py-1.5 text-right tabular-nums font-semibold ${a.delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {a.delta > 0 ? '+' : ''}{BRLFULL(a.delta)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-xs">
                        <DeltaBadge value={a.deltaPct} invert />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
    </ExportProvider>
  );
}
