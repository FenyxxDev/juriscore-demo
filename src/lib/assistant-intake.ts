import { supabase } from './supabase';

export type IntakePriority = 'baixa' | 'normal' | 'alta';
export type IntakeStatus = 'novo' | 'encaminhado';
export type IntakeRequest = {
  id: string;
  clientId: string;
  processId: string | null;
  subject: string;
  description: string;
  priority: IntakePriority;
  status: IntakeStatus;
  createdAt: string;
};

function db() {
  if (!supabase) throw new Error('O Supabase não está configurado.');
  return supabase;
}

async function currentOwnerId() {
  const client = db();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessão expirada. Inicie sessão novamente.');
  return data.user.id;
}

function mapRequest(row: Record<string, unknown>): IntakeRequest {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    processId: typeof row.process_id === 'string' ? row.process_id : null,
    subject: String(row.subject),
    description: String(row.description),
    priority: row.priority as IntakePriority,
    status: row.status as IntakeStatus,
    createdAt: String(row.created_at),
  };
}

export async function listAssistantIntakeRequests(): Promise<IntakeRequest[]> {
  const client = db();
  const ownerId = await currentOwnerId();
  const { data, error } = await client.from('assistant_intake_requests')
    .select('id, client_id, process_id, subject, description, priority, status, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRequest(row as Record<string, unknown>));
}

export async function createAssistantIntakeRequest(input: {
  clientId: string;
  processId?: string | null;
  subject: string;
  description: string;
  priority: IntakePriority;
}): Promise<IntakeRequest> {
  const client = db();
  const ownerId = await currentOwnerId();
  const { data, error } = await client.from('assistant_intake_requests').insert({
    client_id: input.clientId,
    process_id: input.processId || null,
    subject: input.subject.trim(),
    description: input.description.trim(),
    priority: input.priority,
  }).select('id, client_id, process_id, subject, description, priority, status, created_at').single();
  if (error) throw error;
  const { data: current, error: currentError } = await client.auth.getUser();
  if (currentError) throw currentError;
  if (current.user?.id !== ownerId) throw new Error('A conta mudou durante o salvamento.');
  return mapRequest(data as Record<string, unknown>);
}

export async function forwardAssistantIntakeRequest(id: string): Promise<void> {
  const client = db();
  const ownerId = await currentOwnerId();
  const { data, error } = await client.from('assistant_intake_requests')
    .update({ status: 'encaminhado' })
    .eq('owner_id', ownerId)
    .eq('id', id)
    .eq('status', 'novo')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('O pedido já foi encaminhado ou não pertence a esta conta.');
  const { data: current, error: currentError } = await client.auth.getUser();
  if (currentError) throw currentError;
  if (current.user?.id !== ownerId) throw new Error('A conta mudou durante a atualização.');
}
