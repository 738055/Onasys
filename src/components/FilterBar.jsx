import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(opt) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-sm hover:bg-slate-50 transition-colors"
      >
        <span className="text-slate-600">{label}</span>
        {value.length > 0 && (
          <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {value.length}
          </span>
        )}
        <ChevronDown size={13} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-52 max-h-64 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">Sem opções</p>
          )}
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  options,
  filial, onFilial,
  channel, onChannel,
  clientType, onClientType,
  vendor, onVendor,
  saleType, onSaleType,
}) {
  const hasFilters = filial.length + channel.length + clientType.length + vendor.length + saleType.length > 0;

  function clearAll() {
    onFilial([]);
    onChannel([]);
    onClientType([]);
    onVendor([]);
    onSaleType([]);
  }

  return (
    <div className="bg-white border-b border-slate-100 px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2 max-w-screen-2xl mx-auto">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Filtros:</span>
        <MultiSelect label="Filial"       options={options.filiais}     value={filial}      onChange={onFilial}      />
        <MultiSelect label="Canal"        options={options.channels}    value={channel}     onChange={onChannel}     />
        <MultiSelect label="Tipo Cliente" options={options.clientTypes} value={clientType}  onChange={onClientType}  />
        <MultiSelect label="Emissor"      options={options.vendors}     value={vendor}      onChange={onVendor}      />
        <MultiSelect label="Tipo Venda"   options={options.saleTypes}   value={saleType}    onChange={onSaleType}    />
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}
