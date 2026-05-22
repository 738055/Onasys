import { useMemo, useState } from 'react';
import { BRLFULL, BRLk, PCTFMT, SEGMENT_CFG } from '../utils/format';
import { ExportButton } from '../components/ExportButton';

function IconUsers() {
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          {icon}
        </div>
        <p className="text-xs text-slate-400 max-w-[180px] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

export default function ClientsPage({ rows }) {
  const [selectedType,   setSelectedType]   = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [inactiveDays,   setInactiveDays]   = useState(30);

  // Panel 1: group by clientType (REDE)
  const clientTypes = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const type = r.clientType || '(sem tipo)';
      if (!map[type]) map[type] = { name: type, revenue: 0, profitLiquido: 0, clients: new Set(), saleIds: new Set() };
      map[type].revenue       += r.revenue       || 0;
      map[type].profitLiquido += r.profitLiquido || 0;
      if (r.client) map[type].clients.add(r.client);
      if (r.id)     map[type].saleIds.add(r.id);
    }
    return Object.values(map)
      .map(t => ({
        name:        t.name,
        revenue:     t.revenue,
        profitLiquido: t.profitLiquido,
        clientCount: t.clients.size,
        saleCount:   t.saleIds.size,
        rentPct:     t.revenue > 0 ? (t.profitLiquido / t.revenue) * 100 : null,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  // Panel 2: clients for selected type
  const clients = useMemo(() => {
    if (!selectedType) return [];
    const map = {};
    for (const r of rows) {
      if ((r.clientType || '(sem tipo)') !== selectedType) continue;
      const key = r.client || '(sem nome)';
      if (!map[key]) map[key] = { name: key, revenue: 0, profitLiquido: 0, saleIds: new Set() };
      map[key].revenue       += r.revenue       || 0;
      map[key].profitLiquido += r.profitLiquido || 0;
      if (r.id) map[key].saleIds.add(r.id);
    }
    return Object.values(map)
      .map(c => ({
        name:         c.name,
        revenue:      c.revenue,
        profitLiquido: c.profitLiquido,
        saleCount:    c.saleIds.size,
        rentPct:      c.revenue > 0 ? (c.profitLiquido / c.revenue) * 100 : null,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows, selectedType]);

  // Panel 3: services for selected client
  const services = useMemo(() => {
    if (!selectedClient || !selectedType) return [];
    const map = {};
    for (const r of rows) {
      if ((r.clientType || '(sem tipo)') !== selectedType) continue;
      if ((r.client     || '(sem nome)') !== selectedClient) continue;
      const key = r.product || '(sem serviço)';
      if (!map[key]) map[key] = { name: key, segment: r.segment, revenue: 0, profitLiquido: 0, count: 0, passengers: 0 };
      map[key].revenue       += r.revenue       || 0;
      map[key].profitLiquido += r.profitLiquido || 0;
      map[key].count         += 1;
      map[key].passengers    += r.passengers    || 0;
    }
    const total = Object.values(map).reduce((s, x) => s + x.revenue, 0);
    return Object.values(map)
      .map(s => ({
        ...s,
        rentPct: s.revenue > 0 ? (s.profitLiquido / s.revenue) * 100 : null,
        revPct:  total > 0     ? (s.revenue / total) * 100            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows, selectedType, selectedClient]);

  // KPIs for selected client header
  const clientKPIs = useMemo(() => {
    if (!selectedClient || !selectedType) return null;
    let revenue = 0, profitLiquido = 0;
    const saleIds = new Set();
    for (const r of rows) {
      if ((r.clientType || '(sem tipo)') !== selectedType) continue;
      if ((r.client     || '(sem nome)') !== selectedClient) continue;
      revenue       += r.revenue       || 0;
      profitLiquido += r.profitLiquido || 0;
      if (r.id) saleIds.add(r.id);
    }
    return {
      revenue,
      profitLiquido,
      rentPct:    revenue > 0 ? (profitLiquido / revenue) * 100 : null,
      uniqueSales: saleIds.size,
    };
  }, [rows, selectedType, selectedClient]);

  // Inactive clients: last emissionDate in dataset older than threshold
  const inactiveClients = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - inactiveDays);

    const map = {};
    for (const r of rows) {
      const key = r.client || '(sem nome)';
      if (!map[key]) map[key] = { name: key, clientType: r.clientType || '', lastDate: null, revenue: 0, saleIds: new Set() };
      if (r.emissionDate && (!map[key].lastDate || r.emissionDate > map[key].lastDate)) {
        map[key].lastDate = r.emissionDate;
      }
      if (!map[key].clientType && r.clientType) map[key].clientType = r.clientType;
      map[key].revenue += r.revenue || 0;
      if (r.id) map[key].saleIds.add(r.id);
    }

    return Object.values(map)
      .map(c => ({
        name:       c.name,
        clientType: c.clientType,
        lastDate:   c.lastDate,
        daysSince:  c.lastDate ? Math.floor((today - c.lastDate) / 86400000) : null,
        revenue:    c.revenue,
        saleCount:  c.saleIds.size,
        semTipo:    !c.clientType || c.clientType === '(sem tipo)',
      }))
      .filter(c => !c.lastDate || c.lastDate <= cutoff)
      .sort((a, b) => {
        if (a.daysSince === null && b.daysSince === null) return a.name.localeCompare(b.name);
        if (a.daysSince === null) return 1;
        if (b.daysSince === null) return -1;
        return b.daysSince - a.daysSince;
      });
  }, [rows, inactiveDays]);

  const semTipoCount = inactiveClients.filter(c => c.semTipo).length;

  const maxClientRevenue = clients[0]?.revenue || 1;
  const totalTypeRevenue = clientTypes.reduce((s, t) => s + t.revenue, 0);

  return (
    <div className="space-y-6">
    <div
      className="flex bg-white rounded-xl border border-slate-200 shadow-panel overflow-hidden"
      style={{ height: 'calc(100vh - 230px)', minHeight: 520 }}
    >
      {/* ── Panel 1: Client Types ───────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-r border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-start justify-between gap-1">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo de Cliente</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{clientTypes.length} tipos · campo REDE</p>
            </div>
            <ExportButton
              title="Tipos de Cliente"
              slug="clientes-tipos"
              sections={[{
                title: 'Tipos de Cliente (REDE)',
                columns: [
                  { key: 'name',         label: 'Tipo Cliente', type: 'text'     },
                  { key: 'clientCount',  label: 'Nº Clientes',  type: 'number'   },
                  { key: 'saleCount',    label: 'Nº Vendas',    type: 'number'   },
                  { key: 'revenue',      label: 'Faturamento',  type: 'currency', total: true },
                  { key: 'profitLiquido',label: 'Líquido',      type: 'currency', total: true },
                  { key: 'rentPct',      label: '% Rent.',      type: 'percent'  },
                ],
                rows: clientTypes,
              }]}
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {clientTypes.length === 0 && (
            <p className="text-xs text-slate-400 p-4 text-center">Sem dados no período.</p>
          )}
          {clientTypes.map(ct => {
            const isActive = selectedType === ct.name;
            const typePct  = totalTypeRevenue > 0 ? (ct.revenue / totalTypeRevenue) * 100 : 0;
            return (
              <button
                key={ct.name}
                onClick={() => { setSelectedType(ct.name); setSelectedClient(null); }}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
                  isActive ? 'bg-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-700'}`}>
                  {ct.name}
                </p>
                <div className={`flex justify-between mt-1 text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                  <span>{ct.clientCount} clientes</span>
                  <span>{BRLk(ct.revenue)}</span>
                </div>
                <div className={`mt-1.5 h-0.5 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-100'}`}>
                  <div
                    className={`h-full rounded-full ${isActive ? 'bg-white/60' : 'bg-blue-300'}`}
                    style={{ width: `${typePct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panel 2: Clients ─────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col">
        {!selectedType ? (
          <EmptyState icon={<IconUsers />} text="Selecione um tipo de cliente para listar os clientes" />
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{selectedType}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{clients.length} clientes · ordenado por faturamento</p>
                </div>
                <ExportButton
                  title={`Clientes — ${selectedType}`}
                  slug="clientes-lista"
                  sections={[{
                    title: `Clientes — ${selectedType}`,
                    columns: [
                      { key: 'name',         label: 'Cliente',     type: 'text'     },
                      { key: 'saleCount',    label: 'Nº Vendas',   type: 'number'   },
                      { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                      { key: 'profitLiquido',label: 'Líquido',     type: 'currency', total: true },
                      { key: 'rentPct',      label: '% Rent.',     type: 'percent'  },
                    ],
                    rows: clients,
                  }]}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {clients.map((c, i) => {
                const isActive = selectedClient === c.name;
                const barW     = (c.revenue / maxClientRevenue) * 100;
                return (
                  <button
                    key={c.name}
                    onClick={() => setSelectedClient(c.name)}
                    className={`w-full text-left px-4 py-2.5 border-b border-slate-100 transition-colors ${
                      isActive
                        ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
                        : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="text-[10px] text-slate-400 w-4 pt-0.5 flex-shrink-0 text-right">{i + 1}</span>
                        <p className={`text-xs font-medium truncate leading-snug ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                          {c.name}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-semibold tabular-nums ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                          {BRLk(c.revenue)}
                        </p>
                        <p className={`text-[10px] tabular-nums ${c.rentPct !== null && c.rentPct < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {PCTFMT(c.rentPct)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 h-0.5 bg-slate-100 rounded-full overflow-hidden ml-5">
                      <div
                        className={`h-full rounded-full transition-all ${isActive ? 'bg-blue-400' : 'bg-slate-300'}`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Panel 3: Service Profile ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedClient ? (
          <EmptyState icon={<IconClipboard />} text="Selecione um cliente para ver o perfil de compras" />
        ) : (
          <>
            {/* Client header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{selectedClient}</h3>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                      {selectedType}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {services.length} serviço{services.length !== 1 ? 's' : ''} distinto{services.length !== 1 ? 's' : ''}
                    {clientKPIs && ` · ${clientKPIs.uniqueSales} venda${clientKPIs.uniqueSales !== 1 ? 's' : ''}`}
                  </p>
                </div>
                {selectedClient && services.length > 0 && (
                  <ExportButton
                    title={`Perfil — ${selectedClient}`}
                    slug="clientes-perfil-servicos"
                    sections={[{
                      title: `Perfil de Serviços — ${selectedClient}`,
                      columns: [
                        { key: 'name',         label: 'Serviço',     type: 'text'     },
                        { key: 'segmentLabel', label: 'Segmento',    type: 'text'     },
                        { key: 'count',        label: 'Ocorrências', type: 'number'   },
                        { key: 'revenue',      label: 'Faturamento', type: 'currency', total: true },
                        { key: 'revPct',       label: '% Fat.',      type: 'percent'  },
                        { key: 'rentPct',      label: 'Margem',      type: 'percent'  },
                      ],
                      rows: services.map(s => ({
                        ...s,
                        segmentLabel: SEGMENT_CFG[s.segment]?.label || s.segment || '—',
                      })),
                    }]}
                  />
                )}
                {clientKPIs && (
                  <div className="flex gap-5 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 mb-0.5">Faturamento</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{BRLFULL(clientKPIs.revenue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 mb-0.5">Líquido</p>
                      <p className={`text-sm font-bold tabular-nums ${clientKPIs.profitLiquido < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {BRLFULL(clientKPIs.profitLiquido)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 mb-0.5">Margem</p>
                      <p className={`text-sm font-bold tabular-nums ${clientKPIs.rentPct !== null && clientKPIs.rentPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {PCTFMT(clientKPIs.rentPct)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Services table */}
            <div className="overflow-y-auto flex-1 p-5">
              {services.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Sem serviços registrados.</p>
              ) : (
                <>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-left">
                        <th className="pb-2 pr-3 font-semibold w-6">#</th>
                        <th className="pb-2 pr-4 font-semibold">Serviço</th>
                        <th className="pb-2 pr-3 font-semibold">Segmento</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Ocorr.</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                        <th className="pb-2 pr-3 font-semibold text-right">% Fat.</th>
                        <th className="pb-2 font-semibold text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((s, i) => {
                        const isTop    = i < 3;
                        const isBottom = services.length > 6 && i >= services.length - 3;
                        const segCfg   = SEGMENT_CFG[s.segment] || { label: s.segment || '—', color: '#94a3b8' };

                        return (
                          <tr
                            key={s.name}
                            className={`border-b border-slate-100 ${
                              isTop    ? 'bg-emerald-50/60' :
                              isBottom ? 'bg-amber-50/60'   :
                              'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 pr-3 text-slate-400 font-mono">{i + 1}</td>
                            <td className="py-2.5 pr-4 max-w-[260px]">
                              <div className="flex items-center gap-2">
                                {isTop    && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                                {isBottom && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                                {!isTop && !isBottom && <span className="w-1.5 h-1.5 flex-shrink-0" />}
                                <span className="font-medium text-slate-700 truncate" title={s.name}>{s.name}</span>
                              </div>
                              <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden ml-3.5">
                                <div
                                  className={`h-full rounded-full ${
                                    isTop    ? 'bg-emerald-400' :
                                    isBottom ? 'bg-amber-300'   :
                                    'bg-slate-300'
                                  }`}
                                  style={{ width: `${s.revPct}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap"
                                style={{ backgroundColor: segCfg.color }}
                              >
                                {segCfg.label}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-right text-slate-500 tabular-nums">{s.count}</td>
                            <td className="py-2.5 pr-3 text-right font-semibold text-slate-700 tabular-nums">
                              {BRLFULL(s.revenue)}
                            </td>
                            <td className="py-2.5 pr-3 text-right text-slate-500 tabular-nums">
                              {s.revPct.toFixed(1)}%
                            </td>
                            <td className={`py-2.5 text-right font-semibold tabular-nums ${
                              s.rentPct !== null && s.rentPct < 0 ? 'text-red-600' : 'text-emerald-700'
                            }`}>
                              {PCTFMT(s.rentPct)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {services.length > 6 && (
                    <div className="flex gap-5 mt-4 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Top 3 serviços mais comprados
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        3 serviços menos comprados
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>

    {/* ── Inactive Clients Section ─────────────────────────────────── */}
    <div className="bg-white rounded-xl border border-slate-200 shadow-panel overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Monitoramento de Inatividade</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Clientes sem compras nos últimos{' '}
              <span className="font-semibold text-slate-600">{inactiveDays} dias</span>
              {' · '}
              <span className="font-semibold text-slate-700">{inactiveClients.length}</span>{' '}
              cliente{inactiveClients.length !== 1 ? 's' : ''} inativo{inactiveClients.length !== 1 ? 's' : ''}
              {semTipoCount > 0 && (
                <> · <span className="text-amber-600 font-semibold">{semTipoCount} sem tipo</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
            {[30, 60, 90, 120].map((d, i) => (
              <button
                key={d}
                onClick={() => setInactiveDays(d)}
                className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                  inactiveDays === d
                    ? d <= 30 ? 'bg-amber-500 text-white'
                    : d <= 60 ? 'bg-orange-500 text-white'
                    : d <= 90 ? 'bg-red-500 text-white'
                    :           'bg-red-800 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <ExportButton
            title={`Inatividade — ${inactiveDays} dias`}
            slug="clientes-inativos"
            sections={[{
              title: `Clientes Inativos (${inactiveDays} dias)`,
              columns: [
                { key: 'name',       label: 'Cliente',       type: 'text'     },
                { key: 'clientType', label: 'Tipo (REDE)',    type: 'text'     },
                { key: 'lastDateFmt',label: 'Última Compra', type: 'text'     },
                { key: 'daysSince',  label: 'Dias Inativo',  type: 'number'   },
                { key: 'revenue',    label: 'Fat. no Período',type: 'currency', total: true },
                { key: 'saleCount',  label: 'Vendas',        type: 'number'   },
              ],
              rows: inactiveClients.map(c => ({
                ...c,
                lastDateFmt: c.lastDate ? c.lastDate.toLocaleDateString('pt-BR') : '—',
              })),
            }]}
          />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-left bg-slate-50/50">
              <th className="px-5 py-2.5 font-semibold w-8">#</th>
              <th className="px-3 py-2.5 font-semibold">Cliente</th>
              <th className="px-3 py-2.5 font-semibold">Tipo (REDE)</th>
              <th className="px-3 py-2.5 font-semibold text-right">Última Compra</th>
              <th className="px-3 py-2.5 font-semibold text-right">Dias Inativo</th>
              <th className="px-3 py-2.5 font-semibold text-right">Fat. no Período</th>
              <th className="px-5 py-2.5 font-semibold text-right">Vendas</th>
            </tr>
          </thead>
          <tbody>
            {inactiveClients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  Nenhum cliente inativo nos últimos {inactiveDays} dias.
                </td>
              </tr>
            )}
            {inactiveClients.map((c, i) => {
              const days = c.daysSince;
              const rowBg =
                c.semTipo     ? 'bg-amber-50/70'  :
                days === null ? 'bg-slate-50'      :
                days >= 120   ? 'bg-red-50'        :
                days >= 90    ? 'bg-orange-50'     :
                days >= 60    ? 'bg-yellow-50'     :
                                'hover:bg-slate-50';
              const daysColor =
                days === null ? 'text-slate-400'               :
                days >= 120   ? 'text-red-700 font-bold'       :
                days >= 90    ? 'text-orange-600 font-semibold':
                days >= 60    ? 'text-amber-600 font-semibold' :
                                'text-slate-600';
              return (
                <tr key={c.name} className={`border-b border-slate-100 transition-colors ${rowBg}`}>
                  <td className="px-5 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <p className="font-medium text-slate-700 truncate" title={c.name}>{c.name}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {c.semTipo ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                        sem tipo
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                        {c.clientType}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500">
                    {c.lastDate
                      ? c.lastDate.toLocaleDateString('pt-BR')
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${daysColor}`}>
                    {days !== null ? `${days}d` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-700 tabular-nums">
                    {c.revenue > 0 ? BRLFULL(c.revenue) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-500 tabular-nums">{c.saleCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {inactiveClients.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-5 text-[10px] text-slate-400 bg-slate-50/50">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-yellow-100 border border-yellow-300 inline-block" /> 60–89 dias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-orange-100 border border-orange-300 inline-block" /> 90–119 dias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-300 inline-block" /> 120+ dias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block" /> sem tipo (REDE)
          </span>
        </div>
      )}
    </div>
    </div>
  );
}
