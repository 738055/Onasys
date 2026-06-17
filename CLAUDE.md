# Dashboard BI ONASYS — Documentação Técnica

## Stack

React 18 + Vite 5 + Recharts + Tailwind CSS + Lucide React  
API REST ONASYS autenticada via OAuth2 (gateway em `vite.config.js`).

---

## Estrutura de arquivos

```
src/
  utils/normalize.js        — Traduz campos brutos da API → modelo BI (incluindo ajuste de reembolsos)
  utils/aggregations.js     — KPIs, agrupamentos, scatter, ABC, churn
  utils/leadTime.js         — Distribuição por antecedência de emissão
  utils/supplierConcentration.js — HHI e tendência de margem por fornecedor
  utils/rfm.js              — Análise RFM de clientes
  utils/heatMap.js          — Calor Canal × Segmento
  utils/format.js           — Formatadores BRL, %, datas; LOSS_REASON_CFG; PAX_CATEGORY_CFG
  hooks/useDashboardData.js — Fetch + normalização + filtro de perfil
  hooks/useYearData.js      — Dados do ano completo para comparação
  pages/ExecutivePage.jsx   — KPIs, Evolução Mensal, Top Fornecedores, Mix Segmento
  pages/SalesPage.jsx       — Top Emissores, ABC Clientes, Agrupamentos, Performance
  pages/MarginPage.jsx      — Scatter, Distribuição de Margem, Tabela de Prejuízos
  pages/ServicesPage.jsx    — Mix Segmento, Ranking Completo de Serviços
  pages/ClientsPage.jsx     — Navegação por Tipo → Cliente → Serviço, Inatividade
  pages/GeoPage.jsx         — Faturamento por Região e Estado
  pages/IntelligencePage.jsx — Lead Time, Heat Map, RFM, Concentração Fornecedores
  pages/ComparativosPage.jsx — Comparação entre dois períodos
  pages/CancelamentosPage.jsx — Cancelados (excluídos do BI) + Reembolsos Aprovados (auditoria)
  FlowApp.jsx               — App separado: Fluxo Operacional (pax por dia, ddatain)
  FinanceApp.jsx            — App separado: BI Financeiro (DRE, Caixa, Aging, Comparativos)
  components/PaxCompositionBar.jsx  — Mini stacked-bar de composição ADT/CHD/COL/RED/SEN/FREE
  components/PaxAuditModal.jsx      — Modal de auditoria de deduplicação de pax por venda
  components/ScaleAuditModal.jsx    — Modal de auditoria de escala operacional (idEscala)

  — BI Financeiro (finance.html → finance-main.jsx → FinanceApp.jsx) —
  utils/normalizeFinance.js         — normalizeResultado / normalizeBaixada / normalizeAberta
  utils/financeAggregations.js      — KPIs DRE, buildWaterfall, buildDREHierarchy, groupByMonthDRE,
                                      groupByAccount, buildHeatMap, buildAccountTrend, groupByUnit,
                                      calcCashKPIs, groupCashByMonth/Day/Person,
                                      calcAgingKPIs, groupAgingByBucket/Person, compareKPIs/ByAccount
  utils/financeFormat.js            — FINANCE_COLORS, fmtMonthKey, fmtDateKey, accountColor,
                                      AGING_LABELS, AGING_ORDER, MONTHS_SHORT/FULL
  hooks/useFinanceData.js           — Fetch período único; DEV→gateway, PROD→ContabilGateway.ashx
  hooks/useFinanceSeries.js         — Fan-out mês a mês (Promise.all); params: year/startMonth/endMonth
  pages/finance/OverviewPage.jsx    — KPIs (6), waterfall DRE, evolução mensal, ranking categorias
  pages/finance/DREPage.jsx         — Views: Mensal | Hierarquia (contaextendida) | Por Conta
  pages/finance/ExpensesPage.jsx    — Ranking, tendência, heatmap mês×categoria, tabela detalhe
  pages/finance/RevenuePage.jsx     — Barras mensais, top fontes, tendência, por filial
  pages/finance/CashFlowPage.jsx    — KPIs, ComposedChart entradas×saídas+acumulado, por pessoa
  pages/finance/PayablesPage.jsx    — Aging buckets, KPIs pagar/receber, por pessoa
  pages/finance/ComparePage.jsx     — Período A × B; KPI table + variação por conta
```

