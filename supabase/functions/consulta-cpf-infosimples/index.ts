import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ORIGINS = ['https://juriscore-demo.vercel.app', 'http://localhost:5173'];
const LIMIT_BYTES = 2048;
const WINDOW_MS = 60_000;
const USER_LIMIT = 5;
const counts = new Map<string, { start: number; count: number }>();

type ErrCode = 'unauthenticated' | 'invalid_request' | 'invalid_cpf' | 'invalid_birth_date' | 'rate_limited' | 'integration_unconfigured' | 'provider_not_found' | 'provider_unauthorized' | 'provider_unavailable' | 'provider_error' | 'internal_error';
const messages: Record<ErrCode, string> = {
  unauthenticated: 'É necessário iniciar sessão para consultar o CPF.',
  invalid_request: 'Informe CPF e data de nascimento válidos.',
  invalid_cpf: 'O CPF informado é inválido.',
  invalid_birth_date: 'A data de nascimento informada é inválida.',
  rate_limited: 'O limite de consultas foi atingido. Tente novamente mais tarde.',
  integration_unconfigured: 'A integração não está configurada no servidor.',
  provider_not_found: 'Não foi encontrada correspondência para o CPF e a data informados.',
  provider_unauthorized: 'A integração de consulta não está autorizada no servidor.',
  provider_unavailable: 'O serviço de consulta está temporariamente indisponível.',
  provider_error: 'O serviço de consulta não concluiu o pedido.',
  internal_error: 'Erro interno ao consultar o CPF.',
};

function headers(origin: string | null): Record<string, string> {
  return {
    ...(origin && ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}
function reply(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}
function fail(code: ErrCode, status: number, origin: string | null): Response {
  return reply({ ok: false, code, error: messages[code] }, status, origin);
}
async function boundedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('Content-Length') ?? '0') > LIMIT_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(all);
}
function normalizeCpf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cpf = raw.replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return null;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11; if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return null;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11; if (digit === 10) digit = 0;
  return digit === Number(cpf[10]) ? cpf : null;
}
function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  return `${day}/${month}/${year}`;
}
function rateLimit(userId: string): boolean {
  const now = Date.now(); const entry = counts.get(userId);
  if (!entry || now - entry.start >= WINDOW_MS) { counts.set(userId, { start: now, count: 1 }); return true; }
  if (entry.count >= USER_LIMIT) return false;
  entry.count++; return true;
}
function text(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) if (typeof obj[key] === 'string') return (obj[key] as string).slice(0, 200);
  return null;
}
function sanitize(row: Record<string, unknown>, cpf: string, birthDate: string) {
  const status = row.situacao_cadastral && typeof row.situacao_cadastral === 'object'
    ? row.situacao_cadastral as Record<string, unknown> : {};
  const maybeStatus = row.situacao && typeof row.situacao === 'object'
    ? row.situacao as Record<string, unknown> : {};
  return {
    cpf,
    name: text(row, 'nome', 'name'),
    civilName: text(row, 'nome_civil', 'nome_civil_completo'),
    socialName: text(row, 'nome_social'),
    birthDate: text(row, 'data_nascimento', 'nascimento') ?? birthDate,
    registrationDate: text(row, 'data_inscricao', 'data_inscricao_receita_federal'),
    status: text(status, 'descricao', 'situacao') ?? text(row, 'situacao_cadastral', 'situacao') ?? text(maybeStatus, 'descricao', 'codigo'),
    deathYear: text(row, 'ano_obito'),
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  if (origin && !ORIGINS.includes(origin)) return fail('invalid_request', 403, null);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== 'POST') return fail('invalid_request', 405, origin);
  const authorization = request.headers.get('Authorization') ?? '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(authorization);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const token = Deno.env.get('INFOSIMPLES_TOKEN');
  if (!bearer) return fail('unauthenticated', 401, origin);
  if (!supabaseUrl || !anonKey || !token) return fail('integration_unconfigured', 503, origin);
  const raw = await boundedBody(request);
  if (raw === null) return fail('invalid_request', 413, origin);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return fail('invalid_request', 400, origin); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('invalid_request', 400, origin);
  const body = payload as Record<string, unknown>;
  if (Object.keys(body).some((k) => !['cpf', 'birthDate'].includes(k))) return fail('invalid_request', 400, origin);
  const cpf = normalizeCpf(body.cpf); if (!cpf) return fail('invalid_cpf', 422, origin);
  const birthDate = normalizeDate(body.birthDate); if (!birthDate) return fail('invalid_birth_date', 422, origin);
  try {
    const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.auth.getUser(bearer[1]);
    if (error || !data.user) return fail('unauthenticated', 401, origin);
    if (!rateLimit(data.user.id)) return reply({ ok: false, code: 'rate_limited', error: messages.rate_limited }, 429, origin);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch('https://api.infosimples.com/api/v2/consultas/receita-federal/cpf', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ token, cpf, birthdate: birthDate }),
      });
    } catch { return fail('provider_unavailable', 503, origin); }
    finally { clearTimeout(timer); }
    let upstream: Record<string, unknown>;
    try { const parsed: unknown = await response.json(); upstream = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; }
    catch { return fail('provider_error', 502, origin); }
    if (response.status === 401 || response.status === 403) return fail('provider_unauthorized', 502, origin);
    const code = Number(upstream.code ?? response.status);
    if (![200, 206].includes(code)) {
      if (code === 404 || code === 204) return fail('provider_not_found', 404, origin);
      if (code === 401 || code === 403) return fail('provider_unauthorized', 502, origin);
      return fail('provider_error', 502, origin);
    }
    const rows = Array.isArray(upstream.data) ? upstream.data : upstream.data && typeof upstream.data === 'object' ? [upstream.data] : [];
    if (!rows.length || !rows[0] || typeof rows[0] !== 'object') return fail('provider_not_found', 404, origin);
    return reply({ ok: true, partial: code === 206, data: sanitize(rows[0] as Record<string, unknown>, cpf, birthDate) }, 200, origin);
  } catch {
    return fail('internal_error', 500, origin);
  }
});
