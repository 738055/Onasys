import { useState } from 'react';
import { Info } from 'lucide-react';

export function InfoTooltip({ text }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center flex-shrink-0">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="ml-0.5 text-slate-300 hover:text-blue-400 focus:outline-none transition-colors"
        aria-label="Como é calculado"
      >
        <Info size={12} />
      </button>
      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-2 z-[200] w-72 bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2.5 shadow-xl leading-relaxed whitespace-normal pointer-events-none"
        >
          {text}
          <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </span>
  );
}
