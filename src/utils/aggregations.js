import { resolveLossReason, LOSS_GROUP_ORDER } from './format.js';

function sum(rows, field) {
  return rows.reduce((acc, r) => acc + (r[field] || 0), 0);
}

// Deduplica por ID de venda: pega o maior num_pax registrado por venda.
// Evita contar o mesmo grupo de 44 pax 3x quando a venda tem 3 itens (Transfer + Hotel + Ingresso).
function uniquePassengersByVenda(rows) {
  const vendaMap = {};
  for (const r of rows) {
    if (!r.id) continue;
    if (vendaMap[r.id] === undefined || r.passengers > vendaMap[r.id]) {
      vendaMap[r.id] = r.passengers;
    }
  }
  return Object.values(vendaMap).reduce((s, v) => s + v, 0);
}

// Soma bruta de cada categoria de pax por item (para fornecedor/serviço/operação).
// Retorna o mesmo shape de uniquePaxBreakdownByVenda para intercambialidade.
export function sumPaxBreakdown(rows) {
  const bd = { adt: 0, chd: 0, colo: 0, red: 0, sen: 0, free: 0, total: 0 };
  for (const r of rows) {
    bd.adt  += r.paxAdt  || 0;
    bd.chd  += r.paxChd  || 0;
    bd.colo += r.paxColo || 0;
    bd.red  += r.paxRed  || 0;
    bd.sen  += r.paxSen  || 0;
    bd.free += r.paxFree || 0;
    bd.total += r.passengers || 0;
  }
  return bd;
}

// Breakdown de pax por venda (dedup via max por venda — igual ao KPI "Passageiros" global).
// Cada categoria pega o MAX entre os itens da mesma venda (não soma), assim
// ADT+CHD+...+FREE ≈ uniquePassengersByVenda(rows).
export function uniquePaxBreakdownByVenda(rows) {
  const PAX_FIELDS = ['paxAdt', 'paxChd', 'paxColo', 'paxRed', 'paxSen', 'paxFree', 'passengers'];
  const vendaMap = {};
  for (const r of rows) {
    if (!r.id) continue;
    if (!vendaMap[r.id]) vendaMap[r.id] = {};
    for (const f of PAX_FIELDS) {
      const cur = vendaMap[r.id][f];
      if (cur === undefined || (r[f] || 0) > cur) vendaMap[r.id][f] = r[f] || 0;
    }
  }
  const bd = { adt: 0, chd: 0, colo: 0, red: 0, sen: 0, free: 0, total: 0 };
  for (const v of Object.values(vendaMap)) {
    bd.adt  += v.paxAdt  || 0;
    bd.chd  += v.paxChd  || 0;
    bd.colo += v.paxColo || 0;
    bd.red  += v.paxRed  || 0;
    bd.sen  += v.paxSen  || 0;
    bd.free += v.paxFree || 0;
    bd.total += v.passengers || 0;
  }
  return bd;
}

// Agrupa itens por origem do prejuízo.
// Por padrão filtra apenas itens com profit < 0 (onlyLosses = true).
// Retorna array ordenado pelo maior prejuízo absoluto, pronto para BarChart.
export function groupByLossReason(rows, { onlyLosses = true } = {}) {
  const source = onlyLosses ? rows.filter(r => r.profit < 0) : rows;
  const totalLoss = source.reduce((s, r) => s + (r.profit || 0), 0); // negativo
  const map = {};
  for (const r of source) {
    const cfg = resolveLossReason(r.lossReason);
    const key = cfg.label;
    if (!map[key]) map[key] = { reason: cfg.label, group: cfg.group, color: cfg.color, short: cfg.short, items: 0, revenue: 0, loss: 0 };
    map[key].items   += 1;
    map[key].revenue += r.revenue || 0;
    map[key].loss    += r.profit  || 0;   // negativo
  }
  return Object.values(map)
    .map(g => ({
      ...g,
      absloss: Math.abs(g.loss),
      share: totalLoss !== 0 ? (g.loss / totalLoss) * 100 : 0,
    }))
    .sort((a, b) => b.absloss - a.absloss);
}

