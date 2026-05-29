import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_TOKEN_URL = 'http://192.168.25.240/apiwrb/security/token';
const DEFAULT_INTERNAL_BASE = 'http://192.168.25.240/apiwrb';
const DEFAULT_EXTERNAL_BASE = 'http://api.wrb.onasys.com.br';
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

    // A API ONASYS interpreta o segmento qualPeriodo no path assim:
    //   /1/ → filtra por ddatain  (data de serviço / check-in)
    //   /2/ → filtra por ddataemissao (data de emissão)
    // Por isso SEMPRE usamos '1' no path quando queremos filtro por ddatain (Realizado),
    // e não usamos o path para Emitido (filtramos ddataemissao no client-side).
    const pathByDataIn = {
      endpoint: [
        baseEndpoint,
        query.periodoInicial,
        query.periodoFinal,
        '1',              // /1/ → API filtra por ddatain
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

    // qualPeriodo='2' → Realizado: path com /1/ filtra por ddatain — correto
    // qualPeriodo='1' → Emitido: sem datas + filtro client-side por ddataemissao
    if (query.qualPeriodo === '2') {
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
          main: 'index.html',
          flow: 'flow.html',
        },
      },
    },
  };
});
