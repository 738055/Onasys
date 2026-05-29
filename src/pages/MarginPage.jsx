import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  BarChart, Bar, Cell, LineChart, Line, Legend, LabelList,
} from 'recharts';

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function fmtMonthKey(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]}/${y.slice(2)}`;
}

// Cores por grupo de origem
const GROUP_COLORS = {
  Venda:      '#dc2626',
  Escala:     '#f97316',
  Financeira: '#f59e0b',
  Comercial:  '#3b82f6',
  Outro:      '#94a3b8',
};
import { scatterBySupplier, scatterByVendor, groupByLossReason, lossDiagnosticTotals, escalaDeepDive, groupLossReasonByMonth } from '../utils/aggregations';
import { supplierMarginTrend } from '../utils/supplierConcentration';
import { BRLFULL, BRLk, resolveLossReason } from '../utils/format';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';
import { ScaleAuditModal } from '../components/ScaleAuditModal';

const PAGE_SIZE = 20;

const DIST_BUCKETS = [
  { label: '< −20%',       min: -Infinity, max: -20,       color: '#ef4444' },
  { label: '−20% a −10%',  min: -20,       max: -10,       color: '#f97316' },
  { label: '−10% a 0%',    min: -10,       max: 0,         color: '#fbbf24' },
  { label: '0% a 10%',     min: 0,         max: 10,        color: '#a3e635' },
  { label: '10% a 20%',    min: 10,        max: 20,        color: '#34d399' },
  { label: '20% a 30%',    min: 20,        max: 30,        color: '#10b981' },
  { label: '> 30%',        min: 30,        max: Infinity,  color: '#059669' },
];

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
      <p className="text-slate-500">Faturamento: <span className="text-slate-700 font-medium">{BRLFULL(d.revenue)}</span></p>
      <p className="text-slate-500">Líquido <span className="text-slate-400">(total_liquido)</span>: <span className="font-medium">{BRLFULL(d.profitLiquido)}</span></p>
      <p className="text-slate-500">Resultado AB <span className="text-slate-400">(total_resultadoab)</span>: <span className={`font-medium ${d.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(d.profit)}</span></p>
      <p className="text-slate-500">Margem: <span className={`font-medium ${d.margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{d.margin.toFixed(2)}%</span></p>
    </div>
  );
}

function DistTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.label}</p>
      <p>{d.count.toLocaleString('pt-BR')} itens</p>
      <p>Faturamento: {BRLFULL(d.revenue)}</p>
    </div>
  );
}

function LossReasonTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.reason}</p>
      <p className="text-slate-500">Grupo: <span className="font-medium">{d.group}</span></p>
      <p className="text-slate-500">Prejuízo: <span className="font-medium text-red-600">{BRLFULL(-d.absloss)}</span></p>
      <p className="text-slate-500">Itens: <span className="font-medium">{d.items.toLocaleString('pt-BR')}</span></p>
      <p className="text-slate-500">% do Total: <span className="font-medium">{d.share.toFixed(1)}%</span></p>
    </div>
  );
}

export default function MarginPage({ rows }) {
  const [page, setPage]                     = useState(0);
  const [selectedReason, setSelectedReason]   = useState(null);
  const [scaleAuditEscala, setScaleAuditEscala] = useState(null);  // idEscala a auditar (null = fechado)
  useEffect(() => { setPage(0); setSelectedReason(null); }, [rows]);

  const distRef        = useRef(null);
  const scatterRef     = useRef(null);
  const vendorScatRef  = useRef(null);
  const trendRef       = useRef(null);
  const lossReasonRef  = useRef(null);

  const scatter        = useMemo(() => scatterBySupplier(rows),           [rows]);
  const vendorScatter  = useMemo(() => scatterByVendor(rows),             [rows]);
  const trendData      = useMemo(() => supplierMarginTrend(rows, 10),     [rows]);
  const losses         = useMemo(() => rows.filter(r => r.profit < 0).sort((a, b) => a.profit - b.profit), [rows]);
  const lossReasonData = useMemo(() => groupByLossReason(rows),           [rows]);
  const diagnostics    = useMemo(() => lossDiagnosticTotals(rows),        [rows]);
  const escalaDive     = useMemo(() => escalaDeepDive(rows),              [rows]);
  const lossTrend      = useMemo(() => groupLossReasonByMonth(rows),      [rows]);

  const totalPrejuizo  = useMemo(() => losses.reduce((s, r) => s + r.profit, 0), [losses]);
  const piorResultado  = useMemo(() => losses.length > 0 ? losses[0].profit : 0, [losses]);
  const pctNeg         = rows.length > 0 ? (losses.length / rows.length * 100) : 0;

  const distribution = useMemo(() => {
    const counts = DIST_BUCKETS.map(b => ({ ...b, count: 0, revenue: 0 }));
    for (const r of rows) {
      if (!r.revenue || r.revenue === 0) continue;
      const m = (r.profit / r.revenue) * 100;
      for (const b of counts) {
        if (m >= b.min && m < b.max) {
          b.count++;
          b.revenue += r.revenue;
          break;
        }
      }
    }
    return counts;
  }, [rows]);

  // Losses filtradas por origem (quando o usuário clica numa barra)
  const filteredLosses = useMemo(() => {
    if (!selectedReason) return losses;
    return losses.filter(r => resolveLossReason(r.lossReason).label === selectedReason);
  }, [losses, selectedReason]);

  const pageCount = Math.ceil(filteredLosses.length / PAGE_SIZE);
  const pageRows  = filteredLosses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleBarClick(data) {
    if (!data) return;
    const reason = data.activePayload?.[0]?.payload?.reason;
    if (!reason) return;
    setSelectedReason(prev => prev === reason ? null : reason);
    setPage(0);
  }

  return (
    <>
    <div className="space-y-6">
      {/* KPI summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-700 opacity-70 flex items-center gap-0.5">
            Total Prejuízo
            <InfoTooltip text="Soma dos Resultados AB (total_resultadoab) negativos do período. Cada linha da API é analisada individualmente — um fornecedor pode ter margem positiva no agregado e ter itens negativos pontuais." />
          </p>
          <p className="mt-2 text-xl font-bold text-red-800 tabular-nums">{BRLFULL(totalPrejuizo)}</p>
          <p className="mt-0.5 text-xs text-red-600 opacity-60">soma do período</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-700 opacity-70 flex items-center gap-0.5">
            Itens Negativos
            <InfoTooltip text="Contagem de linhas onde total_resultadoab &lt; 0, expressa como % do total de itens no período. Um item = uma linha da API (um serviço dentro de uma venda)." />
          </p>
          <p className="mt-2 text-xl font-bold text-red-800 tabular-nums">{losses.length.toLocaleString('pt-BR')}</p>
          <p className="mt-0.5 text-xs text-red-600 opacity-60">{pctNeg.toFixed(1)}% dos itens</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 opacity-70">Pior Resultado</p>
          <p className="mt-2 text-xl font-bold text-amber-800 tabular-nums">{BRLFULL(piorResultado)}</p>
          <p className="mt-0.5 text-xs text-amber-600 opacity-60">único item</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 opacity-70">Total de Itens</p>
          <p className="mt-2 text-xl font-bold text-slate-700 tabular-nums">{rows.length.toLocaleString('pt-BR')}</p>
          <p className="mt-0.5 text-xs text-slate-500 opacity-60">no período</p>
        </div>
      </div>

      {/* ─── NOVO: Diagnóstico de Origem do Prejuízo ─── */}
      {losses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Diagnóstico — Origem do Prejuízo
              <InfoTooltip text="Classificação automática calculada pelo servidor para cada item com resultado negativo. Baseada em CASE WHEN que compara revenue vs custo_base_net vs custo_escala_operacional vs taxas vs comissões. Clique numa barra para filtrar a tabela de itens abaixo." />
            </h2>
            <ExportButton
              title="Diagnóstico — Origem do Prejuízo"
              slug="margens-origem-prejuizo"
              chartRef={lossReasonRef}
              sections={[{
                title: 'Origem do Prejuízo',
                chartRef: lossReasonRef,
                columns: [
                  { key: 'reason',  label: 'Classificação',  type: 'text'     },
                  { key: 'group',   label: 'Grupo',          type: 'text'     },
                  { key: 'items',   label: 'Nº Itens',       type: 'number'   },
                  { key: 'absloss', label: 'Prejuízo (R$)',  type: 'currency', total: true },
                  { key: 'share',   label: '% do Total',     type: 'percent'  },
                ],
                rows: lossReasonData,
              }]}
            />
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Por que os itens negativos foram negativos? &nbsp;·&nbsp;
            <span className="text-red-500">Venda</span> = preço abaixo do NET &nbsp;·&nbsp;
            <span className="text-orange-500">Escala</span> = custo operacional consumiu a margem &nbsp;·&nbsp;
            <span className="text-amber-500">Financeira</span> = taxas &amp; provisão &nbsp;·&nbsp;
            <span className="text-blue-500">Comercial</span> = repasses, comissões, descontos
          </p>

          {selectedReason && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-0.5">
                Filtrando: <b>{selectedReason}</b>
              </span>
              <button
                onClick={() => { setSelectedReason(null); setPage(0); }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                × limpar filtro
              </button>
            </div>
          )}

          <div ref={lossReasonRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* BarChart horizontal — uma barra por classificação */}
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={Math.max(180, lossReasonData.length * 42 + 20)}>
                <BarChart
                  data={lossReasonData}
                  layout="vertical"
                  margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
                  onClick={handleBarClick}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    tickFormatter={v => BRLk(v)}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="short"
                    tick={{ fontSize: 10 }}
                    width={64}
                    axisLine={false}
                  />
                  <Tooltip content={<LossReasonTooltip />} />
                  <Bar dataKey="absloss" name="Prejuízo" radius={[0,4,4,0]} maxBarSize={28}>
                    {lossReasonData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        opacity={selectedReason && selectedReason !== entry.reason ? 0.35 : 0.9}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Mini-KPIs por GRUPO */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Por grupo</p>
              {diagnostics.map(g => (
                <div key={g.group} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: g.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs font-medium text-slate-700 truncate">{g.group}</span>
                      <span className="text-xs tabular-nums text-red-600 font-semibold whitespace-nowrap">{BRLFULL(-g.absloss)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 bg-slate-100 rounded-full h-1">
                        <div
                          className="h-1 rounded-full"
                          style={{ width: `${Math.abs(g.share)}%`, background: g.color }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">{g.share.toFixed(1)}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{g.items.toLocaleString('pt-BR')} itens</p>
                  </div>
                </div>
              ))}
              {diagnostics.length === 0 && (
                <p className="text-xs text-slate-400">Nenhum dado de diagnóstico disponível.</p>
              )}
            </div>
          </div>

          {/* ── Sub-card: Causa Raiz das Falhas de Escala ── */}
          {escalaDive && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  🔎 Causa Raiz — Falhas de Escala
                  <InfoTooltip text="Decompõe os itens 'Falha na Escala' em duas sub-causas: ① Preço abaixo do NET (emissor vendeu abaixo do custo do fornecedor — problema é a VENDA, não a escala); ② Custo operacional consumiu a margem (preço cobriu o fornecedor, mas guia/transporte zeraram o resultado). Escala deficitária = a operação inteira é inviável. Escala mista = escala lucrativa no total mas com itens negativos por alocação proporcional." />
                </h3>
                <span className="text-[10px] text-slate-400">{escalaDive.scaleCount} escala{escalaDive.scaleCount !== 1 ? 's' : ''} envolvida{escalaDive.scaleCount !== 1 ? 's' : ''} · {escalaDive.total} itens</span>
              </div>

              {/* Split bar principal — a visual mais importante */}
              {escalaDive.total > 0 && (() => {
                const pctAbaixo = escalaDive.belowNet / escalaDive.total * 100;
                const pctEscala = escalaDive.aboveNet / escalaDive.total * 100;
                return (
                  <div className="mb-4">
                    <div className="flex h-8 rounded-lg overflow-hidden text-xs font-semibold">
                      {pctAbaixo > 0 && (
                        <div
                          className="flex items-center justify-center text-white transition-all"
                          style={{ width: `${pctAbaixo}%`, background: '#dc2626' }}
                          title={`Preço < NET do fornecedor: ${escalaDive.belowNet} itens (${pctAbaixo.toFixed(0)}%)`}
                        >
                          {pctAbaixo >= 15 && `${pctAbaixo.toFixed(0)}%`}
                        </div>
                      )}
                      {pctEscala > 0 && (
                        <div
                          className="flex items-center justify-center text-white transition-all"
                          style={{ width: `${pctEscala}%`, background: '#f97316' }}
                          title={`Custo operacional alto: ${escalaDive.aboveNet} itens (${pctEscala.toFixed(0)}%)`}
                        >
                          {pctEscala >= 15 && `${pctEscala.toFixed(0)}%`}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#dc2626' }} />
                        <span className="text-slate-600 font-medium">① Preço &lt; NET</span>
                        <span className="text-red-600 font-bold ml-1">{escalaDive.belowNet} itens</span>
                        <span className="text-red-400 ml-1">({BRLFULL(escalaDive.belowNetLoss)})</span>
                        <span className="text-slate-400 ml-1 italic">→ revisar precificação</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 italic">revisar custo operacional ←</span>
                        <span className="text-orange-400 mr-1">({BRLFULL(escalaDive.aboveNetLoss)})</span>
                        <span className="text-orange-600 font-bold mr-1">{escalaDive.aboveNet} itens</span>
                        <span className="text-slate-600 font-medium">② Escala cara</span>
                        <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#f97316' }} />
                      </div>
                    </div>
                    {escalaDive.avgCoverage !== null && escalaDive.aboveNet > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1 text-center">
                        Cobertura média da escala nos itens ②: <strong className="text-orange-600">{(escalaDive.avgCoverage * 100).toFixed(0)}%</strong>
                        {' '}— o restante ({(100 - escalaDive.avgCoverage * 100).toFixed(0)}%) não foi coberto pelo preço praticado
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Escala-level stats */}
              <div className="flex items-center gap-6 text-[11px] py-2 px-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span className="text-slate-600">
                    <strong className="text-amber-700">{escalaDive.deficitScaleCount}</strong> escala{escalaDive.deficitScaleCount !== 1 ? 's' : ''} deficitária{escalaDive.deficitScaleCount !== 1 ? 's' : ''}
                    <span className="text-slate-400 ml-1">/ {escalaDive.scaleCount} total</span>
                  </span>
                  <span className="text-slate-300 mx-1">|</span>
                  <span className="text-slate-500 italic text-[10px]">operação inviável no total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                  <span className="text-slate-600">
                    <strong className="text-blue-600">{escalaDive.mixedScaleCount}</strong> escala{escalaDive.mixedScaleCount !== 1 ? 's' : ''} mista{escalaDive.mixedScaleCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-slate-500 italic text-[10px]">— escala lucrativa, itens negativos por alocação de custo</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Trend temporal das origens ── */}
          {lossTrend.data.length >= 2 && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <h3 className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1">
                Evolução Mensal das Origens do Prejuízo
                <InfoTooltip text="Barras empilhadas: prejuízo total por mês, colorido por origem. Permite ver se o problema está melhorando ou piorando, e qual causa domina cada mês. Apenas itens com resultado negativo, agrupados por data de emissão." />
              </h3>
              <p className="text-[10px] text-slate-400 mb-3">
                Cada mês = soma do prejuízo absoluto por origem — identifique tendências e causas dominantes
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={lossTrend.data.map(d => ({ ...d, label: fmtMonthKey(d.month) }))}
                  margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => BRLk(v)} axisLine={false} tickLine={false} width={46} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const total = payload.reduce((s, p) => s + (p.value || 0), 0);
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[160px]">
                          <p className="font-semibold text-slate-600 mb-2">{label}</p>
                          {[...payload].reverse().map(p => (
                            <div key={p.name} className="flex justify-between gap-4 mb-0.5" style={{ color: p.fill }}>
                              <span>{p.name}</span>
                              <span className="font-semibold tabular-nums">{BRLFULL(p.value)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100 font-semibold text-slate-700">
                            <span>Total</span>
                            <span className="tabular-nums">{BRLFULL(total)}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                    formatter={(v) => <span style={{ color: GROUP_COLORS[v] || '#94a3b8' }}>{v}</span>}
                  />
                  {lossTrend.groups.map(g => (
                    <Bar key={g} dataKey={g} stackId="a" fill={GROUP_COLORS[g] || '#94a3b8'} maxBarSize={36} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}

      {/* Distribution histogram */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Distribuição de Margem por Item
            <InfoTooltip text="Para cada item: margem = total_resultadoab ÷ total_vendas × 100. Itens com total_vendas = 0 são excluídos. A distribuição conta quantos itens caem em cada faixa de rentabilidade." />
          </h2>
          <ExportButton
            title="Distribuição de Margem por Item"
            slug="margens-distribuicao"
            chartRef={distRef}
            sections={[{
              title: 'Distribuição de Margem',
              chartRef: distRef,
              columns: [
                { key: 'label',   label: 'Faixa de Margem',  type: 'text'     },
                { key: 'count',   label: 'Nº Itens',         type: 'number'   },
                { key: 'revenue', label: 'Faturamento Total', type: 'currency', total: true },
              ],
              rows: distribution,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Quantidade de itens por faixa de rentabilidade — vermelho = prejuízo, verde = lucro</p>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <div ref={distRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribution} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<DistTooltip />} />
                <Bar dataKey="count" name="Nº Itens" radius={[4,4,0,0]}>
                  {distribution.map(b => <Cell key={b.label} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {distribution.map(b => {
                const totalItems = distribution.reduce((s, x) => s + x.count, 0);
                const pct = totalItems > 0 ? (b.count / totalItems * 100) : 0;
                return (
                  <div key={b.label} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: b.color }} />
                        <span className="text-slate-600 font-medium">{b.label}</span>
                      </div>
                      <div className="flex gap-4 text-slate-500 tabular-nums">
                        <span>{b.count.toLocaleString('pt-BR')} itens</span>
                        <span className="w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: b.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scatter */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Margem vs Faturamento por Fornecedor
            <InfoTooltip text="Cada ponto = 1 fornecedor (nomefornecedor). X = Faturamento (tamanho); Y = % Margem (qualidade). Margem = Σ Resultado AB ÷ Σ Faturamento. Abaixo de 0% = prejuízo no período." />
          </h2>
          <ExportButton
            title="Margem vs Faturamento por Fornecedor"
            slug="margens-scatter-fornecedor"
            chartRef={scatterRef}
            sections={[{
              title: 'Scatter — Margem vs Faturamento',
              chartRef: scatterRef,
              columns: [
                { key: 'name',         label: 'Fornecedor',   type: 'text'     },
                { key: 'revenue',      label: 'Faturamento',  type: 'currency', total: true },
                { key: 'profitLiquido',label: 'Líquido',      type: 'currency', total: true },
                { key: 'margin',       label: '% Margem',     type: 'percent'  },
              ],
              rows: scatter,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Cada ponto = 1 fornecedor agregado no período. Abaixo da linha vermelha = prejuízo.</p>
        {scatter.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <div ref={scatterRef}>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="revenue"
                name="Faturamento"
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10 }}
                label={{ value: 'Faturamento (R$)', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                dataKey="margin"
                name="Margem %"
                tick={{ fontSize: 10 }}
                label={{ value: 'Margem %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={scatter} fill="#3b82f6" opacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Vendor scatter */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Emissor × Margem × Volume
            <InfoTooltip text="Cada ponto = 1 emissor (nomeemissor). X = Faturamento; Y = % Margem (Resultado AB ÷ Faturamento). Quadrante inferior direito = alto volume com margem baixa — candidatos a revisão de comissões." />
          </h2>
          <ExportButton
            title="Emissor — Margem vs Faturamento"
            slug="margens-scatter-emissor"
            chartRef={vendorScatRef}
            sections={[{
              title: 'Scatter — Emissor × Margem',
              chartRef: vendorScatRef,
              columns: [
                { key: 'name',          label: 'Emissor',     type: 'text'     },
                { key: 'revenue',       label: 'Faturamento', type: 'currency', total: true },
                { key: 'profitLiquido', label: 'Líquido',     type: 'currency', total: true },
                { key: 'margin',        label: '% Margem',    type: 'percent'  },
                { key: 'saleCount',     label: 'Nº Vendas',   type: 'number'   },
              ],
              rows: vendorScatter,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Cada ponto = 1 emissor. X = faturamento, Y = margem%. Abaixo da linha = prejuízo.</p>
        {vendorScatter.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <div ref={vendorScatRef}>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="revenue"
                name="Faturamento"
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10 }}
                label={{ value: 'Faturamento (R$)', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                dataKey="margin"
                name="Margem %"
                tick={{ fontSize: 10 }}
                label={{ value: 'Margem %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
                    <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
                    <p>Faturamento: {BRLFULL(d.revenue)}</p>
                    <p>Líquido: {BRLFULL(d.profitLiquido)}</p>
                    <p>Margem: {d.margin.toFixed(2)}%</p>
                    <p>Vendas: {d.saleCount.toLocaleString('pt-BR')}</p>
                  </div>
                );
              }} />
              <Scatter data={vendorScatter} fill="#10b981" opacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Loss table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              Itens com Resultado Negativo
              <span className="text-red-500 font-normal text-xs">
                ({filteredLosses.length.toLocaleString('pt-BR')} itens
                {selectedReason ? ` de "${selectedReason}"` : ''})
              </span>
            </h2>
            {selectedReason && (
              <button
                onClick={() => { setSelectedReason(null); setPage(0); }}
                className="mt-1 text-xs text-blue-500 hover:text-blue-700 underline"
              >
                × ver todos os {losses.length.toLocaleString('pt-BR')} itens negativos
              </button>
            )}
          </div>
          <ExportButton
            title="Itens com Resultado Negativo"
            slug="margens-prejuizos"
            sections={[{
              title: 'Itens com Resultado Negativo',
              columns: [
                { key: 'id',           label: 'Venda',        type: 'text'     },
                { key: 'emissionDate', label: 'Emitido',      type: 'text'     },
                { key: 'client',       label: 'Cliente',      type: 'text'     },
                { key: 'supplier',     label: 'Fornecedor',   type: 'text'     },
                { key: 'product',      label: 'Produto',      type: 'text'     },
                { key: 'revenue',      label: 'Faturamento',  type: 'currency', total: true },
                { key: 'profit',       label: 'Resultado AB', type: 'currency', total: true },
                { key: 'marginPctStr', label: '% Rent.',      type: 'text'     },
                { key: 'lossReasonShort', label: 'Origem',    type: 'text'     },
              ],
              rows: filteredLosses.map(r => {
                const cfg = resolveLossReason(r.lossReason);
                return {
                  ...r,
                  emissionDate: r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-',
                  marginPctStr: r.revenue > 0 ? `${(r.profit / r.revenue * 100).toFixed(2)}%` : '-',
                  lossReasonShort: cfg.label,
                };
              }),
            }]}
          />
        </div>
        {filteredLosses.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">
            {losses.length === 0
              ? 'Nenhum item com resultado negativo no período.'
              : `Nenhum item classificado como "${selectedReason}".`}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="pb-2 pr-3 font-semibold">Venda</th>
                    <th className="pb-2 pr-3 font-semibold">Emitido</th>
                    <th className="pb-2 pr-3 font-semibold">Cliente</th>
                    <th className="pb-2 pr-3 font-semibold">Fornecedor</th>
                    <th className="pb-2 pr-3 font-semibold">Produto</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Resultado AB</th>
                    <th className="pb-2 pr-3 font-semibold text-right">% Rent</th>
                    <th className="pb-2 font-semibold">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const marginPct = r.revenue > 0 ? (r.profit / r.revenue * 100) : 0;
                    const cfg       = resolveLossReason(r.lossReason);
                    return (
                      <tr key={`${r.id}-${i}`} className="border-b border-slate-100 bg-red-50">
                        <td className="py-2 pr-3 font-mono text-slate-600">{r.id}</td>
                        <td className="py-2 pr-3">{r.emissionDate ? r.emissionDate.toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="py-2 pr-3 max-w-[8rem] truncate">{r.client}</td>
                        <td className="py-2 pr-3 max-w-[8rem] truncate">{r.supplier}</td>
                        <td className="py-2 pr-3 max-w-[8rem] truncate">{r.product}</td>
                        <td className="py-2 pr-3 text-right">{BRLFULL(r.revenue)}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-red-600">{BRLFULL(r.profit)}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-red-600 tabular-nums">{marginPct.toFixed(2)}%</td>
                        <td className="py-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              {r.lossReason ? (
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap"
                                  style={{ background: cfg.color }}
                                  title={cfg.label}
                                >
                                  {cfg.short}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                              {/* Badge de reembolso — custo real de devolução (taxa/comissão paga) */}
                              {r.idStatusServico === 28 && (
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-fuchsia-100 text-fuchsia-700 whitespace-nowrap"
                                  title={`Custo de reembolso aprovado — taxa ou comissão paga sem receita correspondente. Voucher original: ${r.refundOriginalVoucher > 0 ? '#' + r.refundOriginalVoucher : 'não vinculado'}`}
                                >
                                  reembolso
                                </span>
                              )}
                              {/* Botão de auditoria — aparece quando o item tem idEscala vinculado */}
                              {r.idEscala > 0 && (
                                <button
                                  onClick={() => setScaleAuditEscala(r.idEscala)}
                                  className="text-[10px] text-orange-600 hover:text-orange-800 underline decoration-dashed whitespace-nowrap"
                                  title={`Auditar escala #${r.idEscala} — ver todos os itens desta operação`}
                                >
                                  Escala #{r.idEscala}
                                </button>
                              )}
                            </div>
                            {/* ── Linha secundária: cobertura quantitativa ── */}
                            {cfg.group === 'Venda' && r.costBaseNet > 0 && (
                              // Falha na Venda: mostra quanto % do NET foi coberto
                              // < 100% confirma o diagnóstico; quanto menor, pior o erro de precificação
                              (() => {
                                const pct = (r.revenue / r.costBaseNet) * 100;
                                const color = pct < 70 ? '#ef4444' : pct < 90 ? '#f97316' : '#ca8a04';
                                return (
                                  <span
                                    className="text-[9px] tabular-nums"
                                    style={{ color }}
                                    title={`Faturamento cobriu ${pct.toFixed(1)}% do custo NET do fornecedor. Abaixo de 100% confirma Falha na Venda.`}
                                  >
                                    {pct.toFixed(0)}% do NET
                                  </span>
                                );
                              })()
                            )}
                            {cfg.group === 'Escala' && r.costBaseNet > 0 && (
                              // Falha na Escala: distingue se o problema foi preço (abaixo do NET) ou escala real
                              (() => {
                                const gapNet   = r.revenue - r.costBaseNet;
                                const belowNet = gapNet < 0;
                                const covScale = r.costScale > 0
                                  ? (gapNet / r.costScale) * 100
                                  : null;
                                return (
                                  <div className="flex flex-col gap-px">
                                    <span
                                      className={`text-[9px] tabular-nums font-semibold ${belowNet ? 'text-red-600' : 'text-slate-500'}`}
                                      title={`Faturamento − NET fornecedor = ${BRLFULL(gapNet)}. ${belowNet ? 'NEGATIVO: a venda foi o problema real (preço abaixo do fornecedor), não a escala.' : 'POSITIVO: cobriu o fornecedor, o custo da escala consumiu a margem.'}`}
                                    >
                                      {belowNet ? '⚠ abaixo do NET' : `+${BRLFULL(gapNet)} s/ NET`}
                                    </span>
                                    {covScale !== null && !belowNet && (
                                      <span
                                        className="text-[9px] text-orange-500 tabular-nums"
                                        title={`Cobriu ${covScale.toFixed(1)}% do custo de escala. Abaixo de 100% = custo operacional consumiu toda a margem.`}
                                      >
                                        {covScale.toFixed(0)}% da escala coberta
                                      </span>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">Página {page + 1} de {pageCount} ({filteredLosses.length.toLocaleString('pt-BR')} itens)</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
                  >
                    ‹ Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={page === pageCount - 1}
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

      {/* Supplier margin trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Tendência de Margem por Fornecedor
            <InfoTooltip text="Top 10 fornecedores por faturamento — margem mês a mês: Resultado AB ÷ Faturamento dentro de cada mês. Linhas em queda consistente indicam deterioração da relação comercial." />
          </h2>
          <ExportButton
            title="Tendência de Margem por Fornecedor"
            slug="margens-trend-fornecedor"
            chartRef={trendRef}
            sections={[{
              title: 'Margem Mensal — Top Fornecedores',
              chartRef: trendRef,
              columns: [
                { key: 'month', label: 'Mês', type: 'text' },
                ...trendData.suppliers.map(sup => ({ key: sup, label: sup, type: 'percent' })),
              ],
              rows: trendData.data.map(row => {
                const r = { month: row.month };
                trendData.suppliers.forEach(s => { r[s] = row[s] ?? 0; });
                return r;
              }),
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Evolução mensal da % de margem — top 10 fornecedores por faturamento</p>
        {trendData.data.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados suficientes para tendência mensal.</p>
        ) : (
          <div ref={trendRef}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData.data} margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip formatter={(v, name) => [v !== null ? `${Number(v).toFixed(2)}%` : '—', name]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {trendData.suppliers.map((sup, i) => {
                const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];
                return (
                  <Line
                    key={sup}
                    type="monotone"
                    dataKey={sup}
                    name={sup.length > 20 ? sup.slice(0, 18) + '…' : sup}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>

    {/* ScaleAuditModal — abre ao clicar em "Escala #xxx" na tabela de prejuízos */}
    {scaleAuditEscala !== null && (
      <ScaleAuditModal
        rows={rows}
        idEscala={scaleAuditEscala}
        onClose={() => setScaleAuditEscala(null)}
      />
    )}
    </>
  );
}
