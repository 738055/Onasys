import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ComposedChart, Line,
} from 'recharts';
import { XCircle, RefreshCw, Users, Package, Building2 } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';
import { BRLFULL, BRLk, PCTFMT } from '../utils/format';

const PAGE_SIZE = 25;
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function fmtMonth(key) {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
}

function topNByCount(rows, field, n = 10) {
  const map = {};
  for (const r of rows) {
    const key = r[field] || '(sem nome)';
    if (!map[key]) map[key] = { name: key, count: 0, pax: 0 };
    map[key].count++;
    map[key].pax += r.passengers || 0;
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, n);
}

function topNByRevenue(rows, field, n = 10) {
  const map = {};
  for (const r of rows) {
    const key = r[field] || '(sem nome)';
    if (!map[key]) map[key] = { name: key, count: 0, revenue: 0, profit: 0 };
    map[key].count++;
    // Usa revenueRaw/profitRaw para mostrar os valores originais da operação
    map[key].revenue += r.revenueRaw || 0;
    map[key].profit  += r.profitRaw  || 0;
  }
  return Object.values(map)
    .map(g => ({ ...g, rentPct: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, n);
}

function monthlyCountTrend(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.emissionDate) continue;
    const d = r.emissionDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { month: key, label: fmtMonth(key), count: 0, pax: 0 };
    map[key].count++;
    map[key].pax += r.passengers || 0;
  }
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}

function monthlyRevTrend(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.emissionDate) continue;
    const d = r.emissionDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { month: key, label: fmtMonth(key), revenue: 0, costImpact: 0, count: 0 };
    // revenue = total devolvido (revenueRaw); costImpact = só o que realmente impactou o KPI (≤0)
    map[key].revenue    += r.revenueRaw || 0;
    map[key].costImpact += Math.min(r.profitRaw || 0, 0);
    map[key].count++;
  }
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}

function CountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-slate-500">{p.name}</span>
          <span className="font-semibold">{p.value?.toLocaleString('pt-BR')}</span>
        </div>
      ))}
    </div>
  );
}

function FinTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-slate-500">{p.name}</span>
          <span className="font-semibold">
            {p.name === 'Qtd' ? p.value?.toLocaleString('pt-BR') : BRLFULL(p.value || 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TopChart({ data, title, tooltip, color, valueKey = 'count', labelFmt }) {
  if (data.length === 0) return <p className="text-xs text-slate-400 text-center py-8">Sem dados.</p>;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
      <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-1">
        {title}
        {tooltip && <InfoTooltip text={tooltip} />}
      </h2>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30)}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tickFormatter={labelFmt || (v => v.toLocaleString('pt-BR'))} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
          <Tooltip formatter={(v, name) => [labelFmt ? labelFmt(v) : v.toLocaleString('pt-BR'), name]} />
          <Bar dataKey={valueKey} name={valueKey === 'count' ? 'Cancelamentos' : 'Faturamento'} fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaginationBar({ page, pageCount, total, label, onPrev, onNext }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
      <p className="text-xs text-slate-400">Página {page + 1} de {pageCount} ({total.toLocaleString('pt-BR')} {label})</p>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={page === 0}
          className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">‹ Anterior</button>
        <button onClick={onNext} disabled={page === pageCount - 1}
          className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">Próxima ›</button>
      </div>
    </div>
  );
}

