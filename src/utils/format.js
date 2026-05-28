export const BRLFULL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const BRLk    = v => `R$${(v / 1000).toFixed(0)}k`;
export const PCTFMT  = v => v === null ? '-' : `${v.toFixed(2)}%`;

export const SEGMENT_CFG = {
  'TO': { label: 'TRF OUT',    color: '#3b82f6' },
  'TI': { label: 'TRF IN',     color: '#6366f1' },
  'I':  { label: 'INGRESSOS',  color: '#10b981' },
  'R':  { label: 'RECEPTIVO',  color: '#f59e0b' },
  'A':  { label: 'AEREO',      color: '#8b5cf6' },
  'H':  { label: 'HOTEL',      color: '#f97316' },
  'S':  { label: 'SERVIÇOS',   color: '#14b8a6' },
};

// ─── Tipo de Venda (tipovenda) ────────────────────────────────────────────────
// Paleta: Faturado = azul, Extra = âmbar, outros = slate.
// Lookup case-insensitive para tolerar variações da API (FATURADO / Faturado / faturado).
export const SALE_TYPE_COLORS = {
  'FATURADO': '#3b82f6',
  'EXTRA':    '#f59e0b',
};

export function saleTypeColor(type) {
  if (!type) return '#94a3b8';
  return SALE_TYPE_COLORS[String(type).toUpperCase()] || '#94a3b8';
}

export function saleTypeLabel(type) {
  if (!type) return 'Sem tipo';
  const up = String(type).toUpperCase();
  if (up === 'FATURADO') return 'Faturado';
  if (up === 'EXTRA') return 'Extra';
  return type;
}

// ─── Classificação de origem do prejuízo ─────────────────────────────────────
// Corresponde ao campo lossReason (raw: indicador_origem_prejuizo) da API.
// Cada entrada: group (Venda/Escala/Financeira/Comercial/OK/Outro),
//               label longo, short (badge), cor de visualização.
//
// Mapeamento feito por grupo para consistência visual:
//   OK         → verde  (lucrativo)
//   Venda      → vermelho (preço abaixo do custo)
//   Escala     → laranja  (custo operacional consumiu margem)
//   Financeira → âmbar   (taxas e provisões)
//   Comercial  → azul    (repasses, comissões, descontos)
//   Outro      → cinza
export const LOSS_REASON_CFG = {
  'lucrativo':               { group: 'OK',         label: 'Lucrativo',                          short: 'OK',        color: '#10b981' },
  'falha na venda':          { group: 'Venda',      label: 'Falha na Venda',                     short: 'Venda',     color: '#dc2626' },
  'falha na escala':         { group: 'Escala',     label: 'Falha na Escala',                    short: 'Escala',    color: '#f97316' },
  'taxa de cart':            { group: 'Financeira', label: 'Falha Financeira (Taxa Cartão)',     short: 'Cartão',    color: '#f59e0b' },
  'taxa adm':                { group: 'Financeira', label: 'Falha Financeira (Taxa ADM)',        short: 'ADM',       color: '#eab308' },
  'provis':                  { group: 'Financeira', label: 'Falha Financeira (Provisão)',        short: 'Provisão',  color: '#ca8a04' },
  'repasse':                 { group: 'Comercial',  label: 'Falha Comercial (Repasses)',         short: 'Repasse',   color: '#2563eb' },
  'comiss':                  { group: 'Comercial',  label: 'Falha Comercial (Comissões)',        short: 'Comissão',  color: '#3b82f6' },
  'desconto':                { group: 'Comercial',  label: 'Falha Comercial (Descontos)',        short: 'Desc.',     color: '#60a5fa' },
  'indeterminada':           { group: 'Outro',      label: 'Falha Indeterminada',                short: '?',         color: '#9ca3af' },
};

// Resolve o lossReason (string livre da API) para uma entrada do LOSS_REASON_CFG.
// Usa lowercase + includes para tolerar variações de pontuação, acento e capitalização.
// Categorias desconhecidas retornam o grupo "Outro" (cinza).
export function resolveLossReason(lossReason) {
  if (!lossReason) return { group: 'Outro', label: 'Indeterminada', short: '?', color: '#9ca3af' };
  const lower = lossReason.toLowerCase();
  for (const [key, cfg] of Object.entries(LOSS_REASON_CFG)) {
    if (lower.includes(key)) return cfg;
  }
  return { group: 'Outro', label: lossReason, short: '?', color: '#9ca3af' };
}

// Ordem para exibição dos grupos de origem do prejuízo
export const LOSS_GROUP_ORDER = ['Venda', 'Escala', 'Financeira', 'Comercial', 'Outro'];

// ─── Configuração de categorias de passageiros ───────────────────────────────
// Usado em mini-bars, badges e tooltips de composição de pax.
// PAX_CATEGORY_CFG — categorias de passageiros.
//   field: chave no modelo normalizado (row.paxAdt, etc.)
//   key:   chave no shape de breakdown agregado ({ adt, chd, colo, red, sen, free, total })
export const PAX_CATEGORY_CFG = [
  { field: 'paxAdt',  key: 'adt',  label: 'ADT',  labelLong: 'Adultos',           color: '#3b82f6' },
  { field: 'paxChd',  key: 'chd',  label: 'CHD',  labelLong: 'Crianças (meia)',   color: '#10b981' },
  { field: 'paxColo', key: 'colo', label: 'COL',  labelLong: 'Crianças (free)',   color: '#6366f1' },
  { field: 'paxRed',  key: 'red',  label: 'RED',  labelLong: 'Reduzidas',         color: '#f59e0b' },
  { field: 'paxSen',  key: 'sen',  label: 'SEN',  labelLong: 'Melhor Idade',      color: '#8b5cf6' },
  { field: 'paxFree', key: 'free', label: 'FREE', labelLong: 'Cortesia',          color: '#9ca3af' },
];