---

## Perfis de acesso

| Perfil        | nSistema | Filtro client-side                                      |
|---------------|----------|---------------------------------------------------------|
| Emissivo      | `0`      | nenhum                                                  |
| Receptivo     | `1`      | nenhum                                                  |
| Internacional | `0`      | `serviceScope === 'Internacional'` (campo `nacint`)     |

---

## Mapeamento de campos API → modelo normalizado

### Identificação e dimensões

| Campo API | Campo normalizado | Tipo | Notas |
|-----------|-------------------|------|-------|
| `venda` | `id` | string | ID único da venda |
| `ddataemissao` | `emissionDate` | Date | Formato ISO: `2026-05-02T00:00:00` |
| `ddatain` | `checkinDate` | Date | Formato BR: `04/06/2026` |
| `nomeempresa` | `filial` | string | Filial |
| `tipoturismo` | `channel` | string | Canal de atendimento (BALCÃO, BITRIX, etc.) |
| `rede` | `clientType` | string | Tipo/rede de cliente (OPERADORA, OTAS, etc.) |
| `cliente` / `nmfantasia` | `client` | string | Fallback: `nmfantasia` se `cliente` vazio |
| `nomefornecedor` | `supplier` | string | **Reembolsos: usa `FornecedorOriginalReembolso` quando preenchido** — corrige "REEMBOLSO - RECEPTIVO" |
| `nomeservico` | `product` | string | Nome do serviço |
| `dsCateg` | `segment` | string | Categoria (I=Ingresso, TO=Transfer Out, TI=Transfer In, R=Receptivo, A=Aéreo) |
| `dsestado` | `state` | string | UF |
| `regiaobrasil` | `region` | string | Região (NORTE, SUL, SUDESTE, etc.) |
| `nomeemissor` | `vendor` | string | Emissor da venda |
| `nomecomercial` | `commercial` | string | Responsável comercial (distinto do emissor) |
| `tipovenda` | `saleType` | string | Tipo de venda |
| `idseqintens` / `idseqitens` | `seqId` | string | Sequencial de itens — API usa ambas as grafias; normalize faz fallback |
| `nacint` | `serviceScope` | — | 'I' ou texto com 'inter' → 'Internacional' |

### Quantidade

| Campo API | Campo normalizado | Notas |
|-----------|-------------------|-------|
| `Num_pax` / `num_pax` | `passengers` | **Fallback**: `Num_pax ?? num_pax` — API pode capitalizar o N |
| `num_noites` | `nights` | Noites de hospedagem |
| `nadt` | `paxAdt` | Adultos (por item/serviço) |
| `nchd` | `paxChd` | Crianças meia-entrada (por item) |
| `ncolo` | `paxColo` | Crianças free / colo (por item) |
| `red` | `paxRed` | Reduzidas: estudante, doador de sangue e afins |
| `nmidade` | `paxSen` | Melhor idade / Sênior |
| `free` | `paxFree` | Cortesia: agentes de viagem, cortesia institucional |

> **Dedup de breakdown:** Para KPIs executivos, use `uniquePaxBreakdownByVenda(rows)` em `aggregations.js` (max por venda — consistente com `passengers`).  
> Para visão fornecedor/serviço/operação, use `sumPaxBreakdown(rows)` (SUM bruto por item).  
> `groupByClientOrVendor` retorna ambos: `paxBreakdown` (bruto) e `paxBreakdownUnique` (dedup).

### Diagnóstico de Resultado / Escala

| Campo API | Campo normalizado | Tipo | Notas |
|-----------|-------------------|------|-------|
| `indicador_origem_prejuizo` | `lossReason` | string | Classificação calculada pelo servidor: "Lucrativo", "Falha na Venda (...)", "Falha na Escala (...)", "Falha Financeira (...)", "Falha Comercial (...)", "Falha Indeterminada..." |
| `idescala` | `idEscala` | number | ID de escala operacional — 0 = não escalado / venda avulsa |
| `custo_base_net` | `costBaseNet` | number | Custo bruto NET do fornecedor — Falha na Venda = `revenue < costBaseNet` |
| `custo_escala_operacional` | `costScale` | number | Custo de escala (guias, transporte, estrutura) — Falha na Escala = `(revenue - costBaseNet) < costScale` |

