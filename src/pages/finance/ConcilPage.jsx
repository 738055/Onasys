import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, Search } from 'lucide-react';
import { KPICard }      from '../../components/KPICard';
import { InfoTooltip, TooltipFormula, TooltipTitle } from '../../components/InfoTooltip';
import { ExportButton } from '../../components/ExportButton';
import {
  calcConcilKPIs,
  groupConcilByUnit,
  groupConcilByPerson,
  groupConcilBySale,
  groupConcilByMonth,
} from '../../utils/financeAggregations';
import { BRLFULL, BRLk, PCTFMT, fmtMonthKey } from '../../utils/financeFormat';

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function UnitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const receber = payload.find(p => p.dataKey === 'receber')?.value ?? 0;
  const pagar   = payload.find(p => p.dataKey === 'pagar')?.value   ?? 0;
  const saldo   = receber - pagar;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[200px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4 text-emerald-600">
          <span>Recebido</span>
          <span className="font-semibold tabular-nums">{BRLFULL(receber)}</span>
        </div>
        <div className="flex justify-between gap-4 text-red-500">
          <span>Pago</span>
          <span className="font-semibold tabular-nums">{BRLFULL(pagar)}</span>
        </div>
        <div className={`flex justify-between gap-4 border-t border-slate-100 pt-1 font-bold ${saldo >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
          <span>Saldo</span>
          <span className="tabular-nums">{BRLFULL(saldo)}</span>
        </div>
      </div>
    </div>
  );
}

function MonthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[200px]">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-6 mb-0.5" style={{ color: p.color || p.fill }}>
          <span>{p.name}</span>
          <span className="font-semibold tabular-nums">{BRLFULL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Ranking card reutilizável ────────────────────────────────────────────────

function RankingCard({ title, items, valueKey = 'value', color, tooltip, top = 10 }) {
  const total = items.reduce((s, i) => s + (i[valueKey] || 0), 0);
  const list  = items.slice(0, top);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
        {title}
        {tooltip && <InfoTooltip text={tooltip} />}
      </h2>
      <div className="space-y-2.5">
        {list.map((item, i) => {
          const v   = item[valueKey] || 0;
          const pct = total > 0 ? (v / total) * 100 : 0;
          const label = item.person || item.unit || String(item.saleId || '');
          return (
            <div key={label + i}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-slate-600 truncate max-w-[210px]" title={label}>{label}</span>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-[10px] text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>
                  <span className="tabular-nums text-slate-700 font-semibold">{BRLFULL(v)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-xs text-slate-400 py-4 text-center">Nenhum registro no período.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConcilPage({ rows, loading }) {
  const [saleSearch, setSaleSearch]   = useState('');
  const [saleSortCol, setSaleSortCol] = useState('receber');
  const [saleSortDir, setSaleSortDir] = useState('desc');

  const kpi       = useMemo(() => calcConcilKPIs(rows),          [rows]);
  const byUnit    = useMemo(() => groupConcilByUnit(rows),        [rows]);
  const recebedores = useMemo(() => groupConcilByPerson(rows, 'RECEBER'), [rows]);
  const pagadores   = useMemo(() => groupConcilByPerson(rows, 'PAGAR'),   [rows]);
  const bySale    = useMemo(() => groupConcilBySale(rows),        [rows]);
  const byMonth   = useMemo(() => groupConcilByMonth(rows),       [rows]);

  // Cobertura text
  const coberturaColor = !kpi.cobertura ? 'slate'
    : kpi.cobertura >= 120 ? 'green'
    : kpi.cobertura >= 100 ? 'blue'
    : 'red';

  // Tabela de vendas filtrada e ordenada
  const filteredSales = useMemo(() => {
    let list = bySale;
    if (saleSearch) {
      const q = saleSearch.toLowerCase();
      list = list.filter(s =>
        String(s.saleId).includes(q) || s.unit.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const v = saleSortDir === 'asc' ? 1 : -1;
      return (a[saleSortCol] > b[saleSortCol] ? 1 : -1) * v;
    });
  }, [bySale, saleSearch, saleSortCol, saleSortDir]);

  function onSaleSort(col) {
    if (saleSortCol === col) setSaleSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSaleSortCol(col); setSaleSortDir('desc'); }
  }

  // Dados gráfico filial (top 10)
  const unitChartData = byUnit.slice(0, 10).map(u => ({
    name: u.unit.length > 22 ? u.unit.slice(0, 22) + '…' : u.unit,
    receber: u.receber,
    pagar:   u.pagar,
  }));

  // Dados gráfico mensal
  const monthChartData = byMonth.map(m => ({
    name:    fmtMonthKey(m.key),
    receber: m.receber,
    pagar:   m.pagar,
    saldo:   m.saldo,
  }));

  // Export
  const exportSections = useMemo(() => [
    {
      title: 'KPIs Conciliação',
      columns: [
        { key: 'indicador', label: 'Indicador', type: 'text' },
        { key: 'valor',     label: 'Valor',     type: 'currency' },
      ],
      rows: [
        { indicador: 'Total Recebido',  valor: kpi.receber },
        { indicador: 'Total Pago',      valor: kpi.pagar   },
        { indicador: 'Saldo Líquido',   valor: kpi.saldo   },
      ],
    },
    {
      title: 'Por Filial',
      columns: [
        { key: 'unit',    label: 'Filial',   type: 'text'     },
        { key: 'receber', label: 'Recebido', type: 'currency' },
        { key: 'pagar',   label: 'Pago',     type: 'currency' },
        { key: 'saldo',   label: 'Saldo',    type: 'currency' },
      ],
      rows: byUnit,
    },
    {
      title: 'Top Recebedores',
      columns: [
        { key: 'person', label: 'Entidade',    type: 'text'     },
        { key: 'value',  label: 'Recebido',    type: 'currency' },
        { key: 'count',  label: 'Lançamentos', type: 'number'   },
      ],
      rows: recebedores,
    },
    {
      title: 'Top Fornecedores Pagos',
      columns: [
        { key: 'person', label: 'Fornecedor',  type: 'text'     },
        { key: 'value',  label: 'Pago',        type: 'currency' },
        { key: 'count',  label: 'Lançamentos', type: 'number'   },
      ],
      rows: pagadores,
    },
    {
      title: 'Conciliação por Venda',
      columns: [
        { key: 'saleId',  label: 'Venda',    type: 'number'   },
        { key: 'unit',    label: 'Filial',   type: 'text'     },
        { key: 'receber', label: 'Recebido', type: 'currency' },
        { key: 'pagar',   label: 'Pago',     type: 'currency' },
        { key: 'saldo',   label: 'Saldo',    type: 'currency' },
      ],
      rows: filteredSales,
    },
  ], [kpi, byUnit, recebedores, pagadores, filteredSales]);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            Conciliação — Recebimentos × Pagamentos por Venda
            <InfoTooltip>
              <TooltipTitle>Conciliação Financeira</TooltipTitle>
              <TooltipFormula>ContasBaixadasProdutos — liquidados no período por datapagamento</TooltipFormula>
              <span className="text-slate-300">Liga cada pagamento/recebimento a uma venda específica (idvenda). Permite verificar, por venda, quanto foi efetivamente recebido do cliente vs. pago ao fornecedor. O período filtra pela data de liquidação — não pela data de emissão da venda.</span>
            </InfoTooltip>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Títulos liquidados por data de pagamento · por venda (idvenda)</p>
        </div>
        <ExportButton title="Conciliação Financeira" slug="financeiro-concil" sections={exportSections} />
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={<span className="flex items-center gap-1">Recebido de Clientes<InfoTooltip>
            <TooltipTitle>Total Recebido</TooltipTitle>
            <TooltipFormula>Σ títulos RECEBER liquidados no período</TooltipFormula>
            <span className="text-slate-300">Pagamentos de clientes e OTAs efetivamente recebidos, linkados a vendas por idvenda.</span>
          </InfoTooltip></span>}
          value={kpi.receber}
          format="currency"
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title={<span className="flex items-center gap-1">Pago a Fornecedores<InfoTooltip>
            <TooltipTitle>Total Pago</TooltipTitle>
            <TooltipFormula>Σ títulos PAGAR liquidados no período</TooltipFormula>
            <span className="text-slate-300">Pagamentos a fornecedores e parceiros efetivamente realizados, linkados a vendas por idvenda.</span>
          </InfoTooltip></span>}
          value={kpi.pagar}
          format="currency"
          icon={TrendingDown}
          color="red"
        />
        <KPICard
          title={<span className="flex items-center gap-1">Saldo Líquido<InfoTooltip>
            <TooltipTitle>Saldo Líquido</TooltipTitle>
            <TooltipFormula>Recebido − Pago</TooltipFormula>
            <span className="text-slate-300">Fluxo líquido de caixa no período pelas transações conciliadas. Positivo = entrou mais do que saiu.</span>
          </InfoTooltip></span>}
          value={kpi.saldo}
          format="currency"
          icon={DollarSign}
          color={kpi.saldo >= 0 ? 'blue' : 'amber'}
        />
        <KPICard
          title={<span className="flex items-center gap-1">Cobertura<InfoTooltip>
            <TooltipTitle>Índice de Cobertura</TooltipTitle>
            <TooltipFormula>Recebido ÷ Pago × 100</TooltipFormula>
            <span className="text-slate-300">Indica quantos R$ entraram para cada R$ que saiu. &gt;100% = recebimentos cobrem pagamentos. Atenção: os dois fluxos podem ser de ciclos de vendas diferentes.</span>
          </InfoTooltip></span>}
          value={kpi.cobertura ?? 0}
          format="percent"
          icon={Percent}
          color={coberturaColor}
        />
      </div>

      {/* ── Composição visual Recebido × Pago ─────────────────────────────── */}
      {kpi.receber > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Balanço Recebimentos × Pagamentos</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              kpi.saldo >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              Saldo: {BRLFULL(kpi.saldo)}
            </span>
          </div>
          {/* Barra de composição */}
          <div className="space-y-3">
            {/* Recebido */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-emerald-700">Recebido de Clientes</span>
                <span className="tabular-nums font-semibold text-emerald-700">{BRLFULL(kpi.receber)}</span>
              </div>
              <div className="h-5 bg-emerald-100 rounded-md overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-md flex items-center justify-end pr-2"
                  style={{ width: '100%' }}>
                  <span className="text-[10px] text-white font-bold">100%</span>
                </div>
              </div>
            </div>
            {/* Pago */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-red-600">Pago a Fornecedores</span>
                <span className="tabular-nums font-semibold text-red-600">
                  {BRLFULL(kpi.pagar)}
                  <span className="text-slate-400 font-normal ml-2">
                    ({kpi.receber > 0 ? PCTFMT(kpi.pagar / kpi.receber * 100) : '—'})
                  </span>
                </span>
              </div>
              <div className="h-5 bg-red-100 rounded-md overflow-hidden">
                {(() => {
                  const pct = kpi.receber > 0 ? Math.min(kpi.pagar / kpi.receber * 100, 100) : 0;
                  return (
                    <div className="h-full rounded-md flex items-center justify-end pr-2"
                      style={{ width: `${pct}%`, backgroundColor: pct > 95 ? '#ef4444' : pct > 85 ? '#f97316' : '#22c55e' }}>
                      <span className="text-[10px] text-white font-bold">{PCTFMT(pct)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* Saldo */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={`font-medium ${kpi.saldo >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                  Saldo Líquido ({kpi.saldo >= 0 ? 'sobra' : 'déficit'})
                </span>
                <span className={`tabular-nums font-semibold ${kpi.saldo >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                  {BRLFULL(Math.abs(kpi.saldo))}
                  <span className="text-slate-400 font-normal ml-2">
                    ({kpi.receber > 0 ? PCTFMT(Math.abs(kpi.saldo) / kpi.receber * 100) : '—'} da receita)
                  </span>
                </span>
              </div>
              <div className="h-5 bg-slate-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md"
                  style={{
                    width: `${kpi.receber > 0 ? Math.min(Math.abs(kpi.saldo) / kpi.receber * 100, 100) : 0}%`,
                    backgroundColor: kpi.saldo >= 0 ? '#3b82f6' : '#f59e0b',
                  }} />
              </div>
            </div>
          </div>

          {/* Narrativa executiva */}
          <div className={`mt-4 rounded-lg px-4 py-3 text-xs ${
            kpi.cobertura == null ? 'bg-slate-50 text-slate-500'
            : kpi.cobertura >= 110 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
            : kpi.cobertura >= 100 ? 'bg-blue-50 text-blue-800 border border-blue-100'
            : 'bg-amber-50 text-amber-800 border border-amber-100'
          }`}>
            {kpi.cobertura == null
              ? 'Sem pagamentos registrados no período.'
              : kpi.cobertura >= 110
              ? `Para cada R$1,00 pago a fornecedores, recebemos R$${(kpi.cobertura / 100).toFixed(2)} de clientes — cobertura saudável.`
              : kpi.cobertura >= 100
              ? `Recebimentos cobrem pagamentos com margem de ${PCTFMT(kpi.cobertura - 100)} — equilíbrio apertado.`
              : `Déficit de caixa: pagamentos superam recebimentos em ${BRLFULL(kpi.pagar - kpi.receber)} no período.`
            }
          </div>
        </div>
      )}

      {/* ── Evolução Mensal ─────────────────────────────────────────────────── */}
      {monthChartData.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolução Mensal — Recebimentos × Pagamentos × Saldo</h2>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthChartData} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={BRLk} tick={{ fontSize: 11 }} width={72} />
              <Tooltip content={<MonthTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receber" name="Recebido"   fill="#10b981" radius={[3,3,0,0]} maxBarSize={36} />
              <Bar dataKey="pagar"   name="Pago"       fill="#ef4444" radius={[3,3,0,0]} maxBarSize={36} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Por Filial ──────────────────────────────────────────────────────── */}
      {byUnit.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Recebimentos × Pagamentos por Filial</h2>
          {unitChartData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={unitChartData} layout="vertical" margin={{ left: 160, right: 20, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={BRLk} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={156} />
                <Tooltip content={<UnitTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="receber" name="Recebido" fill="#10b981" radius={[0,3,3,0]} maxBarSize={14} />
                <Bar dataKey="pagar"   name="Pago"     fill="#ef4444" radius={[0,3,3,0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="pb-2 text-left font-semibold">Filial</th>
                  <th className="pb-2 text-right font-semibold text-emerald-600">Recebido</th>
                  <th className="pb-2 text-right font-semibold text-red-500">Pago</th>
                  <th className="pb-2 text-right font-semibold">Saldo</th>
                  <th className="pb-2 text-right font-semibold">Cobertura</th>
                  <th className="pb-2 text-right font-semibold text-slate-400">Títulos</th>
                </tr>
              </thead>
              <tbody>
                {byUnit.map(u => {
                  const cob = u.pagar > 0 ? u.receber / u.pagar * 100 : null;
                  return (
                    <tr key={u.unit} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1.5 font-medium text-slate-700 max-w-[200px]">
                        <span className="block truncate" title={u.unit}>{u.unit}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-emerald-700 font-semibold">{BRLFULL(u.receber)}</td>
                      <td className="py-1.5 text-right tabular-nums text-red-600">{BRLFULL(u.pagar)}</td>
                      <td className={`py-1.5 text-right tabular-nums font-semibold ${u.saldo >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                        {BRLFULL(u.saldo)}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums text-xs font-semibold ${
                        cob == null ? 'text-slate-400'
                        : cob >= 110 ? 'text-emerald-600'
                        : cob >= 100 ? 'text-blue-600'
                        : 'text-red-500'
                      }`}>
                        {cob != null ? PCTFMT(cob) : '—'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-slate-400">{u.count}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200">
                <tr className="font-bold text-slate-800">
                  <td className="py-2 text-xs">Total</td>
                  <td className="py-2 text-right tabular-nums text-emerald-700 text-xs">{BRLFULL(kpi.receber)}</td>
                  <td className="py-2 text-right tabular-nums text-red-600 text-xs">{BRLFULL(kpi.pagar)}</td>
                  <td className={`py-2 text-right tabular-nums text-xs ${kpi.saldo >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>{BRLFULL(kpi.saldo)}</td>
                  <td className="py-2 text-right text-xs text-slate-500">{kpi.cobertura != null ? PCTFMT(kpi.cobertura) : '—'}</td>
                  <td className="py-2 text-right text-xs text-slate-400">{kpi.count}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Rankings Recebedores × Fornecedores Pagos ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard
          title="Top Recebedores (de quem recebemos)"
          items={recebedores}
          valueKey="value"
          color="#10b981"
          tooltip="Clientes, OTAs e consolidadores que nos pagaram no período. Ordenado por valor total recebido."
          top={12}
        />
        <RankingCard
          title="Top Fornecedores Pagos (para quem pagamos)"
          items={pagadores}
          valueKey="value"
          color="#ef4444"
          tooltip="Fornecedores e parceiros para quem realizamos pagamentos no período. Ordenado por valor total pago."
          top={12}
        />
      </div>

      {/* ── Tabela por Venda ───────────────────────────────────────────────── */}
      {bySale.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-panel p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              Conciliação por Venda
              <InfoTooltip text="Cada linha é uma venda (idvenda). Recebido = títulos RECEBER liquidados; Pago = títulos PAGAR liquidados. Saldo = Recebido − Pago." />
            </h2>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={saleSearch}
                onChange={e => setSaleSearch(e.target.value)}
                placeholder="Buscar venda ou filial..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  {[
                    ['saleId',  'Venda #',  'left'],
                    ['unit',    'Filial',   'left'],
                    ['receber', 'Recebido', 'right'],
                    ['pagar',   'Pago',     'right'],
                    ['saldo',   'Saldo',    'right'],
                    ['count',   'Títulos',  'right'],
                  ].map(([col, label, align]) => (
                    <th key={col} onClick={() => onSaleSort(col)}
                      className={`pb-2 pr-3 font-semibold cursor-pointer select-none hover:text-slate-700 ${align === 'right' ? 'text-right' : ''}`}>
                      {label}
                      <span className="ml-0.5 text-[10px] text-slate-300">
                        {saleSortCol === col ? (saleSortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => (
                  <tr key={s.saleId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-1.5 pr-3 font-mono text-slate-600 font-semibold">#{s.saleId}</td>
                    <td className="py-1.5 pr-3 text-slate-600 max-w-[160px]">
                      <span className="block truncate" title={s.unit}>{s.unit || '—'}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-700 font-semibold">
                      {s.receber > 0 ? BRLFULL(s.receber) : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-red-600">
                      {s.pagar > 0 ? BRLFULL(s.pagar) : '—'}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums font-semibold ${s.saldo >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                      {BRLFULL(s.saldo)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-400">{s.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200">
                <tr className="font-bold text-slate-800">
                  <td className="py-2 pr-3 text-xs" colSpan={2}>Total ({filteredSales.length} vendas)</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 text-xs">
                    {BRLFULL(filteredSales.reduce((s, r) => s + r.receber, 0))}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-red-600 text-xs">
                    {BRLFULL(filteredSales.reduce((s, r) => s + r.pagar, 0))}
                  </td>
                  <td className="py-2 text-right tabular-nums text-xs text-blue-700">
                    {BRLFULL(filteredSales.reduce((s, r) => s + r.saldo, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {rows.length === 0 && !loading && (
            <p className="text-xs text-slate-400 text-center py-8">
              Nenhum título liquidado no período. Verifique se o período selecionado tem movimentações em ContasBaixadasProdutos.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