// Totais por GRUPO (Venda/Escala/Financeira/Comercial/Outro).
// Útil para mini-KPIs laterais ao BarChart de origens do prejuízo.
export function lossDiagnosticTotals(rows) {
  const lossRows = rows.filter(r => r.profit < 0);
  const totalLoss = lossRows.reduce((s, r) => s + (r.profit || 0), 0);
  const map = {};
  for (const r of lossRows) {
    const { group, color } = resolveLossReason(r.lossReason);
    if (!map[group]) map[group] = { group, color, items: 0, loss: 0 };
    map[group].items += 1;
    map[group].loss  += r.profit || 0;
  }
  // Retorna na ordem definida (Venda → Escala → Financeira → Comercial → Outro)
  return LOSS_GROUP_ORDER
    .filter(g => map[g])
    .map(g => ({
      ...map[g],
      absloss: Math.abs(map[g].loss),
      share: totalLoss !== 0 ? (map[g].loss / totalLoss) * 100 : 0,
    }));
}

export function calcKPIs(rows) {
  const revenue          = sum(rows, 'revenue');
  const profit           = sum(rows, 'profit');
  const profitLiquido    = sum(rows, 'profitLiquido');
  const uniquePassengers = uniquePassengersByVenda(rows);
  const uniqueSales      = new Set(rows.map(r => r.id).filter(Boolean)).size;
  // Margin = SUM(total_resultadoab) / SUM(total_vendas) — never average per_mkpliquido
  const margin           = revenue !== 0 ? (profit / revenue) * 100 : 0;
  const ticketMedio      = uniquePassengers > 0 ? revenue / uniquePassengers : 0;
  // Breakdown de pax (dedup por venda — consistente com uniquePassengers)
  const paxBreakdown     = uniquePaxBreakdownByVenda(rows);
  return { revenue, profit, profitLiquido, margin, uniquePassengers, uniqueSales, ticketMedio, count: rows.length, paxBreakdown };
}

