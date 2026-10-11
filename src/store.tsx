import { type ReactNode, createContext, useContext, useMemo, useReducer } from 'react';
import type { StatusTone } from './components/ui';
import {
  type Advogado,
  type Audiencia,
  type Cliente,
  type Compromisso,
  type Documento,
  type Movimentacao,
  type Parte,
  type Perfil,
  type Prazo,
  type Processo,
  type Tarefa,
  advogadosSeed,
  clientesSeed,
  compromissosSeed,
  diasAte,
  processosSeed,
  rel,
  tarefasSeed,
  toneOf,
} from './data';

const hoje = () =>
  new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export type DocRef = Documento & { numero: string; cliente: string };
export type EventoRef =
  | (Prazo & { kind: 'prazo'; numero: string; cliente: string })
  | (Audiencia & { kind: 'audiencia'; numero: string; cliente: string; prioridade?: undefined });

export type NotifCategoria =
  | 'prazos-proximos'
  | 'prazos-atrasados'
  | 'audiencias'
  | 'processos'
  | 'documentos'
  | 'tarefas';

export const NOTIF_CATEGORIAS: { id: NotifCategoria; label: string }[] = [
  { id: 'prazos-proximos', label: 'Prazos próximos' },
  { id: 'prazos-atrasados', label: 'Prazos atrasados' },
  { id: 'audiencias', label: 'Audiências próximas' },
  { id: 'processos', label: 'Processos atualizados' },
  { id: 'documentos', label: 'Documentos adicionados' },
  { id: 'tarefas', label: 'Tarefas atribuídas' },
];

export type Notificacao = {
  id: string;
  categoria: NotifCategoria;
  titulo: string;
  texto: string;
  to: string;
  data: string;
  /** menor = mais urgente */
  peso: number;
  lida: boolean;
};

export type Sessao = { id: string; dispositivo: string; local: string; inicio: string; atual?: boolean };

export type Preferencias = {
  iaAtiva: boolean;
  agendaVisao: 'dia' | 'semana' | 'mes';
  canalEmail: boolean;
  canalApp: boolean;
  resumoDiario: boolean;
  antecedenciaPrazo: number;
  distribuicao: 'area' | 'carga' | 'manual';
  escritorio: { nome: string; cnpj: string; cidade: string; email: string };
};

/** Ações sensíveis controladas por perfil. */
export type Permissao =
  | 'gerenciarUsuarios'
  | 'verTodosProcessos'
  | 'cadastrarProcesso'
  | 'editarProcesso'
  | 'encerrarProcesso'
  | 'cadastrarCliente'
  | 'registrarMovimentacao'
  | 'gerenciarPrazos'
  | 'anexarDocumentos'
  | 'agendarAudiencia'
  | 'distribuirTarefas';

export const PERMISSOES: { id: Permissao; label: string; perfis: Perfil[] }[] = [
  { id: 'gerenciarUsuarios', label: 'Gerenciar usuários e perfis', perfis: ['Administrador'] },
  { id: 'verTodosProcessos', label: 'Visualizar todos os processos do escritório', perfis: ['Administrador'] },
  { id: 'distribuirTarefas', label: 'Distribuir tarefas para a equipe', perfis: ['Administrador', 'Advogado'] },
  { id: 'cadastrarProcesso', label: 'Cadastrar processos', perfis: ['Administrador', 'Advogado', 'Assistente'] },
  { id: 'editarProcesso', label: 'Editar dados do processo', perfis: ['Administrador', 'Advogado'] },
  { id: 'encerrarProcesso', label: 'Encerrar e arquivar processos', perfis: ['Administrador', 'Advogado'] },
  { id: 'registrarMovimentacao', label: 'Registrar movimentações', perfis: ['Administrador', 'Advogado', 'Assistente'] },
  { id: 'gerenciarPrazos', label: 'Cadastrar e concluir prazos', perfis: ['Administrador', 'Advogado', 'Assistente'] },
  { id: 'agendarAudiencia', label: 'Agendar audiências e compromissos', perfis: ['Administrador', 'Advogado', 'Assistente'] },
  { id: 'anexarDocumentos', label: 'Anexar documentos', perfis: ['Administrador', 'Advogado', 'Assistente'] },
  { id: 'cadastrarCliente', label: 'Cadastrar clientes', perfis: ['Administrador', 'Advogado', 'Assistente'] },
];

