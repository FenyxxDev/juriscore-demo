import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Gavel, ListChecks, Plus, Sparkles, X } from 'lucide-react';
import { Button, Card, Segmented, Select, StatusBadge, cx, useToast } from '../components/ui';
import { AreaTag } from '../components/Areas';
import { type EventoTipo, NovoEventoModal } from '../components/NovoEventoModal';
import { AIFailed, AIResultView, AIWorking } from '../components/AIResult';
import { type AIResult, useAI } from '../ai';
import { procLink, useStore } from '../store';
import { diasAte, hojeZero, parseData } from '../data';
import { completeProcessDeadline } from '../lib/processes';
import { setCalendarAppointmentStatus, setProcessHearingStatus } from '../lib/schedule';

type Kind = 'prazo' | 'audiencia' | 'tarefa' | 'compromisso';
type Item = {
  key: string;
  id: string;
  kind: Kind;
  titulo: string;
  d: Date;
  hora?: string;
  numero?: string;
  cliente?: string;
  area?: string;
  responsavel: string;
  status: 'pendente' | 'atrasado' | 'concluido' | 'agendado';
  detalhe?: string;
  to?: string;
};

const KINDS: Record<Kind, { label: string; Icon: typeof Gavel; tone: string; dot: string }> = {
  audiencia: { label: 'Audiência', Icon: Gavel, tone: 'text-info', dot: 'bg-info' },
  prazo: { label: 'Prazo', Icon: CalendarClock, tone: 'text-danger', dot: 'bg-[var(--color-danger)]' },
  tarefa: { label: 'Tarefa', Icon: ListChecks, tone: 'text-success', dot: 'bg-[var(--color-success)]' },
  compromisso: { label: 'Compromisso', Icon: CalendarDays, tone: 'text-muted', dot: 'bg-slate-400' },
};

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -d.getDay());
const horaDe = (s: string) => s.match(/(\d{1,2})h(\d{2})/)?.[0];
const minutos = (h?: string) => {
  const m = h?.match(/(\d{1,2})h(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function Agenda() {
  const { processos, tarefas, compromissos, advogados, prefs, can, user, refreshWorkspace } = useStore();
  const isAdmin = user.perfil === 'Administrador';
  const toast = useToast();
  const ai = useAI();
  const [visao, setVisao] = useState<'dia' | 'semana' | 'mes'>(prefs.agendaVisao);
  const [cursor, setCursor] = useState(hojeZero);
  const [f, setF] = useState({ resp: 'todos', tipo: 'todos', area: 'todas', periodo: 'visao', status: 'todos' });
  const [novo, setNovo] = useState<{ data?: string; tipo?: EventoTipo } | null>(null);
  const [savingDeadline, setSavingDeadline] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [hoje, setHoje] = useState<{ s: 'working' | 'done' | 'error'; r?: AIResult } | null>(null);

  useEffect(() => setVisao(prefs.agendaVisao), [prefs.agendaVisao]);

  const itens = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const areaDe = (n?: string) => processos.find((p) => p.numero === n)?.area;
    processos.filter((p) => !p.arquivado).forEach((p) => {
      p.prazos.forEach((x) => {
        const d = parseData(x.data);
        if (!d) return;
        const st = x.status === 'concluido' ? 'concluido' : diasAte(x.data) < 0 ? 'atrasado' : 'pendente';
        out.push({ key: `pz-${x.id}`, id: x.id, kind: 'prazo', titulo: x.descricao, d, numero: p.numero, cliente: p.cliente, area: p.area, responsavel: x.responsavel, status: st, to: procLink(p.numero, 'Prazos', x.id) });
      });
      p.audiencias.filter((a) => a.status !== 'cancelada').forEach((a) => {
        const d = parseData(a.data);
        if (!d) return;
        out.push({ key: `au-${a.id}`, id: a.id, kind: 'audiencia', titulo: a.tipo, d, hora: horaDe(a.data), numero: p.numero, cliente: p.cliente, area: p.area, responsavel: a.responsavel ?? p.responsavel, status: a.status === 'realizada' ? 'concluido' : diasAte(a.data) < 0 ? 'atrasado' : 'agendado', detalhe: `${a.modalidade} · ${a.local}`, to: procLink(p.numero, 'Audiências', a.id) });
      });
    });
    tarefas.forEach((t) => {
      const d = parseData(t.data);
      if (!d) return;
      out.push({ key: `tk-${t.id}`, id: t.id, kind: 'tarefa', titulo: t.titulo, d, numero: t.numero, cliente: t.cliente, area: areaDe(t.numero), responsavel: t.responsavel, status: t.status === 'concluido' ? 'concluido' : diasAte(t.data) < 0 ? 'atrasado' : 'pendente', to: t.numero ? procLink(t.numero) : '/tarefas' });
    });
    compromissos.filter((c) => c.status !== 'cancelada').forEach((c) => {
      const d = parseData(c.data);
      if (!d) return;
      const p = processos.find((x) => x.numero === c.numero);
      out.push({ key: `cp-${c.id}`, id: c.id, kind: 'compromisso', titulo: c.titulo, d, hora: horaDe(c.data), numero: c.numero, cliente: p?.cliente, area: p?.area, responsavel: c.responsavel, status: c.status === 'concluido' ? 'concluido' : diasAte(c.data) < 0 ? 'atrasado' : 'agendado', detalhe: c.local, to: c.numero ? procLink(c.numero) : undefined });
    });
    // O escopo é a conta autenticada; responsável é apenas um filtro visual.
    return out.sort((a, b) => a.d.getTime() - b.d.getTime() || minutos(a.hora) - minutos(b.hora));
  }, [processos, tarefas, compromissos]);

  // Intervalo da visão atual
  const range = useMemo(() => {
    if (visao === 'dia') return [cursor, cursor] as const;
    if (visao === 'semana') return [startOfWeek(cursor), addDays(startOfWeek(cursor), 6)] as const;
    return [new Date(cursor.getFullYear(), cursor.getMonth(), 1), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)] as const;
  }, [visao, cursor]);

  const filtrados = itens.filter((i) => {
    if (f.resp !== 'todos' && i.responsavel !== f.resp) return false;
    if (f.tipo !== 'todos' && i.kind !== f.tipo) return false;
    if (f.area !== 'todas' && i.area !== f.area) return false;
    if (f.status !== 'todos' && i.status !== f.status) return false;
    const n = Math.round((i.d.getTime() - hojeZero().getTime()) / 864e5);
    if (f.periodo === '7' && (n < 0 || n > 7)) return false;
    if (f.periodo === '30' && (n < 0 || n > 30)) return false;
    if (f.periodo === 'atrasados' && i.status !== 'atrasado') return false;
    return true;
  });
  const naVisao = filtrados.filter((i) => i.d >= range[0] && i.d <= range[1]);
  const lista = f.periodo === 'visao' ? naVisao : filtrados;
  const on = (d: Date) => filtrados.filter((i) => sameDay(i.d, d));
  const ativos = Object.entries(f).filter(([k, v]) => v !== (k === 'area' ? 'todas' : k === 'periodo' ? 'visao' : 'todos')).length;

  const move = (dir: number) =>
    setCursor((c) => (visao === 'dia' ? addDays(c, dir) : visao === 'semana' ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));

  async function completeDeadline(id: string) {
    if (savingDeadline) return;
    setSavingDeadline(id);
    try {
      await completeProcessDeadline(id);
      await refreshWorkspace(user.id);
      toast({ tone: 'success', message: 'Prazo concluído.' });
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível concluir o prazo.' });
    } finally {
      setSavingDeadline(null);
    }
  }

  async function changeScheduledStatus(item: Item, nextStatus: 'realizada' | 'concluido' | 'cancelada') {
    if (savingEvent) return;
    setSavingEvent(item.id);
    try {
      if (item.kind === 'audiencia') {
        if (nextStatus === 'concluido') throw new Error('Status inválido para audiência.');
        await setProcessHearingStatus(item.id, nextStatus);
      } else if (item.kind === 'compromisso') {
        if (nextStatus === 'realizada') throw new Error('Status inválido para compromisso.');
        await setCalendarAppointmentStatus(item.id, nextStatus);
      }
      await refreshWorkspace(user.id);
      toast({ tone: 'success', message: nextStatus === 'cancelada' ? 'Evento cancelado.' : item.kind === 'audiencia' ? 'Audiência marcada como realizada.' : 'Compromisso concluído.' });
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar o evento.' });
    } finally {
      setSavingEvent(null);
    }
  }

  function completeItem(item: Item) {
    if (item.kind === 'prazo') void completeDeadline(item.id);
    else if (item.kind === 'audiencia') void changeScheduledStatus(item, 'realizada');
    else if (item.kind === 'compromisso') void changeScheduledStatus(item, 'concluido');
  }

  function cancelItem(item: Item) {
    if (item.kind !== 'audiencia' && item.kind !== 'compromisso') return;
    if (!window.confirm(`Cancelar ${item.kind === 'audiencia' ? 'esta audiência' : 'este compromisso'}?`)) return;
    void changeScheduledStatus(item, 'cancelada');
  }

  const titulo =
    visao === 'dia'
      ? `${cursor.getDate()} de ${MESES[cursor.getMonth()]} de ${cursor.getFullYear()}`
      : visao === 'semana'
        ? `${range[0].getDate()} ${MESES[range[0].getMonth()].slice(0, 3)} – ${range[1].getDate()} ${MESES[range[1].getMonth()].slice(0, 3)} ${range[1].getFullYear()}`
        : `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const perguntarHoje = () => {
    setHoje({ s: 'working' });
    setTimeout(() => {
      try {
        setHoje({ s: 'done', r: ai.answer({ scope: 'agenda' }, 'O que preciso fazer hoje?') });
      } catch {
        setHoje({ s: 'error' });
      }
    }, 700);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Agenda</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">{isAdmin ? 'Agenda' : 'Minha agenda'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Sparkles size={15} />} disabled={!prefs.iaAtiva} onClick={perguntarHoje}>O que preciso fazer hoje?</Button>
          <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setNovo({})}>Novo compromisso</Button>
          {can('agendarAudiencia') && <Button icon={<Plus size={16} />} onClick={() => setNovo({ tipo: 'audiencia' })}>Nova audiência</Button>}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-3.5 text-[12px] text-muted">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className={cx('h-1.5 w-1.5 rounded-full', KINDS[k].dot)} /> {KINDS[k].label}</span>
          ))}
        </div>
        {isAdmin && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {[
              { k: 'resp' as const, label: 'Responsável', opts: [['todos', 'Todos os responsáveis'], ...advogados.filter((a) => a.ativo).map((a) => [a.nome, a.nome])] },
              { k: 'tipo' as const, label: 'Tipo', opts: [['todos', 'Todos os tipos'], ...(Object.keys(KINDS) as Kind[]).map((k) => [k, KINDS[k].label])] },
              { k: 'periodo' as const, label: 'Período', opts: [['visao', 'Período exibido'], ['7', 'Próximos 7 dias'], ['30', 'Próximos 30 dias'], ['atrasados', 'Atrasados']] },
            ].map(({ k, label, opts }) => (
              <select key={k} aria-label={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-7 rounded-md border border-line bg-white px-2 text-[12px] text-muted hover:border-line-strong focus:text-ink">
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            {ativos > 0 && (
              <button onClick={() => setF({ resp: 'todos', tipo: 'todos', area: 'todas', periodo: 'visao', status: 'todos' })} className="inline-flex items-center gap-1 px-1 text-[12px] text-muted hover:text-ink">
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {hoje && (
        <div className="mb-5">
          {hoje.s === 'working' && <AIWorking label="Organizando o seu dia…" />}
          {hoje.s === 'error' && <AIFailed retry={perguntarHoje} manual="/prazos" />}
          {hoje.s === 'done' && hoje.r && (
            <div className="relative">
              <button onClick={() => setHoje(null)} aria-label="Fechar" className="absolute right-2 top-9 z-10 rounded p-1 text-muted hover:bg-slate-100"><X size={14} /></button>
              <AIResultView result={hoje.r} manual="/prazos" />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <button onClick={() => move(-1)} aria-label="Anterior" className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:bg-slate-50"><ChevronLeft size={16} /></button>
              <button onClick={() => move(1)} aria-label="Próximo" className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:bg-slate-50"><ChevronRight size={16} /></button>
              <button onClick={() => setCursor(hojeZero())} className="h-8 rounded-md border border-line px-3 text-[13px] font-medium text-muted hover:bg-slate-50">Hoje</button>
              <h2 className="ml-2 text-[16px] font-semibold capitalize text-ink">{titulo}</h2>
            </div>
            <Segmented size="sm" value={visao} onChange={setVisao} options={[{ value: 'dia', label: 'Dia' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} />
          </div>

          {visao === 'mes' && <MesGrid cursor={cursor} on={on} onPick={(d) => { setCursor(d); setVisao('dia'); }} />}
          {visao === 'semana' && (
            <div className="grid grid-cols-7 divide-x divide-line">
              {Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map((d) => {
                const isHoje = sameDay(d, hojeZero());
                return (
                  <div key={d.toISOString()} className="min-h-[420px]">
                    <button onClick={() => { setCursor(d); setVisao('dia'); }} className={cx('w-full border-b border-line px-2 py-2 text-left hover:bg-slate-50', isHoje && 'bg-[var(--color-teal)]/5')}>
                      <span className="eyebrow">{DIAS[d.getDay()]}</span>
                      <span className={cx('tnum block text-[18px] font-semibold', isHoje ? 'text-[var(--color-teal)]' : 'text-ink')}>{d.getDate()}</span>
                    </button>
                    <div className="space-y-1.5 p-1.5">
                      {on(d).map((i) => <Chip key={i.key} i={i} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {visao === 'dia' && (
            <div>
              {on(cursor).length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p className="text-sm text-muted">Nada agendado para este dia.</p>
                  {can('agendarAudiencia') && <button onClick={() => setNovo({ data: iso(cursor) })} className="mt-2 text-[13px] font-medium text-[var(--color-teal)] hover:underline">Adicionar item neste dia</button>}
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {on(cursor).map((i) => (
                    <li key={i.key} className="flex gap-4 px-5 py-3.5">
                      <span className="tnum w-14 shrink-0 pt-0.5 text-[13px] font-medium text-muted">{i.hora ?? 'Dia todo'}</span>
                      <ItemBody i={i} onDone={() => completeItem(i)} onCancel={() => cancelItem(i)} busy={savingDeadline !== null || savingEvent !== null} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* Lista */}
        <Card className="self-start overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-semibold text-ink">{f.periodo === 'visao' ? 'Nesta visualização' : 'No período filtrado'}</h2>
            <span className="tnum text-[13px] text-muted">{lista.length} {lista.length === 1 ? 'item' : 'itens'}</span>
          </div>
          {lista.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">{ativos ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item neste período.'}</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
              {lista.map((i) => (
                <li key={i.key} className="px-5 py-3">
                  <p className="tnum mb-1 text-[11.5px] font-medium text-muted">
                    {String(i.d.getDate()).padStart(2, '0')}/{String(i.d.getMonth() + 1).padStart(2, '0')}{i.hora ? ` · ${i.hora}` : ''}
                  </p>
                  <ItemBody i={i} compact onDone={() => completeItem(i)} onCancel={() => cancelItem(i)} busy={savingDeadline !== null || savingEvent !== null} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <NovoEventoModal key={novo?.tipo ?? 'x'} open={!!novo} tipoInicial={novo?.tipo} dataInicial={novo?.data} onClose={() => setNovo(null)} />
    </div>
  );
}

function MesGrid({ cursor, on, onPick }: { cursor: Date; on: (d: Date) => Item[]; onPick: (d: Date) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))];
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line">
        {DIAS.map((d) => <div key={d} className="eyebrow px-2 py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} className="min-h-[92px] border-b border-r border-line bg-subtle/50" />;
          const evs = on(d);
          const isHoje = sameDay(d, hojeZero());
          return (
            <button key={idx} onClick={() => onPick(d)} className="flex min-h-[92px] flex-col gap-1 border-b border-r border-line p-1.5 text-left transition-colors hover:bg-slate-50">
              <span className={cx('tnum text-[12.5px] font-semibold', isHoje ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-teal)] text-white' : 'text-ink')}>{d.getDate()}</span>
              {evs.slice(0, 2).map((i) => (
                <span key={i.key} className={cx('flex items-center gap-1 truncate text-[11px]', i.status === 'concluido' ? 'text-[var(--color-faint)] line-through' : i.status === 'atrasado' ? 'text-danger' : 'text-ink')}>
                  <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', KINDS[i.kind].dot)} />
                  <span className="truncate">{i.titulo}</span>
                </span>
              ))}
              {evs.length > 2 && <span className="text-[11px] font-medium text-muted">+{evs.length - 2} itens</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ i }: { i: Item }) {
  const K = KINDS[i.kind];
  const body = (
    <>
      <span className="flex items-center gap-1 text-[10.5px] font-medium text-muted">
        <span className={cx('h-1.5 w-1.5 rounded-full', K.dot)} /> {i.hora ?? K.label}
      </span>
      <span className={cx('mt-0.5 block text-[11.5px] font-medium leading-snug', i.status === 'atrasado' ? 'text-danger' : i.status === 'concluido' ? 'text-[var(--color-faint)] line-through' : 'text-ink')}>{i.titulo}</span>
      {i.cliente && <span className="block truncate text-[10.5px] text-muted">{i.cliente}</span>}
    </>
  );
  const cls = 'block rounded border border-line bg-white px-1.5 py-1 transition-colors hover:border-[var(--color-teal)]';
  return i.to ? <Link to={i.to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function ItemBody({ i, compact, onDone, onCancel, busy }: { i: Item; compact?: boolean; onDone: () => void; onCancel: () => void; busy: boolean }) {
  const K = KINDS[i.kind];
  const statusTone = i.status === 'agendado' ? 'confirmada' : i.status;
  return (
    <div className="flex min-w-0 flex-1 gap-3">
      <K.Icon size={16} className={cx('mt-0.5 shrink-0', K.tone)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {i.to ? (
            <Link to={i.to} className="text-sm font-medium text-ink hover:text-[var(--color-teal)] hover:underline">{i.titulo}</Link>
          ) : (
            <p className="text-sm font-medium text-ink">{i.titulo}</p>
          )}
          {!compact && <StatusBadge tone={statusTone as never} />}
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {K.label}
          {i.numero && <> · <span className="ident">{i.numero.split('.')[0]}</span></>}
          {i.cliente && <> · {i.cliente}</>}
          {' · '}{i.responsavel}
        </p>
        {(i.detalhe || i.area) && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {i.area && <AreaTag area={i.area} />}
            {i.detalhe && <span className="truncate">{i.detalhe}</span>}
          </p>
        )}
        {!compact && (i.kind === 'prazo' && i.status !== 'concluido' || (i.kind === 'audiencia' || i.kind === 'compromisso') && i.status !== 'concluido') && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {(i.kind === 'prazo' || i.kind === 'audiencia' || i.kind === 'compromisso') && (
              <button disabled={busy} onClick={onDone} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-teal)] hover:underline disabled:opacity-50">
                <CheckCircle2 size={13} /> {i.kind === 'prazo' ? 'Concluir prazo' : i.kind === 'audiencia' ? 'Marcar realizada' : 'Concluir compromisso'}
              </button>
            )}
            {(i.kind === 'audiencia' || i.kind === 'compromisso') && (
              <button disabled={busy} onClick={onCancel} className="text-[12.5px] font-medium text-danger hover:underline disabled:opacity-50">Cancelar</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