export function groupByClientOrVendor(rows, groupField) {
  const PAX_FIELDS = ['paxAdt', 'paxChd', 'paxColo', 'paxRed', 'paxSen', 'paxFree', 'passengers'];
  const map = {};
  for (const r of rows) {
    const key = r[groupField] || '(sem nome)';
    if (!map[key]) map[key] = {
      name: key, revenue: 0, profitLiquido: 0, profit: 0,
      commissionEmissor: 0, passengers: 0,
      // Breakdown bruto (SUM por item — para visão fornecedor/serviço)
      paxAdt: 0, paxChd: 0, paxColo: 0, paxRed: 0, paxSen: 0, paxFree: 0,
      _vendaMap: {},
    };
    map[key].revenue           += r.revenue           || 0;
    map[key].profitLiquido     += r.profitLiquido     || 0;
    map[key].profit            += r.profit            || 0;
    map[key].commissionEmissor += r.commissionEmissor || 0;
    map[key].passengers        += r.passengers        || 0;
    // Breakdown bruto por item
    map[key].paxAdt  += r.paxAdt  || 0;
    map[key].paxChd  += r.paxChd  || 0;
    map[key].paxColo += r.paxColo || 0;
    map[key].paxRed  += r.paxRed  || 0;
    map[key].paxSen  += r.paxSen  || 0;
    map[key].paxFree += r.paxFree || 0;
    // Pax único por venda dentro do grupo (para dedup por venda)
    if (r.id) {
      if (!map[key]._vendaMap[r.id]) map[key]._vendaMap[r.id] = {};
      for (const f of PAX_FIELDS) {
        const cur = map[key]._vendaMap[r.id][f];
        if (cur === undefined || (r[f] || 0) > cur) map[key]._vendaMap[r.id][f] = r[f] || 0;
      }
    }
  }
  return Object.values(map)
    .map(({ _vendaMap, ...g }) => {
      // Dedup: soma o max de cada campo por venda
      const dedup = { adt: 0, chd: 0, colo: 0, red: 0, sen: 0, free: 0, total: 0 };
      for (const v of Object.values(_vendaMap)) {
        dedup.adt   += v.paxAdt   || 0;
        dedup.chd   += v.paxChd   || 0;
        dedup.colo  += v.paxColo  || 0;
        dedup.red   += v.paxRed   || 0;
        dedup.sen   += v.paxSen   || 0;
        dedup.free  += v.paxFree  || 0;
        dedup.total += v.passengers || 0;
      }
      return {
        ...g,
        // paxBreakdown (SUM bruto): usado em visão fornecedor/serviço
        paxBreakdown: { adt: g.paxAdt, chd: g.paxChd, colo: g.paxColo, red: g.paxRed, sen: g.paxSen, free: g.paxFree, total: g.passengers },
        // paxBreakdownUnique: dedup por venda (usado em KPIs/resumo do grupo)
        paxBreakdownUnique: dedup,
        uniquePassengers: dedup.total,
        rentPct: g.revenue !== 0 ? (g.profit / g.revenue) * 100 : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function groupByMonth(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.emissionDate) continue;
    const d = r.emissionDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { month: key, revenue: 0, profitLiquido: 0, profit: 0, passengers: 0 };
    map[key].revenue       += r.revenue;
    map[key].profitLiquido += r.profitLiquido;
    map[key].profit        += r.profit;
    map[key].passengers    += r.passengers;
  }
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}

export function topNByField(rows, groupField, valueField, n = 10) {
  const map = {};
  for (const r of rows) {
    const key = r[groupField] || '(sem nome)';
    if (!map[key]) map[key] = { name: key, value: 0, revenue: 0, profitLiquido: 0 };
    map[key].value         += r[valueField]     || 0;
    map[key].revenue       += r.revenue         || 0;
    map[key].profitLiquido += r.profitLiquido   || 0;
  }
  return Object.values(map)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export function channelMix(rows) {
  return topNByField(rows, 'channel', 'revenue', 20).filter(c => c.value > 0);
}

export function scatterBySupplier(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.supplier || '(sem nome)';
    if (!map[key]) map[key] = { name: key, revenue: 0, profitLiquido: 0, profit: 0 };
    map[key].revenue       += r.revenue;
    map[key].profitLiquido += r.profitLiquido;
    map[key].profit        += r.profit;
  }
  return Object.values(map)
    .filter(s => s.revenue > 0)
    .map(s => ({ ...s, margin: (s.profit / s.revenue) * 100 }));
}

export function groupByMonthAndField(rows, field) {
  const months = {};
  const allValues = new Set();
  for (const r of rows) {
    if (!r.emissionDate) continue;
    const d = r.emissionDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const val = r[field] || '(outro)';
    allValues.add(val);
    if (!months[key]) months[key] = { month: key };
    months[key][val] = (months[key][val] || 0) + (r.revenue || 0);
  }
  return {
    data: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
    keys: [...allValues].sort(),
  };
}

export function abcCurve(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.client || '(sem nome)';
    if (!map[key]) map[key] = { name: key, revenue: 0 };
    map[key].revenue += r.revenue;
  }
  const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, x) => s + x.revenue, 0);
  let cumulative = 0;
  return sorted.slice(0, 30).map(c => {
    cumulative += c.revenue;
    return { ...c, cumPct: total > 0 ? (cumulative / total) * 100 : 0 };
  });
}

export function scatterByVendor(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.vendor || '(sem nome)';
    if (!map[key]) map[key] = { name: key, revenue: 0, profitLiquido: 0, profit: 0, saleIds: new Set() };
    map[key].revenue       += r.revenue;
    map[key].profitLiquido += r.profitLiquido;
    map[key].profit        += r.profit;
    if (r.id) map[key].saleIds.add(r.id);
  }
  return Object.values(map)
    .filter(v => v.revenue > 0)
    .map(({ saleIds, ...v }) => ({
      ...v,
      margin:    (v.profit / v.revenue) * 100,
      saleCount: saleIds.size,
    }));
}

