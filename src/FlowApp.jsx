import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts';
import { Download, Search } from 'lucide-react';
import { useDashboardData } from './hooks/useDashboardData';
import { InfoTooltip } from './components/InfoTooltip';
import { SEGMENT_CFG, PAX_CATEGORY_CFG } from './utils/format';
import { PaxCompositionBar } from './components/PaxCompositionBar';

const MONTH_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DOW_PT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const WEEKEND = new Set([0, 6]);
const PAGE_SIZE = 50;

function paxColor(pax, maxPax, isAlert) {
  if (!pax || !maxPax) return { bg: '#f1f5f9', fg: '#cbd5e1' };
  const t = pax / maxPax;
  if (isAlert) {
    if (t < 0.5)  return { bg: '#fed7aa', fg: '#9a3412' };
    if (t < 0.75) return { bg: '#f97316', fg: '#ffffff' };
    return              { bg: '#dc2626', fg: '#fecaca' };
  }
  if (t < 0.20) return { bg: '#dbeafe', fg: '#1e40af' };
  if (t < 0.40) return { bg: '#93c5fd', fg: '#1e3a8a' };
  if (t < 0.65) return { bg: '#3b82f6', fg: '#ffffff' };
  if (t < 0.85) return { bg: '#1d4ed8', fg: '#ffffff' };
  return              { bg: '#1e3a8a', fg: '#bfdbfe' };
}

