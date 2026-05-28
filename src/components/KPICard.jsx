import { InfoTooltip } from './InfoTooltip';

const STYLES = {
  blue:    'bg-blue-50    border-blue-100    text-blue-800',
  green:   'bg-emerald-50 border-emerald-100 text-emerald-800',
  amber:   'bg-amber-50   border-amber-100   text-amber-800',
  slate:   'bg-slate-50   border-slate-200   text-slate-700',
  red:     'bg-red-50     border-red-100     text-red-800',
  indigo:  'bg-indigo-50  border-indigo-100  text-indigo-800',
  fuchsia: 'bg-fuchsia-50 border-fuchsia-100 text-fuchsia-800',
};

function fmt(value, format) {
  if (format === 'currency') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (format === 'percent')  return `${value.toFixed(2)}%`;
  if (format === 'number')   return value.toLocaleString('pt-BR');
  return String(value);
}

export function KPICard({ title, value, format = 'currency', icon: Icon, color = 'blue', sub, tooltip, onClick }) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-panel ${STYLES[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow select-none' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-60">{title}</p>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {Icon && <Icon size={18} className="opacity-40" />}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{fmt(value, format)}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
      {onClick && <p className="mt-1.5 text-[10px] opacity-40 underline underline-offset-2">clique para detalhar</p>}
    </div>
  );
}