> **Uso:** `resolveLossReason(lossReason)` em `src/utils/format.js` faz match tolerante e retorna `{ group, label, short, color }`.  
> `groupByLossReason(rows)` e `lossDiagnosticTotals(rows)` em `aggregations.js` agregam para o painel "Diagnóstico" da MarginPage.

### Financeiro — Receita e Resultado

| Campo API | Campo normalizado | Descrição |
|-----------|-------------------|-----------|
| `total_vendas` | `revenue` | Faturamento para KPI — **0 para reembolsos** (ajustado em normalize.js) |
| `total_vendas` | `revenueRaw` | Valor original da API — usado na aba Reembolsos e callout executivo |
| `total_resultadoab` | `profit` | Resultado final para KPI — **min(rawProfit, 0) para reembolsos** |
| `total_resultadoab` | `profitRaw` | Valor original da API — usado para auditoria de reembolsos |
| `total_liquido` | `profitLiquido` | Resultado antes de deduzir comissão do emissor — **min(rawLiquido, 0) para reembolsos** |
| `total_com_emissor` | `commissionEmissor` | Comissão do emissor a pagar |
| `per_mkpliquido` | `marginPct` | % margem da API — **NUNCA usar para cálculo** (errado em agregados) |

> **Relação:** `total_liquido = total_resultadoab + total_com_emissor`

### Financeiro — Outros custos (não normalizados individualmente)

Campos existem na API mas não são normalizados separadamente — já embutidos em `total_resultadoab`:

| Campo API | Tipo |
|-----------|------|
| `total_Netfornecedor_hotel` | Custo net hotel |
| `total_Netfornecedor_aereo` | Custo net aéreo |
| `total_Netfornecedor_maritimo` | Custo net marítimo |
| `total_Netornecedor_outros` | Custo net outros (**atenção: "orn" sem "f"** — typo intencional da API) |
| `total_fornecedor_guias` | Custo guias |
| `total_taxascc` | Taxa cartão de crédito |
| `total_taxasantec` | Taxa antecipação |
| `total_descontos` | Desconto |
| `total_comissao` | Repasse a OTAs/sub-agentes (custo) |
| `total_taxas_provisao` | Provisão de impostos |

### Vínculo de Reembolso

| Campo API | Campo normalizado | Tipo | Notas |
|-----------|-------------------|------|-------|
| `IDItemReembolsoOriginal` | `refundOriginalVoucher` | number | Voucher do item original reembolsado — 0 = não é reembolso |
| `FornecedorOriginalReembolso` | `refundOriginalSupplier` | string | Nome do fornecedor antes do reembolso — base para corrigir `supplier` |

---

## Regra de ouro: % Rentabilidade

```
% Rent = SUM(profit) / SUM(revenue)
```

**Nunca** usar `per_mkpliquido` da API como média — produz valores completamente errados em agregados.  
**Nunca** usar `profitLiquido` (total_liquido) como base do % Rent — é pré-emissor.

---

## Regra de Reembolsos (idStatusServico = 28)

Um reembolso **nunca gera receita nem lucro**. Lançamentos com `profit > 0` em reembolsos são **erros operacionais** e são bloqueados.

| Situação | `revenue` no KPI | `profit` no KPI | Explicação |
|----------|:---:|:---:|------------|
| Reembolso com custo (taxas, comissão) | `0` | `valor negativo` | Custo real — reduz Resultado AB |
| Reembolso com lucro positivo (erro) | `0` | `0` | Erro de lançamento — bloqueado |
| Reembolso zerado | `0` | `0` | Sem impacto |

```js
// normalize.js — aplicado a todo item com idStatusServico === 28
revenue:       0
profit:        Math.min(rawProfit, 0)
profitLiquido: Math.min(rawProfitLiquido, 0)
revenueRaw:    rawRevenue   // preservado para auditoria
profitRaw:     rawProfit    // preservado para auditoria
```

**supplier:** Para reembolsos, usa `FornecedorOriginalReembolso` (ex: "SNOWLAND") em vez de "REEMBOLSO - RECEPTIVO" — corrige KPIs de fornecedor em todo o BI automaticamente.

