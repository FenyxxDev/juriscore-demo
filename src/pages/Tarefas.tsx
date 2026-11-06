import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CheckSquare, Plus } from 'lucide-react';
import { Button, Card, Metric, PriorityPill, SearchInput, Segmented, Select, StatusBadge, cx, useToast } from '../components/ui';
import { AreaTag } from '../components/Areas';
import { NovoEventoModal } from '../components/NovoEventoModal';
import { AREAS } from '../data';
import { procLink, useStore } from '../store';
import { setProcessTaskStatus } from '../lib/schedule';

type Filtro = 'todas' | 'pendente' | 'atrasado' | 'concluido';
const short = (n: string) => n.split('.')[0];

export function Tarefas() {
  const { tarefas, advogados, processos, refreshWorkspace, user, can } = useStore();
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [resp, setResp] = useState('todos');
  const [q, setQ] = useState('');
  const [area, setArea] = useState('todos');
  const [open, setOpen] = useState(false);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const areaOf = useMemo(() => new Map(processos.map((p) => [p.numero, p.area])), [processos]);

  const rows = useMemo(
    () =>
      tarefas.filter(
        (t) =>
          (filtro === 'todas' || t.status === filtro) &&
          (resp === 'todos' || t.responsavel === resp) &&
          (area === 'todos' || areaOf.get(t.numero) === area) &&
          (!q || `${t.titulo} ${t.numero} ${t.cliente}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [tarefas, filtro, resp, area, q, areaOf],
  );
  const areas = AREAS.filter((a) => tarefas.some((t) => areaOf.get(t.numero) === a));
  const active = [resp, area].filter((f) => f !== 'todos').length + (filtro !== 'todas' ? 1 : 0) + (q ? 1 : 0);
  const reset = () => {
    setFiltro('todas');
    setResp('todos');
    setArea('todos');
    setQ('');
  };
  const responsaveis = advogados.filter((a) => a.perfil !== 'Assistente').map((a) => a.nome);

  async function toggleTask(id: string, isDone: boolean) {
    if (savingTask) return;
    setSavingTask(id);
    try {
      await setProcessTaskStatus(id, isDone ? 'pendente' : 'concluido');
      await refreshWorkspace(user.id);
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar a tarefa.' });
    } finally {
      setSavingTask(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Acompanhamento</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Tarefas</h1>
          <p className="mt-1 text-[13.5px] text-muted">Atividades internas vinculadas aos processos desta conta.</p>
        </div>
        {can('distribuirTarefas') && (
          <Button onClick={() => setOpen(true)} icon={<Plus size={16} />}>Nova tarefa</Button>
        )}
      </header>

      <Card className="mb-6 grid grid-cols-3 divide-x divide-line">
        <Metric label="Pendentes" value={tarefas.filter((t) => t.status === 'pendente').length} />
        <Metric label="Atrasadas" value={tarefas.filter((t) => t.status === 'atrasado').length} hint="Fora do prazo" hintTone="danger" />
        <Metric label="Concluídas" value={tarefas.filter((t) => t.status === 'concluido').length} hint="Finalizadas" hintTone="success" />
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: 'pendente', label: 'Pendentes' },
            { value: 'atrasado', label: 'Atrasadas' },
            { value: 'concluido', label: 'Concluídas' },
          ]}
        />
        <Select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
          <option value="todos">Todos os responsáveis</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por tarefa, processo ou cliente..." className="min-w-[240px] flex-1" />
        <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área jurídica">
          <option value="todos">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        {active > 0 && (
          <button onClick={reset} className="text-[13px] font-medium text-teal hover:underline">
            Limpar filtros ({active})
          </button>
        )}
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-muted">
            {tarefas.length === 0 ? 'Nenhuma tarefa cadastrada.' : 'Nenhuma tarefa corresponde à busca ou aos filtros.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => {
              const done = t.status === 'concluido';
              return (
                <li key={t.id} className="flex items-start gap-3.5 px-5 py-3.5">
                  <button
                    onClick={() => { void toggleTask(t.id, done); }}
                    disabled={savingTask === t.id}
                    aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
                    className={cx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
                      done ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white' : 'border-line-strong hover:border-[var(--color-teal)]',
                    )}
                  >
                    {done && <CheckSquare size={13} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm', done ? 'text-muted line-through' : 'text-ink')}>{t.titulo}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-faint)]">
                      <Link to={procLink(t.numero)} className="ident hover:text-[var(--color-teal)]">{short(t.numero)}</Link>
                      {' · '}{t.cliente} · {t.responsavel}
                      {areaOf.get(t.numero) && (
                        <span className="ml-3 inline-flex align-middle">
                          <AreaTag area={areaOf.get(t.numero)!} />
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <PriorityPill level={t.prioridade} />
                    <span className="tnum hidden text-[12.5px] text-muted sm:inline">{t.data}</span>
                    <StatusBadge tone={t.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <NovoEventoModal open={open} onClose={() => setOpen(false)} tipoInicial="tarefa" />
    </div>
  );
}
