import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://juriscore-demo.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const PAGE_SIZE = 100;
const PROFILES = new Set(['Administrador', 'Advogado', 'Assistente']);
const ELEVATED_PROFILES = new Set(['Administrador', 'Assistente']);

type JsonObject = Record<string, unknown>;
type Action = 'list' | 'reject-profile' | 'set-active';

function corsHeaders(origin: string | null) {
  return {
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: JsonObject, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function profile(value: unknown): string | null {
  return typeof value === 'string' && PROFILES.has(value) ? value : null;
}

function bannedNow(bannedUntil: string | null | undefined) {
  if (!bannedUntil) return false;
  const timestamp = Date.parse(bannedUntil);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function safeUser(user: {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  user_metadata?: JsonObject;
  app_metadata?: JsonObject;
}) {
  const requested = profile(user.user_metadata?.perfil_solicitado) ?? profile(user.user_metadata?.perfil);
  const approved = profile(user.app_metadata?.perfil);
  const rejected = user.app_metadata?.perfil_status === 'rejeitado';
  const pending = Boolean(requested && ELEVATED_PROFILES.has(requested) && requested !== approved && !rejected);
  const approvalStatus = rejected ? 'rejeitado' : pending ? 'pendente' : requested || approved ? 'liberado' : 'sem-perfil';
  const bannedUntil = user.banned_until ?? null;
  return {
    id: user.id,
    email: user.email ?? '',
    nome: text(user.user_metadata?.nome) ?? text(user.user_metadata?.name),
    perfilSolicitado: requested,
    perfilAprovado: approved,
    estadoAprovacao: approvalStatus,
    emailConfirmadoEm: user.email_confirmed_at ?? null,
    criadoEm: user.created_at ?? null,
    ultimoLoginEm: user.last_sign_in_at ?? null,
    banidoAte: bannedUntil,
    ativo: !bannedNow(bannedUntil),
    decisaoPerfilEm: text(user.app_metadata?.perfil_aprovado_em) ?? text(user.app_metadata?.perfil_rejeitado_em),
  };
}

function validUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, null);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const match = (request.headers.get('Authorization') ?? '').match(/^Bearer\s+(.+)$/i);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Admin users function is missing server configuration.');
    return json({ error: 'A gestão de usuários não está configurada no servidor.' }, 500, origin);
  }
  if (!match?.[1]) return json({ error: 'Autenticação obrigatória.' }, 401, origin);

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'Pedido demasiado grande.' }, 413, origin);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Pedido inválido.' }, 400, origin);
  }
  if (!isObject(payload)) return json({ error: 'Pedido inválido.' }, 400, origin);
  const action = payload.action as Action;
  if (!['list', 'reject-profile', 'set-active'].includes(action)) {
    return json({ error: 'Operação não reconhecida.' }, 400, origin);
  }

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(match[1]);
    const caller = callerData.user;
    if (callerError || !caller) return json({ error: 'Sessão inválida ou expirada.' }, 401, origin);
    if (caller.app_metadata?.perfil !== 'Administrador') {
      return json({ error: 'Somente um Administrador pode gerir contas.' }, 403, origin);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === 'list') {
      const page = Number.isInteger(payload.page) ? Number(payload.page) : 1;
      if (page < 1 || page > 10000) return json({ error: 'Página inválida.' }, 400, origin);
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error) {
        console.error('Admin users list operation failed.');
        return json({ error: 'Não foi possível carregar a lista de usuários.' }, 502, origin);
      }
      const users = data.users.map((authUser) => safeUser(authUser));
      return json({ users, page, hasMore: users.length === PAGE_SIZE }, 200, origin);
    }

    if (!validUserId(payload.userId)) return json({ error: 'Identificador de usuário inválido.' }, 400, origin);
    const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(payload.userId);
    const target = targetData.user;
    if (targetError || !target) return json({ error: 'Conta não encontrada.' }, 404, origin);
    if (target.id === caller.id) return json({ error: 'Não é permitido alterar a própria conta.' }, 400, origin);

    if (action === 'reject-profile') {
      const requested = profile(target.user_metadata?.perfil_solicitado) ?? profile(target.user_metadata?.perfil);
      const approved = profile(target.app_metadata?.perfil);
      if (!requested || !ELEVATED_PROFILES.has(requested) || requested === approved) {
        return json({ error: 'A conta não possui um pedido de perfil pendente.' }, 409, origin);
      }
      const appMetadata = {
        ...(target.app_metadata ?? {}),
        perfil_status: 'rejeitado',
        perfil_rejeitado_por: caller.id,
        perfil_rejeitado_em: new Date().toISOString(),
      };
      const { error } = await adminClient.auth.admin.updateUserById(target.id, { app_metadata: appMetadata });
      if (error) {
        console.error('Admin users profile rejection failed.');
        return json({ error: 'Não foi possível rejeitar o pedido de perfil.' }, 502, origin);
      }
      return json({ ok: true }, 200, origin);
    }

    if (typeof payload.ativo !== 'boolean') return json({ error: 'Informe se a conta deve ficar ativa.' }, 400, origin);
    const ativo = payload.ativo;
    const appMetadata = {
      ...(target.app_metadata ?? {}),
      conta_status: ativo ? 'ativa' : 'inativa',
      conta_status_alterado_por: caller.id,
      conta_status_alterado_em: new Date().toISOString(),
    };
    const { error } = await adminClient.auth.admin.updateUserById(target.id, {
      ban_duration: ativo ? 'none' : '876000h',
      app_metadata: appMetadata,
    });
    if (error) {
      console.error('Admin users status change failed.');
      return json({ error: 'Não foi possível alterar o estado da conta.' }, 502, origin);
    }
    return json({ ok: true, ativo }, 200, origin);
  } catch {
    console.error('Unexpected admin users operation failure.');
    return json({ error: 'Erro interno ao gerir a conta.' }, 500, origin);
  }
});
