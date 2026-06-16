import { useState, useMemo, useCallback } from 'react';
import { Loader } from './components/Loader';
import { useFinanceSeries } from './hooks/useFinanceSeries';
import { useFinanceData }   from './hooks/useFinanceData';
import { ExportProvider }   from './contexts/ExportContext';
import OverviewPage  from './pages/finance/OverviewPage';
import DREPage       from './pages/finance/DREPage';
import ExpensesPage  from './pages/finance/ExpensesPage';
import RevenuePage   from './pages/finance/RevenuePage';
import CashFlowPage  from './pages/finance/CashFlowPage';
import PayablesPage  from './pages/finance/PayablesPage';
import ComparePage   from './pages/finance/ComparePage';
import { MONTHS_SHORT } from './utils/financeFormat';

const TABS = [
  { id: 'overview',  label: 'Visão Geral'          },
  { id: 'dre',       label: 'DRE'                   },
  { id: 'expenses',  label: 'Despesas'              },
  { id: 'revenue',   label: 'Receitas'              },
  { id: 'cashflow',  label: 'Fluxo de Caixa'        },
  { id: 'payables',  label: 'Contas Pagar/Receber'  },
  { id: 'compare',   label: 'Comparativos'          },
];

function parseApiError(msg) {
  if (!msg) return 'Erro desconhecido.';
  const lower = msg.toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out'))    return 'Timeout — período muito extenso ou servidor sobrecarregado.';
  if (lower.includes('network') || lower.includes('fetch failed')) return 'Falha de conexão com o servidor.';
  if (lower.includes('401') || lower.includes('403'))              return 'Sem permissão de acesso à API financeira.';
  return msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
}

