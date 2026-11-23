import type { Cliente, Compromisso, Processo, Tarefa } from '../data';
import { listClients } from './clients';
import { listDocuments } from './documents';
import { listProcesses } from './processes';
import { listCalendarAppointments, listProcessTasks } from './schedule';
import { loadUserSettings, type UserSettings } from './user-settings';
import { listOrganizationLawyers } from './organizations';
export type WorkspaceSnapshot = {
  clientes: Cliente[];
  processos: Processo[];
  tarefas: Tarefa[];
  compromissos: Compromisso[];
  settings: UserSettings | null;
  advogadosOrganizacao: Awaited<ReturnType<typeof listOrganizationLawyers>>;
};

export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  const [clientes, processos] = await Promise.all([listClients(), listProcesses()]);
  const [tarefas, compromissos, documentos, settings, advogadosOrganizacao] = await Promise.all([
    listProcessTasks(processos),
    listCalendarAppointments(processos),
    listDocuments(),
    loadUserSettings(),
    listOrganizationLawyers(),
  ]);
  const documentsByCase = new Map<string, typeof documentos>();
  for (const documento of documentos) {
    const current = documentsByCase.get(documento.numero) ?? [];
    current.push(documento);
    documentsByCase.set(documento.numero, current);
  }
  const processosComDocumentos = processos.map((processo) => ({
    ...processo,
    documentos: documentsByCase.get(processo.numero) ?? [],
  }));
  return { clientes, processos: processosComDocumentos, tarefas, compromissos, settings, advogadosOrganizacao };
}
