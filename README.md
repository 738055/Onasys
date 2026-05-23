# Dashboard BI ONASYS

Painel de business intelligence para análise de rentabilidade de vendas, integrado à API `VendasRentabilidadeItens` da ONASYS.

---

## Sumário

1. [Tecnologias](#tecnologias)
2. [Execução](#execução)
3. [Filtros Globais](#filtros-globais)
4. [Abas e Funcionalidades](#abas-e-funcionalidades)
5. [Glossário de Métricas e Cálculos](#glossário-de-métricas-e-cálculos)
6. [Exportação](#exportação)
7. [Campos da API](#campos-da-api)

---

## Tecnologias

| Biblioteca | Uso |
|---|---|
| React 18 + Vite 5 | UI e build |
| Recharts | Gráficos |
| Tailwind CSS | Estilo |
| ExcelJS | Export Excel com formatação rica |
| jsPDF + autotable | Export PDF |
| html2canvas | Captura de gráficos para PDF |
| Lucide React | Ícones |

---

## Execução

```bash
npm install
npm run dev      # desenvolvimento — http://localhost:5173
npm run build    # produção — dist/
```

---

## Filtros Globais

Aplicados no topo da interface antes de qualquer cálculo:

| Filtro | Campo API | Comportamento |
|---|---|---|
| **Filial** | `nomeempresa` | Multi-seleção |
| **Canal** | `tipoturismo` | Multi-seleção |
| **Tipo de Cliente** | `rede` | Multi-seleção |
| **Emissor** | `nomeemissor` | Multi-seleção |

Período e perfil:
- **Datas (De / Até)**: intervalo aplicado via parâmetros da rota da API.
- **Emitido / Realizado** (`qualPeriodo`): 1 = data de emissão; 2 = data de realização.
- **Emissivo / Receptivo** (`nSistema`): 0 = Emissivo; 1 = Receptivo.

---

## Abas e Funcionalidades

### Visão Executiva
Painel geral com KPIs do período + evolução temporal.

- **KPIs** — Faturamento, Líquido, % Rentabilidade, Passageiros, Ticket Médio, Nº Vendas
- **Evolução Mensal** — faturamento (barra) + lucro líquido (linha) + % margem (linha pontilhada, eixo direito)
- **Faturamento por Segmento — Evolução Mensal** — barras empilhadas por categoria de serviço
- **Top 10 Fornecedores** — por lucro líquido
- **Mix por Segmento** — donut + participação %

---

### Margens
Análise de rentabilidade item a item.

- **KPIs de Margens** — Total Prejuízo, Itens Negativos, Pior Resultado, Total de Itens
- **Distribuição de Margem por Item** — histograma de 7 faixas de rentabilidade
- **Margem vs Faturamento por Fornecedor** — scatter (X = faturamento, Y = % margem)
- **Emissor × Margem × Volume** — scatter agrupado por emissor
- **Itens com Resultado Negativo** — tabela paginada de todos os itens no prejuízo
- **Tendência de Margem por Fornecedor** — evolução mensal da margem dos 10 maiores fornecedores

---

### Vendas
Análise por emissor, cliente e serviço.

- **Top N Emissores** — ranking configurável (5/10/15/20) por Faturamento, Líquido ou % Margem
- **Curva ABC — Clientes** — top 30 clientes com % acumulado (Pareto)
- **Detalhamento de Vendas** — tabela paginada com todos os itens
- **Agrupamento por** — tabela agregada por Cliente, Emissor, Fornecedor ou Serviço
- **Performance Comercial** — ranking por `nomecomercial` (responsável estratégico)

---

### Serviços
Análise por categoria e produto.

- **Mix por Segmento** — donut + lista de participação por categoria
- **Detalhe por Segmento** — tabela com Faturamento, Pax, Líquido e % Rent.
- **Eficiência por Estadia** — Receita/Noite por segmento + Itens/Venda (cross-sell)
- **Top 20 Serviços** — gráfico de barras dos serviços com maior volume
- **Ranking Completo de Serviços** — tabela paginada de todos os produtos

---

### Regiões
Análise geográfica.

- **Faturamento por Região** — barras horizontais + tabela com % Total e % Rent.
- **Top 15 Estados** — barras horizontais dos estados de maior volume
- **Ranking de Estados** — tabela completa de todas as UFs do período

---

### Comparativos
Comparativo entre dois períodos ou perfis distintos.

- **KPIs A vs B** — side-by-side com delta absoluto e % variação
- **Faturamento por Segmento A vs B** — barras duplas por segmento
- **Comparativo por dimensão** — tabela por Canal, Segmento, Filial ou Emissor

---

### Inteligência *(aba avançada)*
Análises de cruzamento de dados usando campos até então não exibidos na UI.

- **Lead Time** — distribuição de dias emissão→check-in + margem por faixa de antecedência
- **Heat Map Canal × Segmento** — matriz de faturamento cruzando canal e segmento
- **Análise RFM de Clientes** — segmentação por Recência, Frequência e Monetário
- **Concentração de Fornecedores** — Share Top-N + Índice HHI de concentração

---

### Clientes
Drill-down hierárquico: Tipo → Cliente → Serviços.

- **Tipos de Cliente (REDE)** — lista clicável de tipos
- **Clientes do Tipo** — clientes do tipo selecionado
- **Serviços do Cliente** — produtos comprados pelo cliente selecionado
- **Monitoramento de Inatividade** — clientes sem compras nos últimos N dias

---

## Glossário de Métricas e Cálculos

### Métricas Básicas

#### Faturamento Total
```
Σ total_vendas
```
Soma bruta do campo `total_vendas` de todos os itens do período. Valor faturado antes de qualquer dedução de custo ou comissão.

---

#### Lucro Líquido
```
Σ (total_liquido + total_descontos)
```
> **Nota sobre `total_descontos`:** A API ONASYS aplica uma dedução dupla nesse campo ao calcular `total_liquido`. Para que o resultado bata com o painel web da ONASYS, somamos `total_descontos` de volta. Isso está documentado em `src/utils/normalize.js`.

---

#### % Rentabilidade (Margem)
```
Lucro Líquido ÷ Faturamento × 100
```
Calculada sempre sobre os **totais somados** (Σlíquido ÷ Σfaturamento), nunca como média de percentuais individuais. Isso evita distorção por itens pequenos com margem extrema.

---

#### Passageiros (Pax único)
```
Para cada ID de venda → usar o maior num_pax registrado
Σ esses valores por grupo
```
Quando uma venda tem vários itens, cada item registra o mesmo `num_pax`. A deduplicação evita contar o mesmo grupo de passageiros múltiplas vezes.

---

#### Ticket Médio
```
Faturamento Total ÷ Passageiros únicos
```
Valor médio por passageiro no período, usando contagem deduplicada de pax.

---

#### Nº Vendas
```
COUNT(DISTINCT venda)
```
Contagem de IDs de venda únicos. Um ID agrupa todos os serviços de uma mesma operação comercial.

---

#### % Rent. (por agrupador)
```
Σlíquido do grupo ÷ Σfaturamento do grupo × 100
```
Aplicada em tabelas de fornecedor, segmento, estado, emissor etc. Sempre sobre os totais do grupo.

---

### Análises da Aba Inteligência

#### Lead Time (emissão → check-in)
```
dias = checkinDate − emissionDate
```
- `checkinDate` vem do campo `ddatain` (formato BR: DD/MM/YYYY).
- `emissionDate` vem de `ddataemissao` (formato ISO).
- Itens sem uma das datas, ou com `checkinDate < emissionDate`, são excluídos.
- **Buckets:** 0–7 / 8–15 / 16–30 / 31–60 / 61–90 / 91–180 / 180+ dias.
- Margem por bucket = Σlíquido ÷ Σfaturamento dos itens naquela faixa.

**Interpretação:** vendas de última hora (0–7 dias) tendem a ter margens diferentes das antecipadas (60–180 dias).

---

#### Heat Map Canal × Segmento
```
célula[canal][segmento] = Σ total_vendas
intensidade de cor = valor ÷ max(células)
```
- Canais (`tipoturismo`) e segmentos (`dsCateg`) são ordenados por faturamento total decrescente.
- Azul escuro = maior concentração relativa; células sem valor aparecem em cinza claro.

**Interpretação:** revela combinações canal-segmento subexploradas e dependências excessivas.

---

#### Análise RFM de Clientes

| Dimensão | Cálculo | Score A (melhor) | Score C (pior) |
|---|---|---|---|
| **R** Recência | Dias entre última compra e fim do dataset | Menor recência | Maior recência |
| **F** Frequência | COUNT DISTINCT vendas | Maior frequência | Menor frequência |
| **M** Monetário | Σ total_vendas | Maior valor | Menor valor |

**Classificação:** cada dimensão é dividida nos tercis do conjunto (percentis 33 e 67). Score final = concatenação dos 3 scores (ex: "AAA", "ABC", "CCC").

| Classe | Critério | Ação sugerida |
|---|---|---|
| **Champions** (AA*) | R=A e F=A | Manter relacionamento, oferecer exclusividades |
| **Em Risco** (R=C, F≠C) | Eram frequentes, sumiram | Campanha de reativação prioritária |
| **Perdidos** (CCC) | Baixo em tudo | Avaliar ROI de reativação |

---

#### Concentração de Fornecedores

**Share Top N:**
```
Σ faturamento dos N maiores fornecedores ÷ faturamento total × 100
```

**HHI (Herfindahl-Hirschman Index):**
```
HHI = Σ (shareᵢ)² × 10.000
      onde shareᵢ = faturamento_i ÷ faturamento_total
```

| HHI | Interpretação |
|---|---|
| < 1.500 | Baixa concentração — carteira diversificada |
| 1.500 – 2.500 | Concentração moderada |
| > 2.500 | Alta concentração — risco de dependência excessiva |

Mesma métrica usada como referência antitruste pelo Departamento de Justiça dos EUA.

---

### Análises nas Abas Existentes

#### Emissor × Margem × Volume (aba Margens)
```
Para cada emissor:
  margem = Σlíquido ÷ Σfaturamento × 100
```
Scatter com X = faturamento, Y = % margem. Quadrante inferior direito (alto volume, baixa margem) = candidatos a revisão de comissões ou capacitação.

---

#### Tendência de Margem por Fornecedor (aba Margens)
```
Para cada mês e cada um dos top 10 fornecedores por faturamento total:
  margem_mensal = Σlíquido_do_mês ÷ Σfaturamento_do_mês × 100
```
Linhas com queda consistente indicam deterioração da relação comercial.

---

#### Performance Comercial (aba Vendas)
```
Agrupamento por nomecomercial
```
Distinto de `nomeemissor` (quem operou a venda): o comercial é o **responsável estratégico** pela conta. Permite avaliação de metas por equipe comercial separada da operação.

---

#### Eficiência por Estadia (aba Serviços)

**Receita/Noite:**
```
Por segmento (apenas itens com num_noites > 0):
  Receita/Noite = Σfaturamento ÷ Σnum_noites
```

**Itens por Venda (cross-sell):**
```
Para cada ID de venda:
  itens = COUNT DISTINCT idseqintens
Média = Σitens ÷ total de vendas
```
Um `idseqintens` diferente dentro de um mesmo `venda` = serviço adicional (cross-sell).

---

## Exportação

Cada card tem um botão **Exportar** (ícone ↓) no canto superior direito.

### Excel (.xlsx)
- **Aba "Resumo"**: período, perfil, filtros ativos e timestamp.
- **Aba de dados**: BRL formatado, % em formato percentual, negativos em vermelho, totais em negrito com fundo azul claro.

### PDF (.pdf)
- **Cabeçalho** em todas as páginas: título, período, perfil, filtros.
- **Gráfico como imagem** capturado via html2canvas (scale 2×) quando disponível.
- **Tabela** via jspdf-autotable: header azul, zebrado, negativos em vermelho, totais em negrito.
- **Rodapé**: "Página X de Y".

**Convenção de nome:** `ONASYS-{slug}-{startDate}-to-{endDate}.{xlsx|pdf}`

---

## Campos da API

Rota: `VendasRentabilidadeItens/{inicio}/{fim}/{qualPeriodo}/{nSistema}`

| Campo normalizado | Campo API | Tipo | Descrição |
|---|---|---|---|
| `id` | `venda` | string | ID único da venda |
| `emissionDate` | `ddataemissao` | Date (ISO) | Data de emissão |
| `checkinDate` | `ddatain` | Date (BR DD/MM/YYYY) | Data de check-in |
| `filial` | `nomeempresa` | string | Filial |
| `channel` | `tipoturismo` | string | Canal de turismo |
| `clientType` | `rede` | string | Tipo/rede do cliente |
| `client` | `cliente` ou `nmfantasia` | string | Nome do cliente |
| `supplier` | `nomefornecedor` | string | Fornecedor |
| `product` | `nomeservico` | string | Serviço/produto |
| `segment` | `dsCateg` | string | Categoria/segmento |
| `state` | `dsestado` | string | Estado (UF) |
| `region` | `regiaobrasil` | string | Região do Brasil |
| `vendor` | `nomeemissor` | string | Emissor operacional |
| `commercial` | `nomecomercial` | string | Responsável comercial estratégico |
| `saleType` | `tipovenda` | string | Tipo de venda |
| `seqId` | `idseqintens` | string | Sequencial do item (cross-sell) |
| `passengers` | `num_pax` | number | Número de passageiros |
| `nights` | `num_noites` | number | Número de noites |
| `revenue` | `total_vendas` | number | Faturamento bruto |
| `profit` | `total_resultadoab + total_descontos` | number | Resultado AB (corrigido) |
| `profitLiquido` | `total_liquido + total_descontos` | number | Lucro líquido (corrigido) |
| `commissionEmissor` | `total_com_emissor` | number | Comissão do emissor |
| `marginPct` | `per_mkpliquido` | number | % margem por item (informativo) |

> `profit` e `profitLiquido` somam `total_descontos` de volta para corrigir dedução dupla da API.
