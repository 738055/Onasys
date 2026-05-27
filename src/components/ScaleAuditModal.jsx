import { useMemo } from 'react';
import { X, TrendingDown, TrendingUp, AlertTriangle, Info, ZoomIn } from 'lucide-react';
import { BRLFULL, resolveLossReason } from '../utils/format';
import { groupByEscala } from '../utils/aggregations';

/** Formata checkinDate (Date ou string BR "dd/mm/yyyy") */
function fmtDate(d) {
  if (!d) return '—';
  if (d instanceof Date) return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return String(d);
}

/** Barra horizontal simples para o mini-waterfall */
function WaterfallRow({ label, value, total, color, isDeduction = false, isBold = false }) {
  const pct = total > 0 ? Math.min(100, Math.abs(value) / total * 100) : 0;
  const displayValue = isDeduction ? BRLFULL(-Math.abs(value)) : BRLFULL(value);
  const textCls = isBold
    ? value < 0 ? 'font-bold text-red-700' : 'font-bold text-emerald-700'
    : isDeduction ? 'text-red-500' : 'text-slate-700';

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-32 text-right text-slate-500 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={`w-24 text-right tabular-nums shrink-0 ${textCls}`}>{displayValue}</span>
    </div>
  );
}

/**
 * ScaleAuditModal — exibe todos os itens de uma escala operacional (idEscala),
 * incluindo itens lucrativos e deficitários, com waterfall de custos e diagnóstico.
 *
 * Props:
 *   rows      — todas as linhas normalizadas do dashboard (necessário para encontrar itens fora das losses)
 *   idEscala  — ID da escala a auditar (number)
 *   onClose   — callback de fechamento
 */
