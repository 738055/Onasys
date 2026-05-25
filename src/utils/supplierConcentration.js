function buildSupplierRevMap(rows) {
  const map = {};
  let total = 0;
  for (const r of rows) {
    const key = r.supplier || '(sem nome)';
    map[key] = (map[key] || 0) + (r.revenue || 0);
    total += r.revenue || 0;
  }
  return { map, total };
}

export function supplierShare(rows, topN = 5) {
  const { map, total } = buildSupplierRevMap(rows);
  if (total === 0) return 0;
  const topSum = Object.values(map)
    .sort((a, b) => b - a)
    .slice(0, topN)
    .reduce((s, v) => s + v, 0);
  return (topSum / total) * 100;
}

export function herfindahlIndex(rows) {
  const { map, total } = buildSupplierRevMap(rows);
  if (total === 0) return 0;
  return Object.values(map).reduce((s, v) => {
    const share = v / total;
    return s + share * share * 10000;
  }, 0);
}

export function supplierShareTable(rows, topN = 15) {
  const { map, total } = buildSupplierRevMap(rows);
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, topN);
  let cumulative = 0;
  return sorted.map(([name, revenue]) => {
    const share = total > 0 ? (revenue / total) * 100 : 0;
    cumulative += share;
    return { name, revenue, share, cumShare: cumulative };
  });
}

export function supplierMarginTrend(rows, topN = 10) {
  const { map: supRevMap } = buildSupplierRevMap(rows);
  const topSuppliers = Object.entries(supRevMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  const topSet = new Set(topSuppliers);
  const monthMap = {};

  for (const r of rows) {
    if (!r.emissionDate || !topSet.has(r.supplier)) continue;
    const d = r.emissionDate;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[month]) monthMap[month] = {};
    const sup = r.supplier;
    if (!monthMap[month][sup]) monthMap[month][sup] = { revenue: 0, profit: 0 };
    monthMap[month][sup].revenue += r.revenue || 0;
    monthMap[month][sup].profit  += r.profit  || 0;
  }

  const months = Object.keys(monthMap).sort();
  const data = months.map(month => {
    const row = { month };
    for (const sup of topSuppliers) {
      const agg = monthMap[month]?.[sup];
      row[sup] = agg && agg.revenue > 0 ? (agg.profit / agg.revenue) * 100 : null;
    }
    return row;
  });

  return { months, suppliers: topSuppliers, data };
}
