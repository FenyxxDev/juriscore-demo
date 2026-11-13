import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://juriscore-demo.vercel.app',
  'http://localhost:5173',
];
const DEFAULT_SERPRO_BASE_URL = 'https://gateway.apiserpro.serpro.gov.br/consulta-cpf-df/v3';
const TOKEN_URL = 'https://gateway.apiserpro.serpro.gov.br/token';
const REQUEST_BODY_LIMIT = 2048;
const UPSTREAM_TIMEOUT_MS = 15_000;
const USER_WINDOW_MS = 60_000;
const USER_LIMIT = 5;

const requestCounts = new Map<string, { startedAt: number; count: number }>();

type ErrorCode =
  | 'unauthenticated'
  | 'invalid_request'
  | 'invalid_cpf'
  | 'invalid_birth_date'
  | 'rate_limited'
  | 'integration_unconfigured'
  | 'provider_not_found'
  | 'provider_unauthorized'
  | 'provider_unavailable'
  | 'provider_error'
  | 'internal_error';

function allowedOrigins(): string[] {
  const configured = Deno.env.get('SERPRO_CPF_ALLOWED_ORIGINS');
  return configured
    ? configured.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body: Record<string, unknown>, status = 200, origin: string | null = null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

function errorJson(code: ErrorCode, message: string, status: number, origin: string | null): Response {
  return json({ ok: false, code, error: message }, status, origin);
}

function parseOrigin(request: Request): { origin: string | null; blocked: boolean } {
  const origin = request.headers.get('Origin');
  return { origin, blocked: !!origin && !allowedOrigins().includes(origin) };
}

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (contentLength > REQUEST_BODY_LIMIT) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > REQUEST_BODY_LIMIT) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function normalizeCpf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cpf = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^([0-9])\1{10}$/.test(cpf)) return null;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return null;
  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]) ? cpf : null;
}

function normalizeBirthDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;
  return `${day}${month}${year}`;
}

function consumeUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const current = requestCounts.get(userId);
  if (!current || now - current.startedAt >= USER_WINDOW_MS) {
    requestCounts.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= USER_LIMIT) return false;
  current.count += 1;
  return true;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function getSerproToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const basic = btoa(`${consumerKey}:${consumerSecret}`);
  let response: Response;
  try {
    response = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
  } catch {
    throw { code: 'provider_unavailable' as ErrorCode, status: 503 };
  }
  const body = await readJson(response);
  if (!response.ok || typeof body.access_token !== 'string' || !body.access_token) {
    throw { code: response.status === 401 ? 'provider_unauthorized' as ErrorCode : 'provider_error' as ErrorCode, status: response.status === 401 ? 502 : 502 };
  }
  return body.access_token;
}

function sanitizeProviderData(body: Record<string, unknown>, cpf: string, birthDate: string): Record<string, unknown> {
  const situation = body.situacao && typeof body.situacao === 'object' && !Array.isArray(body.situacao)
    ? body.situacao as Record<string, unknown>
    : {};
  return {
    cpf: typeof body.ni === 'string' ? body.ni : cpf,
    name: typeof body.nome === 'string' ? body.nome : null,
    socialName: typeof body.nomeSocial === 'string' ? body.nomeSocial : null,
    birthDate: typeof body.nascimento === 'string' ? body.nascimento : birthDate,
    registrationDate: typeof body.dataInscricao === 'string' ? body.dataInscricao : null,
    statusCode: typeof situation.codigo === 'string' ? situation.codigo : null,
    statusDescription: typeof situation.descricao === 'string' ? situation.descricao : null,
  };
}