type State = {
  session: { userId: string; lembrar: boolean } | null;
  clientes: Cliente[];
  advogados: Advogado[];
  processos: Processo[];
  tarefas: Tarefa[];
  compromissos: Compromisso[];
  lidas: string[];
  notifPrefs: Record<NotifCategoria, boolean>;
  prefs: Preferencias;
  sessoes: Sessao[];
};

type Action =
  | { type: 'login'; userId: string; lembrar: boolean }
  | { type: 'logout' }
  | { type: 'register'; usuario: Advogado }
  | { type: 'updateUsuario'; id: string; patch: Partial<Omit<Advogado, 'id'>> }
  | { type: 'endSessions' }
  | { type: 'markRead'; id: string }
  | { type: 'markAllRead'; ids: string[] }
  | { type: 'setNotifPref'; categoria: NotifCategoria; on: boolean }
  | { type: 'setPrefs'; patch: Partial<Preferencias> }
  | { type: 'addCompromisso'; compromisso: Omit<Compromisso, 'id' | 'status'> }
  | { type: 'setCompromissoStatus'; id: string; status: StatusTone }
  | { type: 'addCliente'; cliente: Omit<Cliente, 'id' | 'atualizacao' | 'status'> }
  | { type: 'addAdvogado'; advogado: Omit<Advogado, 'id' | 'ativo' | 'senha' | 'ultimaAtividade'> & { ativo?: boolean } }
  | { type: 'toggleUsuario'; id: string }
  | { type: 'addTarefa'; tarefa: Omit<Tarefa, 'id' | 'status'> & { status?: Tarefa['status'] } }
  | { type: 'toggleTarefa'; id: string }
  | {
      type: 'addProcesso';
      processo: Omit<
        Processo,
        'atualizacao' | 'criadoEm' | 'arquivado' | 'status' | 'movimentacoes' | 'observacoes'
      > & { status?: StatusTone; observacoes?: string };
    }
  | { type: 'addParte'; numero: string; parte: Omit<Parte, 'id'> }
  | { type: 'addDocumento'; numero: string; documento: Omit<Documento, 'id' | 'data' | 'tamanho'> & { tamanho?: string } }
  | { type: 'addMovimentacao'; numero: string; mov: Omit<Movimentacao, 'id' | 'data' | 'autor'> }
  | { type: 'addPrazo'; numero: string; prazo: Omit<Prazo, 'id' | 'status'> }
  | { type: 'setPrazoStatus'; numero: string; prazoId: string; status: StatusTone }
  | { type: 'addAudiencia'; numero: string; audiencia: Omit<Audiencia, 'id' | 'status'> }
  | { type: 'updateStatus'; numero: string; status: StatusTone; arquivado?: boolean; nota: string }
  | { type: 'updateProcesso'; numero: string; patch: Partial<Pick<Processo, 'responsavel' | 'area' | 'vara' | 'comarca' | 'tribunal' | 'resumo' | 'observacoes'>> };

const agora = () =>
  new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
  ' · ' +
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

