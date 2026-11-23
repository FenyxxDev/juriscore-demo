import type { StatusTone } from './components/ui';

export type Perfil = 'Administrador' | 'Advogado' | 'Assistente';

export const PERFIS: Perfil[] = ['Administrador', 'Advogado', 'Assistente'];

/** Áreas jurídicas usadas em cadastro, processos, filtros e distribuição. */
export const AREAS = [
  'Direito Penal',
  'Direito Trabalhista',
  'Direito Empresarial',
  'Direito Civil',
  'Direito Previdenciário',
  'Direito de Família',
  'Direito Tributário',
  'Direito do Consumidor',
  'Direito Imobiliário',
  'Direito Administrativo',
  'Direito Constitucional',
  'Direito Ambiental',
  'Direito Digital',
  'Outras áreas',
] as const;

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

/** Short label: "Direito Trabalhista" -> "Trabalhista". */
export const areaCurta = (a: string) => a.replace(/^Direito (d[oae]s? )?/, '');

/* ------------------------------------------------------------ datas */

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtData = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
/** Formata uma data relativa a hoje no padrão DD/MM/AAAA, opcionalmente com hora. */
export const rel = (dias: number, hora?: string) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return hora ? `${fmtData(d)} · ${hora}` : fmtData(d);
};
export function parseData(s: string): Date | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}
export const hojeZero = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
/** Dias entre hoje e a data (negativo = passado). */
export const diasAte = (s: string) => {
  const d = parseData(s);
  return d ? Math.round((d.getTime() - hojeZero().getTime()) / 86400000) : 0;
};
export const toneOf = (s: string): PrazoTone => {
  const n = diasAte(s);
  return n < 0 ? 'atrasado' : n === 0 ? 'hoje' : 'futuro';
};

export type PrazoTone = 'atrasado' | 'hoje' | 'futuro';
export type Prioridade = 'alta' | 'média' | 'baixa';

export type Advogado = {
  id: string;
  nome: string;
  email: string;
  senha: string;
  telefone: string;
  perfil: Perfil;
  ativo: boolean;
  /** Advogado */
  oab: string;
  oabUf?: string;
  especialidade?: string;
  anosExperiencia?: number;
  /** Advogado e Assistente: áreas acompanhadas */
  areas: string[];
  /** Assistente */
  equipe?: string;
  /** Administrador */
  cargo?: string;
  escritorio?: string;
  ultimaAtividade: string;
};

/** Alias semântico: toda conta do sistema é um membro da equipe. */
export type Usuario = Advogado;

/** Perfil profissional visível apenas aos membros aceites da mesma organização. */
export type OrganizationLawyer = {
  id: string;
  organizationId: string;
  organizationName: string;
  nome: string;
  email: string;
  oab: string;
  areas: string[];
  ativo: boolean;
};

export type Compromisso = {
  id: string;
  titulo: string;
  data: string;
  local: string;
  responsavel: string;
  numero?: string;
  observacoes?: string;
  status: StatusTone;
};

export type Tarefa = {
  id: string;
  titulo: string;
  numero: string;
  cliente: string;
  responsavel: string;
  prioridade: Prioridade;
  status: 'pendente' | 'concluido' | 'atrasado';
  data: string;
};

export type Cliente = {
  id: string;
  nome: string;
  tipo: 'Pessoa Física' | 'Pessoa Jurídica';
  documento: string;
  atualizacao: string;
  status: StatusTone;
};

export type Movimentacao = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  autor: string;
  origem?: 'manual' | 'datajud';
};

export type Documento = {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  tamanho: string;
  /** Texto extraído do documento, quando disponível. A IA trabalha somente sobre ele. */
  conteudo?: string;
  autor?: string;
};

export type Parte = { id: string; nome: string; papel: string; doc: string; rep: string };

export type Prazo = {
  id: string;
  descricao: string;
  data: string;
  tone: PrazoTone;
  responsavel: string;
  prioridade: Prioridade;
  status: StatusTone;
};

export type Modalidade = 'Presencial' | 'Online' | 'Híbrida';

export type Audiencia = {
  id: string;
  tipo: string;
  data: string;
  local: string;
  modalidade: Modalidade;
  status: StatusTone;
  participantes?: string;
  responsavel?: string;
  observacoes?: string;
};

export type Processo = {
  id?: string;
  numero: string;
  clienteId: string;
  cliente: string;
  responsavel: string;
  area: string;
  status: StatusTone;
  arquivado: boolean;
  tribunal: string;
  comarca: string;
  vara: string;
  atualizacao: string;
  criadoEm: string;
  resumo: string;
  observacoes: string;
  partes: Parte[];
  documentos: Documento[];
  movimentacoes: Movimentacao[];
  prazos: Prazo[];
  audiencias: Audiencia[];
};