**Onde usar `revenueRaw` / `profitRaw`:**
- `CancelamentosPage` → aba Reembolsos (valores reais para auditoria)
- `ExecutivePage` → `reembolsoSummary.lostRevenue` ("receita que deixamos de ter")
- Em nenhum outro lugar — KPIs sempre usam `revenue` e `profit` (ajustados)

---

## Distinção Líquido vs Resultado AB (nas tabelas)

| Coluna na tabela | Campo | API | Significado |
|------------------|-------|-----|-------------|
| **Líquido** | `profitLiquido` | `total_liquido` | Antes de deduzir comissão do emissor |
| **Comissão Emissor** | `commissionEmissor` | `total_com_emissor` | Comissão a pagar ao emissor |
| **Resultado AB** | `profit` | `total_resultadoab` | Valor final = Líquido − Comissão Emissor |
| **% Rent** | calculado | `profit / revenue` | Base: Resultado AB |

---

## Status de Serviço — comportamento no BI

| ID | Status | Comportamento |
|----|--------|---------------|
| 4 | CANCELADO | **Excluído do BI** em `App.jsx` — isolado em `cancelledRows` para análise na aba Cancelamentos |
| 28 | REEMBOLSO APROVADO | **Incluído em `rows`** mas com `revenue=0` e `profit=min(raw,0)` — aba Reembolsos usa `revenueRaw`/`profitRaw` |
| 38 | NAO EMITIDO | Incluído em `rows`; valores todos zerados — não polui KPIs financeiros |
| demais | — | Incluídos normalmente |

---

## Quirks críticos da API

| # | Campo | Problema |
|---|-------|---------|
| 1 | Numéricos | Alguns endpoints retornam `"5034,66"` (vírgula decimal) → `parseFloat(v.replace(',', '.'))` |
| 2 | Datas | `ddataemissao` → ISO (`2026-05-02T00:00:00`); `ddatain` → BR (`04/06/2026`) |
| 3 | `Num_pax` | API pode capitalizar o N → fallback `raw.Num_pax ?? raw.num_pax` |
| 4 | `total_Netornecedor_outros` | Typo intencional: "orn" sem "f" |
| 5 | `NacInt` | Capitalização mista (N e I maiúsculos) |
| 6 | `total_comissao` | = repasse a OTAs/sub-agentes = **CUSTO**, não receita |
| 7 | `per_mkpliquido` | Gerado sobre `total_resultadoab` bruto — **NUNCA usar para % Rent agregado** |
| 8 | `nadt`+`nchd`+`ncolo`+`red`+`nmidade`+`free` | Soma das categorias pode ≠ `num_pax` (data quality API) — `PaxAuditModal` exibe badge `⚠` quando há discrepância |
| 9 | `idseqitens` / `idseqintens` | API usa ambas as grafias — `normalize.js` faz fallback `raw.idseqintens \|\| raw.idseqitens` |
| 10 | Reembolso com `profit > 0` | Erro operacional de lançamento — `normalize.js` bloqueia do KPI; `console.warn` no DEV |

---

## Auditoria de Escala Operacional

### Conceito

`idEscala` vincula múltiplos itens de venda à mesma operação física (mesmo guia/veículo/saída). A API calcula e aloca `custo_escala_operacional` por item — esse custo pode variar entre itens da mesma escala conforme alocação proporcional.

**A análise correta deve ser feita na escala como unidade, não no item isolado.**

### Diagnóstico automático da API (`indicador_origem_prejuizo`)

| Valor | `lossReason` normalizado | Grupo |
|-------|--------------------------|-------|
| "Lucrativo" | `lossReason = "Lucrativo"` | OK |
| "Falha na Venda (...)" | `lossReason` com "Venda" | Venda — preço abaixo do NET do fornecedor |
| "Falha na Escala (...)" | `lossReason` com "Escala" | Escala — margem NET não cobre custo operacional |
| "Falha Financeira (Taxa...)" | `lossReason` com "Financeira" | Taxas, ADM, provisão |
| "Falha Comercial (...)" | `lossReason` com "Comercial" | Repasses, comissões, descontos |

### ScaleAuditModal

Aberto ao clicar em **"Escala #xxxxx"** na coluna "Origem" da tabela de prejuízos em `MarginPage`.

