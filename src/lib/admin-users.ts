import { supabase } from './supabase';

export type PerfilJuriscore = 'Administrador' | 'Advogado' | 'Assistente';
export type EstadoAprovacao = 'pendente' | 'liberado' | 'rejeitado' | 'sem-perfil';

export type UsuarioAdmin = {
  id: string;
  email: string;
  nome: string | null;
  perfilSolicitado: PerfilJuriscore | null;
  perfilAprovado: PerfilJuriscore | null;
  estadoAprovacao: EstadoAprovacao;
  emailConfirmadoEm: string | null;
  criadoEm: string | null;
  ultimoLoginEm: string | null;
  banidoAte: string | null;
  ativo: boolean;
  decisaoPerfilEm: string | null;
};

type ErrorPayload = { error?: unknown };

async function invoke<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    const context = (error as unknown as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as ErrorPayload | null;
      if (typeof payload?.error === 'string') throw new Error(payload.error);
    }
    throw new Error(error.message || 'Não foi possível concluir a operação.');
  }
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error);
  }
  return data as T;
}

export async function listarUsuariosAdmin(page: number) {
  return invoke<{ users: UsuarioAdmin[]; page: number; hasMore: boolean }>('admin-users', {
    action: 'list',
    page,
  });
}

export async function negarPerfilAdmin(userId: string) {
  return invoke<{ ok: true }>('admin-users', { action: 'reject-profile', userId });
}

export async function definirUsuarioAtivo(userId: string, ativo: boolean) {
  return invoke<{ ok: true; ativo: boolean }>('admin-users', { action: 'set-active', userId, ativo });
}

export async function aprovarPerfilAdmin(email: string) {
  return invoke<{ email: string; perfil: PerfilJuriscore }>('aprovar-role', { email });
}
