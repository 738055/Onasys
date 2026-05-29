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
import CancelamentosPage from './pages/CancelamentosPage';

const TABS = [
  { id: 'executive',    label: 'Visão Executiva' },
  { id: 'margin',       label: 'Margens'         },
  { id: 'sales',        label: 'Vendas'          },
  { id: 'services',     label: 'Serviços'        },
  { id: 'geo',          label: 'Regiões'         },
  { id: 'comparativos', label: 'Comparativos'    },
  { id: 'intelligence',    label: 'Inteligência'         },
  { id: 'clientes',        label: 'Clientes'             },
  { id: 'cancelamentos',   label: 'Cancelamentos'        },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Transforma mensagens de erro brutas da API em textos amigáveis.
// A API devolve o SQL completo no 400, o que é ilegível para o usuário.
function parseApiError(msg) {
  if (!msg) return { message: 'Erro desconhecido.', hint: null, type: 'generic' };
  const lower = msg.toLowerCase();
  if (lower.includes('timeout') || lower.includes('elapsed') || lower.includes('timed out')) {
    return {
      type: 'timeout',
      message: 'O servidor demorou demais para responder (Timeout).',
      hint: 'O período selecionado pode ser muito extenso. Tente consultas de até 3 meses por vez.',
    };
  }
  if (lower.includes('fetch failed') || lower.includes('networkerror') || lower.includes('network')) {
    return {
      type: 'network',
      message: 'Não foi possível conectar ao servidor da API.',
      hint: 'Verifique a conexão de rede e tente novamente.',
    };
  }
  if (lower.includes('404')) {
    return { type: 'notfound', message: 'Endpoint da API não encontrado (404).', hint: 'Verifique a configuração do gateway ou proxy.' };
  }
  if (lower.includes('401') || lower.includes('403')) {
    return { type: 'auth', message: 'Sem permissão de acesso (autenticação expirada).', hint: 'Recarregue a página para renovar a sessão.' };
  }
  const clean = msg.length > 250 ? msg.substring(0, 250) + '…' : msg;
  return { type: 'generic', message: clean, hint: null };
}

export default function App() {
  // ── Estados commitados (disparam fetch) ──────────────────────────────────
  const [nSistema,    setNSistema]    = useState(1);   // Receptivo por padrão
  const [startDate,   setStartDate]   = useState(today());
  const [endDate,     setEndDate]     = useState(today());
  const [qualPeriodo, setQualPeriodo] = useState(1);   // Realizado por padrão
  const [activeTab,   setActiveTab]   = useState('executive');

  // ── Draft states (editáveis sem disparar fetch) ───────────────────────────
  const [draftStart,       setDraftStart]       = useState(today());
  const [draftEnd,         setDraftEnd]         = useState(today());
  const [draftQualPeriodo, setDraftQualPeriodo] = useState(1);
  const [draftNSistema,    setDraftNSistema]    = useState(1);

  // Separado para estilizar só os inputs de data com amber
  const hasPendingDates   = draftStart !== startDate || draftEnd !== endDate;
  const hasPendingPeriod  = draftQualPeriodo !== qualPeriodo;
  const hasPendingProfile = draftNSistema !== nSistema;
  const hasPendingChanges = hasPendingDates || hasPendingPeriod || hasPendingProfile;

  function applyChanges() {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setQualPeriodo(draftQualPeriodo);
    setNSistema(draftNSistema);
  }

  const [filialFilter,     setFilialFilter]     = useState([]);
  const [channelFilter,    setChannelFilter]    = useState([]);
  const [clientTypeFilter, setClientTypeFilter] = useState([]);
  const [vendorFilter,     setVendorFilter]     = useState([]);
  const [saleTypeFilter,   setSaleTypeFilter]   = useState([]);

  const { rows: allRows, loading, error } = useDashboardData({
    startDate, endDate, qualPeriodo, nSistema,
  });

  // Linhas ativas: excluem CANCELADO (idStatusServico 4) + aplicam filtros dimensionais
  const rows = useMemo(() => allRows.filter(r => {
    if (r.idStatusServico === 4) return false;
    if (filialFilter.length     && !filialFilter.includes(r.filial))         return false;
    if (channelFilter.length    && !channelFilter.includes(r.channel))       return false;
    if (clientTypeFilter.length && !clientTypeFilter.includes(r.clientType)) return false;
    if (vendorFilter.length     && !vendorFilter.includes(r.vendor))         return false;
    if (saleTypeFilter.length   && !saleTypeFilter.includes(r.saleType))     return false;
    return true;
  }), [allRows, filialFilter, channelFilter, clientTypeFilter, vendorFilter, saleTypeFilter]);

  // Itens CANCELADO com os mesmos filtros dimensionais — usados só na tab Cancelamentos
  const cancelledRows = useMemo(() => allRows.filter(r => {
    if (r.idStatusServico !== 4) return false;
    if (filialFilter.length     && !filialFilter.includes(r.filial))         return false;
    if (channelFilter.length    && !channelFilter.includes(r.channel))       return false;
    if (clientTypeFilter.length && !clientTypeFilter.includes(r.clientType)) return false;
    if (vendorFilter.length     && !vendorFilter.includes(r.vendor))         return false;
    if (saleTypeFilter.length   && !saleTypeFilter.includes(r.saleType))     return false;
    return true;
  }), [allRows, filialFilter, channelFilter, clientTypeFilter, vendorFilter, saleTypeFilter]);

  const reembolsoCount = useMemo(() => rows.filter(r => r.idStatusServico === 28).length, [rows]);

  const filterOptions = useMemo(() => ({
    filiais:     [...new Set(allRows.map(r => r.filial).filter(Boolean))].sort(),
    channels:    [...new Set(allRows.map(r => r.channel).filter(Boolean))].sort(),
    clientTypes: [...new Set(allRows.map(r => r.clientType).filter(Boolean))].sort(),
    vendors:     [...new Set(allRows.map(r => r.vendor).filter(Boolean))].sort(),
    saleTypes:   [...new Set(allRows.map(r => r.saleType).filter(Boolean))].sort(),
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
      saleType:   saleTypeFilter,
    },
  }), [startDate, endDate, qualPeriodo, nSistema, filialFilter, channelFilter, clientTypeFilter, vendorFilter, saleTypeFilter]);

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
                {qualPeriodo === 0 ? 'Emitido' : 'Realizado'}
              </span>{' '}
              {startDate && endDate && (
                <>
                  {new Date(`${startDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  {' – '}
                  {new Date(`${endDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </>
              )}
              {hasPendingChanges && (
                <span className="ml-2 text-amber-500 font-semibold">· alterações pendentes</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Perfil:</span>
            {[{ label: 'Emissivo', value: 0 }, { label: 'Receptivo', value: 1 }].map(p => {
              const isDraft     = p.value === draftNSistema;
              const isPending   = isDraft && hasPendingProfile;
              return (
                <button
                  key={p.value}
                  onClick={() => setDraftNSistema(p.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isPending
                      ? 'bg-amber-400 text-white ring-2 ring-amber-300 ring-offset-1'
                      : isDraft
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                  {isPending && <span className="ml-1 text-[10px] opacity-80">*</span>}
                </button>
              );
            })}
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

          {/* Botão Aplicar — ativo quando há qualquer alteração pendente */}
          <div className="flex items-center gap-2">
            <button
              onClick={applyChanges}
              disabled={!hasPendingChanges}
              className={`relative px-4 py-1.5 rounded text-sm font-semibold transition-all ${
                hasPendingChanges
                  ? 'bg-amber-500 text-white shadow ring-2 ring-amber-300 ring-offset-1 hover:bg-amber-600'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {hasPendingChanges && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
              )}
              Aplicar
            </button>
            {hasPendingChanges && (
              <span className="text-xs text-amber-600 font-medium">
                {[
                  hasPendingDates   && 'datas',
                  hasPendingPeriod  && 'período',
                  hasPendingProfile && 'perfil',
                ].filter(Boolean).join(', ')} alterado{hasPendingChanges ? 's' : ''} — clique em Aplicar
              </span>
            )}
          </div>

          {/* Separador visual */}
          <div className="h-5 w-px bg-slate-200" />

          {/* ── Período (Emitido / Realizado) — draft, aplica junto com datas ── */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Período:</span>
            {[{ label: 'Emitido', value: 0 }, { label: 'Realizado', value: 1 }].map(p => {
              const isDraft   = p.value === draftQualPeriodo;
              const isPending = isDraft && hasPendingPeriod;
              return (
                <button
                  key={p.value}
                  onClick={() => setDraftQualPeriodo(p.value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    isPending
                      ? 'bg-amber-400 text-white ring-2 ring-amber-300 ring-offset-1'
                      : isDraft
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                  {isPending && <span className="ml-1 text-[10px] opacity-80">*</span>}
                </button>
              );
            })}
          </div>

          {!loading && (
            <span className="ml-auto text-xs text-slate-400 flex items-center gap-2">
              <span>{rows.length.toLocaleString('pt-BR')} registros ativos</span>
              {cancelledRows.length > 0 && (
                <span className="flex items-center gap-1 text-red-400 font-medium">
                  · {cancelledRows.length.toLocaleString('pt-BR')} cancelado{cancelledRows.length !== 1 ? 's' : ''} excl.
                </span>
              )}
              {reembolsoCount > 0 && (
                <span className="flex items-center gap-1 text-fuchsia-500 font-medium">
                  · {reembolsoCount.toLocaleString('pt-BR')} reembolso{reembolsoCount !== 1 ? 's' : ''} (R$0 no fat.)
                </span>
              )}
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
        saleType={saleTypeFilter}     onSaleType={setSaleTypeFilter}
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
        {!loading && error && (() => {
          const parsed = parseApiError(error);
          return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {parsed.type === 'timeout' ? '⏱️' : parsed.type === 'network' ? '📡' : '⚠️'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-800 mb-0.5">{parsed.message}</p>
                  {parsed.hint && <p className="text-red-600 text-xs mb-3">{parsed.hint}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={applyChanges}
                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Tentar novamente
                    </button>
                    {parsed.type === 'timeout' && (
                      <span className="text-xs text-red-500">
                        Período atual: {new Date(`${startDate}T12:00:00`).toLocaleDateString('pt-BR')} – {new Date(`${endDate}T12:00:00`).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {!loading && !error && (
          <>
            {activeTab === 'executive'    && <ExecutivePage    rows={rows} />}
            {activeTab === 'margin'       && <MarginPage       rows={rows} />}
            {activeTab === 'sales'        && <SalesPage        rows={rows} />}
            {activeTab === 'services'     && <ServicesPage     rows={rows} />}
            {activeTab === 'geo'          && <GeoPage          rows={rows} />}
            {activeTab === 'comparativos'  && <ComparativosPage qualPeriodo={qualPeriodo} nSistema={nSistema} />}
            {activeTab === 'intelligence'  && <IntelligencePage rows={rows} />}
            {activeTab === 'clientes'      && <ClientsPage rows={rows} />}
            {activeTab === 'cancelamentos' && <CancelamentosPage cancelledRows={cancelledRows} rows={rows} />}
          </>
        )}
      </main>
    </div>
    </ExportProvider>
  );
}
