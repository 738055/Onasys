// Exportado para reaproveitamento em outros utils
export function parseNum(v) {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(',', '.')) || 0;
}

function parseISODate(v) {
  if (!v) return null;
  try { return new Date(v); } catch { return null; }
}

function parseBRDate(v) {
  if (!v) return null;
  const parts = String(v).split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
}

export function normalizeRow(raw) {
  // ─── Reembolso: ajuste de KPI ─────────────────────────────────────────────
  // Itens REEMBOLSO APROVADO (idStatusServico=28) nunca geram receita real nem lucro.
  // Regra: revenue=0 sempre; profit=min(rawProfit,0) — apenas custos reais passam.
  // Valores originais da API preservados em revenueRaw/profitRaw para auditoria.
  const isRefund        = parseNum(raw.idstatusservico ?? raw.idStatusServico) === 28;
  const rawRevenue      = parseNum(raw.total_vendas);
  const rawProfit       = parseNum(raw.total_resultadoab);
  const rawProfitLiq    = parseNum(raw.total_liquido);

  if (import.meta.env.DEV && isRefund && rawProfit > 0) {
    const key = `${raw.venda}-${raw.Voucher}`;
    if (!_refundWarnSet.has(key)) {
      _refundWarnSet.add(key);
      console.warn(
        `[BI] Reembolso com lucro positivo (erro de lançamento): `+
        `venda=${raw.venda} | voucher=${raw.Voucher} | `+
        `fornecedor="${raw.nomefornecedor}" | `+
        `revenue=R$${rawRevenue.toFixed(2)} | profit=R$${rawProfit.toFixed(2)} `+
        `→ excluído do KPI`
      );
    }
  }

  return {
    id:            raw.venda,
    emissionDate:  parseISODate(raw.ddataemissao),
    checkinDate:   parseBRDate(raw.ddatain),
    filial:        String(raw.nomeempresa   || '').trim(),
    channel:       String(raw.tipoturismo   || '').trim(),
    clientType:    String(raw.rede          || '').trim(),
    client:        String(raw.cliente || raw.nmfantasia || '').trim(),
    // Para itens de reembolso (FornecedorOriginalReembolso preenchido), usa o fornecedor real
    // em vez de "REEMBOLSO - RECEPTIVO" — corrige KPIs de fornecedor em todo o BI.
    supplier: (() => {
      const original = String(raw.FornecedorOriginalReembolso || '').trim();
      return original || String(raw.nomefornecedor || '').trim();
    })(),
    product:       String(raw.nomeservico   || '').trim(),
    segment:       String(raw.dsCateg       || '').trim(),
    state:         String(raw.dsestado      || '').trim(),
    region:        String(raw.regiaobrasil  || '').trim(),
    vendor:        String(raw.nomeemissor   || '').trim(),
    commercial:    String(raw.nomecomercial || '').trim(),
    saleType:      String(raw.tipovenda     || '').trim(),
    // Fallback: API pode retornar "idseqitens" ou "idseqintens" (variação histórica)
    seqId:         String(raw.idseqintens || raw.idseqitens || '').trim(),
    // Fallback: API pode retornar "Num_pax" (capital N) ou "num_pax" (snake_case original).
    passengers:    parseNum(raw.Num_pax ?? raw.num_pax),
    nights:        parseNum(raw.num_noites),
    // revenue/profit ajustados para KPI: reembolsos não geram receita nem lucro.
    revenue:       isRefund ? 0                         : rawRevenue,
    profit:        isRefund ? Math.min(rawProfit, 0)    : rawProfit,
    profitLiquido: isRefund ? Math.min(rawProfitLiq, 0) : rawProfitLiq,
    // Valores originais da API — usados na aba Reembolsos e no callout executivo.
    revenueRaw:    rawRevenue,
    profitRaw:     rawProfit,
    commissionEmissor:   parseNum(raw.total_com_emissor),
    marginPct:           parseNum(raw.per_mkpliquido),

    // ─── Breakdown de passageiros por categoria ────────────────────────────
    // Esses campos são por item (idseqitens). Para KPI executivo (dedup por venda)
    // use uniquePaxBreakdownByVenda() em aggregations.js.
    paxAdt:  parseNum(raw.nadt),          // Adultos
    paxChd:  parseNum(raw.nchd),          // Crianças (meia)
    paxColo: parseNum(raw.ncolo),         // Crianças free (colo)
    paxRed:  parseNum(raw.red),           // Reduzidas (estudante, doador de sangue...)
    paxSen:  parseNum(raw.nmidade),       // Melhor idade / Sênior
    paxFree: parseNum(raw.free),          // Cortesia (agentes de viagem, cortesia...)

    // ─── Status do serviço ────────────────────────────────────────────────
    // idStatusServico: 4 = CANCELADO (excluído do BI principal), 28 = REEMBOLSO APROVADO
    idStatusServico: parseNum(raw.idstatusservico ?? raw.idStatusServico),
    dsStatusServico: String(raw.dsstatusservico || raw.dsStatusServico || '').trim(),

    // ─── Vínculo de reembolso ─────────────────────────────────────────────
    // refundOriginalVoucher: Voucher do item original que foi reembolsado (0 = não é reembolso)
    // refundOriginalSupplier: Nome do fornecedor original antes do reembolso
    refundOriginalVoucher:  parseNum(raw.IDItemReembolsoOriginal),
    refundOriginalSupplier: String(raw.FornecedorOriginalReembolso || '').trim(),

    // ─── Diagnóstico de resultado ──────────────────────────────────────────
    // lossReason: classificação calculada pelo servidor (API SQL) via CASE WHEN.
    //   "Lucrativo" | "Falha na Venda (...)" | "Falha na Escala (...)"
    //   | "Falha Financeira (...)" | "Falha Comercial (...)" | "Falha Indeterminada..."
    lossReason:   String(raw.indicador_origem_prejuizo || '').trim(),
    // idEscala: ID de escala operacional (0 = não escalado / venda avulsa)
    idEscala:     parseNum(raw.idescala),
    // costBaseNet: custo bruto do fornecedor (NET) — usado no diagnóstico
    //   Falha na Venda = revenue < costBaseNet
    costBaseNet:  parseNum(raw.custo_base_net),
    // costScale: custo de escala operacional — guides, transporte, estrutura
    //   Falha na Escala = (revenue - costBaseNet) < costScale
    costScale:    parseNum(raw.custo_escala_operacional),
  };
}

// Set para evitar logs duplicados de qualidade de dados no DEV (limpa a cada fetch)
let _refundWarnSet = new Set();

export function normalizeRows(rawArray) {
  if (!Array.isArray(rawArray)) return [];
  _refundWarnSet = new Set();
  const result = rawArray.map(normalizeRow);

  if (import.meta.env.DEV) {
    const refunds    = result.filter(r => r.idStatusServico === 28);
    const errRefunds = refunds.filter(r => (r.profitRaw || 0) > 0);
    const cancelled  = result.filter(r => r.idStatusServico === 4);
    console.log(
      `[BI] normalize: ${result.length} itens | `+
      `${cancelled.length} cancelados | `+
      `${refunds.length} reembolsos`+
      (errRefunds.length ? ` ⚠ (${errRefunds.length} com erro de lançamento — excluídos do KPI)` : '')
    );
  }

  return result;
}
