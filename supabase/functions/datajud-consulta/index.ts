import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeCaseNumber, resolveTribunalAlias } from './domain.mjs';
import { DataJudServiceError, queryDataJud } from './datajud-service.mjs';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://juriscore-demo.vercel.app',
  'http://localhost:5173',
];
const REQUEST_BODY_LIMIT = 2048;

function allowedOrigins() {
  const configured = Deno.env.get('DATAJUD_ALLOWED_ORIGINS');
  return configured
    ? configured.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
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

Deno.serve(async (request: Request) => {
  const { origin, blocked } = parseOrigin(request);
  if (blocked) return json({ error: 'Origem não autorizada.' }, 403, null);
  if (request.method === 'OPTIONS') return new Response('ok', { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);

  if (Deno.env.get('DATAJUD_ENABLED') !== 'true') {
    return json({ error: 'A integração DataJud está desativada.' }, 503, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('DATAJUD_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !apiKey) {
    return json({ error: 'A integração DataJud não está configurada no servidor.' }, 503, origin);
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!bearer) return json({ error: 'Autenticação obrigatória.' }, 401, origin);

  const rawBody = await readBoundedBody(request);
  if (rawBody === null) return json({ error: 'Pedido demasiado grande.' }, 413, origin);
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Pedido inválido.' }, 400, origin);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Pedido inválido.' }, 400, origin);
  }
  const body = payload as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || typeof body.processId !== 'string' || !body.processId.trim() || body.processId.length > 128) {
    return json({ error: 'Informe apenas o identificador de um processo.' }, 400, origin);
  }

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer[1]}` } },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser(bearer[1]);
    const user = authData.user;
    if (authError || !user) return json({ error: 'Sessão inválida ou expirada.' }, 401, origin);

    const { data: process, error: processError } = await callerClient
      .from('processes')
      .select('id, case_number, tribunal')
      .eq('owner_id', user.id)
      .eq('id', body.processId.trim())
      .maybeSingle();
    if (processError) return json({ error: 'Não foi possível validar o processo.' }, 502, origin);
    if (!process) return json({ error: 'Processo não encontrado nesta conta.' }, 404, origin);

    const caseNumber = normalizeCaseNumber(process.case_number);
    if (!caseNumber) return json({ error: 'O número CNJ deste processo não está num formato consultável.' }, 422, origin);
    if (!resolveTribunalAlias(process.tribunal)) return json({ error: 'O tribunal deste processo ainda não é suportado.' }, 422, origin);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: allowed, error: rateLimitError } = await adminClient.rpc('consume_datajud_request', {
      p_user_id: user.id,
    });
    if (rateLimitError) return json({ error: 'O controlo de consultas está indisponível.' }, 503, origin);
    if (allowed !== true) {
      return new Response(JSON.stringify({ error: 'Limite de consultas atingido. Tente novamente mais tarde.' }), {
        status: 429,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' },
      });
    }

    const result = await queryDataJud({
      tribunal: process.tribunal,
      caseNumber,
      apiKey,
    });
    return json({ ok: true, ...result }, 200, origin);
  } catch (error) {
    if (error instanceof DataJudServiceError) {
      return json({ error: error.message }, error.status, origin);
    }
    return json({ error: 'Erro interno ao consultar DataJud.' }, 500, origin);
  }
});
