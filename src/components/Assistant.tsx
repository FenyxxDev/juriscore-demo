import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { Modal, cx } from './ui';
import { type AIResult, useAI } from '../ai';
import type { Processo } from '../data';
import { useStore } from '../store';
import { askGemini, type GeminiContext } from '../lib/gemini';
import { AIFailed, AIResultView, AIWorking, GeminiAnswer } from './AIResult';

const AssistantCtx = createContext<{ open: (seed?: string) => void; ask: (q: string) => void }>({ open: () => {}, ask: () => {} });
export const useAssistant = () => useContext(AssistantCtx);

type Pending = { from: 'user'; text: string };
type AssistantMode = 'local' | 'gemini';
type Answered =
  | { from: 'ia'; mode: 'local'; result: AIResult; at: string }
  | { from: 'ia'; mode: 'gemini'; answer: string; at: string };
type Working = { from: 'working'; mode: AssistantMode };
type Failed = { from: 'error'; mode: AssistantMode; retry: () => void; message?: string };
type Msg = Pending | Answered | Working | Failed;
type GeminiSelections = {
  basics: boolean;
  identity: boolean;
  internalNotes: boolean;
  movements: boolean;
  deadlines: boolean;
  hearings: boolean;
  parties: boolean;
  documents: string[];
};
type GeminiReview = { question: string; process?: Processo };
const DEFAULT_GEMINI_SELECTIONS: GeminiSelections = {
  basics: true,
  identity: false,
  internalNotes: false,
  movements: true,
  deadlines: true,
  hearings: true,
  parties: false,
  documents: [],
};

function buildGeminiContext(process: Processo | undefined, selections: GeminiSelections): GeminiContext | undefined {
  if (!process) return undefined;
  const context: GeminiContext = {};
  const processData: NonNullable<GeminiContext['process']> = {};
  if (selections.identity) {
    processData.number = process.numero;
    processData.clientName = process.cliente;
  }
  if (selections.basics) {
    processData.area = process.area;
    processData.status = process.status;
    processData.tribunal = process.tribunal;
    processData.comarca = process.comarca;
    processData.vara = process.vara;
    processData.summary = process.resumo.slice(0, 6_000);
  }
  if (selections.internalNotes && process.observacoes) processData.internalNotes = process.observacoes.slice(0, 6_000);
  if (Object.keys(processData).length) context.process = processData;
  if (selections.movements) {
    context.movements = process.movimentacoes.slice(0, 20).map((movement) => ({
      date: movement.data,
      type: movement.tipo,
      description: movement.descricao.slice(0, 1_000),
    }));
  }
  if (selections.deadlines) {
    context.deadlines = process.prazos.slice(0, 20).map((deadline) => ({
      description: deadline.descricao,
      date: deadline.data,
      status: deadline.status,
      priority: deadline.prioridade,
    }));
  }
  if (selections.hearings) {
    context.hearings = process.audiencias.slice(0, 15).map((hearing) => ({
      type: hearing.tipo,
      date: hearing.data,
      status: hearing.status,
      modality: hearing.modalidade,
      location: hearing.local,
    }));
  }
  if (selections.parties) {
    context.parties = process.partes.slice(0, 15).map((party) => ({
      name: party.nome,
      role: party.papel,
      representative: party.rep,
    }));
  }
  if (selections.documents.length) {
    context.documents = process.documentos
      .filter((document) => selections.documents.includes(document.id) && !!document.conteudo?.trim())
      .slice(0, 3)
      .map((document) => {
        const content = document.conteudo!.slice(0, 6_000);
        return {
          name: document.nome,
          type: document.tipo,
          date: document.data,
          content,
          ...(document.conteudo!.length > content.length ? { truncated: true } : {}),
        };
      });
  }
  return Object.keys(context).length ? context : undefined;
}

