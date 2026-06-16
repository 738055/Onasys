import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_TOKEN_URL = 'http://192.168.25.240/apiwrb/security/token';
const DEFAULT_INTERNAL_BASE = 'http://192.168.25.240/apiwrb';
const DEFAULT_EXTERNAL_BASE = 'http://api.wrb.onasys.com.br';
const DEFAULT_FINANCE_EXTERNAL_BASE = 'http://api.frt.onasys.com.br';
const DEFAULT_REFRESH_MS = 2 * 60 * 1000;

function trimSlash(value = '') {
  return String(value).trim().replace(/\/+$/, '');
}

async function parseRemoteResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

function ts() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}
function gLog(msg)  { console.log(`\x1b[36m[ONASYS ${ts()}]\x1b[0m ${msg}`); }
function gWarn(msg) { console.warn(`\x1b[33m[ONASYS ${ts()}] ⚠\x1b[0m  ${msg}`); }
function gErr(msg)  { console.error(`\x1b[31m[ONASYS ${ts()}] ✗\x1b[0m  ${msg}`); }

function buildOnasysGatewayPlugin(env) {
  const tokenUrl = trimSlash(env.ONASYS_TOKEN_URL || DEFAULT_TOKEN_URL);
  const internalBase = trimSlash(env.ONASYS_INTERNAL_BASE || DEFAULT_INTERNAL_BASE);
  const externalBase = trimSlash(env.ONASYS_EXTERNAL_BASE || DEFAULT_EXTERNAL_BASE);
  const financeExternalBase = trimSlash(env.ONASYS_FINANCE_EXTERNAL_BASE || DEFAULT_FINANCE_EXTERNAL_BASE);
  const grantType = (env.ONASYS_GRANT_TYPE || 'password').trim();
  const username = (env.ONASYS_USERNAME || '').trim();
  const password = env.ONASYS_PASSWORD || '';
  const clientId = (env.ONASYS_CLIENT_ID || '').trim();
  const clientSecret = env.ONASYS_CLIENT_SECRET || '';
  const scope = (env.ONASYS_SCOPE || '').trim();
  const extraParams = env.ONASYS_EXTRA_PARAMS || '';
  const refreshMs = Math.max(60_000, Number(env.ONASYS_REFRESH_MS || DEFAULT_REFRESH_MS));

  let tokenCache = {
    accessToken: '',
    tokenType: 'bearer',
    refreshedAt: 0,
    expiresAt: 0,
    expiresIn: 0,
  };
  let preferredBase = internalBase;
  let refreshPromise = null;

  function authConfigured() {
    if (grantType === 'password') return Boolean(username && password && clientId);
    if (grantType === 'client_credentials') return Boolean(clientId && clientSecret);
    return Boolean(username || password || clientId || clientSecret || extraParams);
  }

  function appendExtraParams(params) {
    for (const pair of String(extraParams || '').split('&')) {
      const [rawKey, rawValue] = pair.split('=');
      const key = (rawKey || '').trim();
      if (!key) continue;
      params.set(key, decodeURIComponent((rawValue || '').trim()));
    }
  }

  async function requestNewToken() {
    if (!authConfigured()) {
      throw new Error('Credenciais ONASYS ausentes no ambiente local.');
    }

    const params = new URLSearchParams();
    params.set('grant_type', grantType);
    if (username) params.set('username', username);
    if (password) params.set('password', password);
    if (clientId) params.set('client_id', clientId);
    if (clientSecret) params.set('client_secret', clientSecret);
    if (scope) params.set('scope', scope);
    appendExtraParams(params);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: params.toString(),
    });

    const body = await parseRemoteResponse(response);
    if (!response.ok) {
      const detail =
        typeof body === 'string'
          ? body
          : body?.message || body?.erro || body?.error || response.statusText;
      const err = `Token ${response.status}: ${detail}`;
      gErr(`Falha ao obter token OAuth2 — ${err}`);
      throw new Error(err);
    }

    const accessToken = body?.access_token || body?.token || body?.accessToken;
    if (!accessToken) {
      gErr('Resposta de token sem access_token — verifique ONASYS_USERNAME / ONASYS_PASSWORD / ONASYS_CLIENT_ID no .env');
      throw new Error('Resposta de token sem access_token.');
    }

    const expiresIn = Number(body?.expires_in || 0);
    const refreshedAt = Date.now();
    const safeTtl = expiresIn > 30 ? (expiresIn - 30) * 1000 : refreshMs;

    tokenCache = {
      accessToken,
      tokenType: body?.token_type || 'bearer',
      refreshedAt,
      expiresAt: refreshedAt + safeTtl,
      expiresIn,
    };

    gLog(`🔑 Token renovado — expira em ${expiresIn}s (refresh automático em ${Math.round(safeTtl / 1000)}s)`);
    return tokenCache;
  }

  async function ensureToken(force = false) {
    const now = Date.now();
    if (!force && tokenCache.accessToken && now < tokenCache.expiresAt && now - tokenCache.refreshedAt < refreshMs) {
      return tokenCache;
    }

    if (force) gLog('🔄 Forçando renovação de token (401/403 recebido da API)...');

    if (!refreshPromise) {
      refreshPromise = requestNewToken().finally(() => {
        refreshPromise = null;
      });
    }

    return refreshPromise;
  }

  async function fetchRentabilidadeFromEndpoint(endpoint, token) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await parseRemoteResponse(response);
    return { response, body, endpoint };
  }

  function buildRentabilidadeAttempts(baseUrl, query) {
    const trimmedBase = trimSlash(baseUrl);
    const baseEndpoint = `${trimmedBase}/Lancamentos/VendasRentabilidadeItens`;
    const noDateQuery = new URLSearchParams();
    if (query.qualPeriodo) noDateQuery.set('qualPeriodo', query.qualPeriodo);
    if (query.nSistema) noDateQuery.set('nSistema', query.nSistema);

    // Mapeamento qualPeriodo (frontend) → estratégia de endpoint:
    //   0 = Emitido  → API sem datas no path; client-side filtra por ddataemissao
    //   1 = Realizado → API com /1/ no path; server filtra por ddatain
    // O valor 2 não é usado nesse escopo.
    const pathByDataIn = {
      endpoint: [
        baseEndpoint,
        query.periodoInicial,
        query.periodoFinal,
        '1',              // /1/ no path da API = filtra por ddatain
        query.nSistema,
      ].join('/'),
      serverFiltersDates: true,
    };
    const noDateQueryParams = {
      endpoint: noDateQuery.toString()
        ? `${baseEndpoint}?${noDateQuery.toString()}`
        : baseEndpoint,
      serverFiltersDates: false,
    };
    const noParams = { endpoint: baseEndpoint, serverFiltersDates: false };

    // qualPeriodo='1' (Realizado) → usa path com datas para filtro server-side por ddatain
    // qualPeriodo='0' (Emitido)   → sem datas no path; filtro client-side por ddataemissao
    if (query.qualPeriodo === '1') {
      return [pathByDataIn, noDateQueryParams, noParams];
    }
    return [noDateQueryParams, noParams, pathByDataIn];
  }

  async function requestRentabilidade(query) {
    const tokenInfo = await ensureToken(false);
    const candidates = [preferredBase, preferredBase === internalBase ? externalBase : internalBase].filter(Boolean);
    const errors = [];
    const label = `${query.periodoInicial}→${query.periodoFinal} qP=${query.qualPeriodo} nS=${query.nSistema}`;

    for (const baseUrl of candidates) {
      const source = baseUrl === internalBase ? 'internal' : 'external';
      const attempts = buildRentabilidadeAttempts(baseUrl, query);

      for (const strategy of attempts) {
        try {
          let attempt = await fetchRentabilidadeFromEndpoint(strategy.endpoint, tokenInfo.accessToken);

          if (attempt.response.status === 401 || attempt.response.status === 403) {
            gWarn(`${attempt.response.status} recebido de ${source} — renovando token e tentando novamente...`);
            const freshToken = await ensureToken(true);
            attempt = await fetchRentabilidadeFromEndpoint(strategy.endpoint, freshToken.accessToken);
          }

          if (!attempt.response.ok) {
            const detail =
              typeof attempt.body === 'string'
                ? attempt.body
                : attempt.body?.message || attempt.body?.erro || attempt.body?.error || attempt.response.statusText;
            throw new Error(`${attempt.response.status}: ${detail}`);
          }

          const rowCount = Array.isArray(attempt.body) ? attempt.body.length : (Array.isArray(attempt.body?.rows) ? attempt.body.rows.length : '?');
          preferredBase = baseUrl;
          gLog(`✓ ${rowCount} registros | ${label} | source=${source} | serverFiltersDates=${strategy.serverFiltersDates}`);
          return {
            source,
            endpoint: attempt.endpoint,
            rows: attempt.body,
            serverFiltersDates: strategy.serverFiltersDates,
          };
        } catch (error) {
          gWarn(`Tentativa falhou [${source}]: ${error.message}`);
          errors.push(`${strategy.endpoint} -> ${error.message}`);
        }
      }
    }

    gErr(`Todas as tentativas falharam para ${label}:\n  ${errors.join('\n  ')}`);
    throw new Error(errors.join(' | '));
  }

  // ─── Endpoints contábeis ──────────────────────────────────────────────────

  const CONTABIL_PATH_MAP = {
    resultado:  (ini, fim)      => `Lancamentos/LancamentosContabeisResultado/${ini}/${fim}`,
    baixadas:   (ini, fim)      => `Lancamentos/contasBaixadas/${ini}/${fim}`,
    lancamentos:(ini, fim)      => `Lancamentos/LancamentosContabeis/${ini}/${fim}`,
    todos:      (ini, fim, tipo)=> `Lancamentos/LancamentosContabeisTodos/${ini}/${fim}/${tipo || 'R'}`,
    abertas:    ()              => `Lancamentos/contasAbertas`,
  };

  async function fetchContabilFromEndpoint(endpoint, token, jsonBody = null) {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    if (jsonBody) headers['Content-Type'] = 'application/json';
    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      ...(jsonBody ? { body: JSON.stringify(jsonBody) } : {}),
    });
    const body = await parseRemoteResponse(response);
    return { response, body, endpoint };
  }

  async function requestContabil(query) {
    const { recurso, periodoInicial, periodoFinal, tipo } = query;

    const pathFn = CONTABIL_PATH_MAP[recurso];
    if (!pathFn) throw new Error(`recurso desconhecido: ${recurso}`);

    const tokenInfo = await ensureToken(false);
    const label = `${periodoInicial}→${periodoFinal} recurso=${recurso}`;
    gLog(`→ /contabil ${label}`);

    // Estratégia 1: base interna com path params
    const internalPath = `${internalBase}/${pathFn(periodoInicial, periodoFinal, tipo)}`;
    // Estratégia 2: base externa financeira com JSON body
    const externalPath = `${financeExternalBase}/Lancamentos/${recurso === 'resultado' ? 'LancamentosContabeisResultado' : recurso === 'baixadas' ? 'contasBaixadas' : recurso === 'lancamentos' ? 'LancamentosContabeis' : recurso === 'todos' ? `LancamentosContabeisTodos` : 'contasAbertas'}`;
    const externalBody = { periodoInicial, periodoFinal, ...(recurso === 'todos' ? { tipo: tipo || 'R' } : {}) };

    const attempts = [
      { endpoint: internalPath,  body: null,         source: 'internal' },
      { endpoint: externalPath,  body: externalBody, source: 'external' },
    ];

    const errors = [];
    for (const attempt of attempts) {
      try {
        let res = await fetchContabilFromEndpoint(attempt.endpoint, tokenInfo.accessToken, attempt.body);
        if (res.response.status === 401 || res.response.status === 403) {
          const fresh = await ensureToken(true);
          res = await fetchContabilFromEndpoint(attempt.endpoint, fresh.accessToken, attempt.body);
        }
        if (!res.response.ok) {
          const detail = typeof res.body === 'string' ? res.body : res.body?.message || res.body?.error || res.response.statusText;
          throw new Error(`${res.response.status}: ${detail}`);
        }
        const rowCount = Array.isArray(res.body) ? res.body.length : '?';
        gLog(`✓ ${rowCount} registros contábeis | ${label} | source=${attempt.source}`);
        return { source: attempt.source, rows: res.body };
      } catch (err) {
        gWarn(`Contábil tentativa falhou [${attempt.source}]: ${err.message}`);
        errors.push(`${attempt.endpoint} → ${err.message}`);
      }
    }
    gErr(`Todas tentativas contábeis falharam: ${label}`);
    throw new Error(errors.join(' | '));
  }

  function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  }

  function attachMiddlewares(middlewares) {
    middlewares.use('/api/onasys/status', async (_req, res) => {
      try {
        if (authConfigured() && (!tokenCache.accessToken || Date.now() - tokenCache.refreshedAt > refreshMs)) {
          await ensureToken(false);
        }

        sendJson(res, 200, {
          authConfigured: authConfigured(),
          tokenReady: Boolean(tokenCache.accessToken),
          tokenRefreshedAt: tokenCache.refreshedAt || null,
          tokenExpiresIn: tokenCache.expiresIn || 0,
          activeBase: preferredBase,
          mode: preferredBase === internalBase ? 'internal' : 'external',
          tokenEndpoint: tokenUrl,
        });
      } catch (error) {
        sendJson(res, 500, {
          authConfigured: authConfigured(),
          tokenReady: false,
          error: error.message,
          activeBase: preferredBase,
          mode: preferredBase === internalBase ? 'internal' : 'external',
          tokenEndpoint: tokenUrl,
        });
      }
    });

    middlewares.use('/api/onasys/contabil', async (req, res) => {
      try {
        const url = new URL(req.originalUrl || req.url, 'http://localhost');
        const recurso        = url.searchParams.get('recurso') || '';
        const periodoInicial = url.searchParams.get('periodoInicial') || '';
        const periodoFinal   = url.searchParams.get('periodoFinal')   || '';
        const tipo           = url.searchParams.get('tipo') || 'R';

        if (!recurso) {
          sendJson(res, 400, { error: 'Parâmetro "recurso" obrigatório.' });
          return;
        }
        if (!periodoInicial || !periodoFinal) {
          sendJson(res, 400, { error: 'periodoInicial e periodoFinal são obrigatórios.' });
          return;
        }

        // Valida limite de 1 mês
        const msDay = 1000 * 60 * 60 * 24;
        const diffDays = (new Date(periodoFinal) - new Date(periodoInicial)) / msDay;
        if (diffDays > 31) {
          sendJson(res, 400, { error: 'Período máximo de 1 mês para endpoints contábeis.' });
          return;
        }

        const result = await requestContabil({ recurso, periodoInicial, periodoFinal, tipo });
        sendJson(res, 200, result);
      } catch (error) {
        gErr(`Erro na requisição contábil: ${error.message}`);
        sendJson(res, 502, { error: error.message });
      }
    });

    middlewares.use('/api/onasys/rentabilidade', async (req, res) => {
      try {
        const url = new URL(req.originalUrl || req.url, 'http://localhost');
        const query = {
          periodoInicial: url.searchParams.get('periodoInicial') || '',
          periodoFinal: url.searchParams.get('periodoFinal') || '',
          qualPeriodo: url.searchParams.get('qualPeriodo') || '1',
          nSistema: url.searchParams.get('nSistema') || '0',
        };

        if (!query.periodoInicial || !query.periodoFinal) {
          gWarn('Requisição sem periodoInicial/periodoFinal — rejeitada (400)');
          sendJson(res, 400, {
            error: 'periodoInicial e periodoFinal sao obrigatorios.',
          });
          return;
        }

        gLog(`→ /rentabilidade ${query.periodoInicial}→${query.periodoFinal} | qualPeriodo=${query.qualPeriodo} | nSistema=${query.nSistema}`);
        const result = await requestRentabilidade(query);
        sendJson(res, 200, result);
      } catch (error) {
        gErr(`Erro na requisição de rentabilidade: ${error.message}`);
        sendJson(res, 502, {
          error: error.message,
          activeBase: preferredBase,
        });
      }
    });
  }

  if (authConfigured()) {
    const timer = setInterval(() => {
      ensureToken(false).catch(err => {
        gErr(`Falha no refresh periódico de token: ${err.message}`);
      });
    }, refreshMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  return {
    name: 'onasys-gateway',
    configureServer(server) {
      if (!authConfigured()) {
        gWarn('Credenciais ONASYS não configuradas no .env — requisições à API irão falhar.');
        gWarn('Variáveis necessárias: ONASYS_USERNAME, ONASYS_PASSWORD, ONASYS_CLIENT_ID');
        gWarn('Diagnóstico disponível em: http://localhost:5173/api/onasys/status');
      } else {
        gLog(`Gateway ONASYS iniciado | interno: ${internalBase} | externo: ${externalBase}`);
        gLog(`Diagnóstico: http://localhost:5173/api/onasys/status`);
      }
      attachMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddlewares(server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), buildOnasysGatewayPlugin(env)],
    base: './',
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
    build: {
      rollupOptions: {
        input: {
          main:    'index.html',
          flow:    'flow.html',
          finance: 'finance.html',
        },
      },
    },
  };
});
