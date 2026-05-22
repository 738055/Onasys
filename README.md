# Dashboard ONASYS

Dashboard BI em React + Vite para análise de vendas e rentabilidade, com um segundo painel operacional de fluxo de clientes (PAX por dia).

## Pré-requisitos

- Node.js 18+
- Acesso à rede interna (192.168.25.240) ou internet para `api.wrb.onasys.com.br`

## Configuração

Copie `.env.local.example` para `.env.local` e preencha com as credenciais reais:

```env
ONASYS_TOKEN_URL=http://192.168.25.240/apiwrb/security/token
ONASYS_INTERNAL_BASE=http://192.168.25.240/apiwrb
ONASYS_EXTERNAL_BASE=http://api.wrb.onasys.com.br
ONASYS_GRANT_TYPE=password
ONASYS_USERNAME=seu.usuario@dominio.com
ONASYS_PASSWORD=sua_senha
ONASYS_CLIENT_ID=postman:123
ONASYS_CLIENT_SECRET=
ONASYS_SCOPE=
ONASYS_REFRESH_MS=120000
```

O `ONASYS_REFRESH_MS` controla de quanto em quanto tempo o token é renovado (padrão: 2 minutos). O gateway no Vite gerencia isso automaticamente — a interface nunca lida com tokens diretamente.

## Rodar localmente

```bash
npm install
npm run dev
```

- Dashboard BI principal: `http://localhost:5173/`
- Dashboard de fluxo operacional: `http://localhost:5173/flow.html`

## Build

```bash
npm run build
```

Gera os dois painéis em `dist/` (entradas separadas: `index.html` e `flow.html`). Em produção, replique o proxy do Vite no servidor web ou configure as variáveis de ambiente equivalentes.

## Como funciona a autenticação

O `vite.config.js` tem um plugin que atua como gateway OAuth entre o frontend e a API ONASYS. Quando o frontend faz uma requisição para `/api/onasys/rentabilidade?...`, o gateway:

1. Obtém um token OAuth (grant_type configurável via `.env.local`)
2. Armazena em cache e renova automaticamente antes de expirar
3. Tenta primeiro a rede interna; se falhar, cai no endpoint externo
4. Devolve o JSON da API para o frontend sem expor credenciais

O status atual do gateway (token ativo, endpoint em uso) está disponível em `/api/onasys/status`.

## Comportamento da API ONASYS

O endpoint de rentabilidade aceita o período tanto via path quanto via query string:

```
GET /Lancamentos/VendasRentabilidadeItens/{inicio}/{fim}/{qualPeriodo}/{nSistema}
```

O segmento `{qualPeriodo}` no path determina qual campo de data a API usa para filtrar:
- `/1/` → filtra por `ddatain` (data de check-in / realização do serviço)
- `/2/` → filtra por `ddataemissao` (data de emissão da venda)

Isso é independente do conceito de "Emitido/Realizado" na interface. Por isso o gateway sempre usa `/1/` quando quer filtrar por data de serviço, mesmo que a UI esteja em modo Realizado — e usa a versão sem datas no path quando o filtro é por emissão, deixando a filtragem para o lado do cliente.

## Estrutura de pastas

```
src/
  hooks/
    useDashboardData.js   — hook compartilhado de busca e normalização
  utils/
    normalize.js          — mapeamento dos campos da API para o modelo interno
    aggregations.js       — funções de agrupamento e cálculo usadas nos gráficos
  components/
    FilterBar.jsx         — barra de filtros (período, filial, perfil)
    KPICard.jsx           — card de indicador reutilizável
  pages/
    ExecutivePage.jsx
    SalesPage.jsx
    MarginPage.jsx
    ServicesPage.jsx
    GeoPage.jsx
  App.jsx                 — dashboard BI principal (multi-página)
  FlowApp.jsx             — dashboard de fluxo operacional (PAX por dia)
  flow-main.jsx           — entry point do flow.html
```

## Os dois dashboards

**Dashboard BI (`/`)** — análise de vendas e rentabilidade com filtros por período, filial e perfil. Páginas: Executivo, Vendas, Margem, Serviços, Geo.

**Dashboard de Fluxo (`/flow.html`)** — visão operacional do mês, focada em `ddatain` (data do serviço). Mostra um gráfico de área com picos de PAX, mapa de calor por dia, alertas quando um dia ultrapassa 50% da média do mês, e listagem de serviços com quantidade de passageiros por dia selecionado.
