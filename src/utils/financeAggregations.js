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
// group: { code, label, accounts: [{ name, value, pct, count }], subtotal }
export function buildDREHierarchy(rows) {
  function buildGroups(kindRows) {
    const groups = {};
    for (const r of kindRows) {
      const groupCode = String(r.accountCode || '').slice(0, 2);
      if (!groups[groupCode]) groups[groupCode] = { code: groupCode, accounts: {} };
      const acc = r.account || '(sem conta)';
      if (!groups[groupCode].accounts[acc]) groups[groupCode].accounts[acc] = { value: 0, count: 0 };
      groups[groupCode].accounts[acc].value += Math.abs(r.signed);
      groups[groupCode].accounts[acc].count++;
    }
    const total = kindRows.reduce((s, r) => s + Math.abs(r.signed), 0);
    return {
      groups: Object.entries(groups).map(([code, g]) => {
        const subtotal = Object.values(g.accounts).reduce((s, a) => s + a.value, 0);
        return {
          code,
          label: ACCOUNT_GROUP_LABELS[code] || `Grupo ${code}`,
          subtotal,
          accounts: Object.entries(g.accounts)
            .map(([name, a]) => ({ name, value: a.value, count: a.count, pct: total > 0 ? a.value / total * 100 : 0 }))
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
  let receita = 0, despesa = 0;
  for (const r of rows) {
    if (r.kind === 'receita') receita += r.signed;
    else                      despesa += r.signed;
  }
  const resultado = receita - despesa;
  const margem    = receita > 0 ? (resultado / receita) * 100 : 0;
  return { receita, despesa, resultado, margem };
}

// { 'YYYY-MM': { key, receita, despesa, resultado, margem } }
export function groupByMonthDRE(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.date) continue;
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, receita: 0, despesa: 0 };
    if (r.kind === 'receita') map[key].receita += r.signed;
    else                      map[key].despesa += r.signed;
  }
  return Object.values(map)
    .map(m => ({
      ...m,
      resultado: m.receita - m.despesa,
      margem:    m.receita > 0 ? ((m.receita - m.despesa) / m.receita) * 100 : 0,
    }))
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
    map[key].value += r.kind === 'despesa' ? Math.abs(r.signed) : r.signed;
    map[key].count++;
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

// Waterfall chart data para Recharts (stacked bar trick)
// Cada item: { name, spacer (transparent), value (colored), type, running }
export function buildWaterfall(rows) {
  const receitaBruta = rows.filter(r => r.kind === 'receita' && r.op === 'C').reduce((s, r) => s + r.value, 0);
  const reversoes    = rows.filter(r => r.kind === 'receita' && r.op === 'D').reduce((s, r) => s + r.value, 0);
  const receitaLiq   = receitaBruta - reversoes;

  const despByAcc = groupByAccount(rows, 'despesa');
  const topN      = despByAcc.slice(0, 6);
  const outras    = despByAcc.slice(6).reduce((s, d) => s + d.value, 0);

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

  for (const d of topN) {
    const label = d.account.length > 22 ? d.account.slice(0, 22) + '…' : d.account;
    push(label, -d.value, 'despesa');
  }
  if (outras > 0) push('Outras Despesas', -outras, 'despesa');

  const resultado = running;
  items.push({ name: 'Resultado', spacer: resultado >= 0 ? 0 : resultado, value: Math.abs(resultado), type: resultado >= 0 ? 'total_pos' : 'total_neg', running: resultado });

  return { items, receitaBruta, reversoes, receitaLiq, resultado };
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

// Agrupa por filial (unit)
export function groupByUnit(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.unit || '(sem filial)';
    if (!map[key]) map[key] = { unit: key, receita: 0, despesa: 0 };
    if (r.kind === 'receita') map[key].receita += r.signed;
    else                      map[key].despesa += r.signed;
  }
  return Object.values(map)
    .map(m => ({
      ...m,
      resultado: m.receita - m.despesa,
      margem:    m.receita > 0 ? ((m.receita - m.despesa) / m.receita) * 100 : 0,
    }))
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

// ─── Aging (Abertas) ─────────────────────────────────────────────────────────

export function calcAgingKPIs(rows) {
  let pagar = 0, receber = 0;
  for (const r of rows) {
    if (r.type === 'PAGAR')   pagar   += r.value;
    else                      receber += r.value;
  }
  return { pagar, receber, saldo: receber - pagar };
}

export function groupAgingByBucket(rows) {
  const map = { vencido: { pagar: 0, receber: 0 }, '0-30': { pagar: 0, receber: 0 }, '31-60': { pagar: 0, receber: 0 }, '60+': { pagar: 0, receber: 0 } };
  for (const r of rows) {
    const b = map[r.agingBucket];
    if (!b) continue;
    if (r.type === 'PAGAR') b.pagar   += r.value;
    else                    b.receber += r.value;
  }
  return map;
}

export function groupAgingByPerson(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.person || '(sem nome)';
    if (!map[key]) map[key] = { person: key, type: r.type, pagar: 0, receber: 0 };
    if (r.type === 'PAGAR') map[key].pagar   += r.value;
    else                    map[key].receber += r.value;
  }
  return Object.values(map).sort((a, b) => (b.pagar + b.receber) - (a.pagar + a.receber));
}

// ─── Comparativo A × B ───────────────────────────────────────────────────────

export function compareKPIs(rowsA, rowsB) {
  const kpiA = calcDREKPIs(rowsA);
  const kpiB = calcDREKPIs(rowsB);
  const pct  = (a, b) => b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
  return {
    a: kpiA, b: kpiB,
    deltaReceita:   pct(kpiA.receita,   kpiB.receita),
    deltaDespesa:   pct(kpiA.despesa,   kpiB.despesa),
    deltaResultado: pct(kpiA.resultado, kpiB.resultado),
    deltaMargem:    kpiA.margem - kpiB.margem,
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
