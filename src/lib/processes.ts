import type { Audiencia, Modalidade, Movimentacao, Parte, Prioridade, Processo, Prazo } from '../data';
import { toneOf } from '../data';
import type { StatusTone } from '../components/ui';
import { supabase } from './supabase';
import type { DataJudMovement } from './datajud';

type ProcessRow = {
  id: string;
  case_number: string;
  client_id: string;
  responsible: string;
  area: string;
  status: string;
  archived: boolean;
  tribunal: string;
  comarca: string;
  vara: string;
  updated_at: string;
  created_at: string;
  summary: string;
  observations: string;
};

type ClientRow = { id: string; name: string };
type PartyRow = {
  id: string;
  process_id: string;
  name: string;
  role: string;
  document: string;
  representative: string;
};
type MovementRow = {
  id: string;
  process_id: string;
  movement_type: string;
  description: string;
  author: string;
  occurred_at: string;
  source: string;
};
type DeadlineRow = {
  id: string;
  process_id: string;
  description: string;
  due_date: string;
  responsible: string;
  priority: string;
  status: string;
};
type HearingRow = {
  id: string;
  process_id: string;
  hearing_type: string;
  scheduled_date: string;
  scheduled_time: string;
  modality: string;
  location: string;
  status: string;
  participants: string;
  responsible: string;
  observations: string;
};

export type NewProcessInput = {
  numero: string;
  clienteId: string;
  responsavel: string;
  area: string;
  tribunal: string;
  comarca: string;
  vara: string;
  resumo: string;
  observacoes?: string;
  partes: Array<{ nome: string; papel: string; doc?: string; rep?: string }>;
};

const db = () => {
  if (!supabase) throw new Error('O Supabase não está configurado.');
  return supabase;
};

async function getCurrentUser() {
  const client = db();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessão expirada. Inicie sessão novamente.');
  return data.user;
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value));

const formatSqlDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : formatDate(value);
};

