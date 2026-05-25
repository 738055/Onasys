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

export function calcKPIs(rows) {
  const revenue          = sum(rows, 'revenue');
  const profit           = sum(rows, 'profit');
  const profitLiquido    = sum(rows, 'profitLiquido');
  const uniquePassengers = uniquePassengersByVenda(rows);
  const uniqueSales      = new Set(rows.map(r => r.id).filter(Boolean)).size;
  // Margin = SUM(total_resultadoab) / SUM(total_vendas) — never average per_mkpliquido
  const margin           = revenue !== 0 ? (profit / revenue) * 100 : 0;
  const ticketMedio      = uniquePassengers > 0 ? revenue / uniquePassengers : 0;
  return { revenue, profit, profitLiquido, margin, uniquePassengers, uniqueSales, ticketMedio, count: rows.length };
}

export function groupByClientOrVendor(rows, groupField) {
  const map = {};
  for (const r of rows) {
    const key = r[groupField] || '(sem nome)';
    if (!map[key]) map[key] = {
      name: key, revenue: 0, profitLiquido: 0, profit: 0,
      commissionEmissor: 0, passengers: 0, _vendaMap: {},
    };
    map[key].revenue           += r.revenue           || 0;
    map[key].profitLiquido     += r.profitLiquido     || 0;
    map[key].profit            += r.profit            || 0;
    map[key].commissionEmissor += r.commissionEmissor || 0;
    map[key].passengers        += r.passengers        || 0;
    // Pax único por venda dentro do grupo
    if (r.id) {
      const cur = map[key]._vendaMap[r.id];
      if (cur === undefined || r.passengers > cur) map[key]._vendaMap[r.id] = r.passengers;
    }
  }
  return Object.values(map)
    .map(({ _vendaMap, ...g }) => ({
      ...g,
      uniquePassengers: Object.values(_vendaMap).reduce((s, v) => s + v, 0),
      rentPct: g.revenue !== 0 ? (g.profit / g.revenue) * 100 : null,
    }))
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

export function revenuePerNight(rows) {
  const map = {};
  for (const r of rows) {
    if (!r.nights || r.nights <= 0) continue;
    const key = r.segment || '(outro)';
    if (!map[key]) map[key] = { segment: key, revenue: 0, nights: 0, profitLiquido: 0 };
    map[key].revenue       += r.revenue       || 0;
    map[key].nights        += r.nights;
    map[key].profitLiquido += r.profitLiquido || 0;
  }
  return Object.values(map)
    .filter(s => s.nights > 0)
    .map(s => ({ ...s, revPerNight: s.revenue / s.nights }))
    .sort((a, b) => b.revPerNight - a.revPerNight);
}

export function itemsPerSale(rows) {
  const saleItems = {};
  for (const r of rows) {
    if (!r.id) continue;
    if (!saleItems[r.id]) saleItems[r.id] = new Set();
    if (r.seqId) saleItems[r.id].add(r.seqId);
  }
  const counts = Object.values(saleItems).map(s => s.size);
  if (!counts.length) return { avg: 0, dist: [] };
  const avg = counts.reduce((s, v) => s + v, 0) / counts.length;
  const dist = [
    { label: '1 item',  count: counts.filter(c => c === 1).length },
    { label: '2-3 itens', count: counts.filter(c => c >= 2 && c <= 3).length },
    { label: '4+ itens',  count: counts.filter(c => c >= 4).length },
  ];
  return { avg, dist, total: counts.length };
}
