import type { Audiencia, Compromisso, Modalidade, Prioridade, Processo, Tarefa } from '../data';
import { diasAte } from '../data';
import type { StatusTone } from '../components/ui';
import { supabase } from './supabase';

type ProcessRow = { id: string; case_number: string; client_id: string };
type TaskRow = { id: string; process_id: string; title: string; due_date: string; responsible: string; priority: string; status: string };
type HearingRow = { id: string; process_id: string; hearing_type: string; scheduled_date: string; scheduled_time: string; modality: string; location: string; status: string; participants: string; responsible: string; observations: string };
type AppointmentRow = { id: string; process_id: string | null; title: string; scheduled_date: string; scheduled_time: string | null; location: string; responsible: string; status: string; observations: string };

function db() {
  if (!supabase) throw new Error('O Supabase não está configurado.');
  return supabase;
}

async function currentUserId() {
  const client = db();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessão expirada. Inicie sessão novamente.');
  return data.user.id;
}

function sqlDate(value: string) {
  const input = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  throw new Error('Data inválida.');
}

function displayDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date);
}

function displayTime(value?: string | null) {
  if (!value) return '';
  const time = value.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(time) ? time.replace(':', 'h') : '';
}

function displayDateTime(date: string, time?: string | null) {
  const day = displayDate(date);
  const hour = displayTime(time);
  return hour ? `${day} · ${hour}` : day;
}

async function processByNumber(ownerId: string, caseNumber: string): Promise<ProcessRow> {
  const { data, error } = await db().from('processes')
    .select('id, case_number, client_id')
    .eq('owner_id', ownerId)
    .eq('case_number', caseNumber)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Processo não encontrado nesta conta.');
  return data as ProcessRow;
}

async function processLookup(ownerId: string, domainProcesses: Processo[]) {
  if (domainProcesses.length === 0) return new Map<string, Processo>();
  const { data, error } = await db().from('processes')
    .select('id, case_number, client_id')
    .eq('owner_id', ownerId);
  if (error) throw error;
  const byNumber = new Map(domainProcesses.map((process) => [process.numero, process]));
  return new Map(((data ?? []) as unknown as ProcessRow[])
    .map((row) => [row.id, byNumber.get(row.case_number)] as const)
    .filter((entry): entry is readonly [string, Processo] => Boolean(entry[1])));
}

function mapTask(row: TaskRow, process: Processo): Tarefa {
  const data = displayDate(row.due_date);
  const status: Tarefa['status'] = row.status === 'concluido' ? 'concluido' : diasAte(data) < 0 ? 'atrasado' : 'pendente';
  return {
    id: row.id,
    titulo: row.title,
    numero: process.numero,
    cliente: process.cliente,
    responsavel: row.responsible,
    prioridade: row.priority as Prioridade,
    status,
    data,
  };
}

export async function listProcessTasks(domainProcesses: Processo[]): Promise<Tarefa[]> {
  const client = db();
  const ownerId = await currentUserId();
  const [lookup, result] = await Promise.all([
    processLookup(ownerId, domainProcesses),
    client.from('process_tasks').select('id, process_id, title, due_date, responsible, priority, status')
      .eq('owner_id', ownerId).order('due_date', { ascending: true }),
  ]);
  if (result.error) throw result.error;
  return ((result.data ?? []) as unknown as TaskRow[])
    .flatMap((row) => {
      const process = lookup.get(row.process_id);
      return process ? [mapTask(row, process)] : [];
    });
}

export async function createProcessTask(input: {
  numero: string;
  titulo: string;
  data: string;
  responsavel: string;
  prioridade: Prioridade;
}): Promise<Tarefa> {
  const client = db();
  const ownerId = await currentUserId();
  const process = await processByNumber(ownerId, input.numero);
  const clientResult = await client.from('clients').select('name')
    .eq('owner_id', ownerId).eq('id', process.client_id).maybeSingle();
  if (clientResult.error) throw clientResult.error;
  const insertResult = await client.from('process_tasks').insert({
    owner_id: ownerId,
    process_id: process.id,
    title: input.titulo.trim(),
    due_date: sqlDate(input.data),
    responsible: input.responsavel.trim(),
    priority: input.prioridade,
  }).select('id, process_id, title, due_date, responsible, priority, status').single();
  if (insertResult.error) throw insertResult.error;
  const row = insertResult.data as unknown as TaskRow;
  const data = displayDate(row.due_date);
  return {
    id: row.id,
    titulo: row.title,
    numero: process.case_number,
    cliente: clientResult.data?.name ?? 'Cliente indisponível',
    responsavel: row.responsible,
    prioridade: row.priority as Prioridade,
    status: row.status === 'concluido' ? 'concluido' : diasAte(data) < 0 ? 'atrasado' : 'pendente',
    data,
  };
}