export default function CancelamentosPage({ cancelledRows, rows }) {
  const [activeTab,   setActiveTab]   = useState('cancelamentos');
  const [cancelPage,  setCancelPage]  = useState(0);
  const [reembPage,   setReembPage]   = useState(0);

  useEffect(() => { setCancelPage(0); }, [cancelledRows]);
  useEffect(() => { setReembPage(0);  }, [rows]);

  const reembolsoRows = useMemo(() => rows.filter(r => r.idStatusServico === 28), [rows]);

  // ── Cancelamentos ──────────────────────────────────────────────────────────
  const cancelStats = useMemo(() => ({
    total:           cancelledRows.length,
    uniqueSales:     new Set(cancelledRows.map(r => r.id).filter(Boolean)).size,
    totalPax:        cancelledRows.reduce((s, r) => s + (r.passengers || 0), 0),
    uniqueSuppliers: new Set(cancelledRows.map(r => r.supplier).filter(Boolean)).size,
    uniqueVendors:   new Set(cancelledRows.map(r => r.vendor).filter(Boolean)).size,
  }), [cancelledRows]);

  const topCancelVendors   = useMemo(() => topNByCount(cancelledRows, 'vendor',   10), [cancelledRows]);
  const topCancelClients   = useMemo(() => topNByCount(cancelledRows, 'client',   10), [cancelledRows]);
  const topCancelSuppliers = useMemo(() => topNByCount(cancelledRows, 'supplier', 10), [cancelledRows]);
  const topCancelProducts  = useMemo(() => topNByCount(cancelledRows, 'product',  10), [cancelledRows]);
  const cancelTrend        = useMemo(() => monthlyCountTrend(cancelledRows), [cancelledRows]);

  const cancelSorted = useMemo(() =>
    [...cancelledRows].sort((a, b) => (b.emissionDate?.getTime() || 0) - (a.emissionDate?.getTime() || 0)),
  [cancelledRows]);

  // ── Reembolsos ─────────────────────────────────────────────────────────────
  const reembStats = useMemo(() => {
    const lostRevenue = reembolsoRows.reduce((s, r) => s + (r.revenueRaw || 0), 0);
    const costImpact  = reembolsoRows.reduce((s, r) => s + Math.min(r.profitRaw || 0, 0), 0);
    const errCount    = reembolsoRows.filter(r => (r.profitRaw || 0) > 0).length;
    return {
      count:       reembolsoRows.length,
      uniqueSales: new Set(reembolsoRows.map(r => r.id).filter(Boolean)).size,
      lostRevenue,   // receita que deixamos de ter (total devolvido)
      costImpact,    // custo real que entra no KPI (≤0)
      errCount,      // itens com lucro positivo (erro de lançamento)
    };
  }, [reembolsoRows]);

  const topReembVendors   = useMemo(() => topNByRevenue(reembolsoRows, 'vendor',   10), [reembolsoRows]);
  const topReembClients   = useMemo(() => topNByRevenue(reembolsoRows, 'client',   10), [reembolsoRows]);
  const topReembSuppliers = useMemo(() => topNByRevenue(reembolsoRows, 'supplier', 10), [reembolsoRows]);
  const topReembProducts  = useMemo(() => topNByRevenue(reembolsoRows, 'product',  10), [reembolsoRows]);
  const reembTrend        = useMemo(() => monthlyRevTrend(reembolsoRows), [reembolsoRows]);

  const reembSorted = useMemo(() =>
    [...reembolsoRows].sort((a, b) => (b.revenueRaw || 0) - (a.revenueRaw || 0)),
  [reembolsoRows]);

  const cancelPageCount = Math.ceil(cancelSorted.length / PAGE_SIZE);
  const cancelPageRows  = cancelSorted.slice(cancelPage * PAGE_SIZE, (cancelPage + 1) * PAGE_SIZE);
  const reembPageCount  = Math.ceil(reembSorted.length / PAGE_SIZE);
  const reembPageRows   = reembSorted.slice(reembPage * PAGE_SIZE, (reembPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">

      {/* ── Seletor de seção ── */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('cancelamentos')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'cancelamentos'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <XCircle size={15} />
          Cancelamentos
          {cancelledRows.length > 0 && (
            <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
              activeTab === 'cancelamentos' ? 'bg-white/25 text-white' : 'bg-red-100 text-red-600'
            }`}>
              {cancelledRows.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reembolsos')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'reembolsos'
              ? 'bg-fuchsia-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <RefreshCw size={15} />
          Reembolsos Aprovados
          {reembolsoRows.length > 0 && (
            <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
              activeTab === 'reembolsos' ? 'bg-white/25 text-white' : 'bg-fuchsia-100 text-fuchsia-600'
            }`}>
              {reembolsoRows.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════ CANCELAMENTOS ══════════════ */}
      {activeTab === 'cancelamentos' && (
        <>
          {cancelledRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <XCircle className="text-slate-300" size={24} />
              </div>
              <p className="text-slate-500 font-medium">Nenhum item cancelado no período</p>
              <p className="text-xs text-slate-400 mt-1">Ajuste o intervalo de datas para carregar os dados</p>
            </div>
          ) : (
            <>
              {/* Aviso explicativo */}
              <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">
                <XCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Itens CANCELADO estão excluídos de todos os cálculos financeiros do BI</strong> — faturamento, margem, pax e KPIs não contabilizam esses registros.
                  Os valores da API para cancelados são zero e não geram nem a pagar nem a receber.
                </span>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="Itens Cancelados"   value={cancelStats.total}           format="number" icon={XCircle}    color="red"
                  tooltip="Total de itens com status CANCELADO no período. Excluídos de todos os cálculos financeiros." />
                <KPICard title="Pax Cancelados"     value={cancelStats.totalPax}        format="number" icon={Users}      color="red"   sub="num_pax"
                  tooltip="Soma de num_pax dos itens cancelados — passageiros impactados pelo cancelamento." />
                <KPICard title="Fornecedores"       value={cancelStats.uniqueSuppliers} format="number" icon={Package}    color="slate"
                  tooltip="Fornecedores distintos com pelo menos um item cancelado no período." />
                <KPICard title="Emissores Envolvidos" value={cancelStats.uniqueVendors} format="number" icon={Building2}  color="slate"
                  tooltip="Emissores distintos com pelo menos um item cancelado. Útil para identificar padrões operacionais." />
              </div>

              {/* Tendência mensal */}
              {cancelTrend.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
                  <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    Evolução Mensal de Cancelamentos
                    <InfoTooltip text="Quantidade de itens cancelados por mês de emissão. Permite identificar sazonalidade ou eventos pontuais com picos de cancelamento." />
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">Barras = nº de itens cancelados · linha = pax cancelados</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={cancelTrend} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left"  orientation="left"  tickFormatter={v => v.toLocaleString('pt-BR')} tick={{ fontSize: 11 }} width={36} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={v => v.toLocaleString('pt-BR')} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip content={<CountTooltip />} />
                      <Bar  yAxisId="left"  dataKey="count" name="Itens"  fill="#ef4444" opacity={0.85} radius={[3,3,0,0]} />
                      <Line yAxisId="right" dataKey="pax"   name="Pax"   stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Rankings 2×2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopChart data={topCancelVendors}   color="#ef4444" title="Top 10 Emissores — Cancelamentos"
                  tooltip="Emissores com maior número de itens cancelados. Não reflete necessariamente falha do emissor — pode ser cancelamento solicitado pelo cliente." />
                <TopChart data={topCancelClients}   color="#f97316" title="Top 10 Clientes — Cancelamentos"
                  tooltip="Clientes com maior volume de cancelamentos. Alta concentração pode indicar problemas de relacionamento ou expectativa do produto." />
                <TopChart data={topCancelSuppliers} color="#a855f7" title="Top 10 Fornecedores — Cancelamentos"
                  tooltip="Fornecedores cujos serviços foram mais cancelados — pode indicar problemas de disponibilidade ou qualidade." />
                <TopChart data={topCancelProducts}  color="#6366f1" title="Top 10 Serviços — Cancelamentos"
                  tooltip="Serviços com mais cancelamentos no período. Útil para identificar produtos problemáticos ou revisar a operação." />
              </div>

              {/* Auditoria completa */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    Auditoria de Cancelamentos
                    <InfoTooltip text="Lista completa de itens CANCELADO no período. Valores financeiros são zero — não geram contas a pagar nem a receber." />
                    <span className="ml-1 text-slate-400 font-normal text-xs">({cancelledRows.length.toLocaleString('pt-BR')} itens)</span>
                  </h2>
                  <ExportButton
                    title="Auditoria de Cancelamentos"
                    slug="cancelamentos-auditoria"
                    sections={[{
                      title: 'Cancelamentos',
                      columns: [
                        { key: 'id',           label: 'Venda',      type: 'text'   },
                        { key: 'emissionDate', label: 'Emissão',    type: 'text'   },
                        { key: 'checkinDate',  label: 'Check-in',   type: 'text'   },
                        { key: 'filial',       label: 'Filial',     type: 'text'   },
                        { key: 'vendor',       label: 'Emissor',    type: 'text'   },
                        { key: 'client',       label: 'Cliente',    type: 'text'   },
                        { key: 'supplier',     label: 'Fornecedor', type: 'text'   },
                        { key: 'product',      label: 'Serviço',    type: 'text'   },
                        { key: 'passengers',   label: 'Pax',        type: 'number' },
                      ],
                      rows: cancelSorted.map(r => ({
                        ...r,
                        emissionDate: r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-',
                        checkinDate:  r.checkinDate  ? r.checkinDate.toLocaleDateString('pt-BR')  : '-',
                      })),
                    }]}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-left">
                        <th className="pb-2 pr-3 font-semibold">Venda</th>
                        <th className="pb-2 pr-3 font-semibold">Emissão</th>
                        <th className="pb-2 pr-3 font-semibold">Check-in</th>
                        <th className="pb-2 pr-3 font-semibold">Filial</th>
                        <th className="pb-2 pr-3 font-semibold">Emissor</th>
                        <th className="pb-2 pr-3 font-semibold">Cliente</th>
                        <th className="pb-2 pr-3 font-semibold">Fornecedor</th>
                        <th className="pb-2 pr-3 font-semibold">Serviço</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Pax</th>
                        <th className="pb-2 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelPageRows.length === 0 && (
                        <tr><td colSpan={10} className="py-8 text-center text-slate-400">Sem dados na página.</td></tr>
                      )}
                      {cancelPageRows.map((r, i) => (
                        <tr key={`${r.id}-${i}`} className="border-b border-slate-100 hover:bg-red-50">
                          <td className="py-2 pr-3 font-mono text-slate-500">{r.id}</td>
                          <td className="py-2 pr-3 text-slate-500">{r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="py-2 pr-3 text-slate-500">{r.checkinDate  ? r.checkinDate.toLocaleDateString('pt-BR')  : '—'}</td>
                          <td className="py-2 pr-3 text-slate-500 max-w-[5rem] truncate">{r.filial || '—'}</td>
                          <td className="py-2 pr-3 text-slate-600 max-w-[8rem] truncate" title={r.vendor}>{r.vendor || '—'}</td>
                          <td className="py-2 pr-3 text-slate-700 font-medium max-w-[9rem] truncate" title={r.client}>{r.client || '—'}</td>
                          <td className="py-2 pr-3 text-slate-600 max-w-[9rem] truncate" title={r.supplier}>{r.supplier || '—'}</td>
                          <td className="py-2 pr-3 text-slate-600 max-w-[11rem] truncate" title={r.product}>{r.product || '—'}</td>
                          <td className="py-2 pr-3 text-right text-slate-600 tabular-nums">{r.passengers || '—'}</td>
                          <td className="py-2 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                              CANCELADO
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={cancelPage} pageCount={cancelPageCount} total={cancelledRows.length} label="itens"
                  onPrev={() => setCancelPage(p => Math.max(0, p - 1))}
                  onNext={() => setCancelPage(p => Math.min(cancelPageCount - 1, p + 1))}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ REEMBOLSOS ══════════════ */}
      {activeTab === 'reembolsos' && (
        <>
          {reembolsoRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <RefreshCw className="text-slate-300" size={24} />
              </div>
              <p className="text-slate-500 font-medium">Nenhum reembolso aprovado no período</p>
              <p className="text-xs text-slate-400 mt-1">Ajuste o intervalo de datas para carregar os dados</p>
            </div>
          ) : (
            <>
              {/* Aviso explicativo */}
              <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50 text-xs text-fuchsia-700">
                <RefreshCw size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Reembolsos NÃO entram no Faturamento Total nem geram lucro nos KPIs do BI.</strong>
                  {' '}Apenas custos reais (taxas, comissões pagas) de reembolsos com resultado negativo reduzem o Resultado AB do período.
                  {' '}Lançamentos com lucro positivo são erros operacionais e estão excluídos. O fornecedor exibido é sempre o <strong>fornecedor original</strong> da venda.
                </span>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="Reembolsos"           value={reembStats.count}       format="number"   color="fuchsia" icon={RefreshCw}
                  tooltip="Total de itens com status REEMBOLSO APROVADO no período." />
                <KPICard title="Receita Não Realizada" value={reembStats.lostRevenue} format="currency" color="fuchsia"
                  tooltip="Total devolvido aos clientes (total_vendas original). Essa receita saiu do caixa — não entra no KPI de Faturamento do BI." />
                <KPICard title="Custo Real no Resultado" value={reembStats.costImpact} format="currency" color={reembStats.costImpact < 0 ? 'red' : 'slate'}
                  tooltip="Soma dos custos reais incorridos nos reembolsos (taxas, comissões pagas). Apenas os valores negativos reduzem o Resultado AB do período." />
                <KPICard title="Erros de Lançamento"  value={reembStats.errCount}    format="number"   color={reembStats.errCount > 0 ? 'red' : 'slate'}
                  tooltip="Reembolsos com resultado positivo na API — impossível operacionalmente, indica erro de lançamento. Esses valores são excluídos do KPI." />
              </div>

              {/* Tendência mensal */}
              {reembTrend.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
                  <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    Evolução Mensal — Reembolsos Aprovados
                    <InfoTooltip text="Faturamento e resultado dos reembolsos por mês de emissão. Permite identificar concentração temporal de pedidos de reembolso." />
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">Barras = receita devolvida (não entra no KPI) · linha vermelha = custo real no Resultado AB · linha pontilhada = qtd</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={reembTrend} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="money" tickFormatter={BRLk} tick={{ fontSize: 11 }} width={62} />
                      <YAxis yAxisId="count" orientation="right" tickFormatter={v => v.toLocaleString('pt-BR')} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip content={<FinTooltip />} />
                      <Bar  yAxisId="money" dataKey="revenue"    name="Receita não realizada" fill="#c026d3" opacity={0.85} radius={[3,3,0,0]} />
                      <Line yAxisId="money" dataKey="costImpact" name="Custo no Resultado AB" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                      <Line yAxisId="count" dataKey="count"      name="Qtd"                   stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2.5 }} type="monotone" strokeDasharray="5 3" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Rankings 2×2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopChart data={topReembVendors}   color="#c026d3" title="Top 10 Emissores — Reembolsos"   valueKey="revenue"
                  tooltip="Emissores com maior faturamento em reembolsos aprovados." labelFmt={BRLk} />
                <TopChart data={topReembClients}   color="#a21caf" title="Top 10 Clientes — Reembolsos"    valueKey="revenue"
                  tooltip="Clientes com maior faturamento em reembolsos. Concentração alta pode indicar problema de expectativa ou entrega." labelFmt={BRLk} />
                <TopChart data={topReembSuppliers} color="#7c3aed" title="Top 10 Fornecedores — Reembolsos" valueKey="revenue"
                  tooltip="Fornecedores cujos serviços geraram mais reembolsos. Pode indicar problemas de qualidade ou operação." labelFmt={BRLk} />
                <TopChart data={topReembProducts}  color="#6d28d9" title="Top 10 Serviços — Reembolsos"    valueKey="revenue"
                  tooltip="Serviços com maior faturamento em reembolsos aprovados no período." labelFmt={BRLk} />
              </div>

              {/* Auditoria completa */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    Auditoria de Reembolsos Aprovados
                    <InfoTooltip text="Lista de itens REEMBOLSO APROVADO. 'Fat. Original' e 'Result. Original' mostram os valores brutos da API. 'Status KPI' indica se o item gerou custo real (incluído no Resultado AB), foi excluído por erro de lançamento, ou não teve impacto." />
                    <span className="ml-1 text-slate-400 font-normal text-xs">({reembolsoRows.length.toLocaleString('pt-BR')} itens)</span>
                  </h2>
                  <ExportButton
                    title="Auditoria de Reembolsos Aprovados"
                    slug="reembolsos-auditoria"
                    sections={[{
                      title: 'Reembolsos Aprovados',
                      columns: [
                        { key: 'id',                      label: 'Venda',              type: 'text'     },
                        { key: 'emissionDate',            label: 'Emissão',            type: 'text'     },
                        { key: 'checkinDate',             label: 'Check-in',           type: 'text'     },
                        { key: 'filial',                  label: 'Filial',             type: 'text'     },
                        { key: 'vendor',                  label: 'Emissor',            type: 'text'     },
                        { key: 'client',                  label: 'Cliente',            type: 'text'     },
                        { key: 'supplier',                label: 'Fornecedor',         type: 'text'     },
                        { key: 'refundOriginalVoucherStr',label: 'Vchr. Original',     type: 'text'     },
                        { key: 'product',                 label: 'Serviço',            type: 'text'     },
                        { key: 'passengers',              label: 'Pax',                type: 'number'   },
                        { key: 'revenueRaw',              label: 'Fat. Original',      type: 'currency', total: true },
                        { key: 'profitRaw',               label: 'Result. Original',   type: 'currency', total: true },
                        { key: 'statusKpi',               label: 'Status KPI',         type: 'text'     },
                      ],
                      rows: reembSorted.map(r => ({
                        ...r,
                        emissionDate: r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-',
                        checkinDate:  r.checkinDate  ? r.checkinDate.toLocaleDateString('pt-BR')  : '-',
                        refundOriginalVoucherStr: r.refundOriginalVoucher > 0 ? String(r.refundOriginalVoucher) : '—',
                        statusKpi: (r.profitRaw || 0) < 0 ? 'Custo incluso' : (r.profitRaw || 0) > 0 ? 'Excluído — erro' : 'Sem impacto',
                      })),
                    }]}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-left">
                        <th className="pb-2 pr-3 font-semibold">Venda</th>
                        <th className="pb-2 pr-3 font-semibold">Emissão</th>
                        <th className="pb-2 pr-3 font-semibold">Check-in</th>
                        <th className="pb-2 pr-3 font-semibold">Filial</th>
                        <th className="pb-2 pr-3 font-semibold">Emissor</th>
                        <th className="pb-2 pr-3 font-semibold">Cliente</th>
                        <th className="pb-2 pr-3 font-semibold">Fornecedor</th>
                        <th className="pb-2 pr-3 font-semibold text-center">Vchr. Original</th>
                        <th className="pb-2 pr-3 font-semibold">Serviço</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Pax</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Fat. Original</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Result. Original</th>
                        <th className="pb-2 font-semibold text-center">Status KPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reembPageRows.length === 0 && (
                        <tr><td colSpan={13} className="py-8 text-center text-slate-400">Sem dados na página.</td></tr>
                      )}
                      {reembPageRows.map((r, i) => {
                        const rawProfit = r.profitRaw || 0;
                        const rawRev    = r.revenueRaw || 0;
                        const isCost    = rawProfit < 0;                    // custo real — entra no KPI
                        const isError   = rawProfit > 0;                    // lucro impossível — excluído do KPI
                        const isZero    = rawProfit === 0 && rawRev === 0;  // sem impacto
                        const rowBg = isCost ? 'bg-red-50' : isError ? 'bg-amber-50' : 'hover:bg-fuchsia-50';
                        return (
                          <tr key={`${r.id}-${i}`} className={`border-b border-slate-100 ${rowBg}`}>
                            <td className="py-2 pr-3 font-mono text-slate-500">{r.id}</td>
                            <td className="py-2 pr-3 text-slate-500">{r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="py-2 pr-3 text-slate-500">{r.checkinDate  ? r.checkinDate.toLocaleDateString('pt-BR')  : '—'}</td>
                            <td className="py-2 pr-3 text-slate-500 max-w-[5rem] truncate">{r.filial || '—'}</td>
                            <td className="py-2 pr-3 text-slate-600 max-w-[8rem] truncate" title={r.vendor}>{r.vendor || '—'}</td>
                            <td className="py-2 pr-3 text-slate-700 font-medium max-w-[9rem] truncate" title={r.client}>{r.client || '—'}</td>
                            <td className="py-2 pr-3 text-slate-600 max-w-[9rem] truncate" title={r.supplier}>{r.supplier || '—'}</td>
                            <td className="py-2 pr-3 text-center">
                              {r.refundOriginalVoucher > 0 ? (
                                <span
                                  className="inline-block font-mono text-[10px] bg-fuchsia-100 text-fuchsia-700 px-1.5 py-0.5 rounded"
                                  title="Voucher original que originou este reembolso"
                                >
                                  #{r.refundOriginalVoucher}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-slate-600 max-w-[11rem] truncate" title={r.product}>{r.product || '—'}</td>
                            <td className="py-2 pr-3 text-right text-slate-600 tabular-nums">{r.passengers || '—'}</td>
                            <td className="py-2 pr-3 text-right text-slate-600 tabular-nums">{BRLFULL(rawRev)}</td>
                            <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${isCost ? 'text-red-600' : isError ? 'text-amber-600' : 'text-slate-400'}`}>
                              {BRLFULL(rawProfit)}
                            </td>
                            <td className="py-2 text-center">
                              {isCost && (
                                <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700"
                                  title="Custo real (taxa/comissão paga). Este valor negativo reduz o Resultado AB do período.">
                                  custo incluso
                                </span>
                              )}
                              {isError && (
                                <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                                  title="Lucro positivo em reembolso é erro de lançamento. Receita e resultado excluídos do KPI.">
                                  erro excluído
                                </span>
                              )}
                              {isZero && (
                                <span className="text-slate-300 text-[10px]">sem impacto</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {reembolsoRows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 font-semibold text-slate-700 bg-slate-50">
                          <td className="pt-2 pr-3 text-xs" colSpan={10}>TOTAL</td>
                          <td className="pt-2 pr-3 text-right text-xs tabular-nums">{BRLFULL(reembStats.lostRevenue)}</td>
                          <td className={`pt-2 pr-3 text-right text-xs tabular-nums ${reembStats.costImpact < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                            {BRLFULL(reembStats.costImpact)}
                            <span className="ml-1 font-normal text-[9px] text-slate-400">no KPI</span>
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <PaginationBar
                  page={reembPage} pageCount={reembPageCount} total={reembolsoRows.length} label="itens"
                  onPrev={() => setReembPage(p => Math.max(0, p - 1))}
                  onNext={() => setReembPage(p => Math.min(reembPageCount - 1, p + 1))}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