// Análise da causa-raiz das "Falhas na Escala":
// distingue se o preço não cobriu nem o custo NET do fornecedor (problema de VENDA)
// vs cobriu o NET mas não o custo operacional (problema real de ESCALA).
//
// Retorna null se não houver itens Escala com dados de custo disponíveis.
export function escalaDeepDive(rows) {
  const escalaItems = rows.filter(
    r => r.profit < 0 && resolveLossReason(r.lossReason).group === 'Escala',
  );
  if (escalaItems.length === 0) return null;

  // Sub-causa 1 — "Problema de Venda": preço abaixo do custo NET do fornecedor
  //   revenue < costBaseNet → mesmo sem contar escala, já há prejuízo no custo bruto
  const belowNetItems    = escalaItems.filter(r => r.revenue < (r.costBaseNet || 0));
  // Sub-causa 2 — "Problema de Escala": preço cobriu NET mas não o custo operacional
  //   revenue ≥ costBaseNet, mas revenue − NET < costScale
  const aboveNetItems    = escalaItems.filter(r => r.revenue >= (r.costBaseNet || 0));
  // Sub-causa 3 — "Outros custos" (edge case): cobriu NET+Escala mas taxas/comissões levaram ao prejuízo
  const coversNetScale   = aboveNetItems.filter(r => (r.revenue - (r.costBaseNet||0)) >= (r.costScale||0));

  // Cobertura média da escala para itens que cobriram o NET (0 a 1 = parcial, 1+ = cobre tudo)
  const withScale = aboveNetItems.filter(r => (r.costScale||0) > 0);
  const avgCoverage = withScale.length > 0
    ? withScale.reduce((s, r) => s + (r.revenue - (r.costBaseNet||0)) / r.costScale, 0) / withScale.length
    : null;

  // Diagnóstico das escalas como unidade (não só os itens individuais)
  const scaleIds = [...new Set(escalaItems.map(r => r.idEscala).filter(id => id > 0))];
  // Agrega o resultado total de CADA escala (todos os itens, incluindo lucrativos)
  const scaleTotals = {};
  for (const r of rows) {
    if (!r.idEscala || !scaleIds.includes(r.idEscala)) continue;
    scaleTotals[r.idEscala] = (scaleTotals[r.idEscala] || 0) + (r.profit || 0);
  }
  const deficitScaleCount = scaleIds.filter(id => scaleTotals[id] < 0).length;
  const mixedScaleCount   = scaleIds.filter(id => scaleTotals[id] >= 0).length; // escala lucrativa, mas tem item negativo (alocação)

  return {
    total:             escalaItems.length,
    belowNet:          belowNetItems.length,     // preço < NET → venda foi o problema
    aboveNet:          aboveNetItems.length,      // preço ≥ NET → escala foi o problema
    coversNetScale:    coversNetScale.length,     // edge: cobriu NET+Esc mas outros custos → Financeiro/Comercial
    avgCoverage,                                  // cobertura média da escala (aboveNet items)
    scaleCount:        scaleIds.length,
    deficitScaleCount,                            // escalas deficitárias NO TOTAL
    mixedScaleCount,                              // escalas lucrativas no total mas c/ itens negativos (alocação)
    totalLoss:         escalaItems.reduce((s, r) => s + (r.profit||0), 0),
    belowNetLoss:      belowNetItems.reduce((s, r) => s + (r.profit||0), 0),
    aboveNetLoss:      aboveNetItems.reduce((s, r) => s + (r.profit||0), 0),
  };
}

// Evolução mensal das origens do prejuízo (valores absolutos para BarChart empilhado).
// Retorna { data: [{ month, label, Venda, Escala, Financeira, Comercial, Outro }], groups }
export function groupLossReasonByMonth(rows) {
  const lossRows = rows.filter(r => r.profit < 0 && r.emissionDate);
  const map = {};
  const groupsSet = new Set();
  for (const r of lossRows) {
    const d   = r.emissionDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const { group } = resolveLossReason(r.lossReason);
    groupsSet.add(group);
    if (!map[key]) map[key] = { month: key };
    map[key][group] = (map[key][group] || 0) + Math.abs(r.profit || 0);
  }
  // Ordena por mês e preenche zeros para grupos ausentes
  const groups = LOSS_GROUP_ORDER.filter(g => groupsSet.has(g));
  const data   = Object.values(map)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => {
      const entry = { ...m };
      groups.forEach(g => { if (!entry[g]) entry[g] = 0; });
      return entry;
    });
  return { data, groups };
}

