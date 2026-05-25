# Dashboard BI ONASYS — Documentação Técnica

## Stack

React 18 + Vite 5 + Recharts + Tailwind CSS + Lucide React  
API REST ONASYS autenticada via OAuth2 (gateway em `vite.config.js`).

---

## Estrutura de arquivos

```
src/
  utils/normalize.js        — Traduz campos brutos da API → modelo BI
  utils/aggregations.js     — KPIs, agrupamentos, scatter, ABC, churn
  utils/leadTime.js         — Distribuição por antecedência de emissão
  utils/supplierConcentration.js — HHI e tendência de margem por fornecedor
  utils/rfm.js              — Análise RFM de clientes
  utils/heatMap.js          — Calor Canal × Segmento
  utils/format.js           — Formatadores BRL, %, datas
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
  FlowApp.jsx               — App separado: Fluxo Operacional (pax por dia)
```

---

## Perfis de acesso

| Perfil      | nSistema | Filtro client-side        |
|-------------|----------|---------------------------|
| Emissivo    | `0`      | nenhum                    |
| Receptivo   | `1`      | nenhum                    |
| Internacional | `0`   | `serviceScope === 'Internacional'` (campo `nacint`) |

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
| `nomefornecedor` | `supplier` | string | Fornecedor |
| `nomeservico` | `product` | string | Nome do serviço |
| `dsCateg` | `segment` | string | Categoria (I=Ingresso, TO=Transfer Out, TI=Transfer In, R=Receptivo, A=Aéreo) |
| `dsestado` | `state` | string | UF |
| `regiaobrasil` | `region` | string | Região (NORTE, SUL, SUDESTE, etc.) |
| `nomeemissor` | `vendor` | string | Emissor da venda |
| `nomecomercial` | `commercial` | string | Responsável comercial (distinto do emissor) |
| `tipovenda` | `saleType` | string | Tipo de venda |
| `idseqintens` | `seqId` | string | Sequencial de itens (cross-sell: itens diferentes = seqIds diferentes) |
| `nacint` | `serviceScope` | — | 'I' ou texto com 'inter' → 'Internacional' |

### Quantidade

| Campo API | Campo normalizado | Notas |
|-----------|-------------------|-------|
| `Num_pax` / `num_pax` | `passengers` | **Fallback**: `Num_pax ?? num_pax` — API pode capitalizar o N |
| `num_noites` | `nights` | Noites de hospedagem |

### Financeiro — Receita

| Campo API | Campo normalizado | Descrição |
|-----------|-------------------|-----------|
| `total_vendas` | `revenue` | Faturamento bruto — valor antes de qualquer dedução |

### Financeiro — Resultado (os mais importantes)

| Campo API | Campo normalizado | Significado | Onde aparece no BI |
|-----------|-------------------|-------------|--------------------|
| `total_resultadoab` | `profit` | **Resultado final** após TODOS os custos: fornecedor, comissões repassadas, taxas, descontos, comissão do emissor | KPI "Líquido" (ExecutivePage), coluna "Resultado AB" nas tabelas, base do % Rent em todo o BI |
| `total_liquido` | `profitLiquido` | Resultado **antes** de deduzir comissão do emissor (`total_resultadoab + total_com_emissor`) | Coluna "Líquido" nas tabelas (informativo — par com "Resultado AB") |
| `total_com_emissor` | `commissionEmissor` | Comissão do emissor a pagar | Coluna "Comissão Emissor" no agrupamento de Vendas |
| `per_mkpliquido` | `marginPct` | % margem gerado pela API — **NUNCA usar para cálculo** (produz valores errados em agregados) | Não usado nos cálculos; apenas armazenado |

> **Relação:** `total_liquido = total_resultadoab + total_com_emissor`

### Financeiro — Outros custos (não normalizados individualmente)

Estes campos existem na API mas não são normalizados em campos separados — já estão embutidos em `total_resultadoab`:

| Campo API | Tipo |
|-----------|------|
| `total_Netfornecedor_hotel` | Custo net hotel |
| `total_Netfornecedor_aereo` | Custo net aéreo |
| `total_Netfornecedor_maritimo` | Custo net marítimo |
| `total_Netornecedor_outros` | Custo net outros (**atenção: "orn" sem "f"** — typo intencional da API) |
| `total_fornecedor_guias` | Custo guias |
| `total_taxascc` | Taxa cartão de crédito |
| `total_taxasantec` | Taxa antecipação |
| `total_descontos` | Desconto (embutido em `total_resultadoab`) |
| `total_comissao` | Repasse de comissão a OTAs/sub-agentes (custo) |
| `total_taxas_provisao` | Provisão de impostos |

