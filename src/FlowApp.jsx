import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useDashboardData } from './hooks/useDashboardData';

const MONTH_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DOW_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const WEEKEND  = new Set([0, 6]);
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
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow text-xs">
      <p className="font-bold text-slate-700 mb-1">
        {d.day} de {monthName}
        {d.isAlert && <span className="ml-1.5 text-orange-500">⚠ alerta</span>}
      </p>
      <p className="text-blue-600 font-semibold">{d.pax.toLocaleString('pt-BR')} pax</p>
      {d.services > 0 && <p className="text-slate-400">{d.services} serviços</p>}
    </div>
  );
}

function FlowDot({ cx, cy, payload }) {
  if (!payload?.pax) return null;
  return (
    <circle
      cx={cx} cy={cy}
      r={payload.isAlert ? 5 : 3}
      fill={payload.isAlert ? '#f97316' : '#3b82f6'}
      stroke="#fff" strokeWidth={1.5}
    />
  );
}

function SortTh({ col, label, current, dir, onSort, align = 'left' }) {
  const active = current === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`pb-2 pr-3 font-semibold cursor-pointer select-none hover:text-slate-700 whitespace-nowrap ${align === 'right' ? 'text-right' : ''}`}
    >
      {label}
      <span className="ml-0.5 text-[10px] text-slate-300">
        {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}

