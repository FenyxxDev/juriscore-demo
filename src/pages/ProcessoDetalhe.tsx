import { type FormEvent, type ReactNode, Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import {
  Archive,
  CalendarPlus,
  CheckCircle2,
  Download,
  FileText,
  FileSearch,
  Lightbulb,
  PencilLine,
  Plus,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PriorityPill,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  cx,
  useToast,
} from '../components/ui';
import { useAssistant } from '../components/Assistant';
import { AIFailed, AIResultView, AIWorking } from '../components/AIResult';
import { AreaTag } from '../components/Areas';
import { procLink, useStore } from '../store';
import { addProcessMovement, completeProcessDeadline, createProcessDeadline, getProcessByNumber, setProcessStatus, updateProcess } from '../lib/processes';
import { downloadDocument, listDocumentsForCase } from '../lib/documents';
import { type AIResult, useAI } from '../ai';
import { AREAS, diasAte, type Prioridade } from '../data';

const TABS = ['Resumo', 'Timeline', 'Partes', 'Documentos', 'Prazos', 'Audiências'];

/** Destaque temporário do item aberto a partir de uma fonte da IA, notificação ou agenda. */
function useHighlight(item: string | null) {
  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => document.getElementById(`rec-${item}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    return () => clearTimeout(t);
  }, [item]);
}
const hl = (on: boolean) => (on ? 'ring-2 ring-[var(--color-teal)]/50 bg-[var(--color-teal)]/5' : '');

export function ProcessoDetalhe() {
  const { numero } = useParams();
  const decoded = decodeURIComponent(numero ?? '');
  const { can } = useStore();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const tab = TABS.includes(sp.get('tab') ?? '') ? sp.get('tab')! : 'Resumo';
  const item = sp.get('item');
  const setTab = (t: string) => setSp({ tab: t }, { replace: true });
  const [modal, setModal] = useState<null | 'editar' | 'mov' | 'prazo' | 'encerrar'>(null);
  const [proc, setProc] = useState<Proc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  useHighlight(item);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void Promise.all([getProcessByNumber(decoded), listDocumentsForCase(decoded)])
      .then(([process, documents]) => {
        if (active) setProc(process ? { ...process, documentos: documents } as Proc : null);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [decoded, reload]);

  if (loading) return <div className="mx-auto max-w-[1400px] px-5 py-12 text-center text-sm text-muted">A carregar o processo…</div>;
  if (loadError) return <div className="mx-auto max-w-[1400px] px-5 py-12"><Card className="p-8 text-center text-sm text-muted">Não foi possível carregar o processo desta conta. Verifique a ligação e tente novamente.<div className="mt-3"><Button variant="secondary" onClick={() => setReload((value) => value + 1)}>Tentar novamente</Button></div></Card></div>;
  if (!proc) return <Navigate to="/processos" replace />;
  const changeStatus = async (archived: boolean) => {
    try {
      await setProcessStatus(proc.numero, 'encerrado', archived, archived ? 'Processo encerrado e arquivado.' : 'Processo encerrado.');
      setModal(null);
      setReload((value) => value + 1);
      toast({ tone: 'success', message: archived ? 'Processo arquivado.' : 'Processo encerrado.' });
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar o processo.' });
    }
  };
  const handleDocumentDownload = async (id: string, name: string) => {
    try {
      await downloadDocument(id);
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : `Não foi possível descarregar ${name}.` });
    }
  };
  const counts: Record<string, number> = {
    Timeline: proc.movimentacoes.length,
    Partes: proc.partes.length,
    Documentos: proc.documentos.length,
    Prazos: proc.prazos.filter((x) => x.status !== 'concluido').length,
    Audiências: proc.audiencias.length,
  };

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <Breadcrumb
        items={[{ label: 'Processos', to: '/processos' }, { label: proc.cliente, to: `/clientes/${proc.clienteId}` }, { label: proc.numero.split('.')[0] }]}
      />

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="ident text-2xl font-semibold text-ink">{proc.numero}</h1>
            <StatusBadge tone={proc.status} />
            {proc.arquivado && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted">
                Arquivado
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
            <span className="text-muted">Área: <AreaTag area={proc.area} full /></span>
            <Meta label="Cliente" value={proc.cliente} />
            <Meta label="Responsável" value={proc.responsavel} />
            <Meta label="Tribunal" value={proc.tribunal} />
            <Meta label="Comarca" value={proc.comarca} />
            <Meta label="Vara" value={proc.vara} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('editarProcesso') && (
            <Button variant="secondary" icon={<PencilLine size={16} />} onClick={() => setModal('editar')}>
              Editar
            </Button>
          )}
          {can('registrarMovimentacao') && (
            <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setModal('mov')}>
              Movimentação
            </Button>
          )}
          {can('gerenciarPrazos') && (
            <Button variant="secondary" icon={<CalendarPlus size={16} />} onClick={() => setModal('prazo')}>
              Prazo
            </Button>
          )}
          {proc.status !== 'encerrado' && can('encerrarProcesso') ? (
            <Button variant="secondary" icon={<Archive size={16} />} onClick={() => setModal('encerrar')}>
              Encerrar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <Tabs tabs={TABS.map((t) => ({ id: t, label: t, count: counts[t] }))} active={tab} onChange={setTab} />
        <div className="mt-6">
          {tab === 'Resumo' && <ResumoTab proc={proc} onTab={setTab} />}
          {tab === 'Timeline' && <TimelineTab proc={proc} item={item} />}
          {tab === 'Partes' && <PartesTab proc={proc} />}
          {tab === 'Documentos' && <DocumentosTab proc={proc} item={item} onDownload={handleDocumentDownload} />}
          {tab === 'Prazos' && <PrazosTab proc={proc} item={item} onAdd={() => setModal('prazo')} onComplete={async (deadlineId) => {
            try {
              await completeProcessDeadline(deadlineId);
              setReload((value) => value + 1);
              toast({ tone: 'success', message: 'Prazo concluído.' });
            } catch (error) {
              toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível concluir o prazo.' });
            }
          }} />}
          {tab === 'Audiências' && <AudienciasTab proc={proc} item={item} onAdd={() => toast({ tone: 'warning', message: 'A persistência de audiências está na próxima etapa de migração.' })} />}
        </div>
      </div>

      {/* --- Modais de ação --- */}
      <MovimentacaoModal
        open={modal === 'mov'}
        onClose={() => setModal(null)}
        onSave={(mov) => {
          void addProcessMovement(proc.numero, mov)
            .then(() => { setModal(null); setReload((value) => value + 1); toast({ tone: 'success', message: 'Movimentação guardada.' }); })
            .catch((error: unknown) => toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível guardar a movimentação.' }));
        }}
      />
      <PrazoModal
        open={modal === 'prazo'}
        onClose={() => setModal(null)}
        onSave={async (deadline) => {
          await createProcessDeadline(proc.numero, deadline);
          setModal(null);
          setReload((value) => value + 1);
          toast({ tone: 'success', message: 'Prazo guardado na sua conta.' });
        }}
      />
      {modal === 'editar' && <EditarProcesso proc={proc} onClose={() => setModal(null)} onSaved={() => setReload((value) => value + 1)} />}

      <Modal
        open={modal === 'encerrar'}
        onClose={() => setModal(null)}
        title="Encerrar ou arquivar processo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => void changeStatus(false)}
            >
              Encerrar
            </Button>
            <Button
              icon={<Archive size={16} />}
              onClick={() => void changeStatus(true)}
            >
              Arquivar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Encerrar mantém o processo na base como concluído. Arquivar remove-o das listas ativas
          e do dashboard. Ambas as ações podem ser revertidas pela equipe posteriormente.
        </p>
      </Modal>
    </div>
  );
}

function EditarProcesso({ proc, onClose, onSaved }: { proc: Proc; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ responsavel: proc.responsavel, area: proc.area, tribunal: proc.tribunal, comarca: proc.comarca, vara: proc.vara, resumo: proc.resumo, observacoes: proc.observacoes ?? '' });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await updateProcess(proc.numero, f);
      onSaved();
      onClose();
      toast({ tone: 'success', message: 'Alterações guardadas.' });
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível guardar as alterações.' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar processo"
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button loading={saving} onClick={() => void save()}>Salvar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsável" htmlFor="ep-r">
          <Input id="ep-r" value={f.responsavel} onChange={(e) => set('responsavel', e.target.value)} />
        </Field>
        <Field label="Área jurídica" htmlFor="ep-a">
          <Select id="ep-a" value={f.area} onChange={(e) => set('area', e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</Select>
        </Field>
        <Field label="Tribunal" htmlFor="ep-t"><Input id="ep-t" value={f.tribunal} onChange={(e) => set('tribunal', e.target.value)} /></Field>
        <Field label="Comarca" htmlFor="ep-c"><Input id="ep-c" value={f.comarca} onChange={(e) => set('comarca', e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Vara" htmlFor="ep-v"><Input id="ep-v" value={f.vara} onChange={(e) => set('vara', e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><Field label="Resumo" htmlFor="ep-s"><Textarea id="ep-s" rows={3} value={f.resumo} onChange={(e) => set('resumo', e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><Field label="Observações internas" htmlFor="ep-o"><Textarea id="ep-o" rows={2} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></Field></div>
      </div>
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-muted">
      {label}: <span className="font-medium text-ink">{value}</span>
    </span>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Row({ t, v, danger, warning }: { t: string; v: string; danger?: boolean; warning?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="shrink-0 text-muted sm:w-40">{t}</dt>
      <dd className={cx('font-medium', danger ? 'text-danger' : warning ? 'text-warning' : 'text-ink')}>
        {v}
      </dd>
    </div>
  );
}

/** Simula a latência do serviço de IA e captura falhas técnicas separadamente de "nenhum resultado". */
function useAIRun() {
  const [state, setState] = useState<{ s: 'idle' | 'working' | 'done' | 'error'; r?: AIResult; run?: () => void }>({ s: 'idle' });
  const go = (fn: () => AIResult) => {
    const run = () => {
      setState({ s: 'working' });
      setTimeout(() => {
        try {
          setState({ s: 'done', r: fn(), run });
        } catch {
          setState({ s: 'error', run });
        }
      }, 700);
    };
    run();
  };
  return { state, go, reset: () => setState({ s: 'idle' }) };
}

/* --------------------------------------------------------------- Resumo */

/** Card whose AI output is produced only on explicit request. */
function OnDemandCard({ title, icon, hint, idle, label, working, run, iaAtiva, manual, onRun }: { title: string; icon: ReactNode; hint: string; idle: string; label: string; working: string; run: ReturnType<typeof useAIRun>; iaAtiva: boolean; manual: string; onRun: () => void }) {
  const st = run.state;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line bg-[var(--color-brand-dark)] px-5 py-3.5 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-teal)]">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <p className="text-[11.5px] text-slate-400">{hint}</p>
        </div>
      </div>
      {!iaAtiva ? (
        <p className="px-5 py-4 text-[13px] text-muted">Serviço desativado nas preferências.</p>
      ) : st.s === 'done' && st.r ? (
        <>
          <AIResultView flat result={st.r} manual={manual} retry={st.r.kind === 'indisponivel' ? st.run : undefined} />
          <div className="border-t border-line px-5 py-2.5">
            <Button size="sm" variant="ghost" icon={<RotateCw size={14} />} onClick={onRun}>Gerar novamente</Button>
          </div>
        </>
      ) : st.s === 'error' ? (
        <div className="p-4"><AIFailed retry={st.run!} manual={manual} /></div>
      ) : (
        <div className="px-5 py-4">
          {st.s === 'working' ? <AIWorking label={working} /> : <p className="mb-3 text-[13px] leading-relaxed text-muted">{idle}</p>}
          {st.s !== 'working' && <Button size="sm" icon={<Sparkles size={14} />} onClick={onRun}>{label}</Button>}
        </div>
      )}
    </Card>
  );
}

type Proc = ReturnType<typeof useStore>['processos'][number];

function ResumoTab({ proc, onTab }: { proc: Proc; onTab: (t: string) => void }) {
  const ai = useAI();
  const assistant = useAssistant();
  const { prefs } = useStore();
  const resumo = useAIRun();
  const ultima = proc.movimentacoes[0];
  const pend = proc.prazos.filter((p) => p.status !== 'concluido');
  const prox = [...pend].sort((a, b) => diasAte(a.data) - diasAte(b.data))[0];
  const insight = useAIRun();
  const analise = useAIRun();
  const manual = `/processos/${encodeURIComponent(proc.numero)}?tab=Timeline`;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        {/* Resumo com IA */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div>
              <h3 className="text-base font-semibold text-ink">Resumo do processo</h3>
              <p className="text-[12.5px] text-muted">{resumo.state.s === 'done' ? 'Versão gerada por IA a partir dos registros deste processo.' : 'Descrição cadastrada pela equipe.'}</p>
            </div>
            {resumo.state.s === 'done' ? (
              <Button size="sm" variant="ghost" icon={<RotateCw size={14} />} onClick={resumo.reset}>Ver descrição original</Button>
            ) : (
              <Button size="sm" icon={<Sparkles size={14} />} disabled={!prefs.iaAtiva} loading={resumo.state.s === 'working'} onClick={() => resumo.go(() => ai.answer({ scope: 'processo', numero: proc.numero }, 'Resumir processo'))}>
                Resumir com IA
              </Button>
            )}
          </div>
          <div className={cx(resumo.state.s === 'done' ? '' : 'p-5')}>
            {resumo.state.s === 'idle' && <p className="text-sm leading-relaxed text-muted">{proc.resumo}</p>}
            {resumo.state.s === 'working' && <AIWorking label="Lendo movimentações, prazos e documentos…" />}
            {resumo.state.s === 'error' && <AIFailed retry={resumo.state.run!} manual={manual} />}
            {resumo.state.s === 'done' && resumo.state.r && <AIResultView flat result={resumo.state.r} manual={manual} />}
            {!prefs.iaAtiva && resumo.state.s === 'idle' && (
              <p className="mt-3 text-[12.5px] text-muted">O Assistente está desativado. <Link to="/configuracoes?tab=preferencias" className="font-medium text-[var(--color-teal)] hover:underline">Reativar em Preferências</Link></p>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SectionCard title="Situação atual" action={<button onClick={() => onTab('Timeline')} className="text-[13px] font-medium text-[var(--color-teal)] hover:underline">Timeline</button>}>
            <div className="mb-3">
              <StatusBadge tone={proc.status} />
            </div>
            <dl className="space-y-2.5 text-sm">
              <Row t="Última movimentação" v={ultima ? `${ultima.tipo} · ${ultima.data}` : '-'} />
              <Row t="Descrição" v={ultima ? ultima.descricao : '-'} />
              <Row t="Autor" v={ultima ? ultima.autor : '-'} />
            </dl>
          </SectionCard>

          <SectionCard title="Próximo prazo" action={<button onClick={() => onTab('Prazos')} className="text-[13px] font-medium text-[var(--color-teal)] hover:underline">{plural(pend.length)}</button>}>
            {prox ? (
              <div className={cx('rounded-md border p-4', diasAte(prox.data) < 0 ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5' : 'border-amber-200 bg-amber-50/60')}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{prox.descricao}</p>
                  <PriorityPill level={prox.prioridade} />
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row t="Data" v={prox.data} />
                  <Row t="Responsável" v={prox.responsavel} />
                  <Row t="Situação" v={diasAte(prox.data) < 0 ? 'Vencido' : diasAte(prox.data) === 0 ? 'Vence hoje' : `Em ${diasAte(prox.data)} dias`} danger={diasAte(prox.data) < 0} warning={diasAte(prox.data) >= 0} />
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhum prazo pendente.</p>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Insights + ponte para o Assistente */}
      <div className="flex flex-col gap-6 self-start">
        <OnDemandCard
          title="Insights do Assistente"
          icon={<Lightbulb size={15} />}
          hint="O que os registros podem significar para o caso"
          idle="Interpretações, pontos de atenção e possíveis providências, com fontes. Gerado apenas quando solicitado."
          label="Gerar insight"
          working="Interpretando os registros…"
          run={insight}
          iaAtiva={prefs.iaAtiva}
          manual={manual}
          onRun={() => insight.go(() => ai.answer({ scope: 'processo', numero: proc.numero }, 'Gerar insight'))}
        />
        <OnDemandCard
          title="Análise do caso"
          icon={<FileSearch size={15} />}
          hint="Relações entre documentos, movimentações, prazos, audiências e tarefas"
          idle="Cruza os registros para apontar, com fontes, o que está ou não conectado."
          label="Analisar caso"
          working="Relacionando os registros…"
          run={analise}
          iaAtiva={prefs.iaAtiva}
          manual={manual}
          onRun={() => analise.go(() => ai.answer({ scope: 'processo', numero: proc.numero }, 'Analisar caso'))}
        />

        <Card className="p-5">
          <p className="eyebrow mb-2.5">Pergunte sobre este processo</p>
          <div className="flex flex-wrap gap-1.5">
            {['Qual foi a última decisão?', 'Quais pontos devo revisar?', 'Resuma este documento.', 'O que é importante neste documento para este processo?', 'Quais processos possuem situações semelhantes?'].map((s) => (
              <button key={s} onClick={() => assistant.ask(s)} className="rounded-md border border-line-strong bg-white px-2.5 py-1 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
                {s}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const plural = (n: number) => (n === 1 ? '1 em aberto' : `${n} em aberto`);

/* -------------------------------------------------------------- Timeline */

const MES_ABR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const diaMes = (s: string) => {
  const [d, m] = s.split(' · ')[0].split('/');
  return { dia: d, mes: MES_ABR[Number(m) - 1] ?? '' };
};

function TimelineTab({ proc, item }: { proc: Proc; item: string | null }) {
  if (proc.movimentacoes.length === 0)
    return <Card className="p-10 text-center text-sm text-muted">Nenhuma movimentação registrada.</Card>;
  const docsDe = (data: string) => proc.documentos.filter((d) => d.data.split(' · ')[0] === data.split(' · ')[0]);
  return (
    <Card className="px-6 py-5">
      <ol>
        {proc.movimentacoes.map((t, i) => {
          const { dia, mes } = diaMes(t.data);
          const docs = docsDe(t.data);
          const last = i === proc.movimentacoes.length - 1;
          return (
            <li key={t.id} id={`rec-${t.id}`} className="grid grid-cols-[52px_20px_1fr] gap-x-3">
              <div className="pt-0.5 text-right font-mono leading-none">
                <span className="block text-[15px] font-medium text-ink">{dia}</span>
                <span className="mt-1 block text-[10px] tracking-[0.08em] text-muted">{mes}</span>
              </div>
              <div className="relative flex justify-center">
                <span className={cx('absolute top-0 w-px bg-line', last ? 'h-2' : 'bottom-0')} aria-hidden />
                <span className={cx('relative mt-1 h-2 w-2 rounded-full ring-4 ring-white', i === 0 ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-faint)]')} />
              </div>
              <div className={cx('-mx-2 mb-2 min-w-0 rounded-md px-2 pb-4', hl(item === t.id))}>
                <p className="text-[14px] font-semibold leading-tight text-ink">{t.tipo}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{t.descricao}</p>
                <p className="mt-1.5 text-[12px] text-[var(--color-faint)]">{t.autor}{t.data.includes(' · ') && ` · ${t.data.split(' · ')[1]}`}</p>
                {docs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {docs.map((d) => (
                      <Link key={d.id} to={procLink(proc.numero, 'Documentos', d.id)} className="text-[12.5px] font-medium text-[var(--color-teal)] hover:underline">
                        {d.nome}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ---------------------------------------------------------------- Partes */

function PartesTab({ proc }: { proc: Proc }) {
  if (proc.partes.length === 0)
    return <Card className="p-10 text-center text-sm text-muted">Nenhuma parte cadastrada.</Card>;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {proc.partes.map((p) => (
        <Card key={p.id} className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">{p.nome}</h3>
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{p.papel}</span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row t="Documento" v={p.doc} />
            <Row t="Representação" v={p.rep} />
          </dl>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Documentos */

function DocumentosTab({ proc, item, onDownload }: { proc: Proc; item: string | null; onDownload: (id: string, name: string) => Promise<void> }) {
  const ai = useAI();
  const { prefs } = useStore();
  const [aberto, setAberto] = useState<string | null>(null);
  const run = useAIRun();
  if (proc.documentos.length === 0)
    return <Card className="p-10 text-center text-sm text-muted">Nenhum documento anexado.</Card>;
  const resumir = (id: string) => {
    if (aberto === id) { setAberto(null); run.reset(); return; }
    setAberto(id);
    run.go(() => ai.summarizeDocument(id, proc.numero));
  };
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Documento</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Data</th>
              <th className="px-5 py-3">Tamanho</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {proc.documentos.map((d) => (
              <Fragment key={d.id}>
                <tr id={`rec-${d.id}`} className={cx('border-t border-line hover:bg-slate-50/70', hl(item === d.id))}>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <FileText size={16} className="text-brand" /> {d.nome}
                    </span>
                    {d.autor && <span className="ml-6 text-[12px] text-muted">Enviado por {d.autor}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-muted">{d.tipo}</td>
                  <td className="px-5 py-3.5 text-muted">{d.data || '-'}</td>
                  <td className="px-5 py-3.5 text-muted">{d.tamanho}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <button
                      onClick={() => resumir(d.id)}
                      disabled={!prefs.iaAtiva}
                      className="mr-2 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-teal)] hover:underline disabled:opacity-40"
                    >
                      <Sparkles size={13} /> {aberto === d.id ? 'Fechar resumo' : 'Resumir documento'}
                    </button>
                    <button
                      aria-label={`Baixar ${d.nome}`}
                      onClick={() => void onDownload(d.id, d.nome)}
                      className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-teal"
                    >
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
                {aberto === d.id && (
                  <tr className="border-t border-line bg-subtle">
                    <td colSpan={5} className="px-5 py-4">
                      {run.state.s === 'working' && <AIWorking label={`Lendo ${d.nome}…`} />}
                      {run.state.s === 'error' && <AIFailed retry={run.state.run!} />}
                      {run.state.s === 'done' && run.state.r && <AIResultView result={run.state.r} />}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- Prazos */

function PrazosTab({ proc, item, onAdd, onComplete }: { proc: Proc; item: string | null; onAdd: () => void; onComplete: (id: string) => Promise<void> }) {
  const { can } = useStore();
  const urgentes = proc.prazos.filter((p) => p.prioridade === 'alta' && (p.status === 'pendente' || p.status === 'atrasado'));
  return (
    <div className="flex flex-col gap-4">
      {urgentes.length > 0 && (
        <Alert tone="warning" title={`Você tem ${urgentes.length} prazo(s) de alta prioridade.`}>
          Priorize: {urgentes.map((p) => `${p.descricao} (${p.data})`).join('; ')}.
        </Alert>
      )}
      {can('gerenciarPrazos') && (
        <div className="flex justify-end">
          <Button icon={<CalendarPlus size={16} />} onClick={onAdd}>
            Cadastrar prazo
          </Button>
        </div>
      )}
      {proc.prazos.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">Nenhum prazo cadastrado.</Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Prioridade</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {proc.prazos.map((p) => (
                  <tr key={p.id} id={`rec-${p.id}`} className={cx('border-t border-line hover:bg-slate-50/70', hl(item === p.id))}>
                    <td className="px-5 py-3.5 font-medium text-ink">{p.descricao}</td>
                    <td className="px-5 py-3.5 text-muted">{p.data}</td>
                    <td className="px-5 py-3.5 text-muted">{p.responsavel}</td>
                    <td className="px-5 py-3.5">
                      <PriorityPill level={p.prioridade} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge tone={p.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.status !== 'concluido' && can('gerenciarPrazos') && (
                        <button
                          onClick={() => { void onComplete(p.id); }}
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-teal hover:underline"
                        >
                          <CheckCircle2 size={14} /> Concluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Audiências */

function AudienciasTab({ proc, item, onAdd }: { proc: Proc; item: string | null; onAdd: () => void }) {
  const { can } = useStore();
  return (
    <div className="flex flex-col gap-4">
      {can('agendarAudiencia') && (
        <div className="flex justify-end">
          <Button icon={<CalendarPlus size={16} />} onClick={onAdd}>
            Agendar audiência
          </Button>
        </div>
      )}
      {proc.audiencias.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">Nenhuma audiência cadastrada.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {proc.audiencias.map((a) => (
            <Card key={a.id} className={cx('p-5', hl(item === a.id))}>
              <span id={`rec-${a.id}`} />
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">{a.tipo}</h3>
                <StatusBadge tone={a.status} />
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <Row t="Data e hora" v={a.data} />
                <Row t="Modalidade" v={a.modalidade} />
                <Row t={a.modalidade === 'Online' ? 'Link' : 'Local'} v={a.local} />
                {a.participantes && <Row t="Participantes" v={a.participantes} />}
                {a.responsavel && <Row t="Responsável" v={a.responsavel} />}
                {a.observacoes && <Row t="Observações" v={a.observacoes} />}
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Modais de ação */

function ActionForm({ id, onSubmit, children }: { id: string; onSubmit: (e: FormEvent) => void; children: ReactNode }) {
  return (
    <form id={id} onSubmit={onSubmit} className="flex flex-col gap-4">
      {children}
    </form>
  );
}

const localDateInputValue = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function PrazoModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (deadline: { descricao: string; data: string; responsavel: string; prioridade: Prioridade }) => Promise<void>;
}) {
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(localDateInputValue());
  const [responsavel, setResponsavel] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('média');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!descricao.trim() || !data) {
      setError('Informe a descrição e a data do prazo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ descricao: descricao.trim(), data, responsavel: responsavel.trim(), prioridade });
      setDescricao('');
      setData(localDateInputValue());
      setResponsavel('');
      setPrioridade('média');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível guardar o prazo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title="Cadastrar prazo"
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="form-prazo" loading={saving}>Guardar prazo</Button>
        </>
      }
    >
      <ActionForm id="form-prazo" onSubmit={(event) => { void submit(event); }}>
        <Field label="Descrição do prazo" htmlFor="pd-description" required>
          <Input id="pd-description" value={descricao} onChange={(event) => setDescricao(event.target.value)} maxLength={300} required />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data limite" htmlFor="pd-date" required>
            <Input id="pd-date" type="date" value={data} onChange={(event) => setData(event.target.value)} required />
          </Field>
          <Field label="Prioridade" htmlFor="pd-priority">
            <Select id="pd-priority" className="h-10 w-full" value={prioridade} onChange={(event) => setPrioridade(event.target.value as Prioridade)}>
              <option value="alta">Alta</option>
              <option value="média">Média</option>
              <option value="baixa">Baixa</option>
            </Select>
          </Field>
        </div>
        <Field label="Responsável" htmlFor="pd-responsible">
          <Input id="pd-responsible" value={responsavel} onChange={(event) => setResponsavel(event.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </ActionForm>
    </Modal>
  );
}

function MovimentacaoModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (m: { tipo: string; descricao: string }) => void;
}) {
  const [tipo, setTipo] = useState('Petição');
  const [descricao, setDescricao] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar movimentação"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-mov">
            Registrar
          </Button>
        </>
      }
    >
      <ActionForm
        id="form-mov"
        onSubmit={(e) => {
          e.preventDefault();
          if (!descricao.trim()) return;
          onSave({ tipo, descricao: descricao.trim() });
          setDescricao('');
        }}
      >
        <Field label="Tipo" htmlFor="mv-tipo">
          <Select id="mv-tipo" className="h-10 w-full" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {['Petição', 'Despacho', 'Juntada de documento', 'Intimação', 'Decisão', 'Audiência'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Descrição" htmlFor="mv-desc">
          <textarea
            id="mv-desc"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva a movimentação..."
            className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
          />
        </Field>
      </ActionForm>
    </Modal>
  );
}
