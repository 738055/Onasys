import { useMemo, useRef } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Cell,
} from 'recharts';
import { calcLeadTimeBuckets } from '../utils/leadTime';
import { channelSegmentMatrix } from '../utils/heatMap';
import { calcRFM } from '../utils/rfm';
import { supplierShare, herfindahlIndex, supplierShareTable } from '../utils/supplierConcentration';
import { BRLFULL, BRLk } from '../utils/format';
import { KPICard } from '../components/KPICard';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function interpolateColor(t) {
  const [r1, g1, b1] = hexToRgb('#dbeafe');
  const [r2, g2, b2] = hexToRgb('#1e40af');
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

function LeadTimeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.label}</p>
      <p>{d.count.toLocaleString('pt-BR')} vendas</p>
      <p>Faturamento: {BRLFULL(d.revenue)}</p>
      {d.margin !== null && <p>Margem média: {d.margin.toFixed(2)}%</p>}
    </div>
  );
}

function ConcentrationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
      <p>Faturamento: {BRLFULL(d.revenue)}</p>
      <p>Share: {d.share.toFixed(2)}%</p>
      <p>% Acumulado: {d.cumShare.toFixed(1)}%</p>
    </div>
  );
}

const RFM_CLASSE_COLOR = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-amber-100 text-amber-800',
  C: 'bg-red-100 text-red-800',
};

