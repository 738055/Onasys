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

// contabilPai da conta "DESPESAS COM VENDAS" — custo direto dos serviços
const CSV_CONTABIL_PAI = '410111';

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

// Subclassifica despesas para DRE em camadas usando contabilPai (campo da API):
//   csv   → contabilPai === '410111' (DESPESAS COM VENDAS) — custo direto
//   opex  → demais contas 41xxx (overhead operacional: pessoal, encargos, etc.)
//   fin   → contas 42xxx (despesas financeiras)
//   other → demais (43xxx+)
// Fallback para contaextendida quando contabilPai não vem preenchido.
function classifySubkind(contabilPai, code, kind) {
  if (kind === 'receita') return 'receita';
  const pai = contabilPai || code.slice(0, 6);
  if (pai === CSV_CONTABIL_PAI) return 'csv';
  if (pai.startsWith('42') || code.startsWith('42')) return 'fin';
  if (pai.startsWith('4')  || code.startsWith('4'))  return 'opex';
  return 'other';
}

// Signed amount para o DRE:
//   receita: C = +value (crédito aumenta receita), D = -value (débito reverte)
//   despesa: D = +value (débito aumenta despesa), C = -value (crédito reverte)
function calcSigned(kind, op, value) {
  if (kind === 'receita') return op === 'C' ? value : -value;
  return op === 'D' ? value : -value;
}

export function normalizeResultado(raw) {
  const value       = Math.abs(parseNum(raw.vlvalor));
  const op          = String(raw.dsoperacao || '').toUpperCase();
  const code        = String(raw.contaextendida || '');
  const contabilPai = String(raw.contabilPai || '').trim();
  const kind        = classifyKind(code, op);

  return {
    id:              raw.idlancamento,
    date:            parseISODate(raw.dtmovimento),
    unit:            String(raw.nmunidade || '').trim(),
    account:         String(raw.dsPartida || raw.dspartida || '').trim(),
    accountCode:     code,
    contabilPai,
    nomeContabilPai: String(raw.nomeContabilPai || '').trim(),
    counter:         String(raw.dsContraPartida || raw.dscontrapartida || '').trim(),
    doc:             String(raw.dscomplemento || '').trim(),
    docII:           String(raw.dscomplementoII || '').trim(),
    saleId:          raw.idvenda || 0,
    titleId:         raw.idtitulo || 0,
    subkind:         classifySubkind(contabilPai, code, kind),
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

// Contas Baixadas por Produto — vincula pagamento/recebimento a uma venda específica
export function normalizeBaixadaProduto(raw) {
  const value = Math.abs(parseNum(raw.valorpagamento ?? raw.valorpagamentomoeda));
  const type  = String(raw.tpconta || '').toUpperCase();

  return {
    controlId:     String(raw.idcontrole || ''),
    type,
    invoiceNumber: String(raw.nrfatura || ''),
    saleId:        Number(raw.idvenda)    || 0,
    seqId:         Number(raw.idseqitens) || 0,
    supplierId:    Number(raw.idfornecedor) || 0,
    issueDate:     parseBRDate(raw.dtemissao),
    dueDate:       parseBRDate(raw.dtvencimento),
    payDate:       parseBRDate(raw.datapagamento),
    value,
    account:       String(raw.nomecontapagamento || '').trim(),
    unit:          String(raw.filial || '').trim(),
    person:        String(raw.nomepessoa || '').trim(),
    invoiceId:     Number(raw.idfatagrupada) || 0,
    operationType: String(raw.dsoperacaocontas || ''),
    cashSigned:    type === 'RECEBER' ? value : -value,
  };
}

export function normalizeFinanceRows(rows, recurso) {
  if (!Array.isArray(rows)) return [];
  if (recurso === 'resultado')        return rows.map(normalizeResultado);
  if (recurso === 'baixadas')         return rows.map(normalizeBaixada);
  if (recurso === 'baixadasProdutos') return rows.map(normalizeBaixadaProduto);
  return rows;
}
