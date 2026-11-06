import { type FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Inbox, Plus, Send } from 'lucide-react';
import { Link } from 'react-router';
import { Card, cx } from '../components/ui';
import { useStore } from '../store';
import {
  createAssistantIntakeRequest,
  forwardAssistantIntakeRequest,
  listAssistantIntakeRequests,
  type IntakePriority,
  type IntakeRequest,
} from '../lib/assistant-intake';

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function AssistantIntake() {
  const { role, clientes, processos } = useStore();
  const [items, setItems] = useState<IntakeRequest[]>([]);
  const [clientId, setClientId] = useState('');
  const [processId, setProcessId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IntakePriority>('normal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (role !== 'Assistente') return;
    let active = true;
    setLoading(true);
    listAssistantIntakeRequests()
      .then((data) => { if (active) setItems(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a triagem.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role]);

  if (role !== 'Assistente') return <main className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-xl font-semibold text-ink">Acesso restrito</h1><p className="mt-2 text-sm text-muted">A triagem de solicitações é exclusiva para a equipe de apoio.</p></main>;

  const casesForClient = processos.filter((p) => p.clienteId === clientId);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId || !subject.trim() || !description.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await createAssistantIntakeRequest({
        clientId,
        processId: processId || null,
        subject,
        description,
        priority,
      });
      setItems((current) => [created, ...current]);
      setSuccess('Solicitação guardada nesta conta.');
      setProcessId('');
      setSubject('');
      setDescription('');
      setPriority('normal');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível guardar a solicitação.');
    } finally {
      setSaving(false);
    }
  }

  async function forward(id: string) {
    setSavingId(id);
    setError('');
    setSuccess('');
    try {
      await forwardAssistantIntakeRequest(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: 'encaminhado' } : item));
      setSuccess('Solicitação marcada como encaminhada nesta conta.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a solicitação.');
    } finally {
      setSavingId(null);
    }
  }

  return <main className="mx-auto max-w-[1200px] px-6 py-7 md:px-8">
    <header className="mb-5"><p className="eyebrow">Operação · Apoio jurídico</p><h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Triagem de solicitações</h1><p className="mt-1 text-[13.5px] text-muted">Registe pedidos recebidos e organize-os para revisão dentro desta conta.</p></header>
    <Card className="mb-6 border-line bg-subtle p-4 text-[13px] leading-6 text-muted">Os pedidos ficam privados nesta conta. “Marcar como encaminhado” altera apenas o estado do pedido; não envia e-mail nem partilha dados com outro login.</Card>
    {error && <p role="alert" className="mb-4 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
      <section><div className="mb-3 flex items-center gap-2"><Plus size={16} className="text-[var(--color-teal)]"/><h2 className="text-sm font-semibold text-ink">Nova solicitação</h2></div><Card className="p-5"><form onSubmit={(e) => { void submit(e); }} className="space-y-4">
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-ink">Cliente</span><select required value={clientId} onChange={(e) => { setClientId(e.target.value); setProcessId(''); }} className="h-10 w-full rounded border border-line bg-white px-3 text-sm text-ink"><option value="">Selecione um cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        {clientes.length === 0 && <p className="text-xs text-muted">Cadastre um cliente antes de abrir uma solicitação. <Link to="/clientes" className="font-medium text-[var(--color-brand)] hover:underline">Ir para Clientes</Link></p>}
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-ink">Processo relacionado <span className="font-normal text-muted">(opcional)</span></span><select disabled={!clientId} value={processId} onChange={(e) => setProcessId(e.target.value)} className="h-10 w-full rounded border border-line bg-white px-3 text-sm text-ink disabled:bg-slate-50"><option value="">Não vincular agora</option>{casesForClient.map((p) => <option key={p.numero} value={p.id}>{p.numero}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-ink">Assunto</span><input required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: pedido de atualização do processo" className="h-10 w-full rounded border border-line px-3 text-sm outline-none focus:border-[var(--color-teal)]"/></label>
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-ink">Resumo do contato</span><textarea required maxLength={5000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Registe o pedido e o contexto necessário, sem incluir dados desnecessários." className="w-full resize-y rounded border border-line px-3 py-2.5 text-sm outline-none focus:border-[var(--color-teal)]"/></label>
        <label className="block max-w-[220px]"><span className="mb-1.5 block text-xs font-medium text-ink">Prioridade inicial</span><select value={priority} onChange={(e) => setPriority(e.target.value as IntakePriority)} className="h-10 w-full rounded border border-line bg-white px-3 text-sm"><option value="normal">Normal</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></label>
        <button disabled={saving || clientes.length === 0} type="submit" className="inline-flex items-center gap-2 rounded bg-[var(--color-brand-dark)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><Send size={15}/>{saving ? 'A guardar…' : 'Registar solicitação'}</button>
      </form></Card></section>
      <section><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Inbox size={16} className="text-[var(--color-teal)]"/><h2 className="text-sm font-semibold text-ink">Caixa de triagem</h2></div><span className="text-xs text-muted">{items.filter((i) => i.status === 'novo').length} novas</span></div><div className="divide-y divide-line border-y border-line bg-white">
        {loading ? <p className="px-4 py-10 text-center text-sm text-muted">A carregar solicitações…</p> : items.map((item) => {
          const clientName = clientes.find((c) => c.id === item.clientId)?.nome ?? 'Cliente não disponível';
          const caseNumber = processos.find((p) => p.id === item.processId)?.numero;
          return <article key={item.id} className="px-4 py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] text-muted">{clientName}{caseNumber ? ` · ${caseNumber}` : ''} · Prioridade {item.priority}</p><h3 className="mt-1 text-sm font-semibold text-ink">{item.subject}</h3></div><span className={cx('shrink-0 text-[11px]',item.status === 'novo' ? 'text-amber-800' : 'text-muted')}>{item.status === 'novo' ? 'Novo' : 'Encaminhado'}</span></div><p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-muted">{item.description}</p><p className="mt-2 text-[11px] text-[var(--color-faint)]">{formatDate(item.createdAt)}</p>{item.status === 'novo' && <button disabled={savingId !== null} onClick={() => { void forward(item.id); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand)] hover:underline disabled:opacity-50">{savingId === item.id ? 'A atualizar…' : 'Marcar como encaminhado'} <ArrowRight size={13}/></button>}</article>;
        })}
        {!loading && items.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Nenhuma solicitação guardada nesta conta.</p>}
      </div></section>
    </div>
  </main>;
}
