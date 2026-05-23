function diffInDays(laterDate, earlierDate) {
  if (!laterDate || !earlierDate) return null;
  const ms = laterDate.getTime() - earlierDate.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

const LEAD_BUCKETS = [
  { label: '0–7 dias',    min: 0,   max: 7,        color: '#ef4444' },
  { label: '8–15 dias',   min: 8,   max: 15,       color: '#f97316' },
  { label: '16–30 dias',  min: 16,  max: 30,       color: '#fbbf24' },
  { label: '31–60 dias',  min: 31,  max: 60,       color: '#34d399' },
  { label: '61–90 dias',  min: 61,  max: 90,       color: '#10b981' },
  { label: '91–180 dias', min: 91,  max: 180,      color: '#3b82f6' },
  { label: '180+ dias',   min: 181, max: Infinity, color: '#6366f1' },
];

export function calcLeadTimeBuckets(rows) {
  const buckets = LEAD_BUCKETS.map(b => ({ ...b, count: 0, revenue: 0, profitLiquido: 0 }));
  let total = 0;
  let skipped = 0;

  for (const r of rows) {
    const d = diffInDays(r.checkinDate, r.emissionDate);
    if (d === null) { skipped++; continue; }
    total++;
    for (const b of buckets) {
      if (d >= b.min && d <= b.max) {
        b.count++;
        b.revenue       += r.revenue       || 0;
        b.profitLiquido += r.profitLiquido || 0;
        break;
      }
    }
  }

  return {
    buckets: buckets.map(b => ({
      ...b,
      margin: b.revenue > 0 ? (b.profitLiquido / b.revenue) * 100 : null,
    })),
    total,
    skipped,
  };
}
