function percentileBrackets(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    p33: sorted[Math.floor(n * 0.33)] ?? 0,
    p67: sorted[Math.floor(n * 0.67)] ?? 0,
  };
}

export function calcRFM(rows) {
  if (!rows.length) return { clients: [], summary: { champions: 0, atRisk: 0, lost: 0, total: 0 }, refDate: null };

  let refDate = null;
  for (const r of rows) {
    if (r.emissionDate && (!refDate || r.emissionDate > refDate)) {
      refDate = r.emissionDate;
    }
  }
  if (!refDate) return { clients: [], summary: { champions: 0, atRisk: 0, lost: 0, total: 0 }, refDate: null };

  const map = {};
  for (const r of rows) {
    const key = r.client || '(sem nome)';
    if (!map[key]) map[key] = { name: key, lastDate: null, saleIds: new Set(), revenue: 0 };
    map[key].revenue += r.revenue || 0;
    if (r.id) map[key].saleIds.add(r.id);
    if (r.emissionDate && (!map[key].lastDate || r.emissionDate > map[key].lastDate)) {
      map[key].lastDate = r.emissionDate;
    }
  }

  const clients = Object.values(map).map(c => ({
    name:      c.name,
    recency:   c.lastDate ? Math.floor((refDate - c.lastDate) / (1000 * 60 * 60 * 24)) : 9999,
    frequency: c.saleIds.size,
    monetary:  c.revenue,
  }));

  const rBrackets = percentileBrackets(clients.map(c => c.recency));
  const fBrackets = percentileBrackets(clients.map(c => c.frequency));
  const mBrackets = percentileBrackets(clients.map(c => c.monetary));

  const scored = clients.map(c => {
    // Recency: menor = melhor (compra recente) → A se abaixo do p33
    const rScore = c.recency   <= rBrackets.p33 ? 'A' : c.recency   <= rBrackets.p67 ? 'B' : 'C';
    const fScore = c.frequency >= fBrackets.p67 ? 'A' : c.frequency >= fBrackets.p33 ? 'B' : 'C';
    const mScore = c.monetary  >= mBrackets.p67 ? 'A' : c.monetary  >= mBrackets.p33 ? 'B' : 'C';
    return { ...c, rScore, fScore, mScore, classe: `${rScore}${fScore}${mScore}` };
  });

  scored.sort((a, b) => a.classe.localeCompare(b.classe) || b.monetary - a.monetary);

  const champions = scored.filter(c => c.rScore === 'A' && c.fScore === 'A').length;
  const atRisk    = scored.filter(c => c.rScore === 'C' && c.fScore !== 'C').length;
  const lost      = scored.filter(c => c.classe === 'CCC').length;

  return { clients: scored, summary: { champions, atRisk, lost, total: scored.length }, refDate };
}