export async function setProcessTaskStatus(taskId: string, status: 'pendente' | 'concluido'): Promise<void> {
  const client = db();
  const ownerId = await currentUserId();
  const { data, error } = await client.from('process_tasks').update({ status })
    .eq('owner_id', ownerId).eq('id', taskId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tarefa não encontrada nesta conta.');
}

export async function createProcessHearing(input: {
  numero: string;
  tipo: string;
  data: string;
  hora: string;
  modalidade: Modalidade;
  local: string;
  participantes?: string;
  responsavel: string;
  observacoes?: string;
}): Promise<Audiencia> {
  const client = db();
  const ownerId = await currentUserId();
  const process = await processByNumber(ownerId, input.numero);
  const { data, error } = await client.from('process_hearings').insert({
    owner_id: ownerId,
    process_id: process.id,
    hearing_type: input.tipo.trim(),
    scheduled_date: sqlDate(input.data),
    scheduled_time: input.hora,
    modality: input.modalidade,
    location: input.local.trim(),
    participants: input.participantes?.trim() ?? '',
    responsible: input.responsavel.trim(),
    observations: input.observacoes?.trim() ?? '',
  }).select('id, process_id, hearing_type, scheduled_date, scheduled_time, modality, location, status, participants, responsible, observations').single();
  if (error) throw error;
  const row = data as unknown as HearingRow;
  return {
    id: row.id,
    tipo: row.hearing_type,
    data: displayDateTime(row.scheduled_date, row.scheduled_time),
    local: row.location,
    modalidade: row.modality as Modalidade,
    status: row.status as StatusTone,
    participantes: row.participants || undefined,
    responsavel: row.responsible,
    observacoes: row.observations || undefined,
  };
}

export async function listCalendarAppointments(domainProcesses: Processo[]): Promise<Compromisso[]> {
  const client = db();
  const ownerId = await currentUserId();
  const [lookup, result] = await Promise.all([
    processLookup(ownerId, domainProcesses),
    client.from('calendar_appointments')
      .select('id, process_id, title, scheduled_date, scheduled_time, location, responsible, status, observations')
      .eq('owner_id', ownerId).order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true }),
  ]);
  if (result.error) throw result.error;
  return ((result.data ?? []) as unknown as AppointmentRow[]).map((row) => {
    const process = row.process_id ? lookup.get(row.process_id) : undefined;
    return {
      id: row.id,
      titulo: row.title,
      data: displayDateTime(row.scheduled_date, row.scheduled_time),
      local: row.location,
      responsavel: row.responsible,
      numero: process?.numero,
      observacoes: row.observations || undefined,
      status: row.status as StatusTone,
    };
  });
}

export async function createCalendarAppointment(input: {
  numero?: string;
  titulo: string;
  data: string;
  hora?: string;
  local: string;
  responsavel: string;
  observacoes?: string;
}): Promise<Compromisso> {
  const client = db();
  const ownerId = await currentUserId();
  const process = input.numero ? await processByNumber(ownerId, input.numero) : null;
  const { data, error } = await client.from('calendar_appointments').insert({
    owner_id: ownerId,
    process_id: process?.id ?? null,
    title: input.titulo.trim(),
    scheduled_date: sqlDate(input.data),
    scheduled_time: input.hora || null,
    location: input.local.trim() || 'A definir',
    responsible: input.responsavel.trim(),
    observations: input.observacoes?.trim() ?? '',
  }).select('id, process_id, title, scheduled_date, scheduled_time, location, responsible, status, observations').single();
  if (error) throw error;
  const row = data as unknown as AppointmentRow;
  return {
    id: row.id,
    titulo: row.title,
    data: displayDateTime(row.scheduled_date, row.scheduled_time),
    local: row.location,
    responsavel: row.responsible,
    numero: process?.case_number,
    observacoes: row.observations || undefined,
    status: row.status as StatusTone,
  };
}

export async function setProcessHearingStatus(id: string, status: 'realizada' | 'cancelada'): Promise<void> {
  const client = db();
  const ownerId = await currentUserId();
  const { data, error } = await client.from('process_hearings').update({ status })
    .eq('owner_id', ownerId).eq('id', id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Audiência não encontrada nesta conta.');
}

export async function setCalendarAppointmentStatus(id: string, status: 'concluido' | 'cancelada'): Promise<void> {
  const client = db();
  const ownerId = await currentUserId();
  const { data, error } = await client.from('calendar_appointments').update({ status })
    .eq('owner_id', ownerId).eq('id', id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Compromisso não encontrado nesta conta.');
}