function FlowTooltip({ active, payload, monthName }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const breakdown = { adt: d.paxAdt, chd: d.paxChd, colo: d.paxColo, red: d.paxRed, sen: d.paxSen, free: d.paxFree };
  const hasBreakdown = PAX_CATEGORY_CFG.some(c => (breakdown[c.key] || 0) > 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow text-xs min-w-[140px]">
      <p className="font-bold text-slate-700 mb-1">
        {d.day} de {monthName}
        {d.isAlert && <span className="ml-1.5 text-orange-500">⚠ alerta</span>}
      </p>
      <p className="text-blue-600 font-semibold">{d.pax.toLocaleString('pt-BR')} pax</p>
      {d.services > 0 && <p className="text-slate-400 mb-1">{d.services} serviços</p>}
      {hasBreakdown && (
        <div className="mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5">
          {PAX_CATEGORY_CFG.map(c => {
            const v = breakdown[c.key] || 0;
            if (v === 0) return null;
            return (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-slate-500">{c.labelLong}</span>
                </span>
                <span className="font-semibold text-slate-700 tabular-nums">{v.toLocaleString('pt-BR')}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompareTooltip({ active, payload, label, nameA, nameB, monthName }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-1.5">Dia {label} de {monthName}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5" style={{ color: p.stroke }}>
          <span className="max-w-[110px] truncate" title={p.dataKey === 'paxA' ? nameA : nameB}>
            {p.dataKey === 'paxA' ? (nameA || 'A') : (nameB || 'B')}
          </span>
          <span className="font-bold tabular-nums">{(p.value || 0).toLocaleString('pt-BR')} pax</span>
        </div>
      ))}
    </div>
  );
}

function FlowDot({ cx, cy, payload }) {
  if (!payload?.pax) return null;
  return (
    <circle cx={cx} cy={cy} r={payload.isAlert ? 5 : 3}
      fill={payload.isAlert ? '#f97316' : '#3b82f6'} stroke="#fff" strokeWidth={1.5} />
  );
}

function SortTh({ col, label, current, dir, onSort, align = 'left' }) {
  const active = current === col;
  return (
    <th onClick={() => onSort(col)}
      className={`pb-2 pr-3 font-semibold cursor-pointer select-none hover:text-slate-700 whitespace-nowrap ${align === 'right' ? 'text-right' : ''}`}>
      {label}
      <span className="ml-0.5 text-[10px] text-slate-300">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

function DeltaBadge({ curr, prev }) {
  if (prev == null || prev === 0 || curr == null) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const up  = pct >= 0;
  return (
    <span className={`text-[10px] font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs anterior
    </span>
  );
}

function calcProductStats(rows, product) {
  if (!product) return null;
  const map = {};
  for (const r of rows) {
    if (!r.checkinDate || r.product !== product) continue;
    const d = r.checkinDate.getDate();
    map[d] = (map[d] || 0) + r.passengers;
  }
  const entries = Object.entries(map);
  if (!entries.length) return { total: 0, peak: 0, peakDay: null, avg: 0, activeDays: 0 };
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const peak  = [...entries].sort((a, b) => b[1] - a[1])[0];
  return { total, peak: Number(peak[1]), peakDay: Number(peak[0]), avg: total / entries.length, activeDays: entries.length };
}

export default function FlowApp() {
  const now = new Date();
  const [year,             setYear]             = useState(now.getFullYear());
  const [month,            setMonth]            = useState(now.getMonth());
  const [nSistema,         setNSistema]         = useState(1);
  const [draftNSistema,    setDraftNSistema]    = useState(1);
  const [selectedDay,      setSelectedDay]      = useState(null);
  const [viewMode,         setViewMode]         = useState('resumo');
  const [sortCol,          setSortCol]          = useState('product');
  const [sortDir,          setSortDir]          = useState('asc');
  const [detailPage,       setDetailPage]       = useState(0);
  const [alertMultiplier,  setAlertMultiplier]  = useState(1.5);
  const [selectedSegments, setSelectedSegments] = useState(new Set());
  const [detailSearch,     setDetailSearch]     = useState('');
  const [compareA,         setCompareA]         = useState('');
  const [compareB,         setCompareB]         = useState('');

  const { startDate, endDate, daysInMonth, firstDow } = useMemo(() => {
    const pad     = n => String(n).padStart(2, '0');
    const lastDay = new Date(year, month + 1, 0);
    return {
      startDate:   `${year}-${pad(month + 1)}-01`,
      endDate:     `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`,
      daysInMonth: lastDay.getDate(),
      firstDow:    new Date(year, month, 1).getDay(),
    };
  }, [year, month]);

  const prevMonthStartEnd = useMemo(() => {
    const pad = n => String(n).padStart(2, '0');
    let py = year, pm = month - 1;
    if (pm < 0) { py--; pm = 11; }
    const lastDay = new Date(py, pm + 1, 0).getDate();
    return { startDate: `${py}-${pad(pm + 1)}-01`, endDate: `${py}-${pad(pm + 1)}-${pad(lastDay)}` };
  }, [year, month]);

  const todayDay = (now.getFullYear() === year && now.getMonth() === month) ? now.getDate() : null;

  const { rows: allRows, loading, error } = useDashboardData({ startDate, endDate, qualPeriodo: 1, nSistema });
  const { rows: prevAllRows } = useDashboardData({ startDate: prevMonthStartEnd.startDate, endDate: prevMonthStartEnd.endDate, qualPeriodo: 1, nSistema });

  useEffect(() => { setSelectedDay(null); setDetailSearch(''); }, [startDate, endDate, nSistema]);
  useEffect(() => { setDetailPage(0); }, [selectedDay, viewMode, detailSearch, selectedSegments]);

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }
  function handleSort(col) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }
  function toggleSegment(seg) {
    setSelectedSegments(prev => {
      const next = new Set(prev);
      next.has(seg) ? next.delete(seg) : next.add(seg);
      return next;
    });
  }

  // ── Segment filter ──────────────────────────────────────────
  const uniqueSegments = useMemo(() => [...new Set(allRows.map(r => r.segment).filter(Boolean))].sort(), [allRows]);

  // Reembolso aprovado (status=28) = pax não vai — excluído do fluxo operacional.
  // O item original correspondente já tem num_pax=0, então não há dupla contagem.
  const filteredRows = useMemo(() =>
    allRows.filter(r => {
      if (r.idStatusServico === 28) return false;
      if (selectedSegments.size > 0 && !selectedSegments.has(r.segment)) return false;
      return true;
    }),
  [allRows, selectedSegments]);

  const prevFilteredRows = useMemo(() =>
    prevAllRows.filter(r => {
      if (r.idStatusServico === 28) return false;
      if (selectedSegments.size > 0 && !selectedSegments.has(r.segment)) return false;
      return true;
    }),
  [prevAllRows, selectedSegments]);

  // ── Daily pax ───────────────────────────────────────────────
  const dailyPax = useMemo(() => {
    const map = {};
    for (const r of filteredRows) {
      if (!r.checkinDate) continue;
      const d = r.checkinDate.getDate();
      if (!map[d]) map[d] = {
        pax: 0, services: new Set(),
        // Breakdown por categoria
        paxAdt: 0, paxChd: 0, paxColo: 0, paxRed: 0, paxSen: 0, paxFree: 0,
      };
      map[d].pax += r.passengers;
      if (r.product) map[d].services.add(r.product);
      // Acumula breakdown
      map[d].paxAdt  += r.paxAdt  || 0;
      map[d].paxChd  += r.paxChd  || 0;
      map[d].paxColo += r.paxColo || 0;
      map[d].paxRed  += r.paxRed  || 0;
      map[d].paxSen  += r.paxSen  || 0;
      map[d].paxFree += r.paxFree || 0;
    }
    return map;
  }, [filteredRows]);

  const prevDailyPax = useMemo(() => {
    const map = {};
    for (const r of prevFilteredRows) {
      if (!r.checkinDate) continue;
      const d = r.checkinDate.getDate();
      if (!map[d]) map[d] = { pax: 0 };
      map[d].pax += r.passengers;
    }
    return map;
  }, [prevFilteredRows]);

  const maxDayPax = useMemo(() => Math.max(0, ...Object.values(dailyPax).map(v => v.pax)), [dailyPax]);

  const { avgPax, alertThreshold, alertDays } = useMemo(() => {
    const vals = Object.values(dailyPax).map(v => v.pax);
    if (!vals.length) return { avgPax: 0, alertThreshold: 0, alertDays: new Set() };
    const avg       = vals.reduce((s, v) => s + v, 0) / vals.length;
    const threshold = avg * alertMultiplier;
    const alerts    = new Set(Object.entries(dailyPax).filter(([, v]) => v.pax >= threshold && threshold > 0).map(([d]) => Number(d)));
    return { avgPax: avg, alertThreshold: threshold, alertDays: alerts };
  }, [dailyPax, alertMultiplier]);

  // ── KPIs ────────────────────────────────────────────────────
  const totalPax     = useMemo(() => Object.values(dailyPax).reduce((s, v) => s + v.pax, 0), [dailyPax]);
  const daysWithData = Object.keys(dailyPax).length;

  const prevKPIs = useMemo(() => {
    const vals  = Object.values(prevDailyPax).map(v => v.pax);
    const total = vals.reduce((s, v) => s + v, 0);
    const days  = vals.length;
    const avg   = days > 0 ? total / days : 0;
    const thr   = avg * alertMultiplier;
    return { totalPax: total, daysWithData: days, avgPax: avg, alertCount: thr > 0 ? vals.filter(v => v >= thr).length : 0 };
  }, [prevDailyPax, alertMultiplier]);

  // ── Chart + rows ─────────────────────────────────────────────
  const chartData = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1, info = dailyPax[day];
      return {
        day,
        pax:      info?.pax      ?? 0,
        services: info?.services?.size ?? 0,
        isAlert:  alertDays.has(day),
        // Breakdown por categoria (para o tooltip)
        paxAdt:  info?.paxAdt  ?? 0,
        paxChd:  info?.paxChd  ?? 0,
        paxColo: info?.paxColo ?? 0,
        paxRed:  info?.paxRed  ?? 0,
        paxSen:  info?.paxSen  ?? 0,
        paxFree: info?.paxFree ?? 0,
      };
    }),
  [daysInMonth, dailyPax, alertDays]);

  const dayRows = useMemo(() =>
    selectedDay ? filteredRows.filter(r => r.checkinDate && r.checkinDate.getDate() === selectedDay) : filteredRows,
  [filteredRows, selectedDay]);

  const serviceGroups = useMemo(() => {
    const map = {};
    for (const r of dayRows) {
      const key = r.product || '(sem nome)';
      if (!map[key]) map[key] = { name: key, pax: 0, count: 0, types: new Set() };
      map[key].pax += r.passengers;
      map[key].count++;
      if (r.saleType) map[key].types.add(r.saleType);
    }
    return Object.values(map).sort((a, b) => b.pax - a.pax);
  }, [dayRows]);

  const detailRows = useMemo(() => [...dayRows].sort((a, b) => {
    let cmp = 0;
    if      (sortCol === 'product')     cmp = (a.product  || '').localeCompare(b.product  || '');
    else if (sortCol === 'saleType')    cmp = (a.saleType || '').localeCompare(b.saleType || '');
    else if (sortCol === 'passengers')  cmp = a.passengers - b.passengers;
    else if (sortCol === 'checkinDate') cmp = (a.checkinDate?.getTime() || 0) - (b.checkinDate?.getTime() || 0);
    if (cmp === 0) cmp = (a.seqId || '').localeCompare(b.seqId || '');
    return sortDir === 'asc' ? cmp : -cmp;
  }), [dayRows, sortCol, sortDir]);

  const detailRowsSearched = useMemo(() => {
    const q = detailSearch.trim().toLowerCase();
    if (!q) return detailRows;
    return detailRows.filter(r =>
      (r.product  || '').toLowerCase().includes(q) ||
      (r.id       || '').toLowerCase().includes(q) ||
      (r.saleType || '').toLowerCase().includes(q) ||
      (r.segment  || '').toLowerCase().includes(q)
    );
  }, [detailRows, detailSearch]);

  // ── Compare ──────────────────────────────────────────────────
  const uniqueProducts = useMemo(() => [...new Set(filteredRows.map(r => r.product).filter(Boolean))].sort(), [filteredRows]);

  const compareChartData = useMemo(() => {
    const mapA = {}, mapB = {};
    for (const r of filteredRows) {
      if (!r.checkinDate) continue;
      const d = r.checkinDate.getDate();
      if (compareA && r.product === compareA) mapA[d] = (mapA[d] || 0) + r.passengers;
      if (compareB && r.product === compareB) mapB[d] = (mapB[d] || 0) + r.passengers;
    }
    return Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, paxA: mapA[i + 1] ?? 0, paxB: mapB[i + 1] ?? 0 }));
  }, [filteredRows, daysInMonth, compareA, compareB]);

  const statsA = useMemo(() => calcProductStats(filteredRows, compareA), [filteredRows, compareA]);
  const statsB = useMemo(() => calcProductStats(filteredRows, compareB), [filteredRows, compareB]);

  // ── Calendar ─────────────────────────────────────────────────
  const calendarWeeks = useMemo(() => {
    const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      const w = cells.slice(i, i + 7);
      while (w.length < 7) w.push(null);
      weeks.push(w);
    }
    return weeks;
  }, [firstDow, daysInMonth]);

  // ── Derived ──────────────────────────────────────────────────
  const peakEntry      = Object.entries(dailyPax).sort((a, b) => b[1].pax - a[1].pax)[0];
  const dayTotalPax    = dayRows.reduce((s, r) => s + r.passengers, 0);
  const totalResumoPax = serviceGroups.reduce((s, g) => s + g.pax, 0);
  const pageCount      = Math.max(1, Math.ceil(detailRowsSearched.length / PAGE_SIZE));
  const pageRows       = detailRowsSearched.slice(detailPage * PAGE_SIZE, (detailPage + 1) * PAGE_SIZE);
  const alertPctLabel  = `${Math.round(alertMultiplier * 100)}% da média`;

  function handleExportCSV() {
    const headers = ['#', 'Seq', 'Venda', 'Data IN', 'Serviço', 'Segmento', 'Tipo Venda', 'Pax'];
    const data = detailRowsSearched.map((r, i) => [
      i + 1, r.seqId || '', r.id || '',
      r.checkinDate ? r.checkinDate.toLocaleDateString('pt-BR') : '',
      r.product || '', r.segment || '', r.saleType || '', r.passengers,
    ]);
    const csv  = [headers, ...data].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fluxo-${selectedDay ? `dia${selectedDay}-` : ''}${MONTH_PT[month].toLowerCase()}-${year}-${nSistema === 0 ? 'emissivo' : 'receptivo'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Fluxo Operacional</h1>
            <p className="text-xs text-slate-400 mt-0.5">Pax por Data de Serviço (ddatain) &middot; ONASYS</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Perfil:</span>
            {[{ label: 'Emissivo', value: 0 }, { label: 'Receptivo', value: 1 }].map(p => {
              const isDraft   = p.value === draftNSistema;
              const isPending = isDraft && draftNSistema !== nSistema;
              return (
                <button key={p.value} onClick={() => setDraftNSistema(p.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isPending
                      ? 'bg-amber-400 text-white ring-2 ring-amber-300 ring-offset-1'
                      : isDraft
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {p.label}{isPending && <span className="ml-1 text-[10px] opacity-80">*</span>}
                </button>
              );
            })}
            {draftNSistema !== nSistema && (
              <button
                onClick={() => setNSistema(draftNSistema)}
                className="relative px-4 py-1.5 rounded text-sm font-semibold bg-amber-500 text-white shadow ring-2 ring-amber-300 ring-offset-1 hover:bg-amber-600 transition-all"
              >
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                Aplicar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Month nav */}
        <div className="flex items-center justify-center gap-6">
          <button onClick={prevMonth} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium">
            ‹ {MONTH_PT[(month + 11) % 12].slice(0, 3)}
          </button>
          <h2 className="text-lg font-bold text-slate-800 min-w-[210px] text-center">
            {MONTH_PT[month]} {year}
            {loading && <span className="ml-2 text-xs font-normal text-slate-400 animate-pulse">carregando…</span>}
          </h2>
          <button onClick={nextMonth} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium">
            {MONTH_PT[(month + 1) % 12].slice(0, 3)} ›
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Total Pax', value: totalPax.toLocaleString('pt-BR'),
              sub: 'no mês', color: 'text-slate-800',
              delta: { curr: totalPax, prev: prevKPIs.totalPax },
              tooltip: 'Soma de todos os passageiros com check-in (ddatain) no mês. Um mesmo grupo pode aparecer em mais de um serviço (Transfer + Passeio) — isso é intencional, pois cada serviço exige recursos separados.',
            },
            {
              label: 'Dias c/ Oper.', value: daysWithData,
              sub: `de ${daysInMonth} dias`, color: 'text-slate-800',
              delta: { curr: daysWithData, prev: prevKPIs.daysWithData },
              tooltip: 'Quantidade de dias no mês com pelo menos 1 passageiro com check-in registrado. Dias sem operação não entram na média.',
            },
            {
              label: 'Média / Dia', value: daysWithData ? Math.round(avgPax).toLocaleString('pt-BR') : '—',
              sub: 'pax por dia ativo', color: 'text-blue-700',
              delta: { curr: daysWithData ? avgPax : null, prev: prevKPIs.avgPax },
              tooltip: 'Total pax ÷ dias com operação. Base de cálculo para o limiar de alerta. Ex.: média 200 pax/dia + limiar 150% → alerta em dias com ≥ 300 pax.',
            },
            {
              label: 'Alertas', value: alertDays.size,
              sub: `dias ≥ ${alertPctLabel}`, color: alertDays.size > 0 ? 'text-orange-600' : 'text-slate-400',
              delta: { curr: alertDays.size, prev: prevKPIs.alertCount },
              tooltip: `Dias com pax ≥ ${alertPctLabel} da média diária. Ajuste o limiar abaixo para mais ou menos sensibilidade. Use para planejar vans e equipes extras com antecedência.`,
            },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-0.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
                <InfoTooltip text={k.tooltip} />
              </div>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
              <DeltaBadge curr={k.delta.curr} prev={k.delta.prev} />
            </div>
          ))}
        </div>

        {/* Threshold + Segment filter */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-0.5">
              Limiar de alerta
              <InfoTooltip text="Multiplica a média diária para definir o pico. 150% = dia com pax ≥ 1,5× a média vira alerta laranja. Ajuste conforme a variabilidade da sua operação." />
              :
            </span>
            <div className="flex rounded border border-slate-200 overflow-hidden text-xs">
              {[1.2, 1.5, 1.75, 2.0].map((v, i) => (
                <button key={v} onClick={() => setAlertMultiplier(v)}
                  className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${alertMultiplier === v ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {Math.round(v * 100)}%
                </button>
              ))}
            </div>
          </div>

          {uniqueSegments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 flex items-center gap-0.5">
                Segmento
                <InfoTooltip text="Filtra o calendário, gráfico e tabelas para um ou mais segmentos. 'Todos' mostra a operação completa. Útil para analisar Transfer, Hotel ou Aéreo separadamente e calcular recursos por tipo de serviço." />
                :
              </span>
              <button onClick={() => setSelectedSegments(new Set())}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedSegments.size === 0 ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Todos
              </button>
              {uniqueSegments.map(seg => (
                <button key={seg} onClick={() => toggleSegment(seg)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${selectedSegments.has(seg) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {SEGMENT_CFG[seg]?.label || seg}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Alert panel */}
        {alertDays.size > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-orange-800 mb-2">
              ⚠ {alertDays.size} {alertDays.size === 1 ? 'dia' : 'dias'} com pico de operação
            </p>
            <div className="flex flex-wrap gap-2">
              {[...alertDays].sort((a, b) => (dailyPax[b]?.pax ?? 0) - (dailyPax[a]?.pax ?? 0)).map(day => (
                <button key={day}
                  onClick={() => { setSelectedDay(prev => prev === day ? null : day); setViewMode('resumo'); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selectedDay === day ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100'
                  }`}>
                  <span>Dia {day}</span>
                  <span className="opacity-80">{dailyPax[day]?.pax.toLocaleString('pt-BR')} pax</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Flow chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-1 mb-1">
            <h3 className="text-sm font-semibold text-slate-700">Linha de Fluxo — Pax por Dia</h3>
            <InfoTooltip text="Evolução diária de passageiros com check-in no mês. Clique em qualquer ponto para filtrar o detalhamento abaixo para aquele dia. A linha tracejada cinza é a média do mês; a laranja é o limiar de alerta configurado." />
          </div>
          <p className="text-xs text-slate-400 mb-4">
            — — média &nbsp;·&nbsp; <span className="text-orange-500">— — limiar ({alertPctLabel})</span>
            &nbsp;·&nbsp; <span className="text-orange-500">●</span> alerta
            {selectedDay && <>&nbsp;·&nbsp;<span className="text-blue-700">| dia {selectedDay} selecionado</span></>}
          </p>
          {chartData.every(d => d.pax === 0) ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData}
                onClick={e => { const day = e?.activePayload?.[0]?.payload?.day; if (day) { setSelectedDay(prev => prev === day ? null : day); setViewMode('resumo'); } }}
                style={{ cursor: 'pointer' }}>
                <defs>
                  <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} tickFormatter={v => (v % 5 === 1 || v === daysInMonth) ? v : ''} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={36} axisLine={false} tickLine={false} />
                <Tooltip content={<FlowTooltip monthName={MONTH_PT[month]} />} />
                {avgPax > 0 && (
                  <ReferenceLine y={Math.round(avgPax)} stroke="#94a3b8" strokeDasharray="5 3" strokeWidth={1.5}
                    label={{ value: `avg ${Math.round(avgPax)}`, position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }} />
                )}
                {alertThreshold > 0 && (
                  <ReferenceLine y={Math.round(alertThreshold)} stroke="#f97316" strokeDasharray="5 3" strokeWidth={1.5}
                    label={{ value: `alerta ${Math.round(alertThreshold)}`, position: 'insideTopRight', fontSize: 9, fill: '#f97316' }} />
                )}
                {selectedDay && (
                  <ReferenceLine x={selectedDay} stroke="#1e3a8a" strokeWidth={1.5} strokeDasharray="4 3"
                    label={{ value: `dia ${selectedDay}`, position: 'insideTopLeft', fontSize: 9, fill: '#1e3a8a' }} />
                )}
                <Area dataKey="pax" stroke="#3b82f6" strokeWidth={0} fill="url(#flowGrad)" dot={false} activeDot={false} isAnimationActive={false} />
                <Line dataKey="pax" stroke="#3b82f6" strokeWidth={2.5} dot={<FlowDot />} activeDot={{ r: 6, fill: '#1d4ed8' }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Calendar heatmap */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold text-slate-700">Mapa de Calor — Pax por Dia</h3>
              <InfoTooltip text="Calendário colorido pela intensidade de pax. A intensidade é relativa ao pico do mês (dia mais cheio = azul escuro). Laranja/vermelho = dia em alerta. Rosa = fim de semana sem operação. Subtotais semanais aparecem abaixo de cada linha." />
            </div>
            {selectedDay && (
              <button onClick={() => setSelectedDay(null)} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 bg-blue-50">
                ✕ limpar
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Azul = normal &nbsp;·&nbsp; <span className="text-orange-500">Laranja/vermelho = alerta</span>
            &nbsp;·&nbsp; <span className="text-rose-300">Rosa = fim de semana</span>
            &nbsp;·&nbsp; clique para detalhar
          </p>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW_PT.map((d, i) => (
              <div key={d} className={`text-center text-[11px] font-semibold py-1 ${i === 0 || i === 6 ? 'text-rose-300' : 'text-slate-400'}`}>{d}</div>
            ))}
          </div>

          {calendarWeeks.map((week, wi) => {
            const weekPax    = week.filter(Boolean).reduce((s, day) => s + (dailyPax[day]?.pax ?? 0), 0);
            const weekAlerts = week.filter(Boolean).filter(day => alertDays.has(day)).length;
            return (
              <div key={wi} className="mb-1">
                <div className="grid grid-cols-7 gap-0.5">
                  {week.map((day, di) => {
                    if (!day) return <div key={`e-${wi}-${di}`} className="min-h-[68px]" />;
                    const dow        = (firstDow + day - 1) % 7;
                    const isWeekend  = WEEKEND.has(dow);
                    const info       = dailyPax[day];
                    const pax        = info?.pax ?? 0;
                    const isAlert    = alertDays.has(day);
                    const { bg, fg } = paxColor(pax, maxDayPax, isAlert);
                    const isSel      = selectedDay === day;
                    const isToday    = todayDay === day;
                    const cellBg     = isSel ? '#1e3a8a' : (pax === 0 && isWeekend ? '#fdf2f2' : bg);
                    const numColor   = isSel ? '#bfdbfe' : (pax === 0 && isWeekend ? '#fca5a5' : fg);
                    return (
                      <button key={day}
                        onClick={() => { setSelectedDay(isSel ? null : day); setViewMode('resumo'); }}
                        style={{ backgroundColor: cellBg }}
                        className={`min-h-[68px] rounded-lg p-1.5 text-left flex flex-col justify-between transition-all ${isToday && !isSel ? 'ring-2 ring-indigo-400 ring-offset-1' : ''} ${isSel ? 'ring-2 ring-blue-400 ring-offset-1' : 'hover:opacity-80'}`}>
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-bold leading-none" style={{ color: numColor }}>
                            {day}{isToday && !isSel && <span className="ml-0.5 text-[8px] text-indigo-500">●</span>}
                          </span>
                          {isAlert && <span className="text-[10px] leading-none" style={{ color: isSel ? '#fed7aa' : '#ea580c' }}>⚠</span>}
                        </div>
                        {pax > 0 ? (
                          <div>
                            <span className="text-sm font-bold tabular-nums block leading-tight" style={{ color: isSel ? '#ffffff' : fg }}>
                              {pax.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-[9px] block leading-none mt-0.5 opacity-70" style={{ color: isSel ? '#bfdbfe' : fg }}>
                              {info.services.size} serv.
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] opacity-20" style={{ color: numColor }}>—</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {weekPax > 0 && (
                  <div className="flex justify-end items-center gap-2 px-1 py-0.5 border-t border-slate-50">
                    <span className="text-[10px] text-slate-400">Semana {wi + 1}:</span>
                    <span className="text-[10px] font-bold text-slate-600 tabular-nums">{weekPax.toLocaleString('pt-BR')} pax</span>
                    {weekAlerts > 0 && <span className="text-[10px] text-orange-500 font-semibold">⚠ {weekAlerts}</span>}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">Menos</span>
            {['#dbeafe','#93c5fd','#3b82f6','#1d4ed8','#1e3a8a'].map(c => <div key={c} className="w-5 h-3 rounded-sm" style={{ backgroundColor: c }} />)}
            <span className="text-[11px] text-slate-400">Mais pax</span>
            <span className="mx-1 text-[11px] text-slate-300">|</span>
            {['#fed7aa','#f97316','#dc2626'].map(c => <div key={c} className="w-5 h-3 rounded-sm" style={{ backgroundColor: c }} />)}
            <span className="text-[11px] text-orange-500">Alerta</span>
            <span className="mx-1 text-[11px] text-slate-300">|</span>
            <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#fdf2f2' }} />
            <span className="text-[11px] text-rose-300">Fim de semana</span>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                {selectedDay ? `Serviços — Dia ${selectedDay} de ${MONTH_PT[month]}` : `Serviços — ${MONTH_PT[month]} ${year} (mês completo)`}
                {alertDays.has(selectedDay) && <span className="ml-2 text-xs text-orange-500 font-normal">⚠ dia em alerta</span>}
                <InfoTooltip text="'Por Serviço': agrupa por produto e mostra ranking de pax. 'Detalhado': lista cada item de venda individualmente com busca por texto e exportação CSV. 'Comparar': analisa dois serviços lado a lado com gráfico diário e estatísticas do mês." />
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {dayRows.length.toLocaleString('pt-BR')} vendas &middot; {dayTotalPax.toLocaleString('pt-BR')} pax total
                {selectedDay && peakEntry && <> &middot; pico do mês: dia {peakEntry[0]} ({peakEntry[1].pax.toLocaleString('pt-BR')} pax)</>}
              </p>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
              {[{ id: 'resumo', label: 'Por Serviço' }, { id: 'detalhe', label: 'Detalhado' }, { id: 'comparar', label: 'Comparar' }].map((opt, i) => (
                <button key={opt.id} onClick={() => setViewMode(opt.id)}
                  className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${viewMode === opt.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Por Serviço ── */}
          {dayRows.length === 0 && viewMode !== 'comparar' ? (
            <p className="text-xs text-slate-400 py-8 text-center">{selectedDay ? 'Nenhum serviço nesse dia.' : 'Sem dados no período.'}</p>
          ) : viewMode === 'resumo' ? (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {serviceGroups.map((s, i) => {
                const pct = totalResumoPax > 0 ? (s.pax / totalResumoPax) * 100 : 0;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between gap-2 mb-1 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-400 w-5 text-right flex-shrink-0 tabular-nums">{i + 1}</span>
                        <span className="font-medium text-slate-700 truncate" title={s.name}>{s.name}</span>
                        {s.types.size > 0 && <span className="flex-shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">{[...s.types].join(', ')}</span>}
                      </div>
                      <div className="flex gap-3 flex-shrink-0 tabular-nums items-center">
                        <span className="text-slate-400 text-[10px] w-10 text-right">{pct.toFixed(1)}%</span>
                        <span className="font-bold text-slate-800">{s.pax.toLocaleString('pt-BR')} pax</span>
                        <span className="text-slate-400">{s.count} {s.count === 1 ? 'venda' : 'vendas'}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 ml-7">
                      <div className="h-1.5 rounded-full transition-all duration-300 bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

          /* ── Detalhado ── */
          ) : viewMode === 'detalhe' ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1 max-w-xs">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Buscar serviço, venda, tipo…" value={detailSearch}
                    onChange={e => { setDetailSearch(e.target.value); setDetailPage(0); }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400" />
                </div>
                {detailSearch && <span className="text-xs text-slate-400">{detailRowsSearched.length} resultado{detailRowsSearched.length !== 1 ? 's' : ''}</span>}
                <button onClick={handleExportCSV}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 transition-colors">
                  <Download size={12} /> Exportar CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-left">
                      <th className="pb-2 pr-3 font-semibold text-slate-300">#</th>
                      <th className="pb-2 pr-3 font-semibold">Seq</th>
                      <th className="pb-2 pr-3 font-semibold">Venda</th>
                      <SortTh col="checkinDate" label="Data IN" current={sortCol} dir={sortDir} onSort={handleSort} />
                      <SortTh col="product"     label="Serviço" current={sortCol} dir={sortDir} onSort={handleSort} />
                      <SortTh col="saleType"    label="Tipo"    current={sortCol} dir={sortDir} onSort={handleSort} />
                      <SortTh col="passengers"  label="Pax"     current={sortCol} dir={sortDir} onSort={handleSort} align="right" />
                      <th className="pb-2 font-semibold text-center text-slate-500">Composição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const bd = { adt: r.paxAdt, chd: r.paxChd, colo: r.paxColo, red: r.paxRed, sen: r.paxSen, free: r.paxFree };
                      const hasBd = PAX_CATEGORY_CFG.some(c => (bd[c.key] || 0) > 0);
                      return (
                        <tr key={`${r.id}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-1.5 pr-3 text-slate-300 tabular-nums">{detailPage * PAGE_SIZE + i + 1}</td>
                          <td className="py-1.5 pr-3 font-mono text-slate-500">{r.seqId || '—'}</td>
                          <td className="py-1.5 pr-3 font-mono text-slate-500">{r.id || '—'}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{r.checkinDate ? r.checkinDate.toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="py-1.5 pr-3 max-w-[16rem] truncate font-medium text-slate-700" title={r.product}>{r.product || '—'}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{r.saleType || '—'}</td>
                          <td className="py-1.5 pr-3 text-right font-bold text-slate-800 tabular-nums">{r.passengers.toLocaleString('pt-BR')}</td>
                          <td className="py-1.5 pl-1">
                            {hasBd
                              ? <PaxCompositionBar breakdown={bd} height={5} className="w-16" />
                              : <span className="text-slate-200 text-[10px]">—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={6} className="pt-2 pr-3 text-xs text-slate-500">
                        TOTAL {detailSearch ? `(${detailRowsSearched.length} filtrado${detailRowsSearched.length !== 1 ? 's' : ''})` : ''}
                      </td>
                      <td className="pt-2 pr-3 text-right text-xs text-slate-800 tabular-nums">
                        {detailRowsSearched.reduce((s, r) => s + r.passengers, 0).toLocaleString('pt-BR')}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Página {detailPage + 1} de {pageCount} ({detailRowsSearched.length.toLocaleString('pt-BR')} registros)</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDetailPage(p => Math.max(0, p - 1))} disabled={detailPage === 0}
                      className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">‹ Anterior</button>
                    <button onClick={() => setDetailPage(p => Math.min(pageCount - 1, p + 1))} disabled={detailPage >= pageCount - 1}
                      className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">Próxima ›</button>
                  </div>
                </div>
              )}
            </>

          /* ── Comparar ── */
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Selecione dois serviços para comparar o fluxo diário de pax ao longo do mês completo (independente do dia selecionado no calendário).</p>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'A', val: compareA, set: setCompareA, other: compareB, color: 'blue' },
                  { key: 'B', val: compareB, set: setCompareB, other: compareA, color: 'emerald' },
                ].map(({ key, val, set, other, color }) => (
                  <div key={key}>
                    <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 text-${color}-600`}>Serviço {key}</label>
                    <select value={val} onChange={e => set(e.target.value)}
                      className={`text-xs border border-${color}-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-${color}-400 max-w-[220px] text-slate-700`}>
                      <option value="">— Selecione —</option>
                      {uniqueProducts.map(p => <option key={p} value={p} disabled={p === other}>{p}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {(compareA || compareB) && (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={compareChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 9 }} tickFormatter={v => (v % 5 === 1 || v === daysInMonth) ? v : ''} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={36} axisLine={false} tickLine={false} />
                      <Tooltip content={<CompareTooltip nameA={compareA} nameB={compareB} monthName={MONTH_PT[month]} />} />
                      <Legend formatter={v => v === 'paxA' ? (compareA || 'A') : (compareB || 'B')} wrapperStyle={{ fontSize: 11 }} />
                      {compareA && <Line dataKey="paxA" name="paxA" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} type="monotone" isAnimationActive={false} />}
                      {compareB && <Line dataKey="paxB" name="paxB" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} type="monotone" isAnimationActive={false} />}
                    </ComposedChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-2 gap-3">
                    {[{ name: compareA, stats: statsA, color: 'blue' }, { name: compareB, stats: statsB, color: 'emerald' }].map(({ name, stats, color }) => {
                      const border = color === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50';
                      const label  = color === 'blue' ? 'text-blue-600' : 'text-emerald-600';
                      if (!name || !stats) return (
                        <div key={color} className={`rounded-xl border p-4 ${border} flex items-center justify-center min-h-[80px]`}>
                          <span className="text-xs text-slate-400">Selecione um serviço</span>
                        </div>
                      );
                      return (
                        <div key={color} className={`rounded-xl border p-4 ${border}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${label} mb-2 truncate`} title={name}>{name}</p>
                          <div className="grid grid-cols-2 gap-y-2 text-xs">
                            <div><p className="text-slate-400">Total pax</p><p className="font-bold text-slate-800">{stats.total.toLocaleString('pt-BR')}</p></div>
                            <div>
                              <p className="text-slate-400">Pico do mês</p>
                              <p className="font-bold text-slate-800">
                                {stats.peak.toLocaleString('pt-BR')} pax
                                {stats.peakDay && <span className="ml-1 text-slate-400 font-normal">(dia {stats.peakDay})</span>}
                              </p>
                            </div>
                            <div><p className="text-slate-400">Média/dia ativo</p><p className="font-bold text-slate-800">{Math.round(stats.avg).toLocaleString('pt-BR')} pax</p></div>
                            <div><p className="text-slate-400">Dias ativos</p><p className="font-bold text-slate-800">{stats.activeDays}</p></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