async function querySerpro(cpf: string, birthDate: string, key: string, secret: string): Promise<{ status: number; data: Record<string, unknown> }> {
  const token = await getSerproToken(key, secret);
  const baseUrl = (Deno.env.get('SERPRO_CPF_BASE_URL') || DEFAULT_SERPRO_BASE_URL).replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/cpf/${cpf}/${birthDate}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    throw { code: 'provider_unavailable' as ErrorCode, status: 503 };
  }
  const body = await readJson(response);
  if (response.status === 404) throw { code: 'provider_not_found' as ErrorCode, status: 404 };
  if (response.status === 401 || response.status === 403) throw { code: 'provider_unauthorized' as ErrorCode, status: 502 };
  if (response.status === 400) {
    const upstreamCode = typeof body.erro === 'string' ? body.erro : '';
    throw { code: upstreamCode === 'DATA_NASCIMENTO_INVALIDA' ? 'invalid_birth_date' as ErrorCode : 'invalid_cpf' as ErrorCode, status: 422 };
  }
  if (![200, 206].includes(response.status)) throw { code: 'provider_error' as ErrorCode, status: 502 };
  return { status: response.status, data: sanitizeProviderData(body, cpf, birthDate) };
}

const messages: Record<ErrorCode, string> = {
  unauthenticated: 'É necessário iniciar sessão para consultar o CPF.',
  invalid_request: 'Informe somente CPF e data de nascimento.',
  invalid_cpf: 'O CPF informado é inválido.',
  invalid_birth_date: 'A data de nascimento informada é inválida.',
  rate_limited: 'O limite de consultas de CPF foi atingido. Tente novamente mais tarde.',
  integration_unconfigured: 'A integração Serpro não está configurada no servidor.',
  provider_not_found: 'Não foi encontrada correspondência para o CPF e a data informados.',
  provider_unauthorized: 'A credencial da integração Serpro não foi autorizada.',
  provider_unavailable: 'O serviço Serpro está temporariamente indisponível.',
  provider_error: 'O Serpro não concluiu a consulta neste momento.',
  internal_error: 'Erro interno ao consultar o CPF.',
};

Deno.serve(async (request: Request) => {
  const { origin, blocked } = parseOrigin(request);
  if (blocked) return json({ ok: false, error: 'Origem não autorizada.' }, 403, null);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return errorJson('invalid_request', 'Método não permitido.', 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const consumerKey = Deno.env.get('SERPRO_CONSUMER_KEY');
  const consumerSecret = Deno.env.get('SERPRO_CONSUMER_SECRET');
  const authorization = request.headers.get('Authorization') ?? '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!bearer) return errorJson('unauthenticated', messages.unauthenticated, 401, origin);
  if (!supabaseUrl || !anonKey || !consumerKey || !consumerSecret) {
    return errorJson('integration_unconfigured', messages.integration_unconfigured, 503, origin);
  }

  const rawBody = await readBoundedBody(request);
  if (rawBody === null) return errorJson('invalid_request', 'Pedido demasiado grande.', 413, origin);
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorJson('invalid_request', messages.invalid_request, 400, origin);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return errorJson('invalid_request', messages.invalid_request, 400, origin);
  const body = payload as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['cpf', 'birthDate'].includes(key)) || typeof body.cpf !== 'string' || typeof body.birthDate !== 'string') {
    return errorJson('invalid_request', messages.invalid_request, 400, origin);
  }
  const cpf = normalizeCpf(body.cpf);
  if (!cpf) return errorJson('invalid_cpf', messages.invalid_cpf, 422, origin);
  const birthDate = normalizeBirthDate(body.birthDate);
  if (!birthDate) return errorJson('invalid_birth_date', messages.invalid_birth_date, 422, origin);

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer[1]}` } },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser(bearer[1]);
    const user = authData.user;
    if (authError || !user) return errorJson('unauthenticated', messages.unauthenticated, 401, origin);
    if (!consumeUserRateLimit(user.id)) return json({ ok: false, code: 'rate_limited', error: messages.rate_limited }, 429, origin, { 'Retry-After': '60' });

    const result = await querySerpro(cpf, birthDate, consumerKey, consumerSecret);
    return json({ ok: true, partial: result.status === 206, data: result.data }, 200, origin);
  } catch (error) {
    const candidate = error as { code?: ErrorCode; status?: number };
    const code = candidate?.code && candidate.code in messages ? candidate.code : 'internal_error';
    const status = typeof candidate?.status === 'number' ? candidate.status : 500;
    return errorJson(code, messages[code], status, origin);
  }
});
