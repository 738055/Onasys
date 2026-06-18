// ─── Hierarquia de contas (contaextendida) ───────────────────────────────────

const ACCOUNT_GROUP_LABELS = {
  '31': 'Receitas Operacionais',
  '32': 'Receitas Financeiras',
  '33': 'Receitas Não Operacionais',
  '34': 'Outras Receitas',
  '41': 'Despesas Operacionais',
  '42': 'Despesas Financeiras',
  '43': 'Despesas Não Operacionais',
  '44': 'Outras Despesas',
};

export function getAccountGroupLabel(code) {
  const key = String(code || '').slice(0, 2);
  return ACCOUNT_GROUP_LABELS[key] || `Grupo ${key}`;
}

// Hierarquia DRE: { receitas: { groups, total }, despesas: { groups, total } }
// Agrupa por contabilPai (campo da API) → nomeContabilPai como label.
// Fallback: 2 dígitos de contaextendida + ACCOUNT_GROUP_LABELS quando contabilPai ausente.
export function buildDREHierarchy(rows) {
  function buildGroups(kindRows) {
    const groups = {};
    for (const r of kindRows) {
      const groupCode  = r.contabilPai  || String(r.accountCode || '').slice(0, 2);
      const groupLabel = r.nomeContabilPai || ACCOUNT_GROUP_LABELS[String(r.accountCode || '').slice(0, 2)] || `Grupo ${groupCode}`;
      if (!groups[groupCode]) groups[groupCode] = { code: groupCode, label: groupLabel, accounts: {} };
      const acc = r.account || '(sem conta)';
      if (!groups[groupCode].accounts[acc]) groups[groupCode].accounts[acc] = { value: 0, count: 0 };
      groups[groupCode].accounts[acc].value += r.signed;
      groups[groupCode].accounts[acc].count++;
    }
    const total = kindRows.reduce((s, r) => s + r.signed, 0);
    return {
      groups: Object.entries(groups).map(([code, g]) => {
        const subtotal = Object.values(g.accounts).reduce((s, a) => s + a.value, 0);
        return {
          code,
          label: g.label,
          subtotal,
          // pct = participação da conta DENTRO do grupo (subtotal do grupo = 100%)
          accounts: Object.entries(g.accounts)
            .map(([name, a]) => ({ name, value: a.value, count: a.count, pct: subtotal !== 0 ? a.value / subtotal * 100 : 0 }))
            .sort((a, b) => b.value - a.value),
        };
      }).sort((a, b) => b.subtotal - a.subtotal),
      total,
    };
  }
  return {
    receitas: buildGroups(rows.filter(r => r.kind === 'receita')),
    despesas: buildGroups(rows.filter(r => r.kind === 'despesa')),
  };
}

// ─── DRE (Resultado) ─────────────────────────────────────────────────────────

export function calcDREKPIs(rows) {
  let receita = 0, csv = 0, opex = 0, fin = 0, other = 0;
  for (const r of rows) {
    const sk = r.subkind || (r.kind === 'receita' ? 'receita' : 'other');
    if (sk === 'receita')     receita += r.signed;
    else if (sk === 'csv')    csv     += r.signed;
    else if (sk === 'opex')   opex    += r.signed;
    else if (sk === 'fin')    fin     += r.signed;
    else                      other   += r.signed;
  }
  const despesa     = csv + opex + fin + other;
  const margemBruta = receita - csv;
  const resultado   = receita - despesa;
  return {
    receita, csv, opex, fin, other, despesa,
    margemBruta,
    margemBrutaPct: receita > 0 ? (margemBruta / receita) * 100 : 0,
    resultado,
    margem:      receita > 0 ? (resultado / receita) * 100 : 0,
    taxaDespesa: receita > 0 ? (despesa    / receita) * 100 : 0,
  };
}

