import { Navigate, Link } from 'react-router';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { AreaList } from '../components/Areas';
import { Card, PanelHeader } from '../components/ui';
import { perfilLabel } from '../components/MembroDetalhe';
import { PERMISSOES, useStore } from '../store';

export function Usuarios() {
  const { can, role, user } = useStore();
  if (!can('gerenciarUsuarios'))
    return <main className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-xl font-semibold text-ink">Acesso restrito</h1><p className="mt-2 text-sm text-muted">Esta área é exclusiva para administradores.</p></main>;

  const permissions = PERMISSOES.filter((permission) => permission.perfis.includes(role));

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-7 md:px-8">
      <header className="mb-6 flex items-start gap-3">
        <span className="mt-1 rounded-md bg-[var(--color-teal)]/10 p-2 text-[var(--color-teal)]"><ShieldCheck size={20} /></span>
        <div>
          <p className="eyebrow">Administração · Acesso</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Permissões da conta</h1>
          <p className="mt-1 text-[13.5px] text-muted">Resumo do login atual. Esta página não consulta outros usuários nem registra histórico de atividade.</p>
        </div>
      </header>

      <Card className="mb-5">
        <PanelHeader title="Conta autenticada" subtitle="Informações do perfil desta conta." />
        <dl className="divide-y divide-line">
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-medium text-muted">Nome</dt><dd className="text-sm text-ink">{user.nome || 'Não informado'}</dd></div>
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-medium text-muted">E-mail</dt><dd className="text-sm text-ink">{user.email || 'Não informado'}</dd></div>
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-medium text-muted">Perfil autorizado</dt><dd className="text-sm text-ink">{perfilLabel(role)}</dd></div>
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-medium text-muted">OAB</dt><dd className="text-sm text-ink">{user.oab || 'Não informado'}</dd></div>
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-medium text-muted">Áreas jurídicas</dt><dd className="text-sm text-ink"><AreaList areas={user.areas ?? []} /></dd></div>
        </dl>
      </Card>

      <Card className="mb-5">
        <PanelHeader title="Permissões efetivas" subtitle="Ações disponíveis para o perfil autorizado desta conta." />
        <ul className="grid gap-2 px-5 py-4 sm:grid-cols-2">
          {permissions.map((permission) => <li key={permission.id} className="rounded border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink">{permission.label}</li>)}
          {permissions.length === 0 && <li className="text-[13px] text-muted">Nenhuma permissão disponível.</li>}
        </ul>
      </Card>

      <Card className="border-line bg-subtle p-5">
        <p className="text-[13px] leading-6 text-muted">Convites, partilha de registros entre logins e gestão de contas de terceiros ainda não estão disponíveis. O histórico de acessos também não é persistido.</p>
        <Link to="/configuracoes?tab=perfil" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand)] hover:underline">Abrir meu perfil <ArrowUpRight size={14} /></Link>
      </Card>
    </main>
  );
}
