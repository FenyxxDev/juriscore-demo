import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Gavel, MapPin, Monitor, Plus, Users } from 'lucide-react';
import { Button, Card, EmptyState, Metric, SearchInput, Segmented, Select, StatusBadge, cx } from '../components/ui';
import { AreaTag } from '../components/Areas';
import { NovoEventoModal } from '../components/NovoEventoModal';
import { AREAS, type Modalidade, diasAte } from '../data';
import { procLink, useStore } from '../store';

type Filtro = 'todas' | Modalidade;
const short = (n: string) => n.split('.')[0];
const modIcon = { Presencial: MapPin, Online: Monitor, 'Híbrida': Users } as const;

export function Audiencias() {
  const { eventos, processos, can } = useStore();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [q, setQ] = useState('');
  const [resp, setResp] = useState('todos');
  const [area, setArea] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [novo, setNovo] = useState(false);

  const procOf = useMemo(() => new Map(processos.map((p) => [p.numero, p])), [processos]);
  const auds = useMemo(() => eventos.flatMap((e) => (e.kind === 'audiencia' ? [e] : [])), [eventos]);
  const respOf = (a: (typeof auds)[number]) => a.responsavel || procOf.get(a.numero)?.responsavel || '';
  const responsaveis = [...new Set(auds.map(respOf).filter(Boolean))].sort();
  const areas = AREAS.filter((x) => auds.some((a) => procOf.get(a.numero)?.area === x));

  const rows = auds.filter((a) => {
    if (filtro !== 'todas' && a.modalidade !== filtro) return false;
    if (resp !== 'todos' && respOf(a) !== resp) return false;
    if (area !== 'todos' && procOf.get(a.numero)?.area !== area) return false;
    if (periodo !== 'todos') {
      const d = diasAte(a.data);
      if (periodo === 'passadas' && d >= 0) return false;
      if (periodo === 'hoje' && d !== 0) return false;
      if ((periodo === '7' || periodo === '30') && !(d >= 0 && d <= Number(periodo))) return false;
    }
    return !q || `${a.tipo} ${a.local} ${a.cliente} ${a.numero} ${a.participantes ?? ''}`.toLowerCase().includes(q.toLowerCase());
  });
  const active = [resp, area, periodo].filter((f) => f !== 'todos').length + (filtro !== 'todas' ? 1 : 0) + (q ? 1 : 0);
  const reset = () => {
    setFiltro('todas');
    setQ('');
    setResp('todos');
    setArea('todos');
    setPeriodo('todos');
  };

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Acompanhamento</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Audiências</h1>
          <p className="mt-1 text-[13.5px] text-muted">Sessões designadas: presenciais, online ou híbridas.</p>
        </div>
        {can('agendarAudiencia') && (
          <Button onClick={() => setNovo(true)} icon={<Plus size={16} />}>Agendar audiência</Button>
        )}
      </header>

      <Card className="mb-6 grid grid-cols-3 divide-x divide-line">
        <Metric label="Presenciais" value={auds.filter((a) => a.modalidade === 'Presencial').length} />
        <Metric label="Online" value={auds.filter((a) => a.modalidade === 'Online').length} />
        <Metric label="Híbridas" value={auds.filter((a) => a.modalidade === 'Híbrida').length} />
      </Card>

      <div className="mb-3">
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: 'Presencial', label: 'Presencial' },
            { value: 'Online', label: 'Online' },
            { value: 'Híbrida', label: 'Híbrida' },
          ]}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por tipo, local, cliente ou processo..." className="min-w-[240px] flex-1" />
        <Select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
          <option value="todos">Todos os responsáveis</option>
          {responsaveis.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
        <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área jurídica">
          <option value="todos">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período">
          <option value="todos">Qualquer período</option>
          <option value="hoje">Hoje</option>
          <option value="7">Próximos 7 dias</option>
          <option value="30">Próximos 30 dias</option>
          <option value="passadas">Já realizadas</option>
        </Select>
        {active > 0 && (
          <button onClick={reset} className="text-[13px] font-medium text-teal hover:underline">
            Limpar filtros ({active})
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          {auds.length === 0 ? (
            <EmptyState icon={<Gavel size={22} />} title="Nenhuma audiência" description="Ainda não há audiências designadas." />
          ) : (
            <EmptyState
              icon={<Gavel size={22} />}
              title="Nenhuma audiência neste filtro"
              description="Ajuste a busca ou os filtros para ver resultados."
              action={<Button variant="secondary" onClick={reset}>Limpar filtros</Button>}
            />
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const Icon = modIcon[a.modalidade];
            const pa = procOf.get(a.numero)?.area;
            return (
              <Card key={`${a.numero}-${a.id}`} className="flex items-center gap-4 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-dark)] text-white">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={procLink(a.numero, 'Audiências', a.id)} className="font-medium text-ink hover:text-[var(--color-teal)]">{a.tipo}</Link>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted">
                    {a.local} · {a.cliente}{respOf(a) && ` · ${respOf(a)}`}
                  </p>
                  <p className="mt-0.5 flex items-center gap-3 text-[12px] text-[var(--color-faint)]">
                    <Link to={procLink(a.numero, 'Audiências', a.id)} className="ident hover:text-[var(--color-teal)]">{short(a.numero)}</Link>
                    {pa && <AreaTag area={pa} />}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="tnum text-[13px] font-medium text-ink">{a.data}</span>
                  <span className={cx('rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-medium text-muted')}>{a.modalidade}</span>
                  <StatusBadge tone={a.status} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NovoEventoModal open={novo} onClose={() => setNovo(false)} tipoInicial="audiencia" />
    </div>
  );
}