const touch = (p: Processo): Processo => ({ ...p, atualizacao: hoje() });

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'login':
      return {
        ...state,
        session: { userId: action.userId, lembrar: action.lembrar },
        advogados: state.advogados.map((a) => (a.id === action.userId ? { ...a, ultimaAtividade: agora() } : a)),
      };
    case 'logout':
      return { ...state, session: null };
    case 'register':
      return { ...state, advogados: [...state.advogados, action.usuario] };
    case 'updateUsuario':
      return { ...state, advogados: state.advogados.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)) };
    case 'endSessions':
      return { ...state, sessoes: state.sessoes.filter((x) => x.atual) };
    case 'markRead':
      return state.lidas.includes(action.id) ? state : { ...state, lidas: [...state.lidas, action.id] };
    case 'markAllRead':
      return { ...state, lidas: [...new Set([...state.lidas, ...action.ids])] };
    case 'setNotifPref':
      return { ...state, notifPrefs: { ...state.notifPrefs, [action.categoria]: action.on } };
    case 'setPrefs':
      return { ...state, prefs: { ...state.prefs, ...action.patch } };
    case 'addCompromisso':
      return { ...state, compromissos: [{ ...action.compromisso, id: uid('cp'), status: 'confirmada' }, ...state.compromissos] };
    case 'setCompromissoStatus':
      return { ...state, compromissos: state.compromissos.map((c) => (c.id === action.id ? { ...c, status: action.status } : c)) };
    case 'toggleUsuario':
      return { ...state, advogados: state.advogados.map((a) => (a.id === action.id ? { ...a, ativo: !a.ativo } : a)) };
    case 'addTarefa':
      return {
        ...state,
        tarefas: [{ ...action.tarefa, id: uid('tk'), status: action.tarefa.status ?? 'pendente' }, ...state.tarefas],
      };
    case 'toggleTarefa':
      return {
        ...state,
        tarefas: state.tarefas.map((t) =>
          t.id === action.id ? { ...t, status: t.status === 'concluido' ? 'pendente' : 'concluido' } : t,
        ),
      };
    case 'addCliente':
      return {
        ...state,
        clientes: [
          { ...action.cliente, id: uid('cli'), atualizacao: hoje(), status: 'ativo' },
          ...state.clientes,
        ],
      };
    case 'addAdvogado':
      return {
        ...state,
        advogados: [
          ...state.advogados,
          { ...action.advogado, ativo: action.advogado.ativo ?? true, id: uid('adv'), senha: 'juriscore', ultimaAtividade: 'Convite enviado' },
        ],
      };
    case 'addProcesso':
      return {
        ...state,
        processos: [
          {
            ...action.processo,
            status: action.processo.status ?? 'em-andamento',
            observacoes: action.processo.observacoes ?? '',
            arquivado: false,
            atualizacao: hoje(),
            criadoEm: hoje(),
            movimentacoes: [
              { id: uid('m'), data: hoje(), tipo: 'Cadastro', descricao: 'Processo cadastrado no JurisCore.', autor: 'Você' },
            ],
          },
          ...state.processos,
        ],
      };
    case 'addParte':
      return mut(state, action.numero, (p) => ({ ...p, partes: [...p.partes, { ...action.parte, id: uid('p') }] }));
    case 'addDocumento':
      return mut(state, action.numero, (p) => ({
        ...p,
        documentos: [{ tamanho: '-', ...action.documento, id: uid('d'), data: hoje() }, ...p.documentos],
        movimentacoes: [
          { id: uid('m'), data: hoje(), tipo: 'Juntada de documento', descricao: `Documento "${action.documento.nome}" anexado aos autos.`, autor: 'Você' },
          ...p.movimentacoes,
        ],
      }));
    case 'addMovimentacao':
      return mut(state, action.numero, (p) => ({
        ...p,
        movimentacoes: [{ ...action.mov, id: uid('m'), data: hoje(), autor: 'Você' }, ...p.movimentacoes],
      }));
    case 'addPrazo':
      return mut(state, action.numero, (p) => ({
        ...p,
        prazos: [...p.prazos, { ...action.prazo, tone: toneOf(action.prazo.data), id: uid('pr'), status: 'pendente' }],
      }));
    case 'setPrazoStatus':
      return mut(state, action.numero, (p) => ({
        ...p,
        prazos: p.prazos.map((pr) =>
          pr.id === action.prazoId
            ? { ...pr, status: action.status, tone: action.status === 'concluido' ? 'futuro' : pr.tone }
            : pr,
        ),
      }));
    case 'addAudiencia':
      return mut(state, action.numero, (p) => ({
        ...p,
        audiencias: [...p.audiencias, { ...action.audiencia, id: uid('au'), status: 'confirmada' }],
        movimentacoes: [
          { id: uid('m'), data: hoje(), tipo: 'Audiência agendada', descricao: `${action.audiencia.tipo} marcada para ${action.audiencia.data} (${action.audiencia.modalidade}).`, autor: 'Você' },
          ...p.movimentacoes,
        ],
      }));
    case 'updateProcesso':
      return mut(state, action.numero, (p) => ({
        ...p,
        ...action.patch,
        atualizacao: hoje(),
        movimentacoes: [{ id: uid('m'), data: hoje(), tipo: 'Dados atualizados', descricao: 'Informações cadastrais do processo foram editadas.', autor: 'Você' }, ...p.movimentacoes],
      }));
    case 'updateStatus':
      return mut(state, action.numero, (p) => ({
        ...p,
        status: action.status,
        arquivado: action.arquivado ?? p.arquivado,
        movimentacoes: [
          { id: uid('m'), data: hoje(), tipo: 'Atualização', descricao: action.nota, autor: 'Você' },
          ...p.movimentacoes,
        ],
      }));
    default:
      return state;
  }
}

