import { useState, useEffect } from 'react';
import { normalizeRows } from '../utils/normalize';

export function useDashboardData({ startDate, endDate, qualPeriodo, nSistema }) {
  const [state, setState] = useState({ rows: [], loading: false, error: null });

  useEffect(() => {
    if (!startDate || !endDate) return;

    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));

    const params = new URLSearchParams({
      periodoInicial: startDate,
      periodoFinal:   endDate,
      qualPeriodo:    String(qualPeriodo),
      nSistema:       String(nSistema),
    });

    let apiPrefix = '';

    // Se estiver rodando no servidor local (localhost), precisamos do nome da aplicação no IIS
    if (window.location.hostname === 'localhost') {
        const pastas = window.location.pathname.split('/');
        // O split de "/wrbhomologa/Dashboard/..." gera um array: ["", "wrbhomologa", "Dashboard", ...]
        // Pegamos o índice 1, que será sempre o nome do sistema no IIS ('wrbhomologa' ou 'WRB')
        if (pastas.length > 1 && pastas[1] !== '') {
            apiPrefix = '/' + pastas[1]; 
        }
    }
    // NOTA: Se NÃO for localhost (ex: wrb.homologa...), o apiPrefix continua vazio (''),
    // apontando perfeitamente para a raiz do domínio.

    // Monta a URL cravada na pasta proxy da raiz da aplicação
    const endpoint = import.meta.env.DEV 
      ? `/api/onasys/rentabilidade?${params}`
      : `${apiPrefix}/proxy/RentabilidadeGateway.ashx?${params}`;

    fetch(endpoint, { signal: controller.signal })
      .then(async r => {
        // ... restante do código
        if (!r.ok) {
          return r.json()
            .then(body => { throw new Error(body?.error || `HTTP ${r.status}`); })
            .catch(e => { if (e.message.startsWith('HTTP') || e.message) throw e; throw new Error(`HTTP ${r.status}`); });
        }
        return r.json();
      })
      .then(data => {
        let rawRows = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);

        if (data.serverFiltersDates === false && startDate && endDate) {
          const start = new Date(`${startDate}T00:00:00`);
          const end   = new Date(`${endDate}T23:59:59`);
          rawRows = rawRows.filter(r => {
            let d;
            if (qualPeriodo === 2) {
              // Realizado: ddatain em formato DD/MM/YYYY
              if (!r.ddatain) return false;
              const parts = String(r.ddatain).split('/');
              if (parts.length !== 3) return false;
              d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
            } else {
              // Emitido: ddataemissao em formato ISO
              if (!r.ddataemissao) return false;
              d = new Date(r.ddataemissao);
            }
            return d >= start && d <= end;
          });
        }

        setState({ rows: normalizeRows(rawRows), loading: false, error: null });
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState({ rows: [], loading: false, error: err.message });
      });

    return () => controller.abort();
  }, [startDate, endDate, qualPeriodo, nSistema]);

  return state;
}
