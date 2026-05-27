/**
 * PaxCompositionBar — mini stacked-bar horizontal de composição de passageiros.
 *
 * Props:
 *   breakdown  {Object}  Shape { adt, chd, colo, red, sen, free } (keys do PAX_CATEGORY_CFG).
 *              Aceita também o modelo normalizado completo { paxAdt, paxChd, ... }
 *              — a normalização é feita internamente.
 *   height     {number}  Altura em px (padrão 8).
 *   showLabels {boolean} Se true, mostra chips ADT/CHD/... abaixo da barra (padrão false).
 *   className  {string}  Classes extras no container.
 */
import { PAX_CATEGORY_CFG } from '../utils/format';

function resolveBreakdown(raw) {
  if (!raw) return {};
  // Aceita shape { adt, chd, colo, red, sen, free } OU { paxAdt, paxChd, ... }
  return {
    adt:  raw.adt  ?? raw.paxAdt  ?? 0,
    chd:  raw.chd  ?? raw.paxChd  ?? 0,
    colo: raw.colo ?? raw.paxColo ?? 0,
    red:  raw.red  ?? raw.paxRed  ?? 0,
    sen:  raw.sen  ?? raw.paxSen  ?? 0,
    free: raw.free ?? raw.paxFree ?? 0,
  };
}

export function PaxCompositionBar({
  breakdown,
  height = 8,
  showLabels = false,
  className = '',
}) {
  const bd = resolveBreakdown(breakdown);
  const total = PAX_CATEGORY_CFG.reduce((s, c) => s + (bd[c.key] || 0), 0);

  // Sem dados: retorna placeholder cinza
  if (total === 0) {
    return (
      <div
        className={`rounded-full bg-slate-100 ${className}`}
        style={{ height }}
        title="Composição de pax não disponível"
      />
    );
  }

  return (
    <div className={className}>
      {/* Barra empilhada */}
      <div
        className="flex rounded-full overflow-hidden w-full"
        style={{ height }}
        title={PAX_CATEGORY_CFG
          .filter(c => bd[c.key] > 0)
          .map(c => `${c.label}: ${bd[c.key]}`)
          .join(' · ')}
      >
        {PAX_CATEGORY_CFG.map(c => {
          const v = bd[c.key] || 0;
          if (v === 0) return null;
          return (
            <div
              key={c.key}
              style={{ flex: v, background: c.color }}
            />
          );
        })}
      </div>

      {/* Chips opcionais */}
      {showLabels && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
          {PAX_CATEGORY_CFG.map(c => {
            const v = bd[c.key] || 0;
            if (v === 0) return null;
            return (
              <span key={c.key} className="flex items-center gap-0.5 text-[10px] text-slate-500">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: c.color }}
                />
                {c.label} {v.toLocaleString('pt-BR')}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * PaxBreakdownChips — versão chip inline (sem barra).
 * Exibe cada categoria não-zero como "ADT 2 · CHD 1 · ...".
 */
export function PaxBreakdownChips({ breakdown, className = '' }) {
  const bd = resolveBreakdown(breakdown);
  const items = PAX_CATEGORY_CFG.filter(c => (bd[c.key] || 0) > 0);
  if (items.length === 0) return <span className={`text-slate-300 ${className}`}>—</span>;
  return (
    <span className={`inline-flex flex-wrap gap-x-1.5 gap-y-0.5 ${className}`}>
      {items.map(c => (
        <span key={c.key} className="inline-flex items-center gap-0.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: c.color }}
          />
          <span className="text-slate-600 font-medium">{c.label}</span>
          <span className="text-slate-500">{(bd[c.key] || 0).toLocaleString('pt-BR')}</span>
        </span>
      ))}
    </span>
  );
}
