import { useState, useEffect, useMemo } from 'react';
import { normalizeFinanceRows } from '../utils/normalizeFinance';

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthRange(year, month) {
  const m  = String(month).padStart(2, '0');
  const d  = String(lastDayOfMonth(year, month)).padStart(2, '0');
  return { start: `${year}-${m}-01`, end: `${year}-${m}-${d}` };
}

function buildEndpoint(startDate, endDate, recurso, tipo, apiPrefix, isDev) {
  const params = new URLSearchParams({ periodoInicial: startDate, periodoFinal: endDate, recurso });
  if (recurso === 'todos') params.set('tipo', tipo);
  return isDev
    ? `/api/onasys/contabil?${params}`
    : `${apiPrefix}/proxy/ContabilGateway.ashx?${params}`;
}

// Fan-out mês a mês dentro de um intervalo de anos/meses.
// Dispara uma requisição por mês em paralelo (Promise.all) respeitando o cap de 1 mês da API.
//
// Params:
//   year       — ano fixo (ex: 2024)
//   startMonth — mês inicial (1–12), default 1
//   endMonth   — mês final (1–12), default 12 (ou mês atual se year === ano atual)
//   recurso    — 'resultado' | 'baixadas' | 'abertas'
//   enabled    — permite desabilitar o fetch
//
// Retorna: { rows, byMonth: { 'YYYY-MM': rows[] }, loading, error, loadedMonths }
export function useFinanceSeries({ year, startMonth = 1, endMonth = 12, recurso = 'resultado', tipo = 'R', enabled = true }) {
  const [state, setState] = useState({ rows: [], byMonth: {}, loading: false, error: null, loadedMonths: 0 });

  const months = useMemo(() => {
    const list = [];
    for (let m = startMonth; m <= endMonth; m++) list.push(m);
    return list;
  }, [startMonth, endMonth]);

  const hostname = window.location.hostname;
  const isLocalOuIP = hostname === 'localhost' || /^[0-9.]+$/.test(hostname) || !hostname.includes('.');
  let apiPrefix = '';
  if (isLocalOuIP) {
    const pastas = window.location.pathname.split('/');
    if (pastas.length > 1 && pastas[1] !== '') apiPrefix = '/' + pastas[1];
  }

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!year || !recurso || !enabled || months.length === 0) return;

    const controller = new AbortController();
    setState({ rows: [], byMonth: {}, loading: true, error: null, loadedMonths: 0 });

    if (isDev) {
      console.log(`[FINANCEIRO] fan-out ${year} meses ${startMonth}–${endMonth} | recurso=${recurso}`);
    }

    const fetchOne = (month) => {
      const { start, end } = monthRange(year, month);
      const endpoint = buildEndpoint(start, end, recurso, tipo, apiPrefix, isDev);
      const key = `${year}-${String(month).padStart(2, '0')}`;

      return fetch(endpoint, { signal: controller.signal })
        .then(async r => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body?.error || `HTTP ${r.status}`);
          }
          return r.json();
        })
        .then(data => {
          const rawRows = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);
          return { key, rows: normalizeFinanceRows(rawRows, recurso) };
        })
        .catch(err => {
          if (err.name === 'AbortError') throw err;
          if (isDev) console.warn(`[FINANCEIRO] falha mês ${month}/${year}: ${err.message}`);
          return { key, rows: [], error: err.message };
        });
    };

    Promise.all(months.map(fetchOne))
      .then(results => {
        const allRows = [];
        const byMonth = {};
        for (const r of results) {
          byMonth[r.key] = r.rows;
          allRows.push(...r.rows);
        }
        if (isDev) console.log(`[FINANCEIRO] série completa: ${allRows.length} registros | recurso=${recurso}`);
        setState({ rows: allRows, byMonth, loading: false, error: null, loadedMonths: months.length });
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState(s => ({ ...s, loading: false, error: err.message }));
      });

    return () => controller.abort();
  }, [year, startMonth, endMonth, recurso, tipo, enabled]);

  return state;
}
