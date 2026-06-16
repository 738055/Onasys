export { BRLFULL, BRLk, PCTFMT } from './format';

export const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MONTHS_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function fmtMonthKey(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]}/${y.slice(2)}`;
}

export function fmtDateKey(key) {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

export const FINANCE_COLORS = {
  receita:      '#10b981',
  despesa:      '#ef4444',
  resultado:    '#3b82f6',
  margem:       '#8b5cf6',
  entrada:      '#10b981',
  saida:        '#f97316',
  saldo:        '#3b82f6',
  pagar:        '#ef4444',
  receber:      '#10b981',
  vencido:      '#dc2626',
  '0-30':       '#f59e0b',
  '31-60':      '#3b82f6',
  '60+':        '#6366f1',
};

const ACCOUNT_PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444',
  '#6366f1','#f97316','#14b8a6','#ec4899','#84cc16',
  '#06b6d4','#a78bfa','#fb923c','#34d399','#f472b6',
];

const _accountColorCache = {};
let _paletteIdx = 0;
export function accountColor(name) {
  if (!_accountColorCache[name]) {
    _accountColorCache[name] = ACCOUNT_PALETTE[_paletteIdx % ACCOUNT_PALETTE.length];
    _paletteIdx++;
  }
  return _accountColorCache[name];
}

export const AGING_LABELS = {
  vencido: 'Vencido',
  '0-30':  'Vence em 0–30 dias',
  '31-60': 'Vence em 31–60 dias',
  '60+':   'Vence em 60+ dias',
};

export const AGING_ORDER = ['vencido', '0-30', '31-60', '60+'];