function mut(state: State, numero: string, fn: (p: Processo) => Processo): State {
  return { ...state, processos: state.processos.map((p) => (p.numero === numero ? touch(fn(p)) : p)) };
}

export type Atividade = {
  id: string;
  numero: string;
  cliente: string;
  tipo: string;
  descricao: string;
  autor: string;
  data: string;
};

export const procLink = (numero: string, tab?: string, item?: string) =>
  `/processos/${encodeURIComponent(numero)}${tab ? `?tab=${encodeURIComponent(tab)}${item ? `&item=${item}` : ''}` : ''}`;
const shortNum = (n: string) => n.split('-')[0];

type StoreValue = State & {
  authed: boolean;
  role: Perfil;
  user: Advogado & { name: string; role: Perfil };
  can: (p: Permissao) => boolean;
  /** Todos os processos do escritório, sem recorte por perfil (uso administrativo). */
  todosProcessos: Processo[];
  notificacoes: Notificacao[];
  naoLidas: number;
  dispatch: React.Dispatch<Action>;
  stats: {
    ativos: number;
    prazosHoje: number;
    prazosAtrasados: number;
    audienciasSemana: number;
    tarefasPendentes: number;
    porStatus: { tone: StatusTone; label: string; n: number }[];
    porResponsavel: { nome: string; n: number }[];
    porArea: { nome: string; n: number }[];
  };
  prioridades: (Prazo & { numero: string; cliente: string })[];
  documentos: DocRef[];
  eventos: EventoRef[];
  atividades: Atividade[];
};

const StoreCtx = createContext<StoreValue | null>(null);
const rank = (t: string) => (t === 'atrasado' ? 0 : t === 'hoje' ? 1 : 2);
/** "DD/MM/YYYY[ · HH...]" -> comparable timestamp for recency sorting. */
export const toStamp = (s: string) => {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0;
};

