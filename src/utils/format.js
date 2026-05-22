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
