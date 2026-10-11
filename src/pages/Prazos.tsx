import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarClock, Plus } from 'lucide-react';
import { Button, Card, EmptyState, Metric, PriorityPill, SearchInput, Segmented, Select, StatusBadge, cx } from '../components/ui';
import { AreaTag } from '../components/Areas';
import { NovoEventoModal } from '../components/NovoEventoModal';
import { AREAS, diasAte } from '../data';
import { procLink, useStore } from '../store';

type Filtro = 'todos' | 'atrasado' | 'hoje' | 'futuro';
const short = (n: string) => n.split('.')[0];
const toneRow = { atrasado: 'text-[var(--color-danger)]', hoje: 'text-[var(--color-warning)]', futuro: 'text-muted' } as const;
const toneLabel = { atrasado: 'Atrasado', hoje: 'Vence hoje', futuro: 'No prazo' } as const;

export function Prazos() {
  const { eventos, advogados, processos, dispatch, can } = useStore();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [resp, setResp] = useState('todos');
  const [q, setQ] = useState('');
  const [area, setArea] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [novo, setNovo] = useState(false);
  const areaOf = useMemo(() => new Map(processos.map((p) => [p.numero, p.area])), [processos]);

  const prazos = useMemo(
    () => eventos.flatMap((e) => (e.kind === 'prazo' && e.status !== 'concluido' ? [e] : [])),
    [eventos],
  );
  const rows = useMemo(
    () =>
      prazos.filter((p) => {
        if (filtro !== 'todos' && p.tone !== filtro) return false;
        if (resp !== 'todos' && p.responsavel !== resp) return false;
        if (area !== 'todos' && areaOf.get(p.numero) !== area) return false;
        if (periodo !== 'todos') {
          const d = diasAte(p.data);
          if (periodo === 'atrasados' && d >= 0) return false;
          if (periodo === 'hoje' && d !== 0) return false;
          if ((periodo === '7' || periodo === '30') && !(d >= 0 && d <= Number(periodo))) return false;
        }
        return !q || `${p.descricao} ${p.numero} ${p.cliente} ${p.responsavel}`.toLowerCase().includes(q.toLowerCase());
      }),
    [prazos, filtro, resp, area, periodo, q, areaOf],
  );
  const active = [filtro, resp, area, periodo].filter((f) => f !== 'todos').length + (q ? 1 : 0);
  const reset = () => {
    setFiltro('todos');
    setResp('todos');
    setArea('todos');
    setPeriodo('todos');
    setQ('');
  };
  const areas = AREAS.filter((a) => prazos.some((p) => areaOf.get(p.numero) === a));
  const responsaveis = advogados.filter((a) => a.perfil === 'Advogado').map((a) => a.nome);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Acompanhamento</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Prazos</h1>
          <p className="mt-1 text-[13.5px] text-muted">Controle de prazos processuais por urgência e responsável.</p>
        </div>
        {can('gerenciarPrazos') && (
          <Button onClick={() => setNovo(true)} icon={<Plus size={16} />}>Novo prazo</Button>
        )}
      </header>

      <Card className="mb-6 grid grid-cols-3 divide-x divide-line">
        <Metric label="Atrasados" value={prazos.filter((p) => p.tone === 'atrasado').length} hint="Atenção imediata" hintTone="danger" />
        <Metric label="Vencem hoje" value={prazos.filter((p) => p.tone === 'hoje').length} hint="Para manifestar" hintTone="warning" />
        <Metric label="No prazo" value={prazos.filter((p) => p.tone === 'futuro').length} hint="Em acompanhamento" />
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'atrasado', label: 'Atrasados' },
            { value: 'hoje', label: 'Hoje' },
            { value: 'futuro', label: 'Futuros' },
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
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por prazo, processo ou cliente..." className="min-w-[240px] flex-1" />
        <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área jurídica">
          <option value="todos">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período">
          <option value="todos">Qualquer período</option>
          <option value="atrasados">Atrasados</option>
          <option value="hoje">Hoje</option>
          <option value="7">Próximos 7 dias</option>
          <option value="30">Próximos 30 dias</option>
        </Select>
        {active > 0 && (
          <button onClick={reset} className="text-[13px] font-medium text-teal hover:underline">
            Limpar filtros ({active})
          </button>
        )}
      </div>

      <Card>
        {rows.length === 0 ? (
          prazos.length === 0 ? (
            <EmptyState icon={<CalendarClock size={22} />} title="Nenhum prazo pendente" description="Não há prazos em aberto nos processos do escritório." />
          ) : (
            <EmptyState icon={<CalendarClock size={22} />} title="Nenhum prazo neste filtro" description="Ajuste a busca ou os filtros para ver resultados." action={<Button variant="secondary" onClick={reset}>Limpar filtros</Button>} />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left">
                  {['Prazo', 'Processo', 'Responsável', 'Data', 'Situação', 'Prioridade', ''].map((h) => (
                    <th key={h} className="eyebrow px-5 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={`${p.numero}-${p.id}`} className="border-t border-line hover:bg-subtle">
                    <td className="px-5 py-3">
                      <Link to={procLink(p.numero, 'Prazos', p.id)} className="text-ink hover:text-[var(--color-teal)]">{p.descricao}</Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link to={procLink(p.numero, 'Prazos', p.id)} className="ident block text-[12.5px] text-muted hover:text-[var(--color-teal)]">
                        {short(p.numero)}
                      </Link>
                      {areaOf.get(p.numero) && <AreaTag area={areaOf.get(p.numero)!} />}
                    </td>
                    <td className="px-5 py-3 text-muted">{p.responsavel}</td>
                    <td className={cx('tnum px-5 py-3 font-medium', toneRow[p.tone])}>
                      {p.data} · {toneLabel[p.tone]}
                    </td>
                    <td className="px-5 py-3"><StatusBadge tone={p.status} /></td>
                    <td className="px-5 py-3"><PriorityPill level={p.prioridade} /></td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => dispatch({ type: 'setPrazoStatus', numero: p.numero, prazoId: p.id, status: 'concluido' })}
                      >
                        Concluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NovoEventoModal open={novo} onClose={() => setNovo(false)} tipoInicial="prazo" />
    </div>
  );
}
