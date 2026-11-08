import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, SlidersHorizontal } from 'lucide-react';
import {
  Button,
  Card,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  cx,
} from '../components/ui';
import { NovoProcessoModal } from '../components/NovoProcessoModal';
import { AreaTag } from '../components/Areas';
import { AREAS, diasAte, type Processo } from '../data';
import { listProcesses } from '../lib/processes';
import { useStore } from '../store';

const PER_PAGE = 6;
const uniq = (xs: string[]) => Array.from(new Set(xs));

export function Processos() {
  const navigate = useNavigate();
  const { can } = useStore();
  const [allProcessos, setAllProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [novoOpen, setNovoOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');
  const [cliente, setCliente] = useState('todos');
  const [resp, setResp] = useState('todos');
  const [area, setArea] = useState('todos');
  const [tribunal, setTribunal] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void listProcesses()
      .then((items) => { if (active) setAllProcessos(items); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const filtered = useMemo(() => {
    return allProcessos.filter((p) => {
      if (
        query &&
        !`${p.numero} ${p.cliente} ${p.partes.map((x) => x.nome).join(' ')}`.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      if (status !== 'todos' && p.status !== status) return false;
      if (cliente !== 'todos' && p.cliente !== cliente) return false;
      if (resp !== 'todos' && p.responsavel !== resp) return false;
      if (area !== 'todos' && p.area !== area) return false;
      if (tribunal !== 'todos' && p.tribunal !== tribunal) return false;
      if (periodo !== 'todos') {
        const d = -diasAte(p.atualizacao);
        if (periodo === '7' && !(d >= 0 && d <= 7)) return false;
        if (periodo === '30' && !(d >= 0 && d <= 30)) return false;
        if (periodo === 'parado' && !(d > 30)) return false;
      }
      return true;
    });
  }, [allProcessos, query, status, cliente, resp, area, tribunal, periodo]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const reset = () => {
    setStatus('todos');
    setCliente('todos');
    setResp('todos');
    setArea('todos');
    setTribunal('todos');
    setPeriodo('todos');
    setQuery('');
    setPage(1);
  };
  const active =
    [status, cliente, resp, area, tribunal, periodo].filter((f) => f !== 'todos').length + (query ? 1 : 0);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-ink">Processos</h1>
          <p className="mt-1 text-muted">Acompanhe o andamento de todos os seus processos.</p>
        </div>
        {can('cadastrarProcesso') && (
          <Button icon={<Plus size={16} />} onClick={() => setNovoOpen(true)}>
            Novo processo
          </Button>
        )}
      </header>

      <Card>
        <div className="border-b border-line p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              placeholder="Buscar por número, cliente ou parte..."
              className="min-w-[260px] flex-1"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <SlidersHorizontal size={15} /> Filtros
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="todos">Status</option>
              <option value="em-andamento">Em andamento</option>
              <option value="aguardando">Aguardando ação</option>
              <option value="atrasado">Atrasado</option>
              <option value="encerrado">Encerrado</option>
            </Select>
            <Select value={cliente} onChange={(e) => { setCliente(e.target.value); setPage(1); }} aria-label="Cliente">
              <option value="todos">Cliente</option>
              {uniq(allProcessos.map((p) => p.cliente)).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select value={resp} onChange={(e) => { setResp(e.target.value); setPage(1); }} aria-label="Responsável">
              <option value="todos">Responsável</option>
              {uniq(allProcessos.map((p) => p.responsavel)).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <Select value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} aria-label="Área jurídica">
              <option value="todos">Área jurídica</option>
              {AREAS.filter((a) => allProcessos.some((p) => p.area === a)).map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Select value={tribunal} onChange={(e) => { setTribunal(e.target.value); setPage(1); }} aria-label="Tribunal">
              <option value="todos">Tribunal</option>
              {uniq(allProcessos.map((p) => p.tribunal)).sort().map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={periodo} onChange={(e) => { setPeriodo(e.target.value); setPage(1); }} aria-label="Período">
              <option value="todos">Período</option>
              <option value="7">Atualizados em 7 dias</option>
              <option value="30">Atualizados em 30 dias</option>
              <option value="parado">Sem atualização há +30 dias</option>
            </Select>
            {active > 0 && (
              <button
                onClick={reset}
                className="text-[13px] font-medium text-teal hover:underline"
              >
                Limpar filtros ({active})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Número do processo</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Responsável</th>
                <th className="px-5 py-3">Área</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Próximo prazo</th>
                <th className="px-5 py-3">Atualização</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-line"><td colSpan={7} className="px-5 py-12 text-center text-muted">A carregar processos…</td></tr>
              ) : loadError ? (
                <tr className="border-t border-line"><td colSpan={7} className="px-5 py-12 text-center text-muted">
                  Não foi possível carregar os processos desta conta.{' '}
                  <button className="font-medium text-teal hover:underline" onClick={() => setReload((value) => value + 1)}>Tentar novamente</button>
                </td></tr>
              ) : rows.map((p) => (
                <tr
                  key={p.numero}
                  onClick={() => navigate(`/processos/${encodeURIComponent(p.numero)}`)}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    navigate(`/processos/${encodeURIComponent(p.numero)}`)
                  }
                  className="cursor-pointer border-t border-line hover:bg-slate-50/70 focus:bg-slate-50"
                >
                  <td className="px-5 py-3.5 font-medium text-ink">{p.numero}</td>
                  <td className="px-5 py-3.5 text-muted">{p.cliente}</td>
                  <td className="px-5 py-3.5 text-muted">{p.responsavel}</td>
                  <td className="px-5 py-3.5"><AreaTag area={p.area} /></td>
                  <td className="px-5 py-3.5">
                    <StatusBadge tone={p.status} />
                  </td>
                  {(() => {
                    const prox = p.prazos.find((x) => x.status !== 'encerrado');
                    const tone = prox?.tone;
                    return (
                      <td
                        className={cx(
                          'px-5 py-3.5',
                          tone === 'atrasado'
                            ? 'font-medium text-danger'
                            : tone === 'hoje'
                              ? 'font-medium text-warning'
                              : 'text-muted',
                        )}
                      >
                        {prox
                          ? tone === 'atrasado'
                            ? 'Atrasado'
                            : tone === 'hoje'
                              ? 'Hoje'
                              : prox.data
                          : '-'}
                      </td>
                    );
                  })()}
                  <td className="px-5 py-3.5 text-muted">{p.atualizacao}</td>
                </tr>
              ))}
              {!loading && !loadError && rows.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={7} className="px-5 py-12 text-center text-muted">
                    {allProcessos.length === 0
                      ? 'Nenhum processo cadastrado.'
                      : 'Nenhum processo corresponde aos filtros selecionados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-[13px] text-muted">
          <span>
            {filtered.length} processo{filtered.length !== 1 && 's'} · {PER_PAGE} por página
          </span>
          <Pagination page={current} pages={pages} onChange={setPage} />
        </div>
      </Card>

      <NovoProcessoModal open={novoOpen} onClose={() => setNovoOpen(false)} />
    </div>
  );
}