---

## Regra de ouro: % Rentabilidade

```
% Rent = SUM(total_resultadoab) / SUM(total_vendas)
       = SUM(profit) / SUM(revenue)
```

**Nunca** usar `per_mkpliquido` da API como média — produz valores completamente errados em agregados.  
**Nunca** usar `profitLiquido` (total_liquido) como base do % Rent — é pré-emissor.

---

## Distinção Líquido vs Resultado AB (nas tabelas)

| Coluna na tabela | Campo | API | Significado |
|------------------|-------|-----|-------------|
| **Líquido** | `profitLiquido` | `total_liquido` | Antes de deduzir comissão do emissor |
| **Comissão Emissor** | `commissionEmissor` | `total_com_emissor` | Comissão a pagar ao emissor |
| **Resultado AB** | `profit` | `total_resultadoab` | Valor final = Líquido − Comissão Emissor |
| **% Rent** | calculado | `profit / revenue` | Base: Resultado AB |

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

---

## Endpoints e roteamento

```
GET /Lancamentos/VendasRentabilidadeItens/{inicio}/{fim}/{qualPeriodo}/{nSistema}
```

- `qualPeriodo=1` no path → API filtra por `ddatain` (Realizado)
- `qualPeriodo=2` no path → filtro client-side por `ddataemissao` (Emitido)
- Gateway em `vite.config.js` lida com OAuth2, retry interno/externo e cache de token

---

## Onde cada campo é consumido no frontend

### `revenue` (total_vendas)
- ExecutivePage: KPI "Faturamento Total", gráfico Evolução Mensal, Mix Segmento
- SalesPage: Tabela agrupamento (coluna "Total Vendido"), ABC Clientes
- ServicesPage: Ranking de Serviços, Top 20, Eficiência por Estadia
- MarginPage: Scatter (eixo X), distribuição de margem
- GeoPage: Gráficos e tabelas de Região/Estado
- ClientsPage: Todos os painéis
- IntelligencePage: Lead Time, Heat Map, RFM, Concentração

### `profit` (total_resultadoab)
- ExecutivePage: KPI **"Líquido"**, timeline (linha verde e % margem), Top 10 Fornecedores
- SalesPage: Coluna **"Resultado AB"**, tfoot % Rent, `rentPct` de todos os agrupamentos
- ServicesPage: Coluna "Resultado AB" no Ranking Completo, `rentPct` de todos os grupos
- MarginPage: Losses (filtro `profit < 0`), distribuição de margem, scatter (margem Y)
- ClientsPage: `rentPct` de todos os painéis
- GeoPage: `rentPct`
- IntelligencePage: `margin` do Lead Time, scatter de concentração
- aggregations.js: `calcKPIs.margin`, `groupByClientOrVendor.rentPct`, scatter functions

### `profitLiquido` (total_liquido)
- SalesPage: Coluna **"Líquido"** no agrupamento (informativo — antes de deduzir emissor)
- ServicesPage: Coluna "Líquido" no Ranking Completo (par com "Resultado AB")
- MarginPage: ScatterTooltip (exibido como referência), export do scatter
- ExecutivePage: Export "Evolução Mensal" (coluna "Líquido" no Excel/PDF)
- Outros: campo disponível mas % Rent NÃO usa este campo

### `commissionEmissor` (total_com_emissor)
- SalesPage: Coluna "Comissão Emissor a pagar no período" no agrupamento

### `passengers` (Num_pax / num_pax)
- ExecutivePage: KPI "Passageiros" (único por venda — max num_pax do grupo)
- FlowApp: Fluxo diário de pax por serviço
- SalesPage, ServicesPage: Colunas Pax nas tabelas
- PaxAuditModal: Auditoria de deduplicação de pax

### `profitLiquido` e `profit` — ScatterTooltip (MarginPage hover)
Exibe ambos: "Líquido (total_liquido)" e "Resultado AB (total_resultadoab)" para o usuário comparar a diferença (= comissão do emissor)

---

## Segmentos (dsCateg)

| Código API | Label | Cor |
|------------|-------|-----|
| I | Ingresso | roxo |
| TO | Transfer Out | azul |
| TI | Transfer In | verde-azulado |
| R | Receptivo | verde |
| A | Aéreo | laranja |
| (outros) | Outros | cinza |
