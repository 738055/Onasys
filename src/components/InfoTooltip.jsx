import { useState } from 'react';
import { Info } from 'lucide-react';

// Tooltip informativo — aceita `text` (string simples) ou `children` (JSX estruturado)
export function InfoTooltip({ text, children }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center flex-shrink-0">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="ml-1 text-slate-400 hover:text-blue-500 focus:outline-none transition-colors duration-150"
        aria-label="Mais informações"
      >
        <Info size={13} />
      </button>
      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[200] w-80 bg-slate-900 text-white rounded-xl shadow-2xl pointer-events-none"
          style={{ minWidth: 240 }}
        >
          <div className="px-4 py-3 text-[11px] leading-relaxed whitespace-normal">
            {children ?? <span className="text-slate-200">{text}</span>}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  );
}

// Bloco de fórmula para uso dentro de InfoTooltip (JSX estruturado)
export function TooltipFormula({ formula }) {
  return (
    <span className="block font-mono text-emerald-300 text-[10px] bg-slate-800 rounded px-2 py-1 my-1.5">
      {formula}
    </span>
  );
}

// Linha de título dentro de InfoTooltip
export function TooltipTitle({ children }) {
  return <span className="block font-bold text-white mb-1">{children}</span>;
}
