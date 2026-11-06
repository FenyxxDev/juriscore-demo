import { Link } from 'react-router';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui';
import { useStore } from '../store';

/** Resumo administrativo da conta atual; não se apresenta como histórico de auditoria. */
export function AdminAccessAudit() {
  const { role, user } = useStore();
  if (role !== 'Administrador') return <main className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-xl font-semibold text-ink">Acesso restrito</h1><p className="mt-2 text-sm text-muted">Esta área é exclusiva para administradores.</p></main>;

  return <main className="mx-auto max-w-[1000px] px-6 py-7 md:px-8">
    <header className="mb-6 flex items-start gap-3">
      <span className="mt-1 rounded-md bg-[var(--color-teal)]/10 p-2 text-[var(--color-teal)]"><ShieldCheck size={20}/></span>
      <div><p className="eyebrow">Administração · Segurança</p><h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Acesso da conta</h1><p className="mt-1 text-[13.5px] text-muted">Informações do login autenticado, sem consulta a outras contas.</p></div>
    </header>

    <Card className="divide-y divide-line">
      <div className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr]"><p className="text-xs font-medium text-muted">Conta</p><p className="text-sm text-ink">{user.email || 'E-mail não disponível'}</p></div>
      <div className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr]"><p className="text-xs font-medium text-muted">Perfil autorizado</p><p className="text-sm text-ink">{user.role}</p></div>
      <div className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr]"><p className="text-xs font-medium text-muted">Partilha entre logins</p><p className="text-sm text-ink">Não disponível. Esta tela não consulta contas de outras pessoas.</p></div>
    </Card>

    <Card className="mt-5 border-line bg-subtle p-5">
      <h2 className="text-sm font-semibold text-ink">Histórico de acessos</h2>
      <p className="mt-2 text-[13px] leading-6 text-muted">O sistema ainda não persiste um histórico detalhado de logins e dispositivos. Por isso, esta página não exibe contagens ou atividade que poderiam ser confundidas com um log real.</p>
      <Link to="/configuracoes?tab=seguranca" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand)] hover:underline">Abrir controlos de sessão <ArrowUpRight size={14}/></Link>
    </Card>
  </main>;
}
