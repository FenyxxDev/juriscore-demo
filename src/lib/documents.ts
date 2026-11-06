import type { Documento } from '../data';
import { supabase } from './supabase';

const BUCKET = 'juriscore-documents';
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
};
const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

type ProcessRow = { id: string; case_number: string; client_id: string };
type ClientRow = { id: string; name: string };
type DocumentRow = {
  id: string;
  process_id: string;
  object_path: string;
  file_name: string;
  document_type: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type StoredDocument = Documento & {
  numero: string;
  cliente: string;
  processId: string;
  mimeType: string;
  sizeBytes: number;
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

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function getSafeMimeType(file: File) {
  const mimeType = file.type || MIME_BY_EXTENSION[extensionOf(file.name)] || '';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Formato não permitido. Use PDF, PNG, JPEG, Word, Excel ou TXT.');
  }
  return mimeType;
}

function safeFileName(fileName: string) {
  const normalized = fileName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'documento';
}

function mapRow(
  row: DocumentRow,
  process: ProcessRow | undefined,
  clientName: string,
): StoredDocument {
  return {
    id: row.id,
    nome: row.file_name,
    tipo: row.document_type,
    data: formatDate(row.created_at),
    tamanho: formatSize(Number(row.size_bytes)),
    numero: process?.case_number ?? 'Processo indisponível',
    cliente: clientName,
    processId: row.process_id,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
  };
}

async function loadDocuments(processId?: string): Promise<StoredDocument[]> {
  const client = db();
  const user = await getCurrentUser();
  let documentQuery = client
    .from('process_documents')
    .select('id, process_id, object_path, file_name, document_type, mime_type, size_bytes, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (processId) documentQuery = documentQuery.eq('process_id', processId);
  const { data: documentData, error: documentError } = await documentQuery;
  if (documentError) throw documentError;
  const documentRows = (documentData ?? []) as unknown as DocumentRow[];
  if (documentRows.length === 0) return [];

  const processIds = [...new Set(documentRows.map((row) => row.process_id))];
  const { data: processData, error: processError } = await client
    .from('processes')
    .select('id, case_number, client_id')
    .eq('owner_id', user.id)
    .in('id', processIds);
  if (processError) throw processError;
  const processRows = (processData ?? []) as unknown as ProcessRow[];
  const clientIds = [...new Set(processRows.map((row) => row.client_id))];
  const { data: clientData, error: clientError } = clientIds.length
    ? await client.from('clients').select('id, name').eq('owner_id', user.id).in('id', clientIds)
    : { data: [], error: null };
  if (clientError) throw clientError;

  const processesById = new Map(processRows.map((row) => [row.id, row]));
  const clientsById = new Map(((clientData ?? []) as unknown as ClientRow[]).map((row) => [row.id, row.name]));
  return documentRows.map((row) => {
    const process = processesById.get(row.process_id);
    return mapRow(row, process, process ? clientsById.get(process.client_id) ?? 'Cliente indisponível' : 'Cliente indisponível');
  });
}

export function listDocuments(): Promise<StoredDocument[]> {
  return loadDocuments();
}

export async function listDocumentsForCase(caseNumber: string): Promise<Documento[]> {
  const client = db();
  const user = await getCurrentUser();
  const { data: process, error } = await client
    .from('processes')
    .select('id')
    .eq('owner_id', user.id)
    .eq('case_number', caseNumber)
    .maybeSingle();
  if (error) throw error;
  if (!process) return [];
  const documents = await loadDocuments(process.id);
  return documents.map(({ numero: _numero, cliente: _cliente, processId: _processId, mimeType: _mimeType, sizeBytes: _sizeBytes, ...document }) => document);
}

export async function uploadDocument(input: {
  caseNumber: string;
  file: File;
  documentType: string;
}): Promise<StoredDocument> {
  const client = db();
  const user = await getCurrentUser();
  const { file } = input;
  if (!file || file.size < 1) throw new Error('Selecione um ficheiro válido.');
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error('O ficheiro excede o limite de 25 MiB.');
  if (!input.documentType.trim()) throw new Error('Selecione o tipo de documento.');
  const mimeType = getSafeMimeType(file);

  const { data: process, error: processError } = await client
    .from('processes')
    .select('id, case_number, client_id')
    .eq('owner_id', user.id)
    .eq('case_number', input.caseNumber)
    .maybeSingle();
  if (processError) throw processError;
  if (!process) throw new Error('Processo não encontrado nesta conta.');

  const { data: clientRow, error: clientError } = await client
    .from('clients')
    .select('id, name')
    .eq('owner_id', user.id)
    .eq('id', process.client_id)
    .maybeSingle();
  if (clientError) throw clientError;

  const objectPath = `${user.id}/${process.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(objectPath, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: documentData, error: insertError } = await client
    .from('process_documents')
    .insert({
      owner_id: user.id,
      process_id: process.id,
      object_path: objectPath,
      file_name: file.name.slice(0, 255),
      document_type: input.documentType.trim(),
      mime_type: mimeType,
      size_bytes: file.size,
    })
    .select('id, process_id, object_path, file_name, document_type, mime_type, size_bytes, created_at')
    .single();

  if (insertError) {
    const { error: cleanupError } = await client.storage.from(BUCKET).remove([objectPath]);
    if (cleanupError) {
      throw new Error(`O upload foi feito, mas não foi possível registar os metadados nem limpar o objeto privado: ${insertError.message}.`);
    }
    throw insertError;
  }

  return mapRow(
    documentData as unknown as DocumentRow,
    process as unknown as ProcessRow,
    clientRow?.name ?? 'Cliente indisponível',
  );
}

export async function downloadDocument(documentId: string): Promise<void> {
  const client = db();
  const user = await getCurrentUser();
  const { data: row, error: rowError } = await client
    .from('process_documents')
    .select('object_path, file_name')
    .eq('owner_id', user.id)
    .eq('id', documentId)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row) throw new Error('Documento não encontrado nesta conta.');

  const { data: blob, error: downloadError } = await client.storage.from(BUCKET).download(row.object_path);
  if (downloadError) throw downloadError;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = row.file_name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