export function ScaleAuditModal({ rows, idEscala, onClose }) {
  const escalaMap = useMemo(() => groupByEscala(rows), [rows]);
  const data = escalaMap[idEscala];

  // Escala sem dados conhecidos (idEscala veio de uma linha cujos pares estão fora do filtro atual)
  if (!data) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center">
          <AlertTriangle size={24} className="text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Escala #{idEscala} não encontrada</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Os demais itens desta escala podem estar fora do período ou filtro atual.
            Amplie o período para ver a escala completa.
          </p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const { items, revenue, costBaseNet, costScale, profit } = data;

  // Outros custos: comissões, taxas, descontos etc. — embutidos em profit mas sem campo separado
  // Relação: profit = revenue − costBaseNet − costScale − otherCosts
  const otherCosts = revenue - costBaseNet - costScale - profit;

  const isViable    = profit >= 0;
  const lossItems   = items.filter(r => r.profit < 0);
  const profitItems = items.filter(r => r.profit >= 0);
  const lossClients = [...new Set(lossItems.map(r => r.client).filter(Boolean))];

  // Análise automática
  let insightText = '';
  let insightType = 'ok'; // 'ok' | 'warn' | 'error'
  if (items.length === 0) {
    insightText = 'Nenhum item encontrado para esta escala no período atual.';
    insightType = 'warn';
  } else if (lossItems.length === 0) {
    insightText = `Escala totalmente lucrativa — todos os ${items.length} item(ns) cobriram os custos. Resultado AB: ${BRLFULL(profit)}.`;
    insightType = 'ok';
  } else if (lossItems.length === items.length) {
    insightText = `Escala completamente deficitária — todos os ${items.length} item(ns) resultaram em prejuízo. O custo operacional (${BRLFULL(costScale)}) não foi coberto por nenhuma venda. Revisar política de preços ou retirar o serviço dos canais deficitários.`;
    insightType = 'error';
  } else {
    insightText = `Escala mista — ${profitItems.length} item(ns) cobriu o custo, ${lossItems.length} não. O prejuízo está concentrado em: ${lossClients.join(', ')}. Verificar política de preços para esses clientes/canais.`;
    insightType = 'warn';
  }

  const InsightIcon  = insightType === 'ok' ? TrendingUp : insightType === 'error' ? TrendingDown : AlertTriangle;
  const insightStyle = insightType === 'ok'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : insightType === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-amber-50 border-amber-200 text-amber-700';
  const insightIconCls = insightType === 'ok' ? 'text-emerald-600' : insightType === 'error' ? 'text-red-600' : 'text-amber-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <ZoomIn size={14} className="text-orange-500" />
                Auditoria de Escala
              </h2>
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                #{idEscala}
              </span>
              {!isViable && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingDown size={10} /> Deficitária
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-700 mt-1 truncate max-w-[34rem]">{data.product}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Fornecedor: <span className="font-medium">{data.supplier}</span>
              {data.checkinDate && <> · Check-in: <span className="font-medium">{fmtDate(data.checkinDate)}</span></>}
              <span className="ml-2 text-slate-400">·</span>
              <span className="ml-2 text-slate-500">{items.length} item(ns) na escala</span>
              {lossItems.length > 0 && (
                <span className="ml-2 text-red-500">({lossItems.length} deficitário{lossItems.length > 1 ? 's' : ''})</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-5">

          {/* Insight box */}
          <div className={`rounded-lg p-3 text-xs flex items-start gap-2 border ${insightStyle}`}>
            <InsightIcon size={14} className={`${insightIconCls} shrink-0 mt-0.5`} />
            <p>{insightText}</p>
          </div>

          {/* Waterfall de custos */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Composição do Resultado — Escala Total
            </h3>
            <div className="space-y-2">
              <WaterfallRow label="Faturamento"       value={revenue}       total={revenue}  color="#3b82f6" />
              <WaterfallRow label="(−) Custo NET"     value={costBaseNet}   total={revenue}  color="#ef4444" isDeduction />
              <WaterfallRow label="(−) Custo Escala"  value={costScale}     total={revenue}  color="#f97316" isDeduction />
              {otherCosts > 0.01 && (
                <WaterfallRow label="(−) Outros Custos" value={otherCosts} total={revenue}   color="#eab308" isDeduction />
              )}
              <div className="border-t-2 border-slate-200 pt-2 mt-1">
                <WaterfallRow
                  label="Resultado AB"
                  value={profit}
                  total={revenue}
                  color={profit < 0 ? '#ef4444' : '#10b981'}
                  isBold
                />
              </div>
            </div>
            <p className={`text-xs text-right mt-1 ${profit < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              Margem: {revenue > 0 ? `${(profit / revenue * 100).toFixed(2)}%` : '—'}
            </p>
          </div>

          {/* Tabela por item */}
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Detalhamento por Item
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="pb-2 pr-3 font-semibold whitespace-nowrap">Venda</th>
                    <th className="pb-2 pr-3 font-semibold whitespace-nowrap">Cliente</th>
                    <th className="pb-2 pr-3 font-semibold text-right whitespace-nowrap">Faturamento</th>
                    <th className="pb-2 pr-3 font-semibold text-right whitespace-nowrap">
                      Custo NET
                      <span className="block text-[9px] text-slate-400 font-normal">(custo_base_net)</span>
                    </th>
                    <th className="pb-2 pr-3 font-semibold text-right whitespace-nowrap">
                      Custo Escala
                      <span className="block text-[9px] text-slate-400 font-normal">(custo_escala_op.)</span>
                    </th>
                    <th className="pb-2 pr-3 font-semibold text-right whitespace-nowrap">
                      Gap NET+Esc
                      <span className="block text-[9px] text-slate-400 font-normal">fat − net − escala</span>
                    </th>
                    <th className="pb-2 pr-3 font-semibold text-right whitespace-nowrap">Resultado AB</th>
                    <th className="pb-2 font-semibold whitespace-nowrap">
                      Diagnóstico
                      <span className="block text-[9px] text-slate-400 font-normal">causa real do resultado</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => {
                    const net      = r.costBaseNet || 0;
                    const scale    = r.costScale   || 0;
                    const gapNet   = r.revenue - net;              // positivo = cobriu o fornecedor
                    const gapTotal = r.revenue - net - scale;      // positivo = cobriu NET+Escala
                    const rowBg    = r.profit >= 0 ? 'bg-emerald-50/60' : 'bg-red-50/60';

                    // Veredito independente da classificação da API:
                    // Analisa o que de fato aconteceu com base nos campos de custo.
                    let verdict, verdictColor, verdictTitle;
                    if (r.profit >= 0) {
                      verdict      = '✓ Lucrativo';
                      verdictColor = '#10b981';
                      verdictTitle = 'Item lucrativo — cobriu todos os custos';
                    } else if (net > 0 && gapNet < 0) {
                      verdict      = 'Preço < NET';
                      verdictColor = '#dc2626';
                      verdictTitle = `O preço (${BRLFULL(r.revenue)}) ficou abaixo do custo NET do fornecedor (${BRLFULL(net)}). Problema de VENDA — o emissor precificou abaixo do mínimo do fornecedor, independente da escala.`;
                    } else if (scale > 0 && gapTotal < 0) {
                      const covPct = net > 0 ? (gapNet / scale * 100).toFixed(0) : '?';
                      verdict      = `Escala: ${covPct}% cob.`;
                      verdictColor = '#f97316';
                      verdictTitle = `Preço cobriu o NET do fornecedor (gap = ${BRLFULL(gapNet)}), mas cobriu apenas ${covPct}% do custo da escala operacional (${BRLFULL(scale)}). Problema de ESCALA — custo operacional desproporcional ao preço praticado.`;
                    } else if (r.profit < 0) {
                      verdict      = 'Outros custos';
                      verdictColor = '#eab308';
                      verdictTitle = `Cobriu NET+Escala (gap = ${BRLFULL(gapTotal)}), mas taxas/comissões/provisões geraram o prejuízo. Problema FINANCEIRO/COMERCIAL.`;
                    } else {
                      verdict      = '—';
                      verdictColor = '#94a3b8';
                      verdictTitle = 'Sem dados de custo suficientes para diagnóstico';
                    }

                    return (
                      <tr key={`${r.id}-${i}`} className={`border-b border-slate-100 ${rowBg}`}>
                        <td className="py-2 pr-3 font-mono text-slate-600">{r.id}</td>
                        <td className="py-2 pr-3 font-medium text-slate-700 max-w-[120px] truncate">{r.client}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{BRLFULL(r.revenue)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-red-500">
                          {net > 0 ? BRLFULL(-net) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-orange-500">
                          {scale > 0 ? BRLFULL(-scale) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${gapTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {BRLFULL(gapTotal)}
                        </td>
                        <td className={`py-2 pr-3 text-right tabular-nums font-bold ${r.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {BRLFULL(r.profit)}
                        </td>
                        <td className="py-2">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border"
                            style={{
                              color:             verdictColor,
                              borderColor:       verdictColor,
                              backgroundColor:   verdictColor + '15',
                            }}
                            title={verdictTitle}
                          >
                            {verdict}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 text-xs font-bold">
                    <td className="pt-2 pr-3" colSpan={2}>Total da Escala</td>
                    <td className="pt-2 pr-3 text-right tabular-nums text-slate-700">{BRLFULL(revenue)}</td>
                    <td className="pt-2 pr-3 text-right tabular-nums text-red-500">{BRLFULL(-costBaseNet)}</td>
                    <td className="pt-2 pr-3 text-right tabular-nums text-orange-500">{BRLFULL(-costScale)}</td>
                    <td className={`pt-2 pr-3 text-right tabular-nums ${revenue - costBaseNet - costScale >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {BRLFULL(revenue - costBaseNet - costScale)}
                    </td>
                    <td className={`pt-2 pr-3 text-right tabular-nums ${profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {BRLFULL(profit)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Explicação técnica */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-semibold mb-1.5 flex items-center gap-1">
              <Info size={12} /> Como interpretar este diagnóstico
            </p>
            <ul className="space-y-1 list-disc list-inside text-blue-700">
              <li>
                <b>Custo NET</b> — valor de contrato com o fornecedor por item
                (<code className="bg-blue-100 px-0.5 rounded text-[10px]">custo_base_net</code>)
              </li>
              <li>
                <b>Custo Escala</b> — alocação do custo operacional (guia/transporte/estrutura) para este item
                (<code className="bg-blue-100 px-0.5 rounded text-[10px]">custo_escala_operacional</code>);
                pode variar entre itens da mesma escala conforme alocação proporcional
              </li>
              <li>
                <b>Gap NET+Esc</b> — se <span className="text-red-600 font-semibold">negativo</span>, o item foi
                vendido abaixo do custo operacional total — prejuízo antes mesmo de taxas e comissões
              </li>
              <li>
                <b>Resultado AB</b> — resultado final após todos os custos
                (<code className="bg-blue-100 px-0.5 rounded text-[10px]">total_resultadoab</code>)
              </li>
              <li>
                A escala como unidade deve cobrir o custo total — mesmo que um item individual seja lucrativo,
                a escala pode ser deficitária se os demais não compensarem
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
