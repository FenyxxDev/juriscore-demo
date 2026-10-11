import { type ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CalendarClock, CheckSquare, Clock, Gavel, Sparkles, UserX } from 'lucide-react';
import { Card, Metric, PanelHeader, StatusBadge, cx, type StatusTone } from '../components/ui';
import { useAssistant } from '../components/Assistant';
import { procLink, toStamp, useStore } from '../store';
import { AreaList } from '../components/Areas';
import { HBars, Legend, Meter, SERIES, StackedBar, WeekColumns, type WeekDay } from '../components/Charts';
import { diasAte } from '../data';

const short = (n: string) => n.split('.')[0];

export function Dashboard() {
  const store = useStore();
  const { role } = store;
  const assistant = useAssistant();
  const acting = store.user.nome;
  const firstName = acting.split(' ')[0];
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{role === 'Assistente' ? 'Assistente jurídico' : role} · {hoje}</p>
          <h1 className="mt-1.5 text-[27px] font-semibold tracking-tight text-ink">
            {greeting}, {firstName}.
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => assistant.ask('O que precisa da minha atenção?')}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-teal)] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-teal-hover)]"
          >
            <Sparkles size={15} /> O que precisa da minha atenção?
          </button>
          <button
            onClick={() => assistant.open(' ')}
            className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
          >
            Perguntar ao Assistente
          </button>
        </div>
      </header>

      {role === 'Administrador' && <AdminView store={store} />}
      {role === 'Advogado' && <AdvogadoView store={store} acting={acting} />}
      {role === 'Assistente' && <AssistenteView store={store} />}
    </div>
  );
}

/* --------------------------------------------------------------- shared */

type Store = ReturnType<typeof useStore>;
type EventoRow = Store['eventos'][number];
type ProcRow = Store['processos'][number];

function KpiStrip({ children }: { children: ReactNode }) {
  return <Card className="mb-5 grid grid-cols-2 divide-y divide-line md:grid-cols-4 md:divide-x md:divide-y-0">{children}</Card>;
}

function Panel({ title, subtitle, to, linkLabel, children, className }: { title: string; subtitle?: string; to?: string; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cx('flex h-full flex-col', className)}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        action={to && <Link to={to} className="shrink-0 text-[13px] font-medium text-[var(--color-teal)] hover:underline">{linkLabel ?? 'Ver todos'}</Link>}
      />
      <div className="flex-1 px-5 py-4">{children}</div>
    </Card>
  );
}

type Alerta = { key: string; icon: ReactNode; tone: 'danger' | 'warning' | 'info'; titulo: string; meta: string; to: string };
const toneCls = { danger: 'text-[var(--color-danger)]', warning: 'text-[var(--color-warning)]', info: 'text-[var(--color-info)]' };

