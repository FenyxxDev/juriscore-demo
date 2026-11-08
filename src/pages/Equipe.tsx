import { Link } from 'react-router';
import { ArrowUpRight, BriefcaseBusiness, Mail, Scale, Users } from 'lucide-react';
import { Avatar, Card } from '../components/ui';
import { AreaList } from '../components/Areas';
import { perfilLabel } from '../components/MembroDetalhe';
import { useStore } from '../store';

export function Equipe() {
  const { processos, role, user } = useStore();
  const activeCases = processos.filter((processo) =>
    !processo.arquivado && processo.status !== 'encerrado' && processo.responsavel === user.nome,
  ).length;

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-7 md:px-8">
      <header className="mb-6">
        <p className="eyebrow">Conta</p>
        <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Perfil profissional</h1>
        <p className="mt-1 text-[13.5px] text-muted">Informações do login atual e dos registros privados desta conta.</p>
      </header>

      <Card className="mb-5 border-line bg-subtle p-4 text-[13px] leading-6 text-muted">
        Esta área não lista outros usuários. Convites, partilha de registros e gestão de equipe entre logins ainda não estão disponíveis.
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-5">
          <Avatar name={user.nome || 'Conta'} size={52} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold text-ink">{user.nome || 'Nome não informado'}</h2>
            <p className="mt-0.5 text-[13px] text-muted">{perfilLabel(role)}</p>
          </div>
          <Link to="/configuracoes?tab=perfil" className="inline-flex items-center gap-1.5 rounded border border-line-strong bg-white px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-slate-50">
            Editar meu perfil <ArrowUpRight size={14} />
          </Link>
        </div>
        <dl className="divide-y divide-line">
          <div className="grid gap-2 px-5 py-3.5 sm:grid-cols-[190px_1fr]"><dt className="flex items-center gap-2 text-xs font-medium text-muted"><Mail size={13} /> E-mail</dt><dd className="text-sm text-ink">{user.email || 'Não informado'}</dd></div>
          <div className="grid gap-2 px-5 py-3.5 sm:grid-cols-[190px_1fr]"><dt className="flex items-center gap-2 text-xs font-medium text-muted"><Scale size={13} /> OAB ou vínculo</dt><dd className="text-sm text-ink">{user.oab || user.equipe || 'Não informado'}</dd></div>
          <div className="grid gap-2 px-5 py-3.5 sm:grid-cols-[190px_1fr]"><dt className="flex items-center gap-2 text-xs font-medium text-muted"><Users size={13} /> Áreas jurídicas</dt><dd className="text-sm text-ink"><AreaList areas={user.areas ?? []} /></dd></div>
          <div className="grid gap-2 px-5 py-3.5 sm:grid-cols-[190px_1fr]"><dt className="flex items-center gap-2 text-xs font-medium text-muted"><BriefcaseBusiness size={13} /> Processos ativos sob este nome</dt><dd className="text-sm text-ink">{activeCases}</dd></div>
        </dl>
      </Card>
    </main>
  );
}
