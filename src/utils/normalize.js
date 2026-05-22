function parseNum(v) {
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
    seqId:         String(raw.idseqintens  || '').trim(),
    passengers:    parseNum(raw.num_pax),
    nights:        parseNum(raw.num_noites),
    revenue:       parseNum(raw.total_vendas),
    // total_descontos is informational in ONASYS (per-pax amount × num_pax inflated by API bug).
    // Adding it back removes the erroneous cost deduction: result matches ONASYS front-end.
    profit:              parseNum(raw.total_resultadoab) + parseNum(raw.total_descontos),
    profitLiquido:       parseNum(raw.total_liquido)     + parseNum(raw.total_descontos),
    commissionEmissor:   parseNum(raw.total_com_emissor),
    marginPct:           parseNum(raw.per_mkpliquido),
  };
}

export function normalizeRows(rawArray) {
  if (!Array.isArray(rawArray)) return [];
  return rawArray.map(normalizeRow);
}