export default function IntelligencePage({ rows }) {
  const leadRef         = useRef(null);
  const concentrationRef = useRef(null);

  const { buckets, total: ltTotal, skipped: ltSkipped } = useMemo(
    () => calcLeadTimeBuckets(rows),
    [rows]
  );

  const heatMapData = useMemo(() => channelSegmentMatrix(rows), [rows]);

  const rfmData = useMemo(() => calcRFM(rows), [rows]);

  const top5Share  = useMemo(() => supplierShare(rows, 5),  [rows]);
  const top10Share = useMemo(() => supplierShare(rows, 10), [rows]);
  const hhi        = useMemo(() => herfindahlIndex(rows),   [rows]);
  const shareTable = useMemo(() => supplierShareTable(rows, 15), [rows]);

  const hhiRisk = hhi >= 2500 ? 'red' : hhi >= 1500 ? 'amber' : 'green';

  return (
    <div className="space-y-6">

      {/* ── 1. Lead Time ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Lead Time — Emissão até Check-in
            <InfoTooltip text="Diferença em dias entre ddataemissao e ddatain de cada item. Itens sem uma das datas, ou com check-in anterior à emissão, são excluídos. A linha de margem = Σlíquido ÷ Σfaturamento dos itens em cada faixa de antecedência." />
          </h2>
          <ExportButton
            title="Lead Time — Emissão até Check-in"
            slug="intel-lead-time"
            chartRef={leadRef}
            sections={[{
              title: 'Lead Time por Bucket',
              chartRef: leadRef,
              columns: [
                { key: 'label',   label: 'Intervalo',   type: 'text'     },
                { key: 'count',   label: 'Nº Vendas',   type: 'number'   },
                { key: 'revenue', label: 'Faturamento', type: 'currency', total: true },
                { key: 'margin',  label: '% Margem Média', type: 'percent' },
              ],
              rows: buckets.map(b => ({ ...b, margin: b.margin ?? 0 })),
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-1">
          Dias entre emissão e check-in — vendas com ambas as datas ({ltTotal.toLocaleString('pt-BR')} de {(ltTotal + ltSkipped).toLocaleString('pt-BR')} itens)
        </p>
        <p className="text-xs text-slate-400 mb-4">
          Barras = volume de vendas por janela de antecedência · linha amarela = margem média do bucket
        </p>
        {ltTotal === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados de lead time (verifique se o campo check-in está preenchido).</p>
        ) : (
          <div ref={leadRef}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={buckets} margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }}
                  tickFormatter={v => `${v.toFixed(0)}%`} />
                <Tooltip content={<LeadTimeTooltip />} />
                <Bar yAxisId="left" dataKey="count" name="Vendas" radius={[4, 4, 0, 0]}>
                  {buckets.map(b => <Cell key={b.label} fill={b.color} />)}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="margin" name="Margem %"
                  stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 2. Heat Map Canal × Segmento ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Heat Map — Canal × Segmento
            <InfoTooltip text="Cada célula = Σfaturamento de vendas com aquele canal (tipoturismo) e aquele segmento (dsCateg). A intensidade da cor é proporcional ao valor máximo da matriz — azul escuro = maior concentração de receita." />
          </h2>
          <ExportButton
            title="Heat Map Canal × Segmento"
            slug="intel-heatmap"
            sections={[{
              title: 'Canal × Segmento',
              columns: [
                { key: 'channel', label: 'Canal',       type: 'text' },
                { key: 'segment', label: 'Segmento',    type: 'text' },
                { key: 'revenue', label: 'Faturamento', type: 'currency', total: true },
              ],
              rows: heatMapData.channels.flatMap(ch =>
                heatMapData.segments.map(seg => ({
                  channel: ch,
                  segment: seg,
                  revenue: heatMapData.cells[`${ch}||${seg}`] || 0,
                })).filter(r => r.revenue > 0)
              ),
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Faturamento cruzado: linhas = canais, colunas = segmentos — azul mais escuro = maior volume</p>
        {heatMapData.channels.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs min-w-max">
              <thead>
                <tr>
                  <th className="pb-2 pr-3 text-left text-slate-500 font-semibold sticky left-0 bg-white z-10">Canal</th>
                  {heatMapData.segments.map(seg => (
                    <th key={seg} className="pb-2 px-2 text-center text-slate-500 font-semibold max-w-[80px] truncate" title={seg}>
                      {seg.length > 12 ? seg.slice(0, 10) + '…' : seg}
                    </th>
                  ))}
                  <th className="pb-2 pl-3 text-right text-slate-500 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {heatMapData.channels.map(ch => {
                  const rowTotal = heatMapData.segments.reduce(
                    (s, seg) => s + (heatMapData.cells[`${ch}||${seg}`] || 0), 0
                  );
                  return (
                    <tr key={ch} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-medium text-slate-700 sticky left-0 bg-white">{ch}</td>
                      {heatMapData.segments.map(seg => {
                        const v = heatMapData.cells[`${ch}||${seg}`] || 0;
                        const t = v > 0 ? v / heatMapData.max : 0;
                        const bg = v > 0 ? interpolateColor(t) : '#f8fafc';
                        const textColor = t > 0.55 ? '#fff' : '#1e293b';
                        return (
                          <td
                            key={seg}
                            className="py-1.5 px-2 text-center tabular-nums"
                            style={{ background: bg, color: textColor }}
                            title={`${ch} × ${seg}: ${BRLFULL(v)}`}
                          >
                            {v > 0 ? BRLk(v) : <span className="text-slate-200">—</span>}
                          </td>
                        );
                      })}
                      <td className="py-1.5 pl-3 text-right font-semibold text-slate-700">{BRLk(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="pt-2 pr-3 font-semibold text-slate-700 sticky left-0 bg-slate-50">TOTAL</td>
                  {heatMapData.segments.map(seg => {
                    const colTotal = heatMapData.channels.reduce(
                      (s, ch) => s + (heatMapData.cells[`${ch}||${seg}`] || 0), 0
                    );
                    return (
                      <td key={seg} className="pt-2 px-2 text-center font-semibold text-slate-700 tabular-nums">
                        {BRLk(colTotal)}
                      </td>
                    );
                  })}
                  <td className="pt-2 pl-3 text-right font-semibold text-slate-700">
                    {BRLk(heatMapData.channels.reduce((s, ch) =>
                      s + heatMapData.segments.reduce((s2, seg) => s2 + (heatMapData.cells[`${ch}||${seg}`] || 0), 0), 0
                    ))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. RFM de Clientes ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Análise RFM de Clientes
            <InfoTooltip text="R (Recência) = dias desde a última compra até o último dia do dataset. F (Frequência) = nº de vendas únicas. M (Monetário) = faturamento total. Scores A/B/C são definidos pelos tercis do conjunto (A = top 33%, C = bottom 33%). Recência: menor = melhor (A). F e M: maior = melhor (A)." />
          </h2>
          <ExportButton
            title="Análise RFM de Clientes"
            slug="intel-rfm"
            sections={[{
              title: 'RFM — Top 30 Clientes',
              columns: [
                { key: 'name',      label: 'Cliente',         type: 'text'     },
                { key: 'recency',   label: 'Recência (dias)', type: 'number'   },
                { key: 'frequency', label: 'Frequência',      type: 'number'   },
                { key: 'monetary',  label: 'Monetário (R$)',  type: 'currency', total: true },
                { key: 'classe',    label: 'Classe RFM',      type: 'text'     },
              ],
              rows: rfmData.clients.slice(0, 30),
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">
          R = Recência (dias desde última compra) · F = Frequência (vendas) · M = Monetário (faturamento) · A = melhor, C = pior
          {rfmData.refDate && (
            <span className="ml-1 text-slate-300">
              | referência: {rfmData.refDate.toLocaleDateString('pt-BR')}
            </span>
          )}
        </p>
        {rfmData.summary.total === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <KPICard
                title="Champions (AA*)"
                value={rfmData.summary.champions}
                format="number"
                color="green"
                sub="Alta recência e frequência"
                tooltip="Clientes com score A em Recência e A em Frequência (AA*). São os clientes mais valiosos: compraram recentemente e com alta frequência."
              />
              <KPICard
                title="Em Risco"
                value={rfmData.summary.atRisk}
                format="number"
                color="amber"
                sub="Recência baixa, freq. ativa"
                tooltip="Clientes com score C em Recência mas não C em Frequência — foram frequentes mas estão há muito tempo sem comprar. Prioridade para ações de reativação."
              />
              <KPICard
                title="Perdidos (CCC)"
                value={rfmData.summary.lost}
                format="number"
                color="red"
                sub="Baixo em R, F e M"
                tooltip="Clientes com score C em todas as dimensões (recência baixa, frequência baixa, monetário baixo). Custo de reativação pode superar o retorno esperado."
              />
              <KPICard
                title="Total de Clientes"
                value={rfmData.summary.total}
                format="number"
                color="slate"
                sub="no período"
                tooltip="Total de clientes distintos (campo cliente da API) com ao menos uma venda no período filtrado."
              />
            </div>
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="pb-2 pr-3 font-semibold">#</th>
                    <th className="pb-2 pr-3 font-semibold">Cliente</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Recência</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Freq.</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Monetário</th>
                    <th className="pb-2 font-semibold text-center">Classe</th>
                  </tr>
                </thead>
                <tbody>
                  {rfmData.clients.slice(0, 30).map((c, i) => (
                    <tr key={c.name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium text-slate-700 max-w-[14rem] truncate" title={c.name}>{c.name}</td>
                      <td className="py-2 pr-3 text-right text-slate-500 tabular-nums">{c.recency}d</td>
                      <td className="py-2 pr-3 text-right text-slate-500 tabular-nums">{c.frequency}</td>
                      <td className="py-2 pr-3 text-right text-slate-700 tabular-nums">{BRLFULL(c.monetary)}</td>
                      <td className="py-2 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-bold text-xs`}>
                          {['R','F','M'].map((dim, idx) => {
                            const score = [c.rScore, c.fScore, c.mScore][idx];
                            return (
                              <span key={dim} className={`px-1 rounded ${RFM_CLASSE_COLOR[score]}`}>
                                {score}
                              </span>
                            );
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── 4. Concentração de Fornecedor ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Concentração de Fornecedores
            <InfoTooltip text="Share Top N = faturamento dos N maiores ÷ total × 100. HHI (Herfindahl-Hirschman) = Σ(shareᵢ)² × 10.000. Interpretação: HHI &lt; 1.500 = baixo risco; 1.500–2.500 = moderado; &gt; 2.500 = alto risco (dependência excessiva)." />
          </h2>
          <ExportButton
            title="Concentração de Fornecedores"
            slug="intel-concentracao"
            chartRef={concentrationRef}
            sections={[{
              title: 'Share de Fornecedores',
              chartRef: concentrationRef,
              columns: [
                { key: 'name',     label: 'Fornecedor',   type: 'text'     },
                { key: 'revenue',  label: 'Faturamento',  type: 'currency', total: true },
                { key: 'share',    label: '% Share',      type: 'percent'  },
                { key: 'cumShare', label: '% Acumulado',  type: 'percent'  },
              ],
              rows: shareTable,
            }]}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">Dependência por fornecedor — HHI &gt; 2500 indica alta concentração (risco)</p>
        {shareTable.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              <KPICard
                title="Share Top 5"
                value={top5Share}
                format="percent"
                color="blue"
                sub="dos 5 maiores fornecedores"
                tooltip="% do faturamento total representado pelos 5 maiores fornecedores. Acima de 70% indica dependência significativa de poucos fornecedores."
              />
              <KPICard
                title="Share Top 10"
                value={top10Share}
                format="percent"
                color="indigo"
                sub="dos 10 maiores fornecedores"
                tooltip="% do faturamento total representado pelos 10 maiores fornecedores. Complementa o Top 5 para entender a cauda longa da base de fornecedores."
              />
              <KPICard
                title={`HHI — ${hhiRisk === 'red' ? 'Alto Risco' : hhiRisk === 'amber' ? 'Moderado' : 'Baixo Risco'}`}
                value={Math.round(hhi)}
                format="number"
                color={hhiRisk}
                sub="Herfindahl-Hirschman Index (0–10000)"
                tooltip="HHI = Σ(shareᵢ²) × 10.000. Mede concentração: &lt; 1.500 = baixa (mercado competitivo); 1.500–2.500 = moderada; &gt; 2.500 = alta (risco de dependência — usado como referência antitruste nos EUA)."
              />
            </div>
            <div ref={concentrationRef}>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={shareTable} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={150} />
                  <Tooltip content={<ConcentrationTooltip />} />
                  <Bar dataKey="share" name="% Share" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Line dataKey="cumShare" name="% Acumulado" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