const formatSqlDateTime = (date: string, time: string) =>
  `${formatSqlDate(date)} · ${time.slice(0, 5).replace(':', 'h')}`;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  const day = formatDate(value);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${day} · ${time.replace(':', 'h')}`;
};

function mapProcess(
  row: ProcessRow,
  clientName: string,
  parties: PartyRow[],
  movements: MovementRow[],
  deadlines: DeadlineRow[],
  hearings: HearingRow[],
): Processo {
  const mappedParties: Parte[] = parties.map((party) => ({
    id: party.id,
    nome: party.name,
    papel: party.role,
    doc: party.document,
    rep: party.representative,
  }));
  const mappedMovements: Movimentacao[] = movements.map((movement) => ({
    id: movement.id,
    data: formatDateTime(movement.occurred_at),
    tipo: movement.movement_type,
    descricao: movement.description,
    autor: movement.author,
    origem: movement.source === 'datajud' ? 'datajud' : 'manual',
  }));
  const mappedDeadlines: Prazo[] = deadlines.map((deadline) => {
    const data = formatSqlDate(deadline.due_date);
    const tone = toneOf(data);
    return {
      id: deadline.id,
      descricao: deadline.description,
      data,
      tone,
      responsavel: deadline.responsible,
      prioridade: deadline.priority as Prioridade,
      status: deadline.status === 'concluido' ? 'concluido' : tone === 'atrasado' ? 'atrasado' : 'pendente',
    };
  });
  const mappedHearings: Audiencia[] = hearings.map((hearing) => ({
    id: hearing.id,
    tipo: hearing.hearing_type,
    data: formatSqlDateTime(hearing.scheduled_date, hearing.scheduled_time),
    local: hearing.location,
    modalidade: hearing.modality as Modalidade,
    status: hearing.status as StatusTone,
    participantes: hearing.participants || undefined,
    responsavel: hearing.responsible,
    observacoes: hearing.observations || undefined,
  }));

  return {
    id: row.id,
    numero: row.case_number,
    clienteId: row.client_id,
    cliente: clientName,
    responsavel: row.responsible,
    area: row.area,
    status: row.status as StatusTone,
    arquivado: row.archived,
    tribunal: row.tribunal,
    comarca: row.comarca,
    vara: row.vara,
    atualizacao: formatDate(row.updated_at),
    criadoEm: formatDate(row.created_at),
    resumo: row.summary,
    observacoes: row.observations,
    partes: mappedParties,
    documentos: [],
    movimentacoes: mappedMovements,
    prazos: mappedDeadlines,
    audiencias: mappedHearings,
  };
}

export async function listProcesses(): Promise<Processo[]> {
  const client = db();
  const user = await getCurrentUser();
  const { data: processData, error: processError } = await client
    .from('processes')
    .select('id, case_number, client_id, responsible, area, status, archived, tribunal, comarca, vara, updated_at, created_at, summary, observations')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });
  if (processError) throw processError;

  const rows = (processData ?? []) as unknown as ProcessRow[];
  if (rows.length === 0) return [];
  const processIds = rows.map((row) => row.id);

  const [clientResult, partyResult, movementResult, deadlineResult, hearingResult] = await Promise.all([
    client.from('clients').select('id, name').eq('owner_id', user.id),
    client.from('process_parties').select('id, process_id, name, role, document, representative')
      .eq('owner_id', user.id).in('process_id', processIds),
    client.from('process_movements').select('id, process_id, movement_type, description, author, occurred_at, source')
      .eq('owner_id', user.id).in('process_id', processIds).order('occurred_at', { ascending: false }),
    client.from('process_deadlines').select('id, process_id, description, due_date, responsible, priority, status')
      .eq('owner_id', user.id).in('process_id', processIds).order('due_date', { ascending: true }),
    client.from('process_hearings').select('id, process_id, hearing_type, scheduled_date, scheduled_time, modality, location, status, participants, responsible, observations')
      .eq('owner_id', user.id).in('process_id', processIds).order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true }),
  ]);
  if (clientResult.error) throw clientResult.error;
  if (partyResult.error) throw partyResult.error;
  if (movementResult.error) throw movementResult.error;
  if (deadlineResult.error) throw deadlineResult.error;
  if (hearingResult.error) throw hearingResult.error;

  const clients = (clientResult.data ?? []) as unknown as ClientRow[];
  const parties = (partyResult.data ?? []) as unknown as PartyRow[];
  const movements = (movementResult.data ?? []) as unknown as MovementRow[];
  const deadlines = (deadlineResult.data ?? []) as unknown as DeadlineRow[];
  const hearings = (hearingResult.data ?? []) as unknown as HearingRow[];
  const clientNames = new Map(clients.map((item) => [item.id, item.name]));
  const partiesByProcess = new Map<string, PartyRow[]>();
  const movementsByProcess = new Map<string, MovementRow[]>();
  const deadlinesByProcess = new Map<string, DeadlineRow[]>();
  const hearingsByProcess = new Map<string, HearingRow[]>();
  for (const party of parties) {
    partiesByProcess.set(party.process_id, [...(partiesByProcess.get(party.process_id) ?? []), party]);
  }
  for (const movement of movements) {
    movementsByProcess.set(movement.process_id, [...(movementsByProcess.get(movement.process_id) ?? []), movement]);
  }
  for (const deadline of deadlines) {
    deadlinesByProcess.set(deadline.process_id, [...(deadlinesByProcess.get(deadline.process_id) ?? []), deadline]);
  }
  for (const hearing of hearings) {
    hearingsByProcess.set(hearing.process_id, [...(hearingsByProcess.get(hearing.process_id) ?? []), hearing]);
  }

  return rows.map((row) => mapProcess(
    row,
    clientNames.get(row.client_id) ?? 'Cliente indisponível',
    partiesByProcess.get(row.id) ?? [],
    movementsByProcess.get(row.id) ?? [],
    deadlinesByProcess.get(row.id) ?? [],
    hearingsByProcess.get(row.id) ?? [],
  ));
}

export async function getProcessByNumber(caseNumber: string): Promise<Processo | null> {
  const processes = await listProcesses();
  return processes.find((process) => process.numero === caseNumber) ?? null;
}

export async function createProcess(input: NewProcessInput): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc('create_process_with_parties', {
    p_case_number: input.numero.trim(),
    p_client_id: input.clienteId,
    p_responsible: input.responsavel.trim(),
    p_area: input.area,
    p_tribunal: input.tribunal.trim(),
    p_comarca: input.comarca.trim(),
    p_vara: input.vara.trim(),
    p_summary: input.resumo.trim(),
    p_observations: input.observacoes?.trim() ?? '',
    p_parties: input.partes
      .filter((party) => party.nome.trim())
      .map((party) => ({ ...party, nome: party.nome.trim() })),
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('O processo foi criado sem identificador válido.');
  return data;
}

export async function updateProcess(
  caseNumber: string,
  patch: Partial<Pick<Processo, 'responsavel' | 'area' | 'tribunal' | 'comarca' | 'vara' | 'resumo' | 'observacoes'>>,
): Promise<void> {
  const client = db();
  const user = await getCurrentUser();
  const payload: Record<string, string> = {};
  if (patch.responsavel !== undefined) payload.responsible = patch.responsavel.trim();
  if (patch.area !== undefined) payload.area = patch.area;
  if (patch.tribunal !== undefined) payload.tribunal = patch.tribunal.trim();
  if (patch.comarca !== undefined) payload.comarca = patch.comarca.trim();
  if (patch.vara !== undefined) payload.vara = patch.vara.trim();
  if (patch.resumo !== undefined) payload.summary = patch.resumo.trim();
  if (patch.observacoes !== undefined) payload.observations = patch.observacoes.trim();
  if (Object.keys(payload).length === 0) return;

  const { data, error } = await client.from('processes').update(payload)
    .eq('owner_id', user.id).eq('case_number', caseNumber).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Processo não encontrado nesta conta.');
}

export async function addProcessMovement(
  caseNumber: string,
  movement: { tipo: string; descricao: string },
): Promise<void> {
  const client = db();
  const user = await getCurrentUser();
  const { data: process, error: processError } = await client.from('processes')
    .select('id').eq('owner_id', user.id).eq('case_number', caseNumber).maybeSingle();
  if (processError) throw processError;
  if (!process) throw new Error('Processo não encontrado nesta conta.');

  const metadata = user.user_metadata ?? {};
  const author = String(metadata.nome ?? metadata.full_name ?? metadata.name ?? user.email ?? 'Utilizador');
  const { error } = await client.from('process_movements').insert({
    owner_id: user.id,
    process_id: process.id,
    movement_type: movement.tipo.trim(),
    description: movement.descricao.trim(),
    author,
    actor_id: user.id,
    source: 'manual',
  });
  if (error) throw error;
}

export async function createProcessDeadline(
  caseNumber: string,
  deadline: { descricao: string; data: string; responsavel: string; prioridade: Prioridade },
): Promise<void> {
  const client = db();
  const user = await getCurrentUser();
  const { data: process, error: processError } = await client.from('processes')
    .select('id').eq('owner_id', user.id).eq('case_number', caseNumber).maybeSingle();
  if (processError) throw processError;
  if (!process) throw new Error('Processo não encontrado nesta conta.');
  if (!deadline.descricao.trim() || !deadline.data) throw new Error('Descrição e data do prazo são obrigatórias.');

  const { error } = await client.from('process_deadlines').insert({
    owner_id: user.id,
    process_id: process.id,
    description: deadline.descricao.trim(),
    due_date: deadline.data,
    responsible: deadline.responsavel.trim(),
    priority: deadline.prioridade,
  });
  if (error) throw error;
}

export async function completeProcessDeadline(deadlineId: string): Promise<void> {
  const client = db();
  const user = await getCurrentUser();
  const { data, error } = await client.from('process_deadlines')
    .update({ status: 'concluido' })
    .eq('owner_id', user.id)
    .eq('id', deadlineId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Prazo não encontrado nesta conta.');
}

export async function setProcessStatus(
  caseNumber: string,
  status: Extract<StatusTone, 'em-andamento' | 'aguardando' | 'atrasado' | 'encerrado'>,
  archived: boolean,
  note: string,
): Promise<void> {
  const client = db();
  const user = await getCurrentUser();
  const metadata = user.user_metadata ?? {};
  const author = String(metadata.nome ?? metadata.full_name ?? metadata.name ?? user.email ?? 'Utilizador');
  const { data: process, error: processError } = await client.from('processes')
    .select('id').eq('owner_id', user.id).eq('case_number', caseNumber).maybeSingle();
  if (processError) throw processError;
  if (!process) throw new Error('Processo não encontrado nesta conta.');

  const { error } = await client.rpc('set_process_status', {
    p_process_id: process.id,
    p_status: status,
    p_archived: archived,
    p_note: note,
    p_author: author,
  });
  if (error) throw error;
}

export async function syncDataJudMovements(processId: string, movements: DataJudMovement[]): Promise<number> {
  if (movements.length === 0) return 0;
  const client = db();
  const user = await getCurrentUser();
  const { data: process, error: processError } = await client.from('processes')
    .select('id').eq('owner_id', user.id).eq('id', processId).maybeSingle();
  if (processError) throw processError;
  if (!process) throw new Error('Processo não encontrado nesta conta.');

  const { data: existing, error: existingError } = await client.from('process_movements')
    .select('movement_type, description, occurred_at').eq('owner_id', user.id)
    .eq('process_id', processId).eq('source', 'datajud');
  if (existingError) throw existingError;
  const existingKeys = new Set((existing ?? []).map((row) => `${row.occurred_at}|${row.movement_type}|${row.description}`));
  const rows = movements.map((movement) => {
    const type = `DataJud · ${movement.name}`;
    const details = [movement.code ? `Código ${movement.code}` : '', ...movement.complements, movement.court ?? ''].filter(Boolean).join(' · ');
    const description = details || 'Movimentação disponibilizada pelo CNJ/DataJud.';
    return {
      owner_id: user.id,
      process_id: processId,
      movement_type: type,
      description,
      author: 'CNJ · DataJud',
      actor_id: user.id,
      source: 'datajud',
      occurred_at: movement.date,
    };
  }).filter((row) => {
    const key = `${row.occurred_at}|${row.movement_type}|${row.description}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
  if (rows.length === 0) return 0;
  const { error } = await client.from('process_movements').insert(rows);
  if (error) throw error;
  return rows.length;
}