const stamp = () =>
  new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function useScreenContext() {
  const { pathname } = useLocation();
  const params = useParams();
  return useMemo(() => {
    if (pathname.startsWith('/processos/') && params.numero) {
      const numero = decodeURIComponent(params.numero);
      return {
        numero,
        scope: 'processo',
        label: `Processo ${numero.split('.')[0]}`,
        manual: `/processos/${encodeURIComponent(numero)}`,
        suggestions: ['Resuma este caso.', 'Analisar caso', 'Pontos para revisar', 'Qual foi a última decisão?', 'Resuma este documento.'],
      };
    }
    if (pathname.startsWith('/clientes'))
      return { scope: 'clientes', label: 'Clientes', manual: '/clientes', suggestions: ['O que precisa da minha atenção?', 'Clientes com mais processos'] };
    if (pathname.startsWith('/processos'))
      return { scope: 'processos', label: 'Processos', manual: '/processos', suggestions: ['O que precisa da minha atenção?', 'Quais processos possuem situações semelhantes?', 'Processos sem atualização recente'] };
    if (pathname.startsWith('/documentos'))
      return { scope: 'documentos', label: 'Documentos', manual: '/documentos', suggestions: ['Resuma este documento.', 'O que é importante neste documento para este processo?', 'Quais documentos foram adicionados recentemente?'] };
    if (pathname.startsWith('/agenda') || pathname.startsWith('/prazos') || pathname.startsWith('/audiencias'))
      return { scope: 'agenda', label: 'Agenda e prazos', manual: '/agenda', suggestions: ['O que tenho hoje?', 'Quais audiências estão agendadas?'] };
    if (pathname.startsWith('/pesquisa'))
      return { scope: 'pesquisa', label: 'Pesquisa', manual: '/pesquisa', suggestions: ['Quais processos possuem situações semelhantes?', 'Processos sem atualização recente'] };
    return { scope: 'dashboard', label: 'Visão geral', manual: '/processos', suggestions: ['O que precisa da minha atenção?', 'O que tenho hoje?'] };
  }, [pathname, params.numero]);
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [seed, setSeed] = useState<string | undefined>();
  const [auto, setAuto] = useState<string | undefined>();
  const open = (s?: string) => {
    setSeed(s ?? ' ');
    setIsOpen(true);
  };
  const ask = (q: string) => {
    setAuto(q);
    setIsOpen(true);
  };
  return (
    <AssistantCtx.Provider value={{ open, ask }}>
      {children}
      <AssistantWidget isOpen={isOpen} setIsOpen={setIsOpen} seed={seed} clearSeed={() => setSeed(undefined)} auto={auto} clearAuto={() => setAuto(undefined)} />
    </AssistantCtx.Provider>
  );
}

