import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Users } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  useToast,
} from '../components/ui';
import { AREAS } from '../data';
import { useStore } from '../store';

const PER_PAGE = 6;

export function Clientes() {
  const { clientes, processos, dispatch, can } = useStore();
  const podeCriar = can('cadastrarCliente');
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [comProc, setComProc] = useState('todos');
  const [area, setArea] = useState('todos');
  const [adv, setAdv] = useState('todos');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const countFor = (id: string) => processos.filter((p) => p.clienteId === id).length;

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const n = countFor(c.id);
      if (query && !`${c.nome} ${c.documento}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (tipo !== 'todos' && c.tipo !== tipo) return false;
      if (comProc === 'com' && n === 0) return false;
      if (comProc === 'sem' && n > 0) return false;
      const procs = processos.filter((p) => p.clienteId === c.id);
      if (area !== 'todos' && !procs.some((p) => p.area === area)) return false;
      if (adv !== 'todos' && !procs.some((p) => p.responsavel === adv)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, processos, query, tipo, comProc, area, adv]);
  const active = [tipo, comProc, area, adv].filter((f) => f !== 'todos').length + (query ? 1 : 0);
  const reset = () => {
    setQuery('');
    setTipo('todos');
    setComProc('todos');
    setArea('todos');
    setAdv('todos');
    setPage(1);
  };

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-ink">Clientes</h1>
          <p className="mt-1 text-muted">Gerencie as pessoas e empresas do seu escritório.</p>
        </div>
        {podeCriar && (
          <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Novo cliente
          </Button>
        )}
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <SearchInput
            placeholder="Buscar por nome, CPF/CNPJ..."
            className="min-w-[240px] flex-1"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <Select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }} aria-label="Tipo de pessoa">
            <option value="todos">Todos os tipos</option>
            <option value="Pessoa Física">Pessoa Física</option>
            <option value="Pessoa Jurídica">Pessoa Jurídica</option>
          </Select>
          <Select value={comProc} onChange={(e) => { setComProc(e.target.value); setPage(1); }} aria-label="Processos">
            <option value="todos">Com e sem processos</option>
            <option value="com">Com processos</option>
            <option value="sem">Sem processos</option>
          </Select>
          <Select value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} aria-label="Área jurídica">
            <option value="todos">Todas as áreas</option>
            {AREAS.filter((a) => processos.some((p) => p.area === a)).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Select value={adv} onChange={(e) => { setAdv(e.target.value); setPage(1); }} aria-label="Advogado responsável">
            <option value="todos">Todos os advogados</option>
            {[...new Set(processos.map((p) => p.responsavel))].sort().map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          {active > 0 && (
            <button onClick={reset} className="text-[13px] font-medium text-teal hover:underline">
              Limpar filtros ({active})
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users size={26} />}
            title={clientes.length === 0 ? 'Você ainda não possui clientes cadastrados.' : 'Nenhum cliente encontrado.'}
            description={
              clientes.length === 0
                ? 'Comece adicionando o primeiro cliente ao seu escritório.'
                : 'Ajuste a busca ou os filtros para ver resultados.'
            }
            action={
              clientes.length === 0 ? (
                podeCriar ? (
                  <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
                    Cadastrar primeiro cliente
                  </Button>
                ) : undefined
              ) : (
                <Button variant="secondary" onClick={reset}>
                  Limpar filtros
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Nome</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Nº de processos</th>
                    <th className="px-5 py-3">Última atualização</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/clientes/${c.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/clientes/${c.id}`)}
                      className="cursor-pointer border-t border-line hover:bg-slate-50/70 focus:bg-slate-50"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-ink">{c.nome}</span>
                        <span className="block text-[13px] text-muted">{c.documento}</span>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{c.tipo}</td>
                      <td className="px-5 py-3.5 text-ink">{countFor(c.id)}</td>
                      <td className="px-5 py-3.5 text-muted">{c.atualizacao}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-[13px] text-muted">
              <span>
                {filtered.length} cliente{filtered.length !== 1 && 's'} · {PER_PAGE} por página
              </span>
              <Pagination page={current} pages={pages} onChange={setPage} />
            </div>
          </>
        )}
      </Card>

      <NovoClienteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(cliente) => {
          dispatch({ type: 'addCliente', cliente });
          setModalOpen(false);
          toast({ tone: 'success', message: `Cliente "${cliente.nome}" cadastrado.` });
        }}
      />
    </div>
  );
}

export function NovoClienteModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (c: { nome: string; tipo: 'Pessoa Física' | 'Pessoa Jurídica'; documento: string }) => void;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'Pessoa Física' | 'Pessoa Jurídica'>('Pessoa Física');
  const [documento, setDocumento] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErr('Informe o nome do cliente.');
      return;
    }
    onSave({ nome: nome.trim(), tipo, documento: documento.trim() || '-' });
    setNome('');
    setDocumento('');
    setErr('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo cliente"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-cliente">
            Salvar cliente
          </Button>
        </>
      }
    >
      <form id="form-novo-cliente" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome / Razão social" htmlFor="cli-nome" error={err}>
          <Input
            id="cli-nome"
            value={nome}
            invalid={!!err}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: João da Silva"
          />
        </Field>
        <Field label="Tipo" htmlFor="cli-tipo">
          <Select
            id="cli-tipo"
            className="h-10 w-full"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
          >
            <option>Pessoa Física</option>
            <option>Pessoa Jurídica</option>
          </Select>
        </Field>
        <Field label="CPF / CNPJ" htmlFor="cli-doc" hint="Opcional neste protótipo.">
          <Input
            id="cli-doc"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="000.000.000-00"
          />
        </Field>
      </form>
    </Modal>
  );
}
