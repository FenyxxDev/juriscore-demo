import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Mail, Plus, Scale } from 'lucide-react';
import { Avatar, Breadcrumb, Button, Card, EmptyState, StatusBadge } from '../components/ui';
import { NovoProcessoModal } from '../components/NovoProcessoModal';
import { useStore } from '../store';

export function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clientes, processos } = useStore();
  const [novoOpen, setNovoOpen] = useState(false);

  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) return <Navigate to="/clientes" replace />;

  const meus = processos.filter((p) => p.clienteId === cliente.id);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <Breadcrumb items={[{ label: 'Clientes' }, { label: cliente.nome }]} />

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={cliente.nome} size={56} />
          <div>
            <h1 className="text-2xl font-semibold text-ink">{cliente.nome}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span>{cliente.tipo}</span>
              <span>{cliente.documento}</span>
              <StatusBadge tone={cliente.status} />
            </div>
          </div>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setNovoOpen(true)}>
          Criar processo
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Dados de contato</h2>
          <ul className="space-y-2.5 text-sm text-muted">
            <li className="flex items-center gap-2">
              <Mail size={15} /> contato@{cliente.nome.split(' ')[0].toLowerCase()}.com.br
            </li>
            <li className="flex items-center gap-2">
              <Scale size={15} /> {meus.length} processo{meus.length !== 1 && 's'} vinculado{meus.length !== 1 && 's'}
            </li>
            <li>Última atualização: {cliente.atualizacao}</li>
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Processos do cliente</h2>
          </div>
          {meus.length === 0 ? (
            <EmptyState
              icon={<Scale size={26} />}
              title="Nenhum processo para este cliente."
              description="Crie o primeiro processo vinculado a este cliente."
              action={
                <Button icon={<Plus size={16} />} onClick={() => setNovoOpen(true)}>
                  Criar processo
                </Button>
              }
            />
          ) : (
            <ul>
              {meus.map((p) => (
                <li key={p.numero} className="border-t border-line first:border-t-0">
                  <Link
                    to={`/processos/${encodeURIComponent(p.numero)}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{p.numero}</p>
                      <p className="text-[13px] text-muted">
                        {p.area} · {p.responsavel}
                      </p>
                    </div>
                    <StatusBadge tone={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <NovoProcessoModal open={novoOpen} onClose={() => setNovoOpen(false)} fixedClienteId={cliente.id} />

      <button onClick={() => navigate('/clientes')} className="mt-6 text-sm font-medium text-teal hover:underline">
        ← Voltar para Clientes
      </button>
    </div>
  );
}
