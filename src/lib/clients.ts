import type { Cliente } from '../data';
import { supabase } from './supabase';

/** Retorna apenas os dígitos para comparar CPF/CNPJ sem depender da máscara. */
export const normalizeDocument = (value: string) => value.replace(/\D/g, '');

type ClientRow = {
  id: string;
  name: string;
  type: Cliente['tipo'];
  document: string;
  status: string;
  updated_at: string;
};

function db() {
  if (!supabase) throw new Error('O Supabase não está configurado.');
  return supabase;
}

export async function listClients(): Promise<Cliente[]> {
  const client = db();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error('Sessão expirada. Inicie sessão novamente.');

  const { data, error } = await client
    .from('clients')
    .select('id, name, type, document, status, updated_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ClientRow[]).map((row) => ({
    id: row.id,
    nome: row.name,
    tipo: row.type,
    documento: row.document,
    atualizacao: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(row.updated_at)),
    status: row.status as Cliente['status'],
  }));
}
