import { useState } from 'react';
import { CalendarClock, CalendarDays, Gavel, ListChecks } from 'lucide-react';
import { Button, Field, Input, Modal, Select, Textarea, cx, useToast } from './ui';
import { useStore } from '../store';
import type { Modalidade, Prioridade } from '../data';
import { createProcessDeadline } from '../lib/processes';
import { createCalendarAppointment, createProcessHearing, createProcessTask } from '../lib/schedule';

export type EventoTipo = 'audiencia' | 'prazo' | 'tarefa' | 'compromisso';

const TIPOS: { id: EventoTipo; label: string; hint: string; Icon: typeof Gavel }[] = [
  { id: 'audiencia', label: 'Audiência', hint: 'Vinculada a um processo', Icon: Gavel },
  { id: 'prazo', label: 'Prazo', hint: 'Prazo processual', Icon: CalendarClock },
  { id: 'tarefa', label: 'Tarefa', hint: 'Atividade interna', Icon: ListChecks },
  { id: 'compromisso', label: 'Compromisso', hint: 'Reunião ou evento', Icon: CalendarDays },
];

const TIPOS_AUD = ['Audiência de conciliação', 'Audiência de instrução', 'Audiência una', 'Audiência de julgamento', 'Audiência de justificação'];

export function NovoEventoModal({
  open,
  onClose,
  numero: fixo,
  tipoInicial,
  dataInicial,
}: {
  open: boolean;
  onClose: () => void;
  numero?: string;
  tipoInicial?: EventoTipo;
  dataInicial?: string;
}) {
  if (!open) return null;
  return <Form onClose={onClose} fixo={fixo} tipoInicial={tipoInicial} dataInicial={dataInicial} />;
}