Mostra:
- Waterfall de custos da escala total (revenue → NET → Escala → Outros → Resultado AB)
- Tabela de todos os itens da escala (incluindo lucrativos e deficitários)
- Coluna **"Gap NET+Esc"** = `revenue − costBaseNet − costScale`: se negativo, o item foi vendido abaixo do custo operacional
- Diagnóstico automático: escala totalmente deficitária / mista / lucrativa

### Função `groupByEscala(rows)` em `aggregations.js`

Retorna `{ [idEscala]: { idEscala, product, supplier, checkinDate, items[], revenue, costBaseNet, costScale, profit } }`.  
Exclui `idEscala === 0` (item sem escala operacional).  
Usado exclusivamente pelo `ScaleAuditModal`.

---

## Endpoints e roteamento

```
GET /Lancamentos/VendasRentabilidadeItens/{inicio}/{fim}/{qualPeriodo}/{nSistema}
```

### Mapeamento qualPeriodo (frontend → API)

| Valor | Nome | Filtra por | Estratégia |
|-------|------|-----------|-----------|
| `0` | Emitido | `ddataemissao` | Sem datas no path da API; filtro client-side no hook |
| `1` | Realizado | `ddatain` | Path `/inicio/fim/1/nSistema` na API; server-side filter |
| `2` | — | não usado | fora do escopo desse sistema |

- Gateway em `vite.config.js` recebe o `qualPeriodo` do frontend e escolhe a estratégia de endpoint
- Se `serverFiltersDates=false` na resposta, o hook aplica filtro client-side pelo campo correto

### FlowApp (`qualPeriodo=1`)

O FlowApp passa `qualPeriodo=1` (Realizado) → gateway usa path com datas → API filtra por `ddatain`. Correto para "Pax por Data de Serviço".

---

## Logs de desenvolvimento

### Gateway — terminal (`vite.config.js`)

Todos os logs do gateway usam o prefixo `[ONASYS HH:MM:SS]` com cores ANSI no terminal.

```
[ONASYS 14:32:01] Gateway ONASYS iniciado | interno: http://192.168... | externo: http://api...
[ONASYS 14:32:01] Diagnóstico: http://localhost:5173/api/onasys/status
[ONASYS 14:32:05] 🔑 Token renovado — expira em 3600s (refresh automático em 3570s)
[ONASYS 14:32:10] → /rentabilidade 2026-05-01→2026-05-31 | qualPeriodo=2 | nSistema=1
[ONASYS 14:32:11] ✓ 2847 registros | source=internal | serverFiltersDates=true
[ONASYS 14:35:22] ⚠ 401 recebido de internal — renovando token e tentando novamente...
[ONASYS 14:35:23] 🔄 Forçando renovação de token (401/403 recebido da API)...
[ONASYS 14:35:24] ✗ Todas as tentativas falharam para 2026-05-01→2026-05-31...
```

**Endpoint de diagnóstico:** `GET /api/onasys/status` retorna JSON com estado do token, base ativa e configuração.

**Se não há credenciais no .env**, o gateway loga 3 avisos no startup indicando quais variáveis faltam.

### Browser — console DevTools (`DEV` only)

Logs com prefixo `[BI]` ativos apenas em `import.meta.env.DEV` (desaparecem no build de produção).

```
[BI] fetch 2026-05-01 → 2026-05-31 | qualPeriodo=2 | nSistema=1
[BI] resposta: 2847 registros brutos | source=internal | serverFiltersDates=true
[BI] normalize: 2847 itens | 12 cancelados | 5 reembolsos ⚠ (2 com erro de lançamento — excluídos do KPI)
[BI] Reembolso com lucro positivo (erro de lançamento): venda=364862 | voucher=931253 | fornecedor="A DEFINIR RECEPTIVO" | revenue=R$50.00 | profit=R$27.04 → excluído do KPI
```

**Filtro client-side** só é logado quando efetivamente filtra registros (`antes → depois`).

### Convenção

- `[ONASYS]` → gateway Node.js (terminal Vite)
- `[BI]` → frontend React (browser DevTools)
- Warnings são sempre `console.warn`, erros críticos são `console.error`

---

## Onde cada campo é consumido no frontend

