import { useState, useEffect } from 'react';
import { normalizeFinanceRows } from '../utils/normalizeFinance';

// Hook para buscar um período único (1 mês max).
// recurso: 'resultado' | 'baixadas' | 'abertas' | 'todos'
// tipo (para 'todos'): 'A' | 'P' | 'R'
export function useFinanceData({ startDate, endDate, recurso, tipo = 'R', enabled = true }) {
  const [state, setState] = useState({ rows: [], loading: false, error: null });

  useEffect(() => {
    if (!startDate || !endDate || !recurso || !enabled) return;

    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));

    const params = new URLSearchParams({ periodoInicial: startDate, periodoFinal: endDate, recurso });
    if (recurso === 'todos') params.set('tipo', tipo);

    const hostname = window.location.hostname;
    const isLocalOuIP = hostname === 'localhost' || /^[0-9.]+$/.test(hostname) || !hostname.includes('.');
    let apiPrefix = '';
    if (isLocalOuIP) {
      const pastas = window.location.pathname.split('/');
      if (pastas.length > 1 && pastas[1] !== '') apiPrefix = '/' + pastas[1];
    }

    const endpoint = import.meta.env.DEV
      ? `/api/onasys/contabil?${params}`
      : `${apiPrefix}/proxy/ContabilGateway.ashx?${params}`;

    if (import.meta.env.DEV) {
      console.log(`[FINANCEIRO] fetch ${startDate} → ${endDate} | recurso=${recurso}`);
    }

    fetch(endpoint, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        const rawRows = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);
        if (import.meta.env.DEV) {
          console.log(`[FINANCEIRO] ${rawRows.length} registros | recurso=${recurso}`);
        }
        setState({ rows: normalizeFinanceRows(rawRows, recurso), loading: false, error: null });
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState({ rows: [], loading: false, error: err.message });
      });

    return () => controller.abort();
  }, [startDate, endDate, recurso, tipo, enabled]);

  return state;
}