function Form({ onClose, fixo, tipoInicial, dataInicial }: { onClose: () => void; fixo?: string; tipoInicial?: EventoTipo; dataInicial?: string }) {
  const { processos, advogados, user, can, refreshWorkspace } = useStore();
  const toast = useToast();
  const [tipo, setTipo] = useState<EventoTipo | null>(tipoInicial ?? null);
  const [saving, setSaving] = useState(false);
  const availableTypes = TIPOS.filter(({ id }) =>
    id === 'prazo' ? can('gerenciarPrazos') :
      id === 'tarefa' ? can('distribuirTarefas') :
        id === 'audiencia' ? can('agendarAudiencia') : true,
  );
  const ativos = processos.filter((p) => !p.arquivado);
  const [numero, setNumero] = useState(fixo ?? '');
  const proc = processos.find((p) => p.numero === numero);
  const equipe = advogados.filter((a) => a.ativo);
  const [f, setF] = useState({
    titulo: '',
    data: dataInicial ?? '',
    hora: '',
    tipoAud: TIPOS_AUD[0],
    modalidade: 'Presencial' as Modalidade,
    local: '',
    participantes: '',
    responsavel: proc?.responsavel ?? user.nome,
    observacoes: '',
    prioridade: 'média' as Prioridade,
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    const e: Record<string, string> = {};
    const precisaProc = tipo === 'audiencia' || tipo === 'prazo' || tipo === 'tarefa';
    if (precisaProc && !numero) e.numero = 'Selecione o processo.';
    if (!f.data) e.data = 'Informe a data.';
    if ((tipo === 'audiencia' || tipo === 'compromisso') && !f.hora) e.hora = 'Informe o horário.';
    if (tipo === 'audiencia' && !f.local.trim()) e.local = f.modalidade === 'Online' ? 'Informe o link da sala.' : 'Informe o local.';
    if (tipo !== 'audiencia' && !f.titulo.trim()) e.titulo = 'Informe uma descrição.';
    setErr(e);
    if (Object.keys(e).length || !tipo) return;

    if ((tipo === 'prazo' && !can('gerenciarPrazos')) || (tipo === 'tarefa' && !can('distribuirTarefas'))) {
      toast({ tone: 'error', message: 'Seu perfil não tem permissão para criar este item.' });
      return;
    }

    setSaving(true);
    try {
      if (tipo === 'audiencia') {
        await createProcessHearing({ numero, tipo: f.tipoAud, data: f.data, hora: f.hora, modalidade: f.modalidade, local: f.local.trim(), participantes: f.participantes, responsavel: f.responsavel, observacoes: f.observacoes });
        toast({ tone: 'success', message: 'Audiência agendada e salva no processo.' });
      } else if (tipo === 'prazo') {
        await createProcessDeadline(numero, { descricao: f.titulo.trim(), data: f.data, responsavel: f.responsavel, prioridade: f.prioridade });
        toast({ tone: 'success', message: 'Prazo cadastrado.' });
      } else if (tipo === 'tarefa') {
        await createProcessTask({ numero, titulo: f.titulo.trim(), data: f.data, responsavel: f.responsavel, prioridade: f.prioridade });
        toast({ tone: 'success', message: `Tarefa atribuída a ${f.responsavel}.` });
      } else {
        await createCalendarAppointment({ numero: numero || undefined, titulo: f.titulo.trim(), data: f.data, hora: f.hora || undefined, local: f.local.trim() || 'A definir', responsavel: f.responsavel, observacoes: f.observacoes });
        toast({ tone: 'success', message: 'Compromisso salvo na agenda.' });
      }
      onClose();
      void refreshWorkspace(user.id).catch(() => toast({ tone: 'error', message: 'O item foi salvo, mas a lista não pôde ser atualizada. Atualize a página.' }));
    } catch (saveError) {
      toast({ tone: 'error', message: saveError instanceof Error ? saveError.message : 'Não foi possível salvar o item.' });
    } finally {
      setSaving(false);
    }
  }

  const titulo = !tipo ? 'Novo compromisso ou audiência' : { audiencia: 'Nova audiência', prazo: 'Novo prazo', tarefa: 'Nova tarefa', compromisso: 'Novo compromisso' }[tipo];

  return (
    <Modal
      open
      onClose={() => { if (!saving) onClose(); }}
      size="lg"
      title={titulo}
      description={tipo ? undefined : 'Escolha o tipo de item.'}
      footer={
        tipo && (
          <>
            {!tipoInicial && <Button variant="ghost" className="mr-auto" onClick={() => setTipo(null)}>Trocar tipo</Button>}
            <Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button>
            <Button onClick={() => { void salvar(); }} loading={saving}>Salvar</Button>
          </>
        )
      }
    >
      {!tipo ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {availableTypes.map(({ id, label, hint, Icon }) => (
            <button key={id} onClick={() => setTipo(id)} className="flex items-center gap-3 rounded-md border border-line-strong px-4 py-3.5 text-left transition-colors hover:border-[var(--color-teal)] hover:bg-[var(--color-teal)]/4">
              <Icon size={18} className="text-[var(--color-teal)]" />
              <span>
                <span className="block text-sm font-semibold text-ink">{label}</span>
                <span className="block text-[12.5px] text-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tipo !== 'audiencia' && (
            <div className="sm:col-span-2">
              <Field label={tipo === 'prazo' ? 'Descrição do prazo' : 'Título'} htmlFor="ev-t" error={err.titulo} required>
                <Input id="ev-t" value={f.titulo} invalid={!!err.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder={tipo === 'prazo' ? 'Ex.: Contestação' : tipo === 'tarefa' ? 'Ex.: Revisar cálculos' : 'Ex.: Reunião com cliente'} />
              </Field>
            </div>
          )}
          <Field label={tipo === 'compromisso' ? 'Processo (opcional)' : 'Processo'} htmlFor="ev-p" error={err.numero} required={tipo !== 'compromisso'}>
            <Select id="ev-p" value={numero} disabled={!!fixo} onChange={(e) => { setNumero(e.target.value); const p = processos.find((x) => x.numero === e.target.value); if (p) set('responsavel', p.responsavel); }}>
              <option value="">{tipo === 'compromisso' ? 'Sem vínculo' : 'Selecione…'}</option>
              {ativos.map((p) => <option key={p.numero} value={p.numero}>{p.numero.split('.')[0]} · {p.cliente}</option>)}
            </Select>
          </Field>
          <Field label="Cliente"><Input value={proc?.cliente ?? ''} disabled placeholder="Preenchido pelo processo" /></Field>
          {tipo === 'audiencia' && (
            <Field label="Tipo de audiência" htmlFor="ev-ta">
              <Select id="ev-ta" value={f.tipoAud} onChange={(e) => set('tipoAud', e.target.value)}>{TIPOS_AUD.map((t) => <option key={t}>{t}</option>)}</Select>
            </Field>
          )}
          <div className={cx('grid gap-4', tipo === 'audiencia' || tipo === 'compromisso' ? 'grid-cols-2' : 'grid-cols-1')}>
            <Field label="Data" htmlFor="ev-d" error={err.data} required><Input id="ev-d" type="date" value={f.data} invalid={!!err.data} onChange={(e) => set('data', e.target.value)} /></Field>
            {(tipo === 'audiencia' || tipo === 'compromisso') && (
              <Field label="Horário" htmlFor="ev-h" error={err.hora} required><Input id="ev-h" type="time" value={f.hora} invalid={!!err.hora} onChange={(e) => set('hora', e.target.value)} /></Field>
            )}
          </div>
          {tipo === 'audiencia' && (
            <Field label="Modalidade">
              <div className="flex gap-1.5">
                {(['Presencial', 'Online', 'Híbrida'] as Modalidade[]).map((m) => (
                  <button key={m} type="button" onClick={() => set('modalidade', m)} aria-pressed={f.modalidade === m} className={cx('h-9.5 flex-1 rounded-md border text-[13px] font-medium transition-colors', f.modalidade === m ? 'border-[var(--color-brand-dark)] bg-[var(--color-brand-dark)] text-white' : 'border-line-strong text-muted hover:text-ink')}>{m}</button>
                ))}
              </div>
            </Field>
          )}
          {(tipo === 'audiencia' || tipo === 'compromisso') && (
            <Field label={f.modalidade === 'Online' && tipo === 'audiencia' ? 'Link da sala' : 'Local ou link'} htmlFor="ev-l" error={err.local} required={tipo === 'audiencia'}>
              <Input id="ev-l" value={f.local} invalid={!!err.local} onChange={(e) => set('local', e.target.value)} placeholder={f.modalidade === 'Online' ? 'https://…' : 'Ex.: 3ª Vara Cível · Sala 2'} />
            </Field>
          )}
          {tipo === 'audiencia' && (
            <Field label="Participantes" htmlFor="ev-pa"><Input id="ev-pa" value={f.participantes} onChange={(e) => set('participantes', e.target.value)} placeholder="Cliente, testemunhas, preposto…" /></Field>
          )}
          <Field label="Responsável" htmlFor="ev-r">
            <Select id="ev-r" value={f.responsavel} onChange={(e) => set('responsavel', e.target.value)}>{equipe.map((a) => <option key={a.id}>{a.nome}</option>)}</Select>
          </Field>
          {(tipo === 'prazo' || tipo === 'tarefa') && (
            <Field label="Prioridade" htmlFor="ev-pr">
              <Select id="ev-pr" value={f.prioridade} onChange={(e) => set('prioridade', e.target.value)}><option value="alta">Alta</option><option value="média">Média</option><option value="baixa">Baixa</option></Select>
            </Field>
          )}
          {(tipo === 'audiencia' || tipo === 'compromisso') && (
            <div className="sm:col-span-2">
              <Field label="Observações" htmlFor="ev-o"><Textarea id="ev-o" rows={3} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></Field>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