### `revenue` (total_vendas — ajustado para reembolsos)
- ExecutivePage: KPI "Faturamento Total", gráfico Evolução Mensal, Mix Segmento
- SalesPage: Tabela agrupamento (coluna "Total Vendido"), ABC Clientes
- ServicesPage: Ranking de Serviços, Top 20, Eficiência por Estadia
- MarginPage: Scatter (eixo X), distribuição de margem
- GeoPage: Gráficos e tabelas de Região/Estado
- ClientsPage: Todos os painéis
- IntelligencePage: Lead Time, Heat Map, RFM, Concentração

### `revenueRaw` (total_vendas — valor original da API)
- ExecutivePage: `reembolsoSummary.lostRevenue` → "Receita não realizada" no callout
- CancelamentosPage: aba Reembolsos → KPIs, rankings, tabela de auditoria, trend mensal

### `profit` (total_resultadoab — ajustado para reembolsos)
- ExecutivePage: KPI **"Líquido"**, timeline (linha verde e % margem), Top 10 Fornecedores
- SalesPage: Coluna **"Resultado AB"**, tfoot % Rent, `rentPct` de todos os agrupamentos
- ServicesPage: Coluna "Resultado AB" no Ranking Completo, `rentPct` de todos os grupos
- MarginPage: Losses (filtro `profit < 0`), distribuição de margem, scatter (margem Y)
- ClientsPage: `rentPct` de todos os painéis
- GeoPage: `rentPct`
- IntelligencePage: `margin` do Lead Time, scatter de concentração
- aggregations.js: `calcKPIs.margin`, `groupByClientOrVendor.rentPct`, scatter functions

### `profitRaw` (total_resultadoab — valor original da API)
- CancelamentosPage: aba Reembolsos → tabela "Result. Original" + coluna "Status KPI"
- ExecutivePage: `reembolsoSummary.errCount` (conta reembolsos com profit > 0 = erros)

### `profitLiquido` (total_liquido — ajustado para reembolsos)
- SalesPage: Coluna **"Líquido"** no agrupamento (informativo — antes de deduzir emissor)
- ServicesPage: Coluna "Líquido" no Ranking Completo (par com "Resultado AB")
- MarginPage: ScatterTooltip (exibido como referência), export do scatter
- ExecutivePage: Export "Evolução Mensal" (coluna "Líquido" no Excel/PDF)

### `commissionEmissor` (total_com_emissor)
- SalesPage: Coluna "Comissão Emissor a pagar no período" no agrupamento

### `passengers` (Num_pax / num_pax)
- ExecutivePage: KPI "Passageiros" (único por venda — max num_pax do grupo)
- FlowApp: Fluxo diário de pax por serviço
- SalesPage, ServicesPage: Colunas Pax nas tabelas
- PaxAuditModal: Auditoria de deduplicação de pax

### `supplier` (nomefornecedor — corrigido para reembolsos)
- Todos os rankings, scatter, tendência de margem, HHI — automaticamente corretos porque o campo já vem ajustado do normalize

---

## Segmentos (dsCateg)

| Código API | Label | Cor |
|------------|-------|-----|
| I | Ingresso | verde (`#10b981`) |
| TO | Transfer Out | azul (`#3b82f6`) |
| TI | Transfer In | índigo (`#6366f1`) |
| R | TRF Passeios | âmbar (`#f59e0b`) |
| A | Aéreo | violeta (`#8b5cf6`) |
| H | Hotel | laranja (`#f97316`) |
| S | Serviços | teal (`#14b8a6`) |
| (outros) | Outros | cinza |

---

## BI Financeiro (`finance.html`)

SPA separado, mesmo padrão do FlowApp. Entry point: `finance.html` → `src/finance-main.jsx` → `src/FinanceApp.jsx`.

### Padrão draft/apply (igual ao App.jsx principal)

`FinanceApp` mantém **committed states** (`year`, `startMonth`, `endMonth`) que disparam os fetches, e **draft states** (`draftYear`, `draftStartMonth`, `draftEndMonth`) editáveis sem re-fetch. O botão "Aplicar" fica destacado em azul quando há mudança pendente e comita os drafts nos committed. O filtro de filial (`unitFilter`) é client-side e **não** dispara re-fetch.