// Agrupa todos os itens por idEscala (exclui escala 0 = sem escala operacional).
// Retorna um mapa { [idEscala]: { idEscala, product, supplier, checkinDate, items[], revenue, costBaseNet, costScale, profit } }.
// Usado pelo ScaleAuditModal para exibir TODOS os itens de uma escala (incluindo lucrativos)
// e calcular a viabilidade da escala como unidade de análise.
export function groupByEscala(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.idEscala || r.idEscala === 0) continue;
    const key = r.idEscala;
    if (!map[key]) map[key] = {
      idEscala:    key,
      product:     r.product     || '(sem produto)',
      supplier:    r.supplier    || '(sem fornecedor)',
      checkinDate: r.checkinDate,
      items:       [],
      revenue:     0,
      costBaseNet: 0,
      costScale:   0,
      profit:      0,
    };
    map[key].items.push(r);
    map[key].revenue     += r.revenue     || 0;
    map[key].costBaseNet += r.costBaseNet || 0;
    map[key].costScale   += r.costScale   || 0;
    map[key].profit      += r.profit      || 0;
  }
  return map;
}

// Receita e margem por passageiro por segmento.
// Usa passengers bruto por item (não deduplica por venda) — cada item de serviço
// representa uma entrega independente para aquele grupo de pax.
export function revenuePerPax(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.passengers || r.passengers <= 0) continue;
    const key = r.segment || '(outro)';
    if (!map[key]) map[key] = { segment: key, revenue: 0, profit: 0, passengers: 0 };
    map[key].revenue    += r.revenue    || 0;
    map[key].profit     += r.profit     || 0;
    map[key].passengers += r.passengers || 0;
  }
  return Object.values(map)
    .filter(s => s.passengers > 0)
    .map(s => ({
      ...s,
      revPerPax:    s.revenue / s.passengers,
      profitPerPax: s.profit  / s.passengers,
      rentPct:      s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revPerPax - a.revPerPax);
}

// Receita e margem por noite de hospedagem, por segmento.
// Somente itens com num_noites > 0 entram no cálculo.
export function revenuePerNight(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.nights || r.nights <= 0) continue;
    const key = r.segment || '(outro)';
    if (!map[key]) map[key] = { segment: key, revenue: 0, profit: 0, nights: 0 };
    map[key].revenue += r.revenue || 0;
    map[key].profit  += r.profit  || 0;
    map[key].nights  += r.nights;
  }
  return Object.values(map)
    .filter(s => s.nights > 0)
    .map(s => ({
      ...s,
      revPerNight:    s.revenue / s.nights,
      profitPerNight: s.profit  / s.nights,
      rentPct:        s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revPerNight - a.revPerNight);
}

// Média de serviços por venda (indicador de cross-sell).
// Usa seqId distintos quando preenchidos; fallback para contagem de linhas.
// Garante que todas as vendas caem em algum bucket (% fecha em 100%).
export function itemsPerSale(rows) {
  const saleSeqIds   = {};  // Set de seqIds por venda
  const saleRowCount = {};  // Fallback: contagem de linhas por venda
  for (const r of rows) {
    if (!r.id) continue;
    if (!saleSeqIds[r.id]) { saleSeqIds[r.id] = new Set(); saleRowCount[r.id] = 0; }
    if (r.seqId) saleSeqIds[r.id].add(r.seqId);
    saleRowCount[r.id]++;
  }
  // Prefere seqId (mais preciso para cross-sell); usa linhas quando seqId vazio
  const counts = Object.keys(saleSeqIds).map(id => {
    const seqCount = saleSeqIds[id].size;
    return seqCount > 0 ? seqCount : saleRowCount[id];
  });
  if (!counts.length) return { avg: 0, dist: [], total: 0 };
  const total = counts.length;
  const avg   = counts.reduce((s, v) => s + v, 0) / total;
  const dist  = [
    { label: '1 serviço',    count: counts.filter(c => c === 1).length },
    { label: '2–3 serviços', count: counts.filter(c => c >= 2 && c <= 3).length },
    { label: '4+ serviços',  count: counts.filter(c => c >= 4).length },
  ];
  return { avg, dist, total };
}