export default function FinanceApp() {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // ── Committed states (disparam fetch) ─────────────────────────────────────
  const [year,        setYear]        = useState(currentYear);
  const [startMonth,  setStartMonth]  = useState(1);
  const [endMonth,    setEndMonth]    = useState(currentMonth);
  const [unitFilter,  setUnitFilter]  = useState('');

  // ── Draft states (editáveis sem re-fetch) ──────────────────────────────────
  const [draftYear,        setDraftYear]        = useState(currentYear);
  const [draftStartMonth,  setDraftStartMonth]  = useState(1);
  const [draftEndMonth,    setDraftEndMonth]    = useState(currentMonth);

  const hasPending = draftYear !== year || draftStartMonth !== startMonth || draftEndMonth !== endMonth;

  const applyChanges = useCallback(() => {
    setYear(draftYear);
    setStartMonth(draftStartMonth);
    setEndMonth(draftEndMonth);
  }, [draftYear, draftStartMonth, draftEndMonth]);

  // Garante endMonth nunca menor que startMonth no draft
  const handleDraftStartMonth = (v) => {
    setDraftStartMonth(v);
    if (v > draftEndMonth) setDraftEndMonth(v);
  };

  const years = useMemo(() => {
    const list = [];
    for (let y = currentYear - 3; y <= currentYear + 1; y++) list.push(y);
    return list;
  }, [currentYear]);

  const [activeTab, setActiveTab] = useState('overview');

  // ── Fetches centralizados ──────────────────────────────────────────────────
  // DRE — carregado ao montar; todas as abas exceto caixa/payables usam esses rows
  const { rows: dreRows, loading: dreLoading, error: dreError } = useFinanceSeries({
    year, startMonth, endMonth, recurso: 'resultado',
  });

  // DRE ano anterior para comparativo no Overview
  const { rows: prevDreRows } = useFinanceSeries({
    year: year - 1, startMonth, endMonth, recurso: 'resultado',
    enabled: activeTab === 'overview',
  });

  // Caixa — lazy, só quando aba ativa
  const { rows: cashRows, loading: cashLoading, error: cashError } = useFinanceSeries({
    year, startMonth, endMonth, recurso: 'baixadas',
    enabled: activeTab === 'cashflow',
  });

  // Contas abertas — posição atual, sem filtro de data
  const today = new Date().toISOString().slice(0, 10);
  const { rows: abertasRows, loading: abertasLoading } = useFinanceData({
    startDate: today, endDate: today, recurso: 'abertas',
    enabled: activeTab === 'payables',
  });

  // ── Filtro de filial (client-side, não re-fetcha) ──────────────────────────
  const filteredDRE = useMemo(() =>
    unitFilter ? dreRows.filter(r => r.unit === unitFilter) : dreRows,
  [dreRows, unitFilter]);

  const filteredCash = useMemo(() =>
    unitFilter ? cashRows.filter(r => r.unit === unitFilter) : cashRows,
  [cashRows, unitFilter]);

  const units = useMemo(() => {
    const set = new Set();
    dreRows.forEach(r => r.unit && set.add(r.unit));
    cashRows.forEach(r => r.unit && set.add(r.unit));
    return [...set].sort();
  }, [dreRows, cashRows]);

  // ── Contexto de export ─────────────────────────────────────────────────────
  const lastDay = new Date(year, endMonth, 0).getDate();
  const exportCtx = useMemo(() => ({
    startDate:    `${year}-${String(startMonth).padStart(2, '0')}-01`,
    endDate:      `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`,
    qualPeriodo:  'DRE',
    nSistema:     'Financeiro',
    filters:      { filial: unitFilter ? [unitFilter] : [] },
  }), [year, startMonth, endMonth, unitFilter, lastDay]);

  const loading = dreLoading || (activeTab === 'cashflow' && cashLoading) || (activeTab === 'payables' && abertasLoading);
  const error   = dreError || cashError;

  const totalMonths = endMonth - startMonth + 1;

  return (
    <ExportProvider value={exportCtx}>
      <div className="min-h-screen bg-slate-50 text-slate-900">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-wrap gap-3 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-800 tracking-tight">BI Financeiro</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:inline">ONASYS</span>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">DRE · tipoconta R</span>
          </div>

          {/* Controles de período (draft) */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={draftYear} onChange={e => setDraftYear(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select value={draftStartMonth} onChange={e => handleDraftStartMonth(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              {MONTHS_SHORT.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <span className="text-xs text-slate-400">até</span>
            <select value={draftEndMonth} onChange={e => setDraftEndMonth(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              {MONTHS_SHORT.map((m, i) => (
                <option key={i+1} value={i+1} disabled={i+1 < draftStartMonth}>{m}</option>
              ))}
            </select>

            <button onClick={applyChanges}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                hasPending
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-default'
              }`}
              disabled={!hasPending}>
              Aplicar
            </button>

            {/* Filtro filial (aplica client-side, sem re-fetch) */}
            {units.length > 0 && (
              <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[160px]">
                <option value="">Todas as filiais</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}

            {/* Indicador de carregamento com progresso */}
            {loading && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600">
                <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                {totalMonths > 1 ? `${totalMonths} meses…` : 'Carregando…'}
              </span>
            )}
          </div>
        </header>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <nav className="bg-white border-b border-slate-200 px-5 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Conteúdo ──────────────────────────────────────────────────── */}
        <main className="max-w-screen-2xl mx-auto px-4 py-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
              <span className="font-semibold">Erro ao carregar dados:</span> {parseApiError(error)}
            </div>
          )}

          {loading && dreRows.length === 0 && cashRows.length === 0 && abertasRows.length === 0 && <Loader />}

          {activeTab === 'overview'  && <OverviewPage  rows={filteredDRE}  prevRows={prevDreRows} loading={dreLoading} year={year} startMonth={startMonth} endMonth={endMonth} />}
          {activeTab === 'dre'       && <DREPage       rows={filteredDRE}  loading={dreLoading} />}
          {activeTab === 'expenses'  && <ExpensesPage  rows={filteredDRE}  loading={dreLoading} />}
          {activeTab === 'revenue'   && <RevenuePage   rows={filteredDRE}  loading={dreLoading} />}
          {activeTab === 'cashflow'  && <CashFlowPage  rows={filteredCash} loading={cashLoading} />}
          {activeTab === 'payables'  && <PayablesPage  rows={abertasRows}  loading={abertasLoading} />}
          {activeTab === 'compare'   && <ComparePage />}
        </main>
      </div>
    </ExportProvider>
  );
}
