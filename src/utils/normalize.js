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
  return {
    id:            raw.venda,
    emissionDate:  parseISODate(raw.ddataemissao),
    checkinDate:   parseBRDate(raw.ddatain),
    filial:        String(raw.nomeempresa   || '').trim(),
    channel:       String(raw.tipoturismo   || '').trim(),
    clientType:    String(raw.rede          || '').trim(),
    client:        String(raw.cliente || raw.nmfantasia || '').trim(),
    supplier:      String(raw.nomefornecedor || '').trim(),
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
    revenue:       parseNum(raw.total_vendas),
    // profit        = total_resultadoab: valor final após todos os custos.
    //                 → KPI "Líquido" (ExecutivePage) e base da % Rentabilidade.
    // profitLiquido = total_liquido: antes de deduzir comissão do emissor.
    //                 → Coluna "Líquido" nas tabelas (par com "Resultado AB").
    profit:        parseNum(raw.total_resultadoab),
    profitLiquido: parseNum(raw.total_liquido),
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

export function normalizeRows(rawArray) {
  if (!Array.isArray(rawArray)) return [];
  return rawArray.map(normalizeRow);
}