/** Compact attention strip: at most 4 actionable items, each opening its record. */
function AttentionStrip({ title, items, empty }: { title: string; items: Alerta[]; empty: string }) {
  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <span className="tnum text-[12.5px] text-muted">{items.length ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}` : ''}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {items.slice(0, 4).map((a) => (
            <li key={a.key} className="min-w-0">
              <Link to={a.to} className="flex h-full items-start gap-2.5 px-5 py-3 transition-colors hover:bg-subtle">
                <span className={cx('mt-0.5 shrink-0', toneCls[a.tone])}>{a.icon}</span>
                <span className="min-w-0">
                  <span className={cx('block text-[11.5px] font-medium uppercase tracking-wide', toneCls[a.tone])}>{a.meta}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] font-medium text-ink">{a.titulo}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MiniList({ items, empty, inset }: { items: { key: string; to: string; title: ReactNode; meta?: ReactNode; right?: ReactNode }[]; empty: string; inset?: boolean }) {
  if (!items.length) return <p className="py-2 text-[13px] text-muted">{empty}</p>;
  return (
    <ul className={cx('divide-y divide-line', inset ? '-my-2' : '-mx-5 -my-2')}>
      {items.slice(0, 3).map((i) => (
        <li key={i.key}>
          <Link to={i.to} className={cx('flex items-center justify-between gap-3 py-2 transition-colors hover:bg-subtle', inset ? 'px-0' : 'px-5')}>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink">{i.title}</span>
              {i.meta && <span className="mt-0.5 block truncate text-[12px] text-muted">{i.meta}</span>}
            </span>
            {i.right && <span className="shrink-0 text-[12px] text-[var(--color-faint)] tnum">{i.right}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const upcomingAuds = (ev: EventoRow[]) =>
  ev.filter((e) => e.kind === 'audiencia' && diasAte(e.data) >= 0).sort((x, y) => toStamp(x.data) - toStamp(y.data));
const parado = (p: ProcRow) => !p.arquivado && diasAte(p.atualizacao) < -30;
const quando = (n: number) => (n === 0 ? 'Hoje' : n === 1 ? 'Amanhã' : n < 0 ? `Venceu há ${-n} ${n === -1 ? 'dia' : 'dias'}` : `Em ${n} dias`);

const STATUS_COLORS: Record<string, string> = {
  'em-andamento': SERIES.a,
  aguardando: SERIES.c,
  atrasado: 'var(--color-danger)',
  encerrado: 'var(--color-faint)',
};
const statusSegments = (procs: ProcRow[]) =>
  ([
    ['em-andamento', 'Em andamento'],
    ['aguardando', 'Aguardando ação'],
    ['atrasado', 'Em atenção'],
    ['encerrado', 'Encerrados'],
  ] as [StatusTone, string][]).map(([tone, label]) => ({
    label,
    color: STATUS_COLORS[tone],
    to: '/processos',
    n: procs.filter((p) => (tone === 'encerrado' ? p.status === 'encerrado' || p.arquivado : !p.arquivado && p.status === tone)).length,
  }));

/* -------------------------------------------------------------- Advogado */

function AdvogadoView({ store, acting }: { store: Store; acting: string }) {
  const todosMeus = store.processos.filter((p) => p.responsavel === acting);
  const meus = todosMeus.filter((p) => !p.arquivado);
  const nums = new Set(meus.map((p) => p.numero));
  const prazos = store.prioridades.filter((p) => nums.has(p.numero) && p.status !== 'concluido');
  const atrasados = prazos.filter((p) => p.tone === 'atrasado');
  const proximos = prazos.filter((p) => diasAte(p.data) >= 0 && diasAte(p.data) <= 7);
  const auds = upcomingAuds(store.eventos.filter((e) => nums.has(e.numero)));
  const tarefas = store.tarefas.filter((t) => t.responsavel === acting && t.status !== 'concluido');

  const alertas: Alerta[] = [
    ...prazos
      .filter((p) => diasAte(p.data) >= 0 && diasAte(p.data) <= 1)
      .map((p) => ({ key: `p-${p.id}`, icon: <Clock size={16} />, tone: diasAte(p.data) === 0 ? ('danger' as const) : ('warning' as const), meta: `Prazo vence ${diasAte(p.data) === 0 ? 'hoje' : 'amanhã'}`, titulo: `${p.descricao} (${p.cliente})`, to: procLink(p.numero, 'Prazos', p.id) })),
    ...auds
      .filter((a) => diasAte(a.data) === 0)
      .map((a) => ({ key: `a-${a.id}`, icon: <Gavel size={16} />, tone: 'warning' as const, meta: `Audiência hoje ${a.data.split('·')[1]?.trim() ?? ''}`, titulo: `${a.kind === 'audiencia' ? a.tipo : a.descricao} (${a.cliente})`, to: procLink(a.numero, 'Audiências', a.id) })),
    ...tarefas
      .filter((t) => diasAte(t.data) <= 0)
      .map((t) => ({ key: `t-${t.id}`, icon: <CheckSquare size={16} />, tone: t.status === 'atrasado' ? ('danger' as const) : ('info' as const), meta: t.status === 'atrasado' ? 'Tarefa atrasada' : 'Tarefa de hoje', titulo: t.titulo, to: t.numero ? procLink(t.numero) : '/tarefas' })),
    ...meus
      .filter(parado)
      .map((p) => ({ key: `s-${p.numero}`, icon: <AlertTriangle size={16} />, tone: 'info' as const, meta: `Sem atualização há ${-diasAte(p.atualizacao)} dias`, titulo: `${short(p.numero)} (${p.cliente})`, to: procLink(p.numero) })),
  ];

  const dias: WeekDay[] = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() + k);
    return {
      label: k === 0 ? 'Hoje' : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      sub: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      today: k === 0,
      values: [
        prazos.filter((p) => diasAte(p.data) === k).length,
        auds.filter((a) => diasAte(a.data) === k).length,
        tarefas.filter((t) => diasAte(t.data) === k).length,
      ],
    };
  });
  const series = [
    { label: 'Prazos', color: SERIES.a },
    { label: 'Audiências', color: SERIES.b },
    { label: 'Tarefas', color: SERIES.c },
  ];

  return (
    <>
      <AttentionStrip title="Atenção" items={alertas} empty="Nada urgente para hoje ou amanhã." />
      <KpiStrip>
        <Metric label="Processos ativos" value={meus.length} hint="Sob sua responsabilidade" />
        <Metric label="Prazos próximos" value={proximos.length} hint="Próximos 7 dias" hintTone={proximos.length ? 'warning' : 'muted'} />
        <Metric label="Prazos atrasados" value={atrasados.length} hint={atrasados.length ? 'Atenção imediata' : 'Nenhum atraso'} hintTone={atrasados.length ? 'danger' : 'muted'} />
        <Metric label="Audiências" value={auds.length} hint={auds[0] ? `Próxima em ${auds[0].data.split(' ')[0]}` : 'Nenhuma agendada'} />
      </KpiStrip>
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-5">
        <Panel title="Visão da semana" subtitle="Compromissos por dia, próximos 7 dias" to="/agenda" linkLabel="Abrir agenda" className="lg:col-span-3">
          <div className="mb-3"><Legend items={series} /></div>
          <WeekColumns days={dias} series={series} />
        </Panel>
        <Panel title="Status dos meus processos" subtitle={`${todosMeus.length} processos`} to="/processos" className="lg:col-span-2">
          <StackedBar segments={statusSegments(todosMeus)} />
        </Panel>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Admin */

function AdminView({ store }: { store: Store }) {
  const { stats, prioridades, clientes, eventos, processos } = store;
  const auds = upcomingAuds(eventos);
  const media = stats.porResponsavel.length ? stats.porResponsavel.reduce((n, r) => n + r.n, 0) / stats.porResponsavel.length : 0;
  const sobrecarga = (n: number) => stats.porResponsavel.length > 1 && n >= Math.max(3, media * 1.5);
  const atrasados = prioridades.filter((p) => p.tone === 'atrasado');
  const ativos = processos.filter((p) => !p.arquivado);

  const alertas: Alerta[] = [
    ...atrasados.slice(0, 2).map((p) => ({ key: `p-${p.id}`, icon: <Clock size={16} />, tone: 'danger' as const, meta: quando(diasAte(p.data)), titulo: `${p.descricao} (${p.cliente})`, to: procLink(p.numero, 'Prazos', p.id) })),
    ...ativos.filter((p) => !p.responsavel).map((p) => ({ key: `r-${p.numero}`, icon: <UserX size={16} />, tone: 'warning' as const, meta: 'Sem responsável', titulo: `${short(p.numero)} (${p.cliente})`, to: procLink(p.numero) })),
    ...stats.porResponsavel.filter((r) => sobrecarga(r.n)).map((r) => ({ key: `o-${r.nome}`, icon: <AlertTriangle size={16} />, tone: 'warning' as const, meta: 'Carga acima da média', titulo: `${r.nome}: ${r.n} processos ativos`, to: '/equipe' })),
    ...ativos.filter(parado).map((p) => ({ key: `s-${p.numero}`, icon: <CalendarClock size={16} />, tone: 'info' as const, meta: `Sem atualização há ${-diasAte(p.atualizacao)} dias`, titulo: `${short(p.numero)} (${p.cliente})`, to: procLink(p.numero) })),
  ];

  return (
    <>
      <KpiStrip>
        <Metric label="Total de processos" value={processos.length} hint={`${stats.ativos} ativos`} />
        <Metric label="Total de clientes" value={clientes.length} hint={`${clientes.filter((c) => c.status === 'ativo').length} ativos`} />
        <Metric label="Prazos atrasados" value={stats.prazosAtrasados} hint={stats.prazosAtrasados ? 'Exigem intervenção' : 'Nenhum atraso'} hintTone={stats.prazosAtrasados ? 'danger' : 'muted'} />
        <Metric label="Audiências próximas" value={stats.audienciasSemana} hint="Próximos 7 dias" />
      </KpiStrip>
      <div className="mb-5 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        <Panel title="Processos por status" subtitle="Como está a carteira?" to="/processos">
          <StackedBar segments={statusSegments(processos)} />
        </Panel>
        <Panel title="Processos por área jurídica" subtitle="Onde está o volume?" to="/processos">
          <HBars data={stats.porArea} to={() => '/processos'} max={5} />
        </Panel>
        <Panel title="Distribuição por responsável" subtitle="A carga está equilibrada?" to="/equipe" linkLabel="Ver equipe">
          <HBars data={stats.porResponsavel.map((r) => ({ ...r, flag: sobrecarga(r.n) }))} to={() => '/equipe'} max={5} />
        </Panel>
      </div>
      <AttentionStrip title="Atenção da operação" items={alertas} empty="Nenhum evento exige intervenção agora." />
    </>
  );
}

/* ------------------------------------------------------------ Assistente */

function AssistenteView({ store }: { store: Store }) {
  const { clientes, documentos, atividades, prioridades, eventos, user } = store;
  const docs = [...documentos].sort((a, b) => toStamp(b.data) - toStamp(a.data));
  const clis = [...clientes].sort((a, b) => toStamp(b.atualizacao) - toStamp(a.atualizacao));
  const auds = upcomingAuds(eventos);
  const abertos = prioridades.filter((p) => p.status !== 'concluido');
  const nA = abertos.filter((p) => p.tone === 'atrasado').length;
  const nH = abertos.filter((p) => p.tone === 'hoje').length;
  const nF = abertos.length - nA - nH;

  return (
    <>
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        {user.equipe && <span>Equipe <span className="font-medium text-ink">{user.equipe}</span></span>}
        <AreaList areas={user.areas} />
      </div>
      <div className="mb-5 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        <Panel title="Prazos cadastrados" to="/prazos">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-[28px] font-semibold leading-none text-ink">{abertos.length}</span>
            <span className="text-[12.5px] text-muted">em aberto</span>
          </div>
          <div className="mt-3"><Meter parts={[{ label: 'Atrasados', n: nA, color: 'var(--color-danger)' }, { label: 'Hoje', n: nH, color: SERIES.b }, { label: 'Futuros', n: nF, color: SERIES.a }]} /></div>
          <div className="mt-2">
            <Legend items={[{ label: `Atrasados ${nA}`, color: 'var(--color-danger)' }, { label: `Hoje ${nH}`, color: SERIES.b }, { label: `Futuros ${nF}`, color: SERIES.a }]} />
          </div>
        </Panel>
        <Panel title="Audiências próximas" to="/agenda">
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              <span className="tnum block text-[28px] font-semibold leading-none text-ink">{auds.length}</span>
              <span className="mt-1 block text-[12.5px] text-muted">agendadas</span>
            </div>
            <div className="min-w-0 flex-1">
              <MiniList
                inset
                empty="Nenhuma audiência agendada."
                items={auds.slice(0, 2).map((a) => ({ key: a.id, to: procLink(a.numero, 'Audiências', a.id), title: a.kind === 'audiencia' ? a.tipo : a.descricao, meta: a.cliente, right: diasAte(a.data) === 0 ? 'Hoje' : a.data.split(' ')[0] }))}
              />
            </div>
          </div>
        </Panel>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        <Panel title="Clientes recentes" to="/clientes">
          <MiniList empty="Nenhum cliente." items={clis.map((c) => ({ key: c.id, to: `/clientes/${c.id}`, title: c.nome, meta: c.tipo, right: <StatusBadge tone={c.status} /> }))} />
        </Panel>
        <Panel title="Documentos recentes" to="/documentos">
          <MiniList empty="Nenhum documento." items={docs.map((d) => ({ key: `${d.numero}-${d.id}`, to: procLink(d.numero, 'Documentos', d.id), title: d.nome, meta: `${d.tipo} · ${d.cliente}`, right: d.data.split(' ')[0] }))} />
        </Panel>
        <Panel title="Movimentações recentes" to="/processos">
          <MiniList empty="Nenhuma movimentação." items={atividades.map((a) => ({ key: a.id, to: procLink(a.numero, 'Timeline', a.id), title: a.tipo, meta: `${a.cliente} · ${a.descricao}`, right: a.data.split(' ')[0] }))} />
        </Panel>
      </div>
    </>
  );
}
