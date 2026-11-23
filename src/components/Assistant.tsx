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
import { cx } from './ui';
import { type AIResult, useAI } from '../ai';
import { useStore } from '../store';
import { askGemini } from '../lib/gemini';
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scrollDown = () => requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }));

  const ask = (question: string, numero?: string, selectedMode: AssistantMode = mode) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');
    setMsgs((m) => [...m.filter((x) => x.from !== 'error'), { from: 'user', text: q }, { from: 'working', mode: selectedMode }]);
    scrollDown();
    if (selectedMode === 'gemini') {
      void askGemini(q)
        .then((answer) => {
          setMsgs((m) => [...m.filter((x) => x.from !== 'working'), { from: 'ia', mode: 'gemini', answer, at: stamp() }]);
        })
        .catch((error: unknown) => {
          setMsgs((m) => [...m.filter((x) => x.from !== 'working'), {
            from: 'error',
            mode: selectedMode,
            message: error instanceof Error ? error.message : 'Não foi possível consultar o Gemini. Tente novamente.',
            retry: () => ask(q, numero, selectedMode),
          }]);
        })
        .finally(() => {
          setBusy(false);
          scrollDown();
        });
      return;
    }
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

  const suggestions = mode === 'local'
    ? ctx.suggestions
    : ['Explique um conceito jurídico em termos gerais.', 'Sugira uma estrutura para uma peça jurídica sem usar dados reais.', 'Como melhorar a clareza deste texto?'];

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
                {mode === 'gemini' ? 'Somente a pergunta atual vai ao Google' : 'Somente registros desta conta'}
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
                <p className="text-[12.5px] text-ink">A tela, os registros do JurisCore e o histórico do chat não são anexados à pergunta enviada ao Gemini.</p>
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
                <strong>Antes de enviar:</strong> somente a pergunta digitada será enviada ao Google. A conta do AI Studio está no nível gratuito; nesse nível, o Google pode usar o conteúdo enviado para melhorar seus produtos. Não inclua nomes, números de processo, dados pessoais, documentos ou informações sigilosas.
              </div>
            )}
            {msgs.length === 0 && (
              <p className="px-1 text-[12.5px] leading-relaxed text-muted">
                {mode === 'gemini' ? 'Faça uma pergunta geral. O Gemini não recebe os dados desta tela.' : 'Escolha uma sugestão abaixo ou faça uma pergunta sobre os registros desta tela.'}
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
                ? 'Apenas a mensagem atual é enviada ao Google; nenhum registro, documento ou histórico é enviado. No nível gratuito, o conteúdo pode ser usado pelo Google para melhorar produtos. Resposta de IA: confira as fontes oficiais; não constitui parecer jurídico.'
                : 'Regras locais sobre registros desta conta. Não usa modelo generativo nem envia dados a serviço externo. Não constitui parecer jurídico.'}
            </p>
          </form>
        </aside>
      </div>
    </>
  );
}
