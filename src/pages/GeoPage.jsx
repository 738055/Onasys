import { useMemo, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ComposedChart, Line,
} from 'recharts';
import { groupByClientOrVendor } from '../utils/aggregations';
import { BRLFULL, BRLk, PCTFMT } from '../utils/format';
import { InfoTooltip } from '../components/InfoTooltip';
import { ExportButton } from '../components/ExportButton';

export default function GeoPage({ rows }) {
  const regionChartRef = useRef(null);
  const stateChartRef  = useRef(null);
  const regions = useMemo(() => groupByClientOrVendor(rows, 'region'), [rows]);
  const states  = useMemo(() => groupByClientOrVendor(rows, 'state'),  [rows]);

  const top15States = states.slice(0, 15);

  const regionTotal = regions.reduce((s, x) => s + x.revenue, 0);
  const stateTotal  = states.reduce((s, x) => s + x.revenue, 0);

  const regionsWithPct = regions.map(r => ({
    ...r,
    revPct: regionTotal > 0 ? (r.revenue / regionTotal) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Regions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Region bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            Faturamento por Região
            <InfoTooltip text="Agrupamento pelo campo regiaobrasil da API. % Total = faturamento da região ÷ faturamento geral × 100. % Rent. = Σlíquido ÷ Σfaturamento da região × 100." />
          </h2>
            <ExportButton
              title="Faturamento por Região"
              slug="geo-regioes"
              chartRef={regionChartRef}
              sections={[{
                title: 'Faturamento por Região',
                chartRef: regionChartRef,
                columns: [
                  { key: 'name',             label: 'Região',      type: 'text'     },
                  { key: 'revenue',          label: 'Faturamento', type: 'currency', total: true },
                  { key: 'revPct',           label: '% Total',     type: 'percent'  },
                  { key: 'uniquePassengers', label: 'Pax',         type: 'number'   },
                  { key: 'profitLiquido',    label: 'Líquido',     type: 'currency', total: true },
                  { key: 'rentPct',          label: '% Rent.',     type: 'percent'  },
                ],
                rows: regionsWithPct,
              }]}
            />
          </div>
          <p className="text-xs text-slate-400 mb-4">Regiões do Brasil ordenadas por faturamento</p>
          {regions.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div ref={regionChartRef}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={regionsWithPct} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip
                  formatter={(v, name) => [name === 'Faturamento' ? BRLFULL(v) : `${Number(v).toFixed(1)}%`, name]}
                />
                <Bar dataKey="revenue" name="Faturamento" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Region table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Detalhe por Região</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="pb-2 pr-3 font-semibold">Região</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                  <th className="pb-2 pr-3 font-semibold text-right">% Total</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Pax</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Líquido</th>
                  <th className="pb-2 font-semibold text-right">% Rent</th>
                </tr>
              </thead>
              <tbody>
                {regionsWithPct.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">Sem dados.</td></tr>
                )}
                {regionsWithPct.map(r => {
                  const isNeg  = r.profitLiquido < 0;
                  const pctNeg = r.rentPct !== null && r.rentPct < 0;
                  return (
                    <tr key={r.name} className={`border-b border-slate-100 ${isNeg ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                      <td className="py-2 pr-3 font-medium text-slate-700">{r.name || '(sem região)'}</td>
                      <td className="py-2 pr-3 text-right text-slate-700">{BRLFULL(r.revenue)}</td>
                      <td className="py-2 pr-3 text-right text-slate-400 tabular-nums">{r.revPct.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{r.uniquePassengers.toLocaleString('pt-BR')}</td>
                      <td className={`py-2 pr-3 text-right font-semibold ${isNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                        {BRLFULL(r.profitLiquido)}
                      </td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                        {PCTFMT(r.rentPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {regionsWithPct.length > 0 && (() => {
                const totRev = regionsWithPct.reduce((s, x) => s + x.revenue, 0);
                const totLiq = regionsWithPct.reduce((s, x) => s + x.profitLiquido, 0);
                const totPax = regionsWithPct.reduce((s, x) => s + x.uniquePassengers, 0);
                const totPct = totRev !== 0 ? (totLiq / totRev) * 100 : null;
                return (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold text-slate-700 bg-slate-50">
                      <td className="pt-2 pr-3 text-xs">TOTAL</td>
                      <td className="pt-2 pr-3 text-right text-xs">{BRLFULL(totRev)}</td>
                      <td className="pt-2 pr-3 text-right text-xs text-slate-400">100%</td>
                      <td className="pt-2 pr-3 text-right text-xs">{totPax.toLocaleString('pt-BR')}</td>
                      <td className={`pt-2 pr-3 text-right text-xs ${totLiq < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{BRLFULL(totLiq)}</td>
                      <td className={`pt-2 text-right text-xs ${totPct !== null && totPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{PCTFMT(totPct)}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      </div>

      {/* Top 15 States */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* States bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Top 15 Estados — Faturamento
              <InfoTooltip text="Agrupamento pelo campo dsestado da API. O gráfico mostra os 15 maiores. A tabela ao lado lista TODOS os estados do período. % Rent. = Σlíquido ÷ Σfaturamento do estado × 100." />
            </h2>
            <ExportButton
              title="Ranking de Estados"
              slug="geo-estados"
              chartRef={stateChartRef}
              sections={[{
                title: 'Ranking de Estados',
                chartRef: stateChartRef,
                columns: [
                  { key: 'name',             label: 'UF',          type: 'text'     },
                  { key: 'revenue',          label: 'Faturamento', type: 'currency', total: true },
                  { key: 'revPct',           label: '% Total',     type: 'percent'  },
                  { key: 'uniquePassengers', label: 'Pax',         type: 'number'   },
                  { key: 'rentPct',          label: '% Rent.',     type: 'percent'  },
                ],
                rows: states.map(s => ({
                  ...s,
                  revPct: stateTotal > 0 ? (s.revenue / stateTotal) * 100 : 0,
                })),
              }]}
            />
          </div>
          <p className="text-xs text-slate-400 mb-4">Estados com maior volume de faturamento</p>
          {top15States.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">Sem dados.</p>
          ) : (
            <div ref={stateChartRef}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={top15States} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={50} />
                <Tooltip formatter={v => [BRLFULL(v), 'Faturamento']} />
                <Bar dataKey="revenue" name="Faturamento" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* States table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-panel">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Ranking de Estados
            <span className="ml-2 text-slate-400 font-normal text-xs">({states.length} UFs)</span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">Todos os estados do período</p>
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="pb-2 pr-3 font-semibold">#</th>
                  <th className="pb-2 pr-3 font-semibold">UF</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Faturamento</th>
                  <th className="pb-2 pr-3 font-semibold text-right">% Total</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Pax</th>
                  <th className="pb-2 font-semibold text-right">% Rent</th>
                </tr>
              </thead>
              <tbody>
                {states.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">Sem dados.</td></tr>
                )}
                {states.map((s, i) => {
                  const pct = stateTotal > 0 ? (s.revenue / stateTotal * 100) : 0;
                  const pctNeg = s.rentPct !== null && s.rentPct < 0;
                  return (
                    <tr key={s.name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium text-slate-700">{s.name || '(sem UF)'}</td>
                      <td className="py-2 pr-3 text-right text-slate-700">{BRLFULL(s.revenue)}</td>
                      <td className="py-2 pr-3 text-right text-slate-400 tabular-nums">{pct.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{s.uniquePassengers.toLocaleString('pt-BR')}</td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${pctNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                        {PCTFMT(s.rentPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