function AssistantWidget({
  isOpen,
  setIsOpen,
  seed,
  clearSeed,
  auto,
  clearAuto,
}: {
  auto?: string;
  clearAuto: () => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  seed?: string;
  clearSeed: () => void;
}) {
  const ctx = useScreenContext();
  const ai = useAI();
  const { prefs, processos } = useStore();
  const proc = ctx.numero ? processos.find((p) => p.numero === ctx.numero) : undefined;
  const [mode, setMode] = useState<AssistantMode>('local');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [geminiReview, setGeminiReview] = useState<GeminiReview>();
  const [geminiSelections, setGeminiSelections] = useState<GeminiSelections>(DEFAULT_GEMINI_SELECTIONS);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scrollDown = () => requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }));

  const ask = (question: string, numero?: string, selectedMode: AssistantMode = mode) => {
    const q = question.trim();
    if (!q || busy) return;
    if (selectedMode === 'gemini') {
      setGeminiSelections({ ...DEFAULT_GEMINI_SELECTIONS, documents: [] });
      setGeminiReview({ question: q, process: (numero ? processos.find((p) => p.numero === numero) : undefined) ?? proc });
      return;
    }
    setBusy(true);
    setInput('');
    setMsgs((m) => [...m.filter((x) => x.from !== 'error'), { from: 'user', text: q }, { from: 'working', mode: selectedMode }]);
    scrollDown();
    timer.current = setTimeout(() => {
      try {
        const result = ai.answer({ scope: numero ? 'processo' : ctx.scope, numero: numero ?? ctx.numero }, q);
        if (result.kind === 'indisponivel') result.actions = undefined;
        setMsgs((m) => [...m.filter((x) => x.from !== 'working'), { from: 'ia', mode: 'local', result, at: stamp() }]);
      } catch {
        setMsgs((m) => [...m.filter((x) => x.from !== 'working'), { from: 'error', mode: 'local', retry: () => ask(q, numero, 'local') }]);
      } finally {
        setBusy(false);
        scrollDown();
      }
    }, 650);
  };

  const confirmGeminiSend = () => {
    if (!geminiReview || busy) return;
    const { question, process } = geminiReview;
    const context = buildGeminiContext(process, geminiSelections);
    setGeminiReview(undefined);
    setInput('');
    setBusy(true);
    setMsgs((m) => [...m.filter((x) => x.from !== 'error'), { from: 'user', text: question }, { from: 'working', mode: 'gemini' }]);
    scrollDown();
    void askGemini(question, context)
      .then((answer) => {
        setMsgs((m) => [...m.filter((x) => x.from !== 'working'), { from: 'ia', mode: 'gemini', answer, at: stamp() }]);
      })
      .catch((error: unknown) => {
        setMsgs((m) => [...m.filter((x) => x.from !== 'working'), {
          from: 'error',
          mode: 'gemini',
          message: error instanceof Error ? error.message : 'Não foi possível consultar o Gemini. Tente novamente.',
          retry: () => ask(question, undefined, 'gemini'),
        }]);
      })
      .finally(() => {
        setBusy(false);
        scrollDown();
      });
  };

  const closeGeminiReview = () => {
    if (geminiReview) setInput(geminiReview.question);
    setGeminiReview(undefined);
  };

  const suggestions = mode === 'local'
    ? ctx.suggestions
    : ctx.scope === 'processo'
      ? ['Resuma este processo.', 'Analise as movimentações deste processo.', 'Quais prazos e audiências merecem atenção?', 'Resuma um documento selecionado.']
      : ['Explique um conceito jurídico brasileiro.', 'Sugira uma estrutura genérica para uma peça jurídica.', 'Como melhorar a clareza deste texto jurídico?'];
  const reviewContext = geminiReview ? buildGeminiContext(geminiReview.process, geminiSelections) : undefined;
  const reviewPayload = geminiReview
    ? JSON.stringify({ question: geminiReview.question, ...(reviewContext ? { context: reviewContext } : {}) }, null, 2)
    : '';
  const availableDocuments = geminiReview?.process?.documentos.filter((document) => !!document.conteudo?.trim()) ?? [];

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (seed !== undefined) {
      if (seed !== ' ') setInput(seed);
      clearSeed();
    }
  }, [seed, clearSeed]);

  useEffect(() => {
    if (auto) {
      clearAuto();
      setMode('local');
      ask(auto, undefined, 'local');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full border border-white/10 bg-[var(--color-brand-dark)] py-3 pl-3 pr-4 text-[13px] font-medium text-white shadow-lg shadow-[var(--color-navy)]/20 transition-colors hover:bg-[var(--color-navy-600)]"
          aria-label="Abrir assistente jurídico"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-teal)]">
            <Sparkles size={14} />
          </span>
          <span className="hidden sm:inline">Assistente jurídico</span>
        </button>
      )}

      <div className={cx('fixed inset-0 z-50 transition-opacity', isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')}>
        <div className="absolute inset-0 bg-[var(--color-navy)]/20" onClick={() => setIsOpen(false)} />
        <aside
          role="dialog"
          aria-label="Assistente jurídico"
          className={cx(
            'absolute right-0 top-0 flex h-full w-full max-w-[400px] flex-col border-l border-line bg-canvas shadow-2xl transition-transform duration-300',
            isOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[var(--color-brand-dark)] px-5 py-3.5 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-teal)]">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold leading-tight">Assistente jurídico</h2>
              <p className="truncate text-[11.5px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className={cx('h-1.5 w-1.5 rounded-full', mode === 'gemini' ? 'bg-[var(--color-teal)]' : prefs.iaAtiva ? 'bg-[var(--color-success)]' : 'bg-slate-500')} /> {mode === 'gemini' ? 'Gemini sob demanda' : prefs.iaAtiva ? 'Regras locais ativas' : 'Desativada'}
                </span>
                <span className="mx-1.5 text-slate-600">·</span>
                {mode === 'gemini' ? 'Envio ao Google só após sua confirmação' : 'Somente registros desta conta'}
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Fechar assistente" className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <X size={17} />
            </button>
          </div>

          {/* Body */}
          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="rounded-md border border-line bg-white px-3.5 py-2.5">
              <p className="eyebrow mb-1.5">{mode === 'gemini' ? 'Privacidade do contexto' : 'Contexto atual'}</p>
              {mode === 'gemini' ? (
                <p className="text-[12.5px] text-ink">Você revisa e confirma cada envio. Só a pergunta e as seções que selecionar serão enviadas; o histórico e outros processos ficam de fora.</p>
              ) : proc ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
                  <dt className="text-muted">Processo</dt>
                  <dd className="min-w-0 truncate font-mono text-[12px] text-ink">{proc.numero}</dd>
                  <dt className="text-muted">Cliente</dt>
                  <dd className="min-w-0 truncate text-ink">{proc.cliente}</dd>
                  <dt className="text-muted">Área</dt>
                  <dd className="min-w-0 truncate text-ink">{proc.area}</dd>
                </dl>
              ) : (
                <p className="text-[12.5px] text-ink">{ctx.label}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-white p-1" role="group" aria-label="Modo do assistente">
              <button type="button" aria-pressed={mode === 'local'} disabled={busy} onClick={() => setMode('local')} className={cx('rounded px-2 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50', mode === 'local' ? 'bg-[var(--color-brand-dark)] text-white' : 'text-muted hover:bg-subtle')}>
                Regras locais
              </button>
              <button type="button" aria-pressed={mode === 'gemini'} disabled={busy} onClick={() => setMode('gemini')} className={cx('rounded px-2 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50', mode === 'gemini' ? 'bg-[var(--color-teal)] text-white' : 'text-muted hover:bg-subtle')}>
                Gemini
              </button>
            </div>
            {mode === 'gemini' && (
              <div className="rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
                <strong>Antes de enviar:</strong> cada pergunta exige uma confirmação. Você escolhe as seções do processo e confere a prévia exata. No nível gratuito atual do AI Studio, o Google pode usar o conteúdo enviado para melhorar produtos; evite incluir identificadores ou dados sigilosos quando não forem necessários.
              </div>
            )}
            {msgs.length === 0 && (
              <p className="px-1 text-[12.5px] leading-relaxed text-muted">
                {mode === 'gemini' ? 'Pergunte sobre Direito brasileiro, o JurisCore ou o processo atual. Antes de cada envio, você escolhe o contexto e confirma o que será compartilhado.' : 'Escolha uma sugestão abaixo ou faça uma pergunta sobre os registros desta tela.'}
              </p>
            )}

            {msgs.map((m, i) => {
              if (m.from === 'user')
                return (
                  <p key={i} className="border-l-2 border-[var(--color-teal)] pl-2.5 text-[12.5px] font-medium text-ink">{m.text}</p>
                );
              if (m.from === 'working') return <AIWorking key={i} label={m.mode === 'gemini' ? 'Consultando o Gemini…' : undefined} />;
              if (m.from === 'error') return <AIFailed key={i} retry={m.retry} manual={ctx.manual} mode={m.mode} message={m.message} />;
              if (m.mode === 'gemini') return <GeminiAnswer key={i} answer={m.answer} at={m.at} />;
              return <AIResultView key={i} result={m.result} at={m.at} manual={ctx.manual} onChoose={(q, numero) => ask(q, numero, 'local')} retry={m.result.kind === 'indisponivel' ? () => ask(msgs[i - 1]?.from === 'user' ? (msgs[i - 1] as Pending).text : 'Resuma este caso.', undefined, 'local') : undefined} onNavigate={() => setIsOpen(false)} />;
            })}
          </div>

          {/* Suggestions */}
          <div className="border-t border-line bg-white px-4 pt-3">
            <p className="eyebrow mb-2">Sugestões</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="rounded-md border border-line-strong bg-white px-2.5 py-1 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Composer */}
          <form className="bg-white px-4 py-3.5" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <div className="relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={4_000}
                placeholder={mode === 'gemini' ? 'Digite uma pergunta geral…' : 'Pergunte sobre estes registros…'}
                aria-label="Mensagem para o assistente"
                className="h-10 w-full rounded-md border border-line-strong bg-white pl-3.5 pr-11 text-sm text-ink placeholder:text-[var(--color-faint)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/25"
              />
              <button
                type="submit"
                aria-label="Enviar"
                disabled={busy || !input.trim()}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-[var(--color-teal)] text-white transition-colors hover:bg-[var(--color-teal-hover)] disabled:opacity-40"
              >
                <ArrowRight size={15} />
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-faint)]">
              {mode === 'gemini'
                ? 'A pergunta só vai ao Google após sua confirmação. Você decide quais dados do processo incluir. No nível gratuito, o conteúdo pode ser usado para melhorar produtos. Resposta de IA: confira as fontes oficiais; não constitui parecer jurídico.'
                : 'Regras locais sobre registros desta conta. Não usa modelo generativo nem envia dados a serviço externo. Não constitui parecer jurídico.'}
            </p>
          </form>
        </aside>
      </div>

      <Modal
        open={!!geminiReview}
        onClose={closeGeminiReview}
        title="Revise antes de enviar ao Gemini"
        description="Nada será enviado até você confirmar. Revise a pergunta e selecione apenas o contexto necessário."
        size="lg"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={closeGeminiReview} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] font-medium text-muted hover:bg-subtle">Cancelar</button>
            <button type="button" onClick={confirmGeminiSend} disabled={busy} className="rounded-md bg-[var(--color-teal)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-teal-hover)] disabled:opacity-50">
              Confirmar envio {reviewContext ? 'do contexto ao Google' : 'da pergunta ao Google'}
            </button>
          </div>
        )}
      >
        {geminiReview && (
          <div className="space-y-3 text-[13px]">
            <div className="rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-3 leading-relaxed text-ink">
              O Google receberá a pergunta e as seções mostradas na prévia; o servidor também aplica as instruções fixas de escopo do assistente. A chave atual usa o nível gratuito do AI Studio, no qual o conteúdo enviado pode ser usado para melhorar produtos. Não inclua dados sigilosos sem necessidade.
            </div>
            {geminiReview.process ? (
              <fieldset className="space-y-2 rounded-md border border-line p-3">
                <legend className="px-1 text-[12px] font-semibold text-ink">Dados do processo atual</legend>
                <label className="flex gap-2"><input type="checkbox" checked={geminiSelections.basics} onChange={(e) => setGeminiSelections((s) => ({ ...s, basics: e.target.checked }))} /> <span>Área, situação, tribunal, comarca, vara e resumo cadastrado</span></label>
                <label className="flex gap-2"><input type="checkbox" checked={geminiSelections.movements} onChange={(e) => setGeminiSelections((s) => ({ ...s, movements: e.target.checked }))} /> <span>Até 20 movimentações disponíveis, com data, tipo e descrição</span></label>
                <label className="flex gap-2"><input type="checkbox" checked={geminiSelections.deadlines} onChange={(e) => setGeminiSelections((s) => ({ ...s, deadlines: e.target.checked }))} /> <span>Até 20 prazos, com descrição, data, situação e prioridade</span></label>
                <label className="flex gap-2"><input type="checkbox" checked={geminiSelections.hearings} onChange={(e) => setGeminiSelections((s) => ({ ...s, hearings: e.target.checked }))} /> <span>Até 15 audiências, com tipo, data, situação, modalidade e local</span></label>
                <label className="flex gap-2"><input type="checkbox" checked={geminiSelections.identity} onChange={(e) => setGeminiSelections((s) => ({ ...s, identity: e.target.checked }))} /> <span>Número do processo e nome do cliente (desativado por padrão)</span></label>
                <label className="flex gap-2"><input type="checkbox" checked={geminiSelections.internalNotes} onChange={(e) => setGeminiSelections((s) => ({ ...s, internalNotes: e.target.checked }))} /> <span>Observações internas do processo (desativado por padrão)</span></label>
                <label className="flex gap-2"><input type="checkbox" checked={geminiSelections.parties} onChange={(e) => setGeminiSelections((s) => ({ ...s, parties: e.target.checked }))} /> <span>Nomes, papéis e representantes das partes; documentos pessoais são sempre excluídos</span></label>
                {availableDocuments.length > 0 ? (
                  <div className="border-t border-line pt-2">
                    <p className="mb-1.5 font-medium text-ink">Documentos com texto extraído (até 3 arquivos)</p>
                    {availableDocuments.map((document) => (
                      <label key={document.id} className="mb-1 flex gap-2">
                        <input type="checkbox" checked={geminiSelections.documents.includes(document.id)} disabled={!geminiSelections.documents.includes(document.id) && geminiSelections.documents.length >= 3} onChange={(e) => setGeminiSelections((s) => ({ ...s, documents: e.target.checked ? [...s.documents, document.id] : s.documents.filter((id) => id !== document.id) }))} />
                        <span>{document.nome} · {document.tipo} · até 6.000 caracteres</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="border-t border-line pt-2 text-[12px] text-muted">Os anexos deste processo estão disponíveis apenas como arquivos/metadados; nenhum conteúdo de documento será enviado. Arquivos sem texto extraído não podem ser resumidos pelo Gemini nesta etapa.</p>
                )}
              </fieldset>
            ) : (
              <p className="rounded-md border border-line bg-subtle p-3 text-muted">Nenhum processo específico está selecionado. O Gemini receberá somente a pergunta, a menos que você navegue até um processo e faça uma nova solicitação.</p>
            )}
            <details className="rounded-md border border-line" open>
              <summary className="cursor-pointer px-3 py-2 font-medium text-ink">Prévia da pergunta e do contexto selecionado</summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-line bg-subtle p-3 text-[11px] leading-relaxed text-ink">{reviewPayload}</pre>
            </details>
          </div>
        )}
      </Modal>
    </>
  );
}
