import { useState, useMemo } from 'react';
import { useDashboardData } from './hooks/useDashboardData';
import { FilterBar } from './components/FilterBar';
import { Loader } from './components/Loader';
import { ExportProvider } from './contexts/ExportContext';
import ExecutivePage from './pages/ExecutivePage';
import MarginPage from './pages/MarginPage';
import SalesPage from './pages/SalesPage';
import ServicesPage from './pages/ServicesPage';
import GeoPage from './pages/GeoPage';
import ComparativosPage from './pages/ComparativosPage';
import ClientsPage from './pages/ClientsPage';
import IntelligencePage from './pages/IntelligencePage';

const TABS = [
  { id: 'executive',    label: 'Visão Executiva' },
  { id: 'margin',       label: 'Margens'         },
  { id: 'sales',        label: 'Vendas'          },
  { id: 'services',     label: 'Serviços'        },
  { id: 'geo',          label: 'Regiões'         },
  { id: 'comparativos', label: 'Comparativos'    },
  { id: 'intelligence', label: 'Inteligência'    },
  { id: 'clientes',     label: 'Clientes'        },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function App() {
  const [nSistema,    setNSistema]    = useState(1);          // Receptivo por padrão
  const [startDate,   setStartDate]   = useState(today());
  const [endDate,     setEndDate]     = useState(today());
  const [qualPeriodo, setQualPeriodo] = useState(2);          // Realizado por padrão
  const [activeTab,   setActiveTab]   = useState('executive');

  // Draft states: controlam os inputs de data sem disparar fetch
  const [draftStart, setDraftStart]  = useState(today());
  const [draftEnd,   setDraftEnd]    = useState(today());

  const hasPendingDates = draftStart !== startDate || draftEnd !== endDate;

  function applyDates() {
    setStartDate(draftStart);
    setEndDate(draftEnd);
  }

  const [filialFilter,     setFilialFilter]     = useState([]);
  const [channelFilter,    setChannelFilter]    = useState([]);
  const [clientTypeFilter, setClientTypeFilter] = useState([]);
  const [vendorFilter,     setVendorFilter]     = useState([]);

  const { rows: allRows, loading, error } = useDashboardData({
    startDate, endDate, qualPeriodo, nSistema,
  });

  const rows = useMemo(() => allRows.filter(r => {
    if (filialFilter.length     && !filialFilter.includes(r.filial))         return false;
    if (channelFilter.length    && !channelFilter.includes(r.channel))       return false;
    if (clientTypeFilter.length && !clientTypeFilter.includes(r.clientType)) return false;
    if (vendorFilter.length     && !vendorFilter.includes(r.vendor))         return false;
    return true;
  }), [allRows, filialFilter, channelFilter, clientTypeFilter, vendorFilter]);

  const filterOptions = useMemo(() => ({
    filiais:     [...new Set(allRows.map(r => r.filial).filter(Boolean))].sort(),
    channels:    [...new Set(allRows.map(r => r.channel).filter(Boolean))].sort(),
    clientTypes: [...new Set(allRows.map(r => r.clientType).filter(Boolean))].sort(),
    vendors:     [...new Set(allRows.map(r => r.vendor).filter(Boolean))].sort(),
  }), [allRows]);

  const exportCtx = useMemo(() => ({
    startDate,
    endDate,
    qualPeriodo,
    nSistema,
    filters: {
      filial:     filialFilter,
      channel:    channelFilter,
      clientType: clientTypeFilter,
      vendor:     vendorFilter,
    },
  }), [startDate, endDate, qualPeriodo, nSistema, filialFilter, channelFilter, clientTypeFilter, vendorFilter]);

  return (
    <ExportProvider value={exportCtx}>
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-screen-2xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard BI</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              ONASYS — Rentabilidade &middot;{' '}
              <span className="font-medium text-indigo-500">
                {qualPeriodo === 1 ? 'Emitido' : 'Realizado'}
              </span>{' '}
              {startDate && endDate && (
                <>
                  {new Date(`${startDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  {' – '}
                  {new Date(`${endDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Perfil:</span>
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

      {/* Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3 max-w-screen-2xl mx-auto">

          {/* ── Datas com estado draft ── */}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            De
            <input
              type="date"
              value={draftStart}
              onChange={e => setDraftStart(e.target.value)}
              className={`border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 transition-colors ${
                hasPendingDates
                  ? 'border-amber-400 bg-amber-50 focus:ring-amber-400 text-amber-800'
                  : 'border-slate-300 focus:ring-blue-400'
              }`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Até
            <input
              type="date"
              value={draftEnd}
              onChange={e => setDraftEnd(e.target.value)}
              className={`border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 transition-colors ${
                hasPendingDates
                  ? 'border-amber-400 bg-amber-50 focus:ring-amber-400 text-amber-800'
                  : 'border-slate-300 focus:ring-blue-400'
              }`}
            />
          </label>

          {/* Botão Aplicar — destaque quando há pendência */}
          <div className="flex items-center gap-2">
            <button
              onClick={applyDates}
              disabled={!hasPendingDates}
              className={`relative px-4 py-1.5 rounded text-sm font-semibold transition-all ${
                hasPendingDates
                  ? 'bg-amber-500 text-white shadow ring-2 ring-amber-300 ring-offset-1 hover:bg-amber-600'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {hasPendingDates && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
              )}
              Aplicar
            </button>
            {hasPendingDates && (
              <span className="text-xs text-amber-600 font-medium">
                Datas alteradas — clique em Aplicar
              </span>
            )}
          </div>

          {/* Separador visual */}
          <div className="h-5 w-px bg-slate-200" />

          {/* ── Período (Emitido / Realizado) — dispara fetch imediatamente ── */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Período:</span>
            {[{ label: 'Emitido', value: 1 }, { label: 'Realizado', value: 2 }].map(p => (
              <button
                key={p.value}
                onClick={() => setQualPeriodo(p.value)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  qualPeriodo === p.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {!loading && (
            <span className="ml-auto text-xs text-slate-400">
              {rows.length.toLocaleString('pt-BR')} registros
              {rows.length !== allRows.length && ` (${allRows.length.toLocaleString('pt-BR')} total)`}
            </span>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        options={filterOptions}
        filial={filialFilter}         onFilial={setFilialFilter}
        channel={channelFilter}       onChannel={setChannelFilter}
        clientType={clientTypeFilter} onClientType={setClientTypeFilter}
        vendor={vendorFilter}         onVendor={setVendorFilter}
      />

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex max-w-screen-2xl mx-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="p-6 max-w-screen-2xl mx-auto">
        {loading && <Loader />}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            <strong>Erro ao carregar dados:</strong> {error}
          </div>
        )}
        {!loading && !error && (
          <>
            {activeTab === 'executive'    && <ExecutivePage    rows={rows} />}
            {activeTab === 'margin'       && <MarginPage       rows={rows} />}
            {activeTab === 'sales'        && <SalesPage        rows={rows} />}
            {activeTab === 'services'     && <ServicesPage     rows={rows} />}
            {activeTab === 'geo'          && <GeoPage          rows={rows} />}
            {activeTab === 'comparativos'  && <ComparativosPage />}
            {activeTab === 'intelligence'  && <IntelligencePage rows={rows} />}
            {activeTab === 'clientes'      && <ClientsPage rows={rows} />}
          </>
        )}
      </main>
    </div>
    </ExportProvider>
  );
}