const STATUS_LABELS: { tone: StatusTone; label: string }[] = [
  { tone: 'em-andamento', label: 'Em andamento' },
  { tone: 'aguardando', label: 'Aguardando ação' },
  { tone: 'atrasado', label: 'Atrasado' },
  { tone: 'encerrado', label: 'Encerrado' },
];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    session: null,
    clientes: clientesSeed,
    advogados: advogadosSeed,
    processos: processosSeed,
    tarefas: tarefasSeed,
    compromissos: compromissosSeed,
    lidas: [],
    notifPrefs: { 'prazos-proximos': true, 'prazos-atrasados': true, audiencias: true, processos: true, documentos: true, tarefas: true },
    prefs: { iaAtiva: true, agendaVisao: 'semana', canalEmail: true, canalApp: true, resumoDiario: false, antecedenciaPrazo: 3, distribuicao: 'area', escritorio: { nome: 'Silva & Costa Advogados Associados', cnpj: '12.345.678/0001-90', cidade: 'Recife, PE', email: 'contato@silvacosta.adv.br' } },
    sessoes: [
      { id: 's1', dispositivo: 'Chrome · macOS', local: 'Recife, PE', inicio: 'Agora', atual: true },
      { id: 's2', dispositivo: 'Safari · iPhone', local: 'Recife, PE', inicio: rel(-1, '19h22') },
      { id: 's3', dispositivo: 'Edge · Windows', local: 'Olinda, PE', inicio: rel(-3, '08h05') },
    ],
  });

  const value = useMemo<StoreValue>(() => {
    const conta = state.advogados.find((a) => a.id === state.session?.userId) ?? state.advogados[0];
    const role = conta.perfil;
    const user = { ...conta, name: conta.nome, role };
    const can = (p: Permissao) => !!PERMISSOES.find((x) => x.id === p)?.perfis.includes(role);

    // Recorte por perfil: mesma plataforma, acesso diferente.
    const processos = state.processos.filter((p) =>
      role === 'Administrador'
        ? true
        : role === 'Advogado'
          ? p.responsavel === conta.nome
          : p.responsavel === conta.equipe || conta.areas.includes(p.area),
    );
    const nums = new Set(processos.map((p) => p.numero));
    const clienteIds = new Set(processos.map((p) => p.clienteId));
    const clientes = role === 'Administrador' ? state.clientes : state.clientes.filter((c) => clienteIds.has(c.id) || !state.processos.some((p) => p.clienteId === c.id));
    const tarefas = role === 'Administrador' ? state.tarefas : state.tarefas.filter((t) => nums.has(t.numero) || t.responsavel === conta.nome);

    const ativos = processos.filter((p) => !p.arquivado && p.status !== 'encerrado');
    const pendentes = (pr: Prazo) => pr.status === 'pendente' || pr.status === 'atrasado' || pr.status === 'em-andamento';
    const withTone = (pr: Prazo): Prazo => ({ ...pr, tone: pr.status === 'concluido' ? 'futuro' : toneOf(pr.data) });
    const allPrazos = ativos.flatMap((p) =>
      p.prazos.filter(pendentes).map((pr) => ({ ...withTone(pr), numero: p.numero, cliente: p.cliente })),
    );
    const documentos: DocRef[] = processos
      .flatMap((p) => p.documentos.map((d) => ({ ...d, numero: p.numero, cliente: p.cliente })))
      .sort((a, b) => toStamp(b.data) - toStamp(a.data));
    const eventos: EventoRef[] = [
      ...ativos.flatMap((p) => p.prazos.map((pr) => ({ ...withTone(pr), kind: 'prazo' as const, numero: p.numero, cliente: p.cliente }))),
      ...ativos.flatMap((p) => p.audiencias.map((au) => ({ ...au, kind: 'audiencia' as const, numero: p.numero, cliente: p.cliente }))),
    ];
    const atividades: Atividade[] = processos
      .flatMap((p) => p.movimentacoes.map((m) => ({ ...m, numero: p.numero, cliente: p.cliente })))
      .sort((a, b) => toStamp(b.data) - toStamp(a.data));

    // Notificações derivadas dos registros autorizados
    const raw: Omit<Notificacao, 'lida'>[] = [];
    for (const pr of allPrazos) {
      const n = diasAte(pr.data);
      if (n < 0)
        raw.push({ id: `pa-${pr.id}`, categoria: 'prazos-atrasados', peso: 0, titulo: 'Prazo atrasado', texto: `Prazo do processo ${shortNum(pr.numero)} venceu em ${pr.data}: ${pr.descricao}.`, to: procLink(pr.numero, 'Prazos', pr.id), data: pr.data });
      else if (n <= state.prefs.antecedenciaPrazo)
        raw.push({ id: `pp-${pr.id}`, categoria: 'prazos-proximos', peso: 1 + n, titulo: 'Prazo próximo', texto: `Prazo do processo ${shortNum(pr.numero)} vence ${n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`}: ${pr.descricao}.`, to: procLink(pr.numero, 'Prazos', pr.id), data: pr.data });
    }
    for (const p of ativos)
      for (const au of p.audiencias) {
        const n = diasAte(au.data);
        if (n >= 0 && n <= 14 && au.status !== 'cancelada')
          raw.push({ id: `au-${au.id}`, categoria: 'audiencias', peso: 3 + n, titulo: 'Audiência próxima', texto: `${au.tipo} do processo ${shortNum(p.numero)} em ${au.data} (${au.modalidade}).`, to: procLink(p.numero, 'Audiências', au.id), data: au.data });
      }
    for (const a of atividades.slice(0, 12)) {
      const n = diasAte(a.data);
      if (n < -5 || a.autor === 'Você' || a.autor === conta.nome) continue;
      const isDoc = /juntada|documento/i.test(a.tipo);
      raw.push({ id: `mv-${a.id}`, categoria: isDoc ? 'documentos' : 'processos', peso: 20 - n, titulo: isDoc ? 'Documento adicionado' : 'Processo atualizado', texto: `${a.tipo} no processo ${shortNum(a.numero)} (${a.cliente}): ${a.descricao}`, to: procLink(a.numero, 'Timeline', a.id), data: a.data });
    }
    for (const d of documentos.slice(0, 8)) {
      if (diasAte(d.data) < -7 || d.autor === conta.nome) continue;
      raw.push({ id: `dc-${d.id}`, categoria: 'documentos', peso: 25, titulo: 'Documento adicionado', texto: `"${d.nome}" foi anexado ao processo ${shortNum(d.numero)}.`, to: procLink(d.numero, 'Documentos', d.id), data: d.data });
    }
    for (const t of state.tarefas)
      if (t.responsavel === conta.nome && t.status !== 'concluido')
        raw.push({ id: `tk-${t.id}`, categoria: 'tarefas', peso: 10, titulo: 'Tarefa atribuída', texto: `${t.titulo} (${t.cliente}), prevista para ${t.data}.`, to: '/tarefas', data: t.data });

    const notificacoes = raw
      .filter((n) => state.notifPrefs[n.categoria])
      .map((n) => ({ ...n, lida: state.lidas.includes(n.id) }))
      .sort((a, b) => Number(a.lida) - Number(b.lida) || a.peso - b.peso);

    const areaCount = new Map<string, number>();
    ativos.forEach((p) => areaCount.set(p.area, (areaCount.get(p.area) ?? 0) + 1));

    return {
      ...state,
      authed: !!state.session,
      role,
      user,
      can,
      processos,
      clientes,
      tarefas,
      todosProcessos: state.processos,
      notificacoes,
      naoLidas: notificacoes.filter((n) => !n.lida).length,
      dispatch,
      stats: {
        ativos: ativos.length,
        prazosHoje: allPrazos.filter((p) => p.tone === 'hoje').length,
        prazosAtrasados: allPrazos.filter((p) => p.tone === 'atrasado').length,
        audienciasSemana: eventos.filter((e) => e.kind === 'audiencia' && diasAte(e.data) >= 0 && diasAte(e.data) <= 7).length,
        tarefasPendentes: tarefas.filter((t) => t.status !== 'concluido').length,
        porStatus: STATUS_LABELS.map((s) => ({
          ...s,
          n: processos.filter((p) => p.status === s.tone).length,
        })),
        porResponsavel: state.advogados
          .filter((a) => a.perfil === 'Advogado')
          .map((a) => ({ nome: a.nome, n: ativos.filter((p) => p.responsavel === a.nome).length }))
          .filter((r) => r.n > 0)
          .sort((a, b) => b.n - a.n),
        porArea: [...areaCount.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
      },
      prioridades: allPrazos.sort((a, b) => rank(a.tone) - rank(b.tone) || toStamp(a.data) - toStamp(b.data)),
      documentos,
      eventos,
      atividades,
    };
  }, [state]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('useStore must be used within StoreProvider');
  return v;
}
