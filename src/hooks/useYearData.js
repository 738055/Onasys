import { useState, useEffect } from 'react';
import { normalizeRows } from '../utils/normalize';

export function useYearData({ year, qualPeriodo, nSistema }) {
  const [state, setState] = useState({ rows: [], loading: false, error: null });

  useEffect(() => {
    if (!year) return;

    const startDate = `${year}-01-01`;
    const endDate   = `${year}-12-31`;
    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));

    const params = new URLSearchParams({
      periodoInicial: startDate,
      periodoFinal:   endDate,
      qualPeriodo:    String(qualPeriodo),
      nSistema:       String(nSistema),
    });

    let apiPrefix = '';
    const hostname = window.location.hostname;

    // Deteta se é 'localhost', um IP (ex: 192.168.25.240) ou um nome de PC interno (sem pontos)
    const isLocalOuIP = hostname === 'localhost' || /^[0-9.]+$/.test(hostname) || !hostname.includes('.');

    // Se for acesso interno/local, precisamos do nome da aplicação no IIS (ex: /wrbhomologa)
    if (isLocalOuIP) {
        const pastas = window.location.pathname.split('/');
        if (pastas.length > 1 && pastas[1] !== '') {
            apiPrefix = '/' + pastas[1]; 
        }
    }

    // Monta a URL cravada na pasta proxy da raiz da aplicação
    const endpoint = import.meta.env.DEV 
      ? `/api/onasys/rentabilidade?${params}`
      : `${apiPrefix}/proxy/RentabilidadeGateway.ashx?${params}`;

    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.log(`[BI] yearData fetch ${year} | qualPeriodo=${qualPeriodo} | nSistema=${nSistema}`);
    }

    fetch(endpoint, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) {
          return r.json()
            .then(body => { throw new Error(body?.error || `HTTP ${r.status}`); })
            .catch(e => { if (e.message.startsWith('HTTP') || e.message) throw e; throw new Error(`HTTP ${r.status}`); });
        }
        return r.json();
      })
      .then(data => {
        let rawRows = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);

        if (isDev) {
          console.log(`[BI] yearData resposta: ${rawRows.length} registros | year=${year} | source=${data.source || 'prod'}`);
        }

        if (data.serverFiltersDates === false) {
          const start = new Date(`${startDate}T00:00:00`);
          const end   = new Date(`${endDate}T23:59:59`);
          rawRows = rawRows.filter(r => {
            let d;
            if (qualPeriodo === 2) {
              if (!r.ddatain) return false;
              const parts = String(r.ddatain).split('/');
              if (parts.length !== 3) return false;
              d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
            } else {
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
        if (isDev) console.error(`[BI] yearData ERRO: ${err.message}`);
        setState({ rows: [], loading: false, error: err.message });
      });

    return () => controller.abort();
  }, [year, qualPeriodo, nSistema]);

  return state;
}