```
[draft year ▼] [draft startMonth ▼] até [draft endMonth ▼]  [Aplicar]  [filial ▼]
       ↓ somente ao clicar Aplicar
committed states → useFinanceSeries → rows (compartilhados entre todas as abas DRE)
```

### Endpoints contábeis

```
Gateway DEV:  GET /api/onasys/contabil?recurso=resultado&periodoInicial=YYYY-MM-DD&periodoFinal=YYYY-MM-DD
Gateway PROD: GET /{subpath}/proxy/ContabilGateway.ashx?recurso=...
```

| recurso | Endpoint API | Observação |
|---------|-------------|-----------|
| `resultado` | `/Lancamentos/LancamentosContabeisResultado/{ini}/{fim}` | DRE — tipoconta R |
| `baixadas`  | `/Lancamentos/contasBaixadas/{ini}/{fim}` | Caixa realizado |
| `abertas`   | `/Lancamentos/contasAbertas` | Posição atual (sem filtro data) |
| `todos`     | `/Lancamentos/LancamentosContabeisTodos/{ini}/{fim}/{tipo}` | Tipo A/P/R |

**Limite da API:** máximo 1 mês por requisição. `useFinanceSeries` dispara `Promise.all` com 1 req/mês.

**Base externa financeira:** `http://api.frt.onasys.com.br` — diferente da base BI (`api.wrb.onasys.com.br`). Env var: `ONASYS_FINANCE_EXTERNAL_BASE`.

### Normalização — `normalizeFinance.js`

#### `normalizeResultado(raw)` — fonte: `LancamentosContabeisResultado`

| Campo API | Campo normalizado | Notas |
|-----------|-------------------|-------|
| `idlancamento` | `id` | ID único |
| `dtmovimento` | `date` | ISO `2026-05-02T00:00:00` |
| `nmunidade` | `unit` | Filial |
| `dsPartida` / `dspartida` | `account` | Nome da conta (fallback minúsculo) |
| `contaextendida` | `accountCode` | Código 11 dígitos; `3xxx`=receita, `4xxx`=despesa |
| `dsContraPartida` / `dscontrapartida` | `counter` | Conta contrapartida |
| `dscomplemento` | `doc` | Complemento/histórico |
| `idvenda` | `saleId` | Vínculo ao ID de venda do BI |
| `vlvalor` | `value` | Sempre positivo (abs) |
| `dsoperacao` | `op` | `C` = crédito / `D` = débito |
| — | `kind` | `'receita'` (3xxx) ou `'despesa'` (4xxx); fallback por op |
| — | `signed` | Receita: C→+v, D→-v · Despesa: D→+v, C→-v |
| `tipoconta` | — | Sempre `R` neste endpoint; exibido como badge informativo |

**Reversão de receita:** conta `3xxx` com `op=D` → `signed < 0` → reduz receita líquida. Correto e esperado.

#### `normalizeBaixada(raw)` — fonte: `contasBaixadas`

| Campo API | Campo normalizado |
|-----------|-------------------|
| `idconta` | `id` |
| `tpconta` | `type` (`PAGAR` / `RECEBER`) |
| `idvenda` | `saleId` |
| `datavencimento` | `dueDate` (BR DD/MM/YYYY → Date) |
| `datapagamento` | `payDate` (BR → Date) |
| `dataemissao` | `issueDate` |
| `valorpagamento` | `value` |
| `nomepessoa` | `person` |
| `clientedavenda` | `client` |
| `filial` | `unit` |
| `nomecontapagamento` | `account` |
| — | `cashSigned` | RECEBER→+value, PAGAR→-value |

#### `normalizeAberta(raw)` — fonte: `contasAbertas`

Shape do JSON ainda não foi validado com dados reais em produção. Campos esperados: `tpconta`, `dtvencimento`, `valor`, `nomepessoa`, `filial`. Campo `agingBucket` calculado client-side vs `new Date()`.

### Regra de ouro — DRE financeiro

```
receitaLiquida = Σ signed (kind='receita')   // inclui reversões (signed negativo)
despesaTotal   = Σ signed (kind='despesa')
resultado      = receitaLiquida − despesaTotal
margem%        = resultado / receitaLiquida × 100
```

**Nunca** usar `per_mkpliquido` nem médias de % — mesma regra do BI de rentabilidade.

### Hierarquia de contas (`contaextendida`)