export default function FlowApp() {
  const now = new Date();
  const [year,            setYear]            = useState(now.getFullYear());
  const [month,           setMonth]           = useState(now.getMonth());
  const [nSistema,        setNSistema]        = useState(0);
  const [selectedDay,     setSelectedDay]     = useState(null);
  const [viewMode,        setViewMode]        = useState('resumo');
  const [sortCol,         setSortCol]         = useState('product');
  const [sortDir,         setSortDir]         = useState('asc');
  const [detailPage,      setDetailPage]      = useState(0);
  const [alertMultiplier, setAlertMultiplier] = useState(1.5);

  const { startDate, endDate, daysInMonth, firstDow } = useMemo(() => {
    const pad     = n => String(n).padStart(2, '0');
    const lastDay = new Date(year, month + 1, 0);
    return {
      startDate:   `${year}-${pad(month + 1)}-01`,
      endDate:     `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`,
      daysInMonth: lastDay.getDate(),
      firstDow:    new Date(year, month, 1).getDay(), // 0 = domingo
    };
  }, [year, month]);

  // destaque visual do dia atual no calendário
  const todayDay = (
    now.getFullYear() === year && now.getMonth() === month
  ) ? now.getDate() : null;

  const { rows: allRows, loading, error } = useDashboardData({
    startDate,
    endDate,
    qualPeriodo: 2,  // Realizado — ddatain como eixo de data
    nSistema,
  });

  // limpa seleção de dia ao trocar mês ou perfil
  useEffect(() => {
    setSelectedDay(null);
  }, [startDate, endDate, nSistema]);

  // reset paginação ao trocar dia ou modo de visualização
  useEffect(() => {
    setDetailPage(0);
  }, [selectedDay, viewMode]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function handleSort(col) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const dailyPax = useMemo(() => {
    const map = {};
    for (const r of allRows) {
      if (!r.checkinDate) continue;
      const d = r.checkinDate.getDate();
      if (!map[d]) map[d] = { pax: 0, services: new Set() };
      map[d].pax += r.passengers;
      if (r.product) map[d].services.add(r.product);
    }
    return map;
  }, [allRows]);

  const maxDayPax = useMemo(
    () => Math.max(0, ...Object.values(dailyPax).map(v => v.pax)),
    [dailyPax]
  );

  const { avgPax, alertThreshold, alertDays } = useMemo(() => {
    const vals = Object.values(dailyPax).map(v => v.pax);
    if (!vals.length) return { avgPax: 0, alertThreshold: 0, alertDays: new Set() };
    const avg       = vals.reduce((s, v) => s + v, 0) / vals.length;
    const threshold = avg * alertMultiplier; // configurável pelo usuário
    const alerts    = new Set(
      Object.entries(dailyPax)
        .filter(([, v]) => v.pax >= threshold && threshold > 0)
        .map(([d]) => Number(d))
    );
    return { avgPax: avg, alertThreshold: threshold, alertDays: alerts };
  }, [dailyPax, alertMultiplier]);

  const chartData = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const day  = i + 1;
      const info = dailyPax[day];
      return {
        day,
        pax:      info?.pax ?? 0,
        services: info?.services?.size ?? 0,
        isAlert:  alertDays.has(day),
      };
    }),
    [daysInMonth, dailyPax, alertDays]
  );

  const dayRows = useMemo(() =>
    selectedDay
      ? allRows.filter(r => r.checkinDate && r.checkinDate.getDate() === selectedDay)
      : allRows,
    [allRows, selectedDay]
  );

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

  const detailRows = useMemo(() => {
    return [...dayRows].sort((a, b) => {
      let cmp = 0;
      if      (sortCol === 'product')     cmp = (a.product  || '').localeCompare(b.product  || '');
      else if (sortCol === 'saleType')    cmp = (a.saleType || '').localeCompare(b.saleType || '');
      else if (sortCol === 'passengers')  cmp = a.passengers - b.passengers;
      else if (sortCol === 'checkinDate') cmp = (a.checkinDate?.getTime() || 0) - (b.checkinDate?.getTime() || 0);
      if (cmp === 0) cmp = (a.seqId || '').localeCompare(b.seqId || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [dayRows, sortCol, sortDir]);

  const totalPax       = allRows.reduce((s, r) => s + r.passengers, 0);
  const daysWithData   = Object.keys(dailyPax).length;
  const peakEntry      = Object.entries(dailyPax).sort((a, b) => b[1].pax - a[1].pax)[0];
  const dayTotalPax    = dayRows.reduce((s, r) => s + r.passengers, 0);
  const totalResumoPax = serviceGroups.reduce((s, g) => s + g.pax, 0);
  const pageCount      = Math.ceil(detailRows.length / PAGE_SIZE);
  const pageRows       = detailRows.slice(detailPage * PAGE_SIZE, (detailPage + 1) * PAGE_SIZE);
  const alertPctLabel  = `${Math.round(alertMultiplier * 100)}% da média`;

  const calendarCells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Fluxo Operacional</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Pax por Data de Serviço (ddatain) &middot; ONASYS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Perfil:</span>
            {[{ label: 'Emissivo', value: 0 }, { label: 'Receptivo', value: 1 }].map(p => (
              <button
                key={p.value}
                onClick={() => setNSistema(p.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  nSistema === p.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-5">

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={prevMonth}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium"
          >
            ‹ {MONTH_PT[(month + 11) % 12].slice(0, 3)}
          </button>
          <h2 className="text-lg font-bold text-slate-800 min-w-[210px] text-center">
            {MONTH_PT[month]} {year}
            {loading && <span className="ml-2 text-xs font-normal text-slate-400 animate-pulse">carregando…</span>}
          </h2>
          <button
            onClick={nextMonth}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium"
          >
            {MONTH_PT[(month + 1) % 12].slice(0, 3)} ›
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Pax',     value: totalPax.toLocaleString('pt-BR'),                                    sub: 'no mês',                       color: 'text-slate-800'  },
            { label: 'Dias c/ Oper.', value: daysWithData,                                                        sub: `de ${daysInMonth} dias`,        color: 'text-slate-800'  },
            { label: 'Média / Dia',   value: daysWithData ? Math.round(avgPax).toLocaleString('pt-BR') : '—',     sub: 'pax por dia ativo',             color: 'text-blue-700'   },
            { label: 'Alertas',       value: alertDays.size,                                                       sub: `dias acima de ${alertPctLabel}`, color: alertDays.size > 0 ? 'text-orange-600' : 'text-slate-400' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Limiar de alerta:</span>
          <div className="flex rounded border border-slate-200 overflow-hidden text-xs">
            {[1.2, 1.5, 1.75, 2.0].map((v, i) => (
              <button
                key={v}
                onClick={() => setAlertMultiplier(v)}
                className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                  alertMultiplier === v
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {Math.round(v * 100)}%
              </button>
            ))}
          </div>
        </div>

        {alertDays.size > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-orange-800 mb-2">
              ⚠ {alertDays.size} {alertDays.size === 1 ? 'dia' : 'dias'} com pico de operação
            </p>
            <div className="flex flex-wrap gap-2">
              {[...alertDays]
                .sort((a, b) => (dailyPax[b]?.pax ?? 0) - (dailyPax[a]?.pax ?? 0))
                .map(day => (
                  <button
                    key={day}
                    onClick={() => { setSelectedDay(prev => prev === day ? null : day); setViewMode('resumo'); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selectedDay === day
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100'
                    }`}
                  >
                    <span>Dia {day}</span>
                    <span className="opacity-80">{dailyPax[day]?.pax.toLocaleString('pt-BR')} pax</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Linha de Fluxo — Pax por Dia</h3>
          <p className="text-xs text-slate-400 mb-4">
            — — média &nbsp;·&nbsp;
            <span className="text-orange-500">— — limiar ({alertPctLabel})</span>
            &nbsp;·&nbsp;
            <span className="text-orange-500">●</span> alerta
            {selectedDay && <>&nbsp;·&nbsp;<span className="text-blue-700">| dia {selectedDay} selecionado</span></>}
          </p>
          {chartData.every(d => d.pax === 0) ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={chartData}
                onClick={e => {
                  const day = e?.activePayload?.[0]?.payload?.day;
                  if (day) { setSelectedDay(prev => prev === day ? null : day); setViewMode('resumo'); }
                }}
                style={{ cursor: 'pointer' }}
              >
                <defs>
                  <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9 }}
                  tickFormatter={v => (v % 5 === 1 || v === daysInMonth) ? v : ''}
                  axisLine={false} tickLine={false}
                />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={36} axisLine={false} tickLine={false} />
                <Tooltip content={<FlowTooltip monthName={MONTH_PT[month]} />} />
                {avgPax > 0 && (
                  <ReferenceLine
                    y={Math.round(avgPax)}
                    stroke="#94a3b8"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    label={{ value: `avg ${Math.round(avgPax)}`, position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
                  />
                )}
                {alertThreshold > 0 && (
                  <ReferenceLine
                    y={Math.round(alertThreshold)}
                    stroke="#f97316"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    label={{ value: `alerta ${Math.round(alertThreshold)}`, position: 'insideTopRight', fontSize: 9, fill: '#f97316' }}
                  />
                )}
                {selectedDay && (
                  <ReferenceLine
                    x={selectedDay}
                    stroke="#1e3a8a"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    label={{ value: `dia ${selectedDay}`, position: 'insideTopLeft', fontSize: 9, fill: '#1e3a8a' }}
                  />
                )}
                <Area
                  dataKey="pax"
                  stroke="#3b82f6"
                  strokeWidth={0}
                  fill="url(#flowGrad)"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="pax"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={<FlowDot />}
                  activeDot={{ r: 6, fill: '#1d4ed8' }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Mapa de Calor — Pax por Dia</h3>
              <p className="text-xs text-slate-400">
                Azul = normal &nbsp;·&nbsp;
                <span className="text-orange-500">Laranja/vermelho = alerta</span>
                &nbsp;·&nbsp;
                <span className="text-rose-300">Rosa = fim de semana</span>
                &nbsp;·&nbsp; clique para detalhar
              </p>
            </div>
            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 bg-blue-50"
              >
                ✕ limpar
              </button>
            )}
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW_PT.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[11px] font-semibold py-1 ${
                  i === 0 || i === 6 ? 'text-rose-300' : 'text-slate-400'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calendarCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="min-h-[68px]" />;

              const dow       = (firstDow + day - 1) % 7;
              const isWeekend = WEEKEND.has(dow);
              const info      = dailyPax[day];
              const pax       = info?.pax ?? 0;
              const isAlert   = alertDays.has(day);
              const { bg, fg } = paxColor(pax, maxDayPax, isAlert);
              const isSel     = selectedDay === day;
              const isToday   = todayDay === day;

              // fim de semana sem operação: fundo levemente rosado
              const cellBg = isSel ? '#1e3a8a' : (pax === 0 && isWeekend ? '#fdf2f2' : bg);
              const numColor = isSel ? '#bfdbfe' : (pax === 0 && isWeekend ? '#fca5a5' : fg);

              return (
                <button
                  key={day}
                  onClick={() => { setSelectedDay(isSel ? null : day); setViewMode('resumo'); }}
                  style={{ backgroundColor: cellBg }}
                  className={`min-h-[68px] rounded-lg p-1.5 text-left flex flex-col justify-between transition-all ${
                    isToday && !isSel ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                  } ${isSel ? 'ring-2 ring-blue-400 ring-offset-1' : 'hover:opacity-80'}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold leading-none" style={{ color: numColor }}>
                      {day}
                      {isToday && !isSel && (
                        <span className="ml-0.5 text-[8px] text-indigo-500">●</span>
                      )}
                    </span>
                    {isAlert && (
                      <span className="text-[10px] leading-none" style={{ color: isSel ? '#fed7aa' : '#ea580c' }}>⚠</span>
                    )}
                  </div>
                  {pax > 0 ? (
                    <div>
                      <span
                        className="text-sm font-bold tabular-nums block leading-tight"
                        style={{ color: isSel ? '#ffffff' : fg }}
                      >
                        {pax.toLocaleString('pt-BR')}
                      </span>
                      <span
                        className="text-[9px] block leading-none mt-0.5 opacity-70"
                        style={{ color: isSel ? '#bfdbfe' : fg }}
                      >
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

          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">Menos</span>
            {['#dbeafe','#93c5fd','#3b82f6','#1d4ed8','#1e3a8a'].map(c => (
              <div key={c} className="w-5 h-3 rounded-sm" style={{ backgroundColor: c }} />
            ))}
            <span className="text-[11px] text-slate-400">Mais pax</span>
            <span className="mx-1 text-[11px] text-slate-300">|</span>
            {['#fed7aa','#f97316','#dc2626'].map(c => (
              <div key={c} className="w-5 h-3 rounded-sm" style={{ backgroundColor: c }} />
            ))}
            <span className="text-[11px] text-orange-500">Alerta</span>
            <span className="mx-1 text-[11px] text-slate-300">|</span>
            <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#fdf2f2' }} />
            <span className="text-[11px] text-rose-300">Fim de semana</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                {selectedDay
                  ? `Serviços — Dia ${selectedDay} de ${MONTH_PT[month]}`
                  : `Serviços — ${MONTH_PT[month]} ${year} (mês completo)`}
                {alertDays.has(selectedDay) && (
                  <span className="ml-2 text-xs text-orange-500 font-normal">⚠ dia em alerta</span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {dayRows.length.toLocaleString('pt-BR')} vendas &middot;{' '}
                {dayTotalPax.toLocaleString('pt-BR')} pax total
                {selectedDay && peakEntry && (
                  <> &middot; pico do mês: dia {peakEntry[0]} ({peakEntry[1].pax.toLocaleString('pt-BR')} pax)</>
                )}
              </p>
            </div>
            {/* toggle resumo / detalhe */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
              {[
                { id: 'resumo',  label: 'Por Serviço' },
                { id: 'detalhe', label: 'Detalhado'   },
              ].map((opt, i) => (
                <button
                  key={opt.id}
                  onClick={() => setViewMode(opt.id)}
                  className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                    viewMode === opt.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {dayRows.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              {selectedDay ? 'Nenhum serviço nesse dia.' : 'Sem dados no período.'}
            </p>
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
                        {s.types.size > 0 && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">
                            {[...s.types].join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 flex-shrink-0 tabular-nums items-center">
                        <span className="text-slate-400 text-[10px] w-10 text-right">{pct.toFixed(1)}%</span>
                        <span className="font-bold text-slate-800">{s.pax.toLocaleString('pt-BR')} pax</span>
                        <span className="text-slate-400">{s.count} {s.count === 1 ? 'venda' : 'vendas'}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 ml-7">
                      <div
                        className="h-1.5 rounded-full transition-all duration-300 bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
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
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => (
                      <tr key={`${r.id}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-1.5 pr-3 text-slate-300 tabular-nums">{detailPage * PAGE_SIZE + i + 1}</td>
                        <td className="py-1.5 pr-3 font-mono text-slate-500">{r.seqId || '—'}</td>
                        <td className="py-1.5 pr-3 font-mono text-slate-500">{r.id || '—'}</td>
                        <td className="py-1.5 pr-3 text-slate-500">
                          {r.checkinDate ? r.checkinDate.toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-1.5 pr-3 max-w-[16rem] truncate font-medium text-slate-700" title={r.product}>
                          {r.product || '—'}
                        </td>
                        <td className="py-1.5 pr-3 text-slate-500">{r.saleType || '—'}</td>
                        <td className="py-1.5 text-right font-bold text-slate-800 tabular-nums">
                          {r.passengers.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <td colSpan={6} className="pt-2 pr-3 text-xs text-slate-500">TOTAL</td>
                      <td className="pt-2 text-right text-xs text-slate-800 tabular-nums">
                        {dayTotalPax.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Página {detailPage + 1} de {pageCount} ({detailRows.length.toLocaleString('pt-BR')} registros)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetailPage(p => Math.max(0, p - 1))}
                      disabled={detailPage === 0}
                      className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
                    >
                      ‹ Anterior
                    </button>
                    <button
                      onClick={() => setDetailPage(p => Math.min(pageCount - 1, p + 1))}
                      disabled={detailPage === pageCount - 1}
                      className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
                    >
                      Próxima ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