// { 'YYYY-MM': { key, receita, csv, opex, fin, other, despesa, margemBruta, margemBrutaPct, resultado, margem } }
export function groupByMonthDRE(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.date) continue;
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, receita: 0, csv: 0, opex: 0, fin: 0, other: 0 };
    const sk = r.subkind || (r.kind === 'receita' ? 'receita' : 'other');
    if (sk === 'receita')   map[key].receita += r.signed;
    else if (sk === 'csv')  map[key].csv     += r.signed;
    else if (sk === 'opex') map[key].opex    += r.signed;
    else if (sk === 'fin')  map[key].fin     += r.signed;
    else                    map[key].other   += r.signed;
  }
  return Object.values(map)
    .map(m => {
      const despesa     = m.csv + m.opex + m.fin + m.other;
      const margemBruta = m.receita - m.csv;
      const resultado   = m.receita - despesa;
      return {
        ...m,
        despesa,
        margemBruta,
        margemBrutaPct: m.receita > 0 ? (margemBruta / m.receita) * 100 : 0,
        resultado,
        margem: m.receita > 0 ? (resultado / m.receita) * 100 : 0,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

// { 'YYYY-MM-DD': { key, receita, despesa, resultado } }
export function groupByDayDRE(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.date) continue;
    const key = r.date.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { key, receita: 0, despesa: 0 };
    if (r.kind === 'receita') map[key].receita += r.signed;
    else                      map[key].despesa += r.signed;
  }
  return Object.values(map)
    .map(m => ({ ...m, resultado: m.receita - m.despesa }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// Agrupa por conta (dsPartida) para um kind específico ou ambos
export function groupByAccount(rows, kind = null) {
  const map = {};
  for (const r of rows) {
    if (kind && r.kind !== kind) continue;
    const key = r.account || '(sem categoria)';
    if (!map[key]) map[key] = { account: key, value: 0, count: 0, kind: r.kind };
    map[key].value += r.signed;
    map[key].count++;
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

// Waterfall chart data para Recharts (stacked bar trick)
// Estrutura: Receita → [Reversões] → Rec. Líquida → Desp. Vendas → Margem Bruta → overhead → Resultado
export function buildWaterfall(rows) {
  const receitaBruta = rows.filter(r => r.kind === 'receita' && r.op === 'C').reduce((s, r) => s + r.value, 0);
  const reversoes    = rows.filter(r => r.kind === 'receita' && r.op === 'D').reduce((s, r) => s + r.value, 0);
  const receitaLiq   = receitaBruta - reversoes;

  // Custo direto dos serviços (CSV)
  const csvTotal = rows
    .filter(r => r.subkind === 'csv')
    .reduce((s, r) => s + r.signed, 0);

  // Demais despesas (overhead: opex + fin + other), agrupadas por conta
  const overheadRows = rows.filter(r => r.kind === 'despesa' && r.subkind !== 'csv');
  const despByAcc    = groupByAccount(overheadRows);
  const topN         = despByAcc.slice(0, 5);
  const outras       = despByAcc.slice(5).reduce((s, d) => s + d.value, 0);

  let running = 0;
  const items = [];

  const push = (name, delta, type) => {
    const before = running;
    running += delta;
    const low  = Math.min(before, running);
    const high = Math.max(before, running);
    items.push({ name, spacer: low < 0 ? 0 : low, value: high - low, type, running });
  };

  push('Receita Bruta', receitaBruta, 'receita');
  if (reversoes > 0) push('Reversões', -reversoes, 'reducao');
  items.push({ name: 'Rec. Líquida', spacer: 0, value: receitaLiq, type: 'subtotal', running: receitaLiq });
  running = receitaLiq;

  if (csvTotal > 0) {
    push('Desp. c/ Vendas', -csvTotal, 'csv');
    const mb = running;
    items.push({ name: 'Rec. Líquida', spacer: mb >= 0 ? 0 : mb, value: Math.abs(mb), type: 'subtotal_mb', running: mb });
    running = mb;
  }

  for (const d of topN) {
    const label = d.account.length > 20 ? d.account.slice(0, 20) + '…' : d.account;
    push(label, -d.value, 'despesa');
  }
  if (outras !== 0) push('Outras Overhead', -outras, 'despesa');

  const resultado = running;
  items.push({ name: 'Resultado', spacer: resultado >= 0 ? 0 : resultado, value: Math.abs(resultado), type: resultado >= 0 ? 'total_pos' : 'total_neg', running: resultado });

  return { items, receitaBruta, reversoes, receitaLiq, csvTotal, resultado };
}

// Heat map: mês × conta → valor
// Retorna { accounts: string[], months: string[], matrix: { [account]: { [month]: number } } }
export function buildHeatMap(rows, kind = 'despesa', topN = 12) {
  const monthSet = new Set();
  const raw = {};
  for (const r of rows) {
    if (r.kind !== kind || !r.date) continue;
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    const acc = r.account || '(sem categoria)';
    monthSet.add(key);
    if (!raw[acc]) raw[acc] = {};
    raw[acc][key] = (raw[acc][key] || 0) + Math.abs(r.signed);
  }
  const months   = [...monthSet].sort();
  const totals   = Object.entries(raw).map(([acc, mv]) => ({ acc, total: Object.values(mv).reduce((s, v) => s + v, 0) }));
  totals.sort((a, b) => b.total - a.total);
  const accounts = totals.slice(0, topN).map(t => t.acc);
  const matrix   = {};
  for (const acc of accounts) matrix[acc] = raw[acc] || {};
  return { accounts, months, matrix };
}

// Agrupa por filial (unit) com separação CSV / overhead
export function groupByUnit(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.unit || '(sem filial)';
    if (!map[key]) map[key] = { unit: key, receita: 0, csv: 0, overhead: 0 };
    if (r.kind === 'receita')              map[key].receita  += r.signed;
    else if (r.subkind === 'csv')          map[key].csv      += r.signed;
    else                                   map[key].overhead += r.signed;
  }
  return Object.values(map)
    .map(m => {
      const despesa     = m.csv + m.overhead;
      const margemBruta = m.receita - m.csv;
      const resultado   = m.receita - despesa;
      return {
        ...m,
        despesa,
        margemBruta,
        margemBrutaPct: m.receita > 0 ? (margemBruta / m.receita) * 100 : 0,
        resultado,
        margem: m.receita > 0 ? (resultado / m.receita) * 100 : 0,
      };
    })
    .sort((a, b) => b.resultado - a.resultado);
}

// Tendência das top N contas de um kind ao longo dos meses
// Retorna { accounts: string[], series: [{ key, [acc]: value }] }
export function buildAccountTrend(rows, kind = 'despesa', topN = 6) {
  const byAcc = groupByAccount(rows, kind);
  const topAccs = byAcc.slice(0, topN).map(a => a.account);

  const monthMap = {};
  for (const r of rows) {
    if (r.kind !== kind || !r.date) continue;
    if (!topAccs.includes(r.account)) continue;
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { key };
    const acc = r.account || '(sem categoria)';
    monthMap[key][acc] = (monthMap[key][acc] || 0) + Math.abs(r.signed);
  }

  const series = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));
  return { accounts: topAccs, series };
}

// ─── Fluxo de Caixa (Baixadas) ───────────────────────────────────────────────

export function calcCashKPIs(rows) {
  let entradas = 0, saidas = 0;
  for (const r of rows) {
    if (r.type === 'RECEBER') entradas += r.value;
    else                      saidas   += r.value;
  }
  return { entradas, saidas, saldo: entradas - saidas };
}

export function groupCashByMonth(rows) {
  const map = {};
  for (const r of rows) {
    const d = r.payDate;
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, entradas: 0, saidas: 0 };
    if (r.type === 'RECEBER') map[key].entradas += r.value;
    else                      map[key].saidas   += r.value;
  }
  const sorted = Object.values(map)
    .map(m => ({ ...m, saldo: m.entradas - m.saidas }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // Saldo acumulado
  let acc = 0;
  for (const m of sorted) { acc += m.saldo; m.saldoAcum = acc; }
  return sorted;
}

export function groupCashByDay(rows) {
  const map = {};
  for (const r of rows) {
    const d = r.payDate;
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { key, entradas: 0, saidas: 0 };
    if (r.type === 'RECEBER') map[key].entradas += r.value;
    else                      map[key].saidas   += r.value;
  }
  const sorted = Object.values(map)
    .map(m => ({ ...m, saldo: m.entradas - m.saidas }))
    .sort((a, b) => a.key.localeCompare(b.key));

  let acc = 0;
  for (const m of sorted) { acc += m.saldo; m.saldoAcum = acc; }
  return sorted;
}

export function groupCashByPerson(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.person || '(sem nome)';
    if (!map[key]) map[key] = { person: key, entradas: 0, saidas: 0, count: 0 };
    if (r.type === 'RECEBER') map[key].entradas += r.value;
    else                      map[key].saidas   += r.value;
    map[key].count++;
  }
  return Object.values(map)
    .map(m => ({ ...m, saldo: m.entradas - m.saidas }))
    .sort((a, b) => Math.abs(b.saidas) - Math.abs(a.saidas));
}

// ─── Comparativo A × B ───────────────────────────────────────────────────────

export function compareKPIs(rowsA, rowsB) {
  const kpiA = calcDREKPIs(rowsA);
  const kpiB = calcDREKPIs(rowsB);
  const pct  = (a, b) => b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
  return {
    a: kpiA, b: kpiB,
    deltaReceita:     pct(kpiA.receita,     kpiB.receita),
    deltaCsv:         pct(kpiA.csv,         kpiB.csv),
    deltaMargemBruta: kpiA.margemBrutaPct - kpiB.margemBrutaPct,
    deltaDespesa:     pct(kpiA.despesa,     kpiB.despesa),
    deltaResultado:   pct(kpiA.resultado,   kpiB.resultado),
    deltaMargem:      kpiA.margem          - kpiB.margem,
  };
}

export function compareByAccount(rowsA, rowsB, kind = null) {
  const byAccA = groupByAccount(rowsA, kind);
  const byAccB = groupByAccount(rowsB, kind);
  const mapB   = Object.fromEntries(byAccB.map(a => [a.account, a.value]));
  return byAccA.map(a => ({
    account: a.account,
    valueA:  a.value,
    valueB:  mapB[a.account] || 0,
    delta:   a.value - (mapB[a.account] || 0),
    deltaPct: mapB[a.account] ? ((a.value - mapB[a.account]) / Math.abs(mapB[a.account])) * 100 : null,
  }));
}

// ─── Conciliação (BaixadasProdutos) ──────────────────────────────────────────

export function calcConcilKPIs(rows) {
  let receber = 0, pagar = 0;
  for (const r of rows) {
    if (r.type === 'RECEBER') receber += r.value;
    else                      pagar   += r.value;
  }
  const saldo     = receber - pagar;
  const cobertura = pagar > 0 ? (receber / pagar) * 100 : null;
  return { receber, pagar, saldo, cobertura, count: rows.length };
}

// Agrupa por filial → { unit, receber, pagar, saldo }[]
export function groupConcilByUnit(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.unit || '(sem filial)';
    if (!map[key]) map[key] = { unit: key, receber: 0, pagar: 0, count: 0 };
    if (r.type === 'RECEBER') map[key].receber += r.value;
    else                      map[key].pagar   += r.value;
    map[key].count++;
  }
  return Object.values(map)
    .map(m => ({ ...m, saldo: m.receber - m.pagar }))
    .sort((a, b) => b.receber - a.receber);
}

// Agrupa por pessoa filtrando por tipo → { person, value, count }[]
export function groupConcilByPerson(rows, type) {
  const map = {};
  for (const r of rows) {
    if (r.type !== type) continue;
    const key = r.person || '(sem nome)';
    if (!map[key]) map[key] = { person: key, value: 0, count: 0 };
    map[key].value += r.value;
    map[key].count++;
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

// Agrupa por venda → { saleId, unit, receber, pagar, saldo, count }[] top 100
export function groupConcilBySale(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.saleId) continue;
    const key = r.saleId;
    if (!map[key]) map[key] = { saleId: key, unit: r.unit || '', receber: 0, pagar: 0, count: 0 };
    if (r.type === 'RECEBER') map[key].receber += r.value;
    else                      map[key].pagar   += r.value;
    map[key].count++;
  }
  return Object.values(map)
    .map(m => ({ ...m, saldo: m.receber - m.pagar }))
    .sort((a, b) => (b.receber + b.pagar) - (a.receber + a.pagar))
    .slice(0, 100);
}

// Evolução mensal conciliação → [{ key, receber, pagar, saldo }]
export function groupConcilByMonth(rows) {
  const map = {};
  for (const r of rows) {
    const d = r.payDate;
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, receber: 0, pagar: 0 };
    if (r.type === 'RECEBER') map[key].receber += r.value;
    else                      map[key].pagar   += r.value;
  }
  return Object.values(map)
    .map(m => ({ ...m, saldo: m.receber - m.pagar }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
