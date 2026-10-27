import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Supabase Edge Function environment is incomplete.');
    return json({ error: 'A função está sem configuração segura no servidor.' }, 500);
  }
  if (!token || token === authorization) return json({ error: 'Autenticação obrigatória.' }, 401);

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    const caller = callerData.user;
    if (callerError || !caller) return json({ error: 'Sessão inválida ou expirada.' }, 401);
    if (caller.app_metadata?.perfil !== 'Administrador') {
      return json({ error: 'Somente um Administrador pode aprovar perfis.' }, 403);
    }

    const payload = await request.json().catch(() => null);
    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Informe um e-mail válido.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    type AuthUser = {
      id: string;
      email?: string;
      email_confirmed_at?: string | null;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    };
    let target: AuthUser | null = null;
    for (let page = 1; page <= 100 && !target; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error('Could not list Auth users for role approval.');
        return json({ error: 'Não foi possível localizar a solicitação.' }, 502);
      }
      target = data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
      if (data.users.length < 1000) break;
    }

    if (!target) return json({ error: 'Conta não encontrada.' }, 404);
    if (target.id === caller.id) return json({ error: 'Um Administrador não pode aprovar a própria solicitação.' }, 400);
    if (!target.email_confirmed_at) return json({ error: 'A conta precisa confirmar o e-mail antes da aprovação.' }, 409);

    const requestedProfile = target.user_metadata?.perfil_solicitado ?? target.user_metadata?.perfil;
    if (requestedProfile !== 'Administrador' && requestedProfile !== 'Assistente') {
      return json({ error: 'Esta conta não possui uma solicitação pendente de Administrador ou Assistente.' }, 409);
    }

    const appMetadata = {
      ...(target.app_metadata ?? {}),
      perfil: requestedProfile,
      perfil_aprovado_por: caller.id,
      perfil_aprovado_em: new Date().toISOString(),
    };
    const { error: updateError } = await adminClient.auth.admin.updateUserById(target.id, {
      app_metadata: appMetadata,
    });
    if (updateError) {
      console.error('Could not update approved Auth role.');
      return json({ error: 'Não foi possível aplicar a role aprovada.' }, 502);
    }

    return json({ email: target.email, perfil: requestedProfile });
  } catch {
    console.error('Unexpected role approval error.');
    return json({ error: 'Erro interno ao processar a aprovação.' }, 500);
  }
});
