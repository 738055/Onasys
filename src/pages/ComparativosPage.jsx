import { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { calcKPIs, groupByClientOrVendor } from '../utils/aggregations';
import { BRLFULL, BRLk, SEGMENT_CFG } from '../utils/format';
import { ExportButton } from '../components/ExportButton';

const ISO   = d => d.toISOString().slice(0, 10);
const fmtBR = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

function firstOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function lastOf(d)  { return ISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function shift(d, n){ return new Date(d.getFullYear(), d.getMonth() + n, 1); }

const N           = new Date();
const todayStr    = ISO(N);
const lastYearStr = ISO(new Date(N.getFullYear() - 1, N.getMonth(), N.getDate()));

const PRESETS = [
  {
    label: 'Hoje vs mesmo dia ano passado',
    a: { start: todayStr,             end: todayStr             },
    b: { start: lastYearStr,          end: lastYearStr          },
  },
  {
    label: 'Mês atual vs mês anterior',
    a: { start: firstOf(N),           end: ISO(N)               },
    b: { start: firstOf(shift(N,-1)), end: lastOf(shift(N,-1))  },
  },
  {
    label: 'Mês atual vs mesmo mês ano passado',
    a: { start: firstOf(N),            end: ISO(N)                },
    b: { start: firstOf(shift(N,-12)), end: lastOf(shift(N,-12))  },
  },
  {
    label: 'Mês anterior vs mesmo mês ano passado',
    a: { start: firstOf(shift(N,-1)),  end: lastOf(shift(N,-1))   },
    b: { start: firstOf(shift(N,-13)), end: lastOf(shift(N,-13))  },
  },
];

const PERIOD_OPTS  = [{ label: 'Emitido', value: 1 }, { label: 'Realizado', value: 2 }];
const PROFILE_OPTS = [{ label: 'Emissivo', value: 0 }, { label: 'Receptivo', value: 1 }];

const DIM_OPTS = [
  { value: 'supplier', label: 'Fornecedor' },
  { value: 'vendor',   label: 'Emissor'    },
  { value: 'product',  label: 'Serviço'    },
  { value: 'channel',  label: 'Canal'      },
  { value: 'segment',  label: 'Segmento'   },
];

function pctDelta(a, b) {
  if (b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function DeltaCell({ a, b }) {
  const d = pctDelta(a, b);
  if (d === null) return <span className="text-slate-300">—</span>;
  if (Math.abs(d) < 0.1) return <span className="text-slate-400 tabular-nums">0%</span>;
  const up = d > 0;
  return (
    <span className={`flex items-center justify-end gap-0.5 font-semibold tabular-nums ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{d.toFixed(1)}%
    </span>
  );
}

function KpiCard({ title, aVal, bVal, format }) {
  const fmt = v => {
    if (format === 'currency') return BRLFULL(v);
    if (format === 'percent')  return `${Number(v).toFixed(2)}%`;
    return Number(v).toLocaleString('pt-BR');
  };
  const d    = pctDelta(aVal, bVal);
  const up   = d !== null && d > 0;
  const zero = d !== null && Math.abs(d) < 0.1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</p>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex-shrink-0">A</span>
          <span className="text-base font-bold text-slate-800 tabular-nums text-right">{fmt(aVal)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">B</span>
          <span className="text-sm text-slate-500 tabular-nums text-right">{fmt(bVal)}</span>
        </div>
      </div>
      {d !== null && !zero && (
        <div className={`mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {up ? '+' : ''}{d.toFixed(1)}%
          <span className="font-normal text-slate-400">A vs B</span>
        </div>
      )}
    </div>
  );
}

// ── PeriodConfig com draft/apply e indicador de pendência ──────────────────
function PeriodConfig({
  badge, badgeClass, label,
  draftStart, draftEnd, hasPending,
  onDraftStart, onDraftEnd, onApply,
  qual, sys, onQual, onSys,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-bold rounded px-1.5 py-0.5 ${badgeClass}`}>{badge}</span>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>

      {/* Datas + botão Aplicar */}
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          De
          <input
            type="date" value={draftStart} onChange={e => onDraftStart(e.target.value)}
            className={`border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 transition-colors ${
              hasPending
                ? 'border-amber-400 bg-amber-50 focus:ring-amber-400 text-amber-800'
                : 'border-slate-300 focus:ring-blue-400'
            }`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          Até
          <input
            type="date" value={draftEnd} onChange={e => onDraftEnd(e.target.value)}
            className={`border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 transition-colors ${
              hasPending
                ? 'border-amber-400 bg-amber-50 focus:ring-amber-400 text-amber-800'
                : 'border-slate-300 focus:ring-blue-400'
            }`}
          />
        </label>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onApply}
            disabled={!hasPending}
            className={`relative px-3 py-1 rounded text-xs font-semibold transition-all ${
              hasPending
                ? 'bg-amber-500 text-white shadow ring-2 ring-amber-300 ring-offset-1 hover:bg-amber-600'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {hasPending && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
            )}
            Aplicar
          </button>
          {hasPending && (
            <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">
              não aplicado
            </span>
          )}
        </div>
      </div>

      {/* Período + Perfil — selects segmentados */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded border border-slate-200 overflow-hidden text-xs">
          {PERIOD_OPTS.map((o, i) => (
            <button
              key={o.value} onClick={() => onQual(o.value)}
              className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                qual === o.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >{o.label}</button>
          ))}
        </div>
        <div className="flex rounded border border-slate-200 overflow-hidden text-xs">
          {PROFILE_OPTS.map((o, i) => (
            <button
              key={o.value} onClick={() => onSys(o.value)}
              className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                sys === o.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >{o.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ComparativosPage({ qualPeriodo = 2, nSistema = 1 }) {
  const segChartRef = useRef(null);

  // ── Período A — estados aplicados (disparam fetch) ──
  const [startA, setStartA] = useState(todayStr);
  const [endA,   setEndA]   = useState(todayStr);
  const [qualA,  setQualA]  = useState(qualPeriodo);
  const [sysA,   setSysA]   = useState(nSistema);

  // ── Período B ──
  const [startB, setStartB] = useState(lastYearStr);
  const [endB,   setEndB]   = useState(lastYearStr);
  const [qualB,  setQualB]  = useState(qualPeriodo);
  const [sysB,   setSysB]   = useState(nSistema);

  // ── Drafts de data (inputs não disparam fetch) ──
  const [draftStartA, setDraftStartA] = useState(todayStr);
  const [draftEndA,   setDraftEndA]   = useState(todayStr);
  const [draftStartB, setDraftStartB] = useState(lastYearStr);
  const [draftEndB,   setDraftEndB]   = useState(lastYearStr);

  const hasPendingA = draftStartA !== startA || draftEndA !== endA;
  const hasPendingB = draftStartB !== startB || draftEndB !== endB;

  function applyA() { setStartA(draftStartA); setEndA(draftEndA); }
  function applyB() { setStartB(draftStartB); setEndB(draftEndB); }

  const [dim, setDim] = useState('supplier');

  const { rows: rowsA, loading: loadingA } = useDashboardData({
    startDate: startA, endDate: endA, qualPeriodo: qualA, nSistema: sysA,
  });
  const { rows: rowsB, loading: loadingB } = useDashboardData({
    startDate: startB, endDate: endB, qualPeriodo: qualB, nSistema: sysB,
  });

  const kpiA = useMemo(() => calcKPIs(rowsA), [rowsA]);
  const kpiB = useMemo(() => calcKPIs(rowsB), [rowsB]);

  const segmentChart = useMemo(() => {
    const a = groupByClientOrVendor(rowsA, 'segment');
    const b = groupByClientOrVendor(rowsB, 'segment');
    const bMap = Object.fromEntries(b.map(x => [x.name, x]));
    const allNames = [...new Set([...a.map(x => x.name), ...b.map(x => x.name)])];
    return allNames
      .map(name => ({
        name: SEGMENT_CFG[name]?.label || name || '(outro)',
        A: a.find(x => x.name === name)?.revenue || 0,
        B: bMap[name]?.revenue || 0,
      }))
      .sort((x, y) => (y.A + y.B) - (x.A + x.B))
      .slice(0, 8);
  }, [rowsA, rowsB]);

  const dimTable = useMemo(() => {
    const a = groupByClientOrVendor(rowsA, dim);
    const b = groupByClientOrVendor(rowsB, dim);
    const aMap = Object.fromEntries(a.map(x => [x.name, x]));
    const bMap = Object.fromEntries(b.map(x => [x.name, x]));
    const allNames = [...new Set([...a.map(x => x.name), ...b.map(x => x.name)])];
    return allNames
      .map(name => ({
        name,
        ra: aMap[name] || { revenue: 0, profitLiquido: 0, profit: 0, rentPct: null },
        rb: bMap[name] || { revenue: 0, profitLiquido: 0, profit: 0, rentPct: null },
      }))
      .sort((x, y) => (y.ra.revenue + y.rb.revenue) - (x.ra.revenue + x.rb.revenue));
  }, [rowsA, rowsB, dim]);

  // Preset aplica nos dois estados (applied + draft)
  function applyPreset(p) {
    setStartA(p.a.start); setEndA(p.a.end);
    setStartB(p.b.start); setEndB(p.b.end);
    setDraftStartA(p.a.start); setDraftEndA(p.a.end);
    setDraftStartB(p.b.start); setDraftEndB(p.b.end);
  }

  const loading  = loadingA || loadingB;
  const labelA   = `${fmtBR(startA)} – ${fmtBR(endA)}`;
  const labelB   = `${fmtBR(startB)} – ${fmtBR(endB)}`;
  const dimLabel = DIM_OPTS.find(d => d.value === dim)?.label || dim;

  return (
    <div className="space-y-6">

      {/* Config panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-5">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-600 hover:text-blue-700 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PeriodConfig
            badge="A" badgeClass="bg-blue-600 text-white"
            label="Período comparado"
            draftStart={draftStartA} draftEnd={draftEndA}
            hasPending={hasPendingA}
            onDraftStart={setDraftStartA} onDraftEnd={setDraftEndA}
            onApply={applyA}
            qual={qualA} sys={sysA}
            onQual={setQualA} onSys={setSysA}
          />
          <PeriodConfig
            badge="B" badgeClass="bg-slate-500 text-white"
            label="Período base"
            draftStart={draftStartB} draftEnd={draftEndB}
            hasPending={hasPendingB}
            onDraftStart={setDraftStartB} onDraftEnd={setDraftEndB}
            onApply={applyB}
            qual={qualB} sys={sysB}
            onQual={setQualB} onSys={setSysB}
          />
        </div>

        {loading && (
          <p className="text-xs text-slate-400 animate-pulse mt-4">Carregando dados dos dois períodos…</p>
        )}
      </div>

      {/* KPI cards */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            <span className="font-bold text-blue-500">A</span>: {labelA}
            &nbsp;·&nbsp;
            <span className="font-bold text-slate-500">B</span>: {labelB}
          </p>
          <ExportButton
            title="KPIs Comparativos A vs B"
            slug="comp-kpis"
            sections={[{
              title: `KPIs Comparativos — A: ${labelA} vs B: ${labelB}`,
              columns: [
                { key: 'indicador', label: 'Indicador',      type: 'text' },
                { key: 'aFmt',      label: `A (${labelA})`,  type: 'text' },
                { key: 'bFmt',      label: `B (${labelB})`,  type: 'text' },
                { key: 'delta',     label: 'Δ %',            type: 'text' },
              ],
              rows: [
                { indicador: 'Faturamento', aFmt: BRLFULL(kpiA.revenue),       bFmt: BRLFULL(kpiB.revenue),       delta: pctDelta(kpiA.revenue, kpiB.revenue) != null          ? `${pctDelta(kpiA.revenue, kpiB.revenue).toFixed(1)}%`          : '-' },
                { indicador: 'Líquido',     aFmt: BRLFULL(kpiA.profitLiquido), bFmt: BRLFULL(kpiB.profitLiquido), delta: pctDelta(kpiA.profitLiquido, kpiB.profitLiquido) != null ? `${pctDelta(kpiA.profitLiquido, kpiB.profitLiquido).toFixed(1)}%` : '-' },
                { indicador: '% Margem',    aFmt: `${kpiA.margin.toFixed(2)}%`,bFmt: `${kpiB.margin.toFixed(2)}%`,delta: '-' },
                { indicador: 'Passageiros', aFmt: kpiA.uniquePassengers.toLocaleString('pt-BR'), bFmt: kpiB.uniquePassengers.toLocaleString('pt-BR'), delta: pctDelta(kpiA.uniquePassengers, kpiB.uniquePassengers) != null ? `${pctDelta(kpiA.uniquePassengers, kpiB.uniquePassengers).toFixed(1)}%` : '-' },
                { indicador: 'Nº Vendas',   aFmt: kpiA.uniqueSales.toLocaleString('pt-BR'),      bFmt: kpiB.uniqueSales.toLocaleString('pt-BR'),      delta: pctDelta(kpiA.uniqueSales, kpiB.uniqueSales) != null          ? `${pctDelta(kpiA.uniqueSales, kpiB.uniqueSales).toFixed(1)}%`          : '-' },
              ],
            }]}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard title="Faturamento"  aVal={kpiA.revenue}          bVal={kpiB.revenue}          format="currency" />
          <KpiCard title="Líquido"      aVal={kpiA.profitLiquido}    bVal={kpiB.profitLiquido}    format="currency" />
          <KpiCard title="% Margem"     aVal={kpiA.margin}           bVal={kpiB.margin}           format="percent"  />
          <KpiCard title="Passageiros"  aVal={kpiA.uniquePassengers} bVal={kpiB.uniquePassengers} format="number"   />
          <KpiCard title="Nº Vendas"    aVal={kpiA.uniqueSales}      bVal={kpiB.uniqueSales}      format="number"   />
        </div>
      </div>

      {/* Segment chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700">Faturamento por Segmento</h2>
          <ExportButton
            title="Faturamento por Segmento A vs B"
            slug="comp-segmentos"
            chartRef={segChartRef}
            sections={[{
              title: 'Faturamento por Segmento — A vs B',
              chartRef: segChartRef,
              columns: [
                { key: 'name', label: 'Segmento',           type: 'text'     },
                { key: 'A',    label: `Fat. A (${labelA})`, type: 'currency', total: true },
                { key: 'B',    label: `Fat. B (${labelB})`, type: 'currency', total: true },
              ],
              rows: segmentChart,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">
          <span className="inline-block w-3 h-2 rounded-sm bg-blue-500 mr-1.5 align-middle" />A: {labelA}
          &nbsp;&nbsp;
          <span className="inline-block w-3 h-2 rounded-sm bg-slate-400 mr-1.5 align-middle" />B: {labelB}
        </p>
        {segmentChart.every(s => s.A === 0 && s.B === 0) ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados para comparar.</p>
        ) : (
          <div ref={segChartRef}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={segmentChart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={BRLk} tick={{ fontSize: 10 }} width={58} />
                <Tooltip formatter={(v, name) => [BRLFULL(v), `Período ${name}`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={name => `Período ${name} — ${name === 'A' ? labelA : labelB}`} />
                <Bar dataKey="A" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="B" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Dimension table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              Comparativo por <span className="text-blue-600">{dimLabel}</span>
              <span className="ml-2 text-slate-400 font-normal text-xs">({dimTable.length} registros)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Ordenado por volume total (A + B)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
              {DIM_OPTS.map((o, i) => (
                <button
                  key={o.value}
                  onClick={() => setDim(o.value)}
                  className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                    dim === o.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <ExportButton
              title={`Comparativo por ${dimLabel}`}
              slug="comp-dimensao"
              sections={[{
                title: `Comparativo por ${dimLabel}`,
                columns: [
                  { key: 'name', label: dimLabel,    type: 'text'     },
                  { key: 'fatA', label: `Fat. A`,    type: 'currency', total: true },
                  { key: 'fatB', label: `Fat. B`,    type: 'currency', total: true },
                  { key: 'liqA', label: `Líq. A`,    type: 'currency', total: true },
                  { key: 'liqB', label: `Líq. B`,    type: 'currency', total: true },
                  { key: 'pctA', label: `% Marg. A`, type: 'percent'  },
                  { key: 'pctB', label: `% Marg. B`, type: 'percent'  },
                ],
                rows: dimTable.map(({ name, ra, rb }) => ({
                  name:  dim === 'segment' ? (SEGMENT_CFG[name]?.label || name) : name,
                  fatA:  ra.revenue,       fatB: rb.revenue,
                  liqA:  ra.profitLiquido, liqB: rb.profitLiquido,
                  pctA:  ra.rentPct,       pctB: rb.rentPct,
                })),
              }]}
            />
          </div>
        </div>

        {dimTable.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados para comparar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="pb-2 pr-3 font-semibold">#</th>
                  <th className="pb-2 pr-3 font-semibold">{dimLabel}</th>
                  <th className="pb-2 pr-3 font-semibold text-right text-blue-500">Fat. A</th>
                  <th className="pb-2 pr-3 font-semibold text-right text-slate-400">Fat. B</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Δ Fat.</th>
                  <th className="pb-2 pr-3 font-semibold text-right text-blue-500">Líq. A</th>
                  <th className="pb-2 pr-3 font-semibold text-right text-slate-400">Líq. B</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Δ Líq.</th>
                  <th className="pb-2 pr-3 font-semibold text-right text-blue-500">% A</th>
                  <th className="pb-2 font-semibold text-right text-slate-400">% B</th>
                </tr>
              </thead>
              <tbody>
                {dimTable.map(({ name, ra, rb }, i) => (
                  <tr key={name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium text-slate-700 max-w-[14rem] truncate" title={name}>
                      {dim === 'segment' ? (SEGMENT_CFG[name]?.label || name) : name}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-700 tabular-nums">{BRLFULL(ra.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-400 tabular-nums">{BRLFULL(rb.revenue)}</td>
                    <td className="py-2 pr-3 text-right"><DeltaCell a={ra.revenue} b={rb.revenue} /></td>
                    <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${ra.profitLiquido < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {BRLFULL(ra.profitLiquido)}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${rb.profitLiquido < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {BRLFULL(rb.profitLiquido)}
                    </td>
                    <td className="py-2 pr-3 text-right"><DeltaCell a={ra.profitLiquido} b={rb.profitLiquido} /></td>
                    <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${ra.rentPct !== null && ra.rentPct < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {ra.rentPct !== null ? `${ra.rentPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${rb.rentPct !== null && rb.rentPct < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {rb.rentPct !== null ? `${rb.rentPct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
