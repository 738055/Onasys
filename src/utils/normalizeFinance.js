function parseNum(v) {
  if (v == null) return 0;
  return parseFloat(String(v).replace(',', '.')) || 0;
}

function parseBRDate(str) {
  if (!str) return null;
  const parts = String(str).split('/');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
  }
  return new Date(str);
}

function parseISODate(str) {
  if (!str) return null;
  return new Date(str);
}

// Classifica a conta pelo prefixo de contaextendida:
//   3xxx → receita (normal balance = crédito)
//   4xxx → despesa (normal balance = débito)
// Fallback: dsoperacao C=receita, D=despesa
function classifyKind(code, op) {
  const prefix = String(code || '').charAt(0);
  if (prefix === '3') return 'receita';
  if (prefix === '4') return 'despesa';
  return op === 'C' ? 'receita' : 'despesa';
}

// Signed amount para o DRE:
//   receita: C = +value (crédito aumenta receita), D = -value (débito reverte)
//   despesa: D = +value (débito aumenta despesa), C = -value (crédito reverte)
function calcSigned(kind, op, value) {
  if (kind === 'receita') return op === 'C' ? value : -value;
  return op === 'D' ? value : -value;
}

export function normalizeResultado(raw) {
  const value = Math.abs(parseNum(raw.vlvalor));
  const op    = String(raw.dsoperacao || '').toUpperCase();
  const code  = String(raw.contaextendida || '');
  const kind  = classifyKind(code, op);

  return {
    id:            raw.idlancamento,
    date:          parseISODate(raw.dtmovimento),
    unit:          String(raw.nmunidade || '').trim(),
    account:       String(raw.dsPartida || raw.dspartida || '').trim(),
    accountCode:   code,
    counter:       String(raw.dsContraPartida || raw.dscontrapartida || '').trim(),
    doc:           String(raw.dscomplemento || '').trim(),
    docII:         String(raw.dscomplementoII || '').trim(),
    saleId:        raw.idvenda || 0,
    titleId:       raw.idtitulo || 0,
    value,
    op,
    kind,
    signed:        calcSigned(kind, op, value),
    operationType: String(raw.dsoperacaocontas || ''),
  };
}

export function normalizeBaixada(raw) {
  const value = Math.abs(parseNum(raw.valorpagamento ?? raw.vltitulo));
  const type  = String(raw.tpconta || '').toUpperCase();

  return {
    id:            raw.idconta,
    controlId:     raw.idcontrole,
    type,
    saleId:        raw.idvenda || 0,
    issueDate:     parseBRDate(raw.dtemissao),
    dueDate:       parseBRDate(raw.dtvencimento),
    payDate:       parseBRDate(raw.datapagamento),
    value,
    person:        String(raw.nomepessoa || '').trim(),
    client:        String(raw.clientedavenda || '').trim(),
    unit:          String(raw.filial || '').trim(),
    account:       String(raw.nomecontapagamento || '').trim(),
    titleType:     String(raw.tipotitulo || '').trim(),
    cashSigned:    type === 'RECEBER' ? value : -value,
    invoiceId:     raw.idfatAgrupada || 0,
    operationType: String(raw.dsoperacaocontas || ''),
  };
}

export function normalizeAberta(raw) {
  const value   = Math.abs(parseNum(raw.valorpagamento ?? raw.vltitulo ?? 0));
  const type    = String(raw.tpconta || '').toUpperCase();
  const dueDate = parseBRDate(raw.dtvencimento);
  const today   = new Date();
  today.setHours(0, 0, 0, 0);

  let agingBucket = '0-30';
  if (dueDate) {
    const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0)       agingBucket = 'vencido';
    else if (diffDays <= 30) agingBucket = '0-30';
    else if (diffDays <= 60) agingBucket = '31-60';
    else                     agingBucket = '60+';
  }

  return {
    id:          raw.idconta || raw.idtitulo,
    type,
    issueDate:   parseBRDate(raw.dtemissao),
    dueDate,
    value,
    person:      String(raw.nomepessoa || '').trim(),
    unit:        String(raw.filial || '').trim(),
    titleType:   String(raw.tipotitulo || '').trim(),
    cashSigned:  type === 'RECEBER' ? value : -value,
    agingBucket,
  };
}

export function normalizeFinanceRows(rows, recurso) {
  if (!Array.isArray(rows)) return [];
  if (recurso === 'resultado')   return rows.map(normalizeResultado);
  if (recurso === 'baixadas')    return rows.map(normalizeBaixada);
  if (recurso === 'abertas')     return rows.map(normalizeAberta);
  return rows;
}
