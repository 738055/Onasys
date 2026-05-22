const PROFILE_LABELS = { 0: 'Emissivo', 1: 'Receptivo' };
const PERIOD_LABELS  = { 1: 'Emitido',  2: 'Realizado' };

export function buildMetadata(ctx) {
  const { startDate, endDate, qualPeriodo, nSistema, filters } = ctx;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const generatedAt = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const fmt = iso => {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const activeFilters = [];
  if (filters?.filial?.length)     activeFilters.push(`Filial: ${filters.filial.join(', ')}`);
  if (filters?.channel?.length)    activeFilters.push(`Canal: ${filters.channel.join(', ')}`);
  if (filters?.clientType?.length) activeFilters.push(`Tipo Cliente: ${filters.clientType.join(', ')}`);
  if (filters?.vendor?.length)     activeFilters.push(`Emissor: ${filters.vendor.join(', ')}`);

  return {
    periodo:     `${fmt(startDate)} a ${fmt(endDate)}`,
    perfil:      PROFILE_LABELS[nSistema] ?? String(nSistema),
    modalidade:  PERIOD_LABELS[qualPeriodo] ?? String(qualPeriodo),
    filtros:     activeFilters.length ? activeFilters.join(' · ') : 'Nenhum',
    geradoEm:    generatedAt,
  };
}

export function buildFileName(slug, ctx) {
  const { startDate, endDate } = ctx;
  const clean = s => (s || '').replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
  return `ONASYS-${clean(slug)}-${startDate}-to-${endDate}`;
}

export function fmtBRL(v) {
  if (v == null || isNaN(v)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function fmtPct(v) {
  if (v == null || isNaN(v)) return '-';
  return `${Number(v).toFixed(2)}%`;
}

export function fmtNum(v) {
  if (v == null || isNaN(v)) return '-';
  return new Intl.NumberFormat('pt-BR').format(v);
}

export function fmtCell(value, type) {
  if (type === 'currency') return fmtBRL(value);
  if (type === 'percent')  return fmtPct(value);
  if (type === 'number')   return fmtNum(value);
  return value ?? '-';
}