O código de 11 dígitos (ex: `41010700006`) é agrupado pelos 2 primeiros dígitos:

| Prefixo 2 dig | Grupo | Cor |
|--------------|-------|-----|
| `31` | Receitas Operacionais | verde |
| `32` | Receitas Financeiras | esmeralda |
| `33` | Receitas Não Operacionais | teal |
| `41` | Despesas Operacionais | vermelho |
| `42` | Despesas Financeiras | rosa |
| `43` | Despesas Não Operacionais | âmbar |

`buildDREHierarchy(rows)` em `financeAggregations.js` retorna `{ receitas: { groups, total }, despesas: { groups, total } }`.
Cada `group`: `{ code, label, subtotal, accounts: [{ name, value, count, pct }] }`.

`DREPage` oferece 3 views:
- **Mensal** — tabela YYYY-MM com Receita/Despesa/Resultado/Margem/Taxa Despesa
- **Hierarquia** — seções colapsáveis por grupo de conta, % sobre receita total
- **Por Conta** — tabela pivô conta × mês (visão planilha)

### Waterfall DRE

`buildWaterfall(rows)` retorna dados para gráfico cascata (Recharts stacked bar transparente + colorido):

```
Receita Bruta → [Reversões] → Rec. Líquida (subtotal) →
top 6 despesas por conta → [Outras Despesas] → Resultado
```

Cada item: `{ name, spacer (transparente), value (visível), type, running }`.
Cores por `type`: `receita=#10b981`, `reducao=#f59e0b`, `subtotal=#3b82f6`, `despesa=#f43f5e`, `total_pos=#0ea5e9`, `total_neg=#ef4444`.

### KPIs do Overview (6 cards)

| KPI | Fórmula | Alerta cor |
|-----|---------|-----------|
| Receita Total | `Σ signed (kind=receita)` | verde |
| Despesa Total | `Σ signed (kind=despesa)` | vermelho |
| Resultado | Receita − Despesa | azul ≥ 0, âmbar < 0 |
| Margem % | Resultado / Receita × 100 | indigo ≥10%, âmbar ≥0%, vermelho <0% |
| Taxa de Despesa | Despesa / Receita × 100 | verde <80%, âmbar <95%, vermelho ≥95% |
| Lançamentos | `rows.length` | slate |

Todos os KPIs têm `InfoTooltip` explicando o cálculo.

### Export (Excel + PDF)

`FinanceApp` envolve tudo em `<ExportProvider value={exportCtx}>`. Cada aba usa `<ExportButton>` do padrão existente.

`exportCtx`:
```js
{ startDate, endDate, qualPeriodo: 'DRE', nSistema: 'Financeiro', filters: { filial: [] } }
```

`buildMetadata` aceita strings livres em `nSistema`/`qualPeriodo` — exibidos literalmente no Excel/PDF.

### Abas e dados

| Aba | Hook | Lazy? | Dados |
|-----|------|-------|-------|
| Visão Geral | `useFinanceSeries` resultado | não | DRE |
| DRE | idem | não | DRE |
| Despesas | idem | não | DRE |
| Receitas | idem | não | DRE |
| Fluxo de Caixa | `useFinanceSeries` baixadas | **sim** (só ao abrir aba) | Baixadas |
| Contas Pagar/Receber | `useFinanceData` abertas | **sim** | Abertas (posição atual) |
| Comparativos | `useFinanceSeries` ×2 | sempre ativo | DRE próprio (self-contained) |

O DRE do ano anterior (para delta) só é buscado quando a aba Overview está ativa.

### Pendências conhecidas

- **`contasAbertas` (PayablesPage):** shape do JSON não validado com dados reais — pode precisar de ajuste em `normalizeAberta`.
- **PROD:** criar `ContabilGateway.ashx` no IIS análogo ao `RentabilidadeGateway.ashx` para ambiente de produção.
- **`useFinanceSeries` progressivo:** atualmente `Promise.all` aguarda todos os meses antes de atualizar estado — não há progresso incremental. Para spans longos (6-12 meses), avaliar atualização mês a mês via `setState` incremental.
- **Comparativos — ExportProvider:** `ComparePage` usa seu próprio `ExportProvider` interno com ctx baseado no período A. Se migrar para receber ctx do pai, remover o provider interno.
