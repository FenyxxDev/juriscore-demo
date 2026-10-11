import { useNavigate } from 'react-router';
import { LogOut, Mail, Shield, User } from 'lucide-react';
import { Avatar, Button, Card } from '../components/ui';
import { useStore } from '../store';

export function Perfil() {
  const { user, stats, dispatch } = useStore();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-[820px] px-5 py-7 md:px-8">
      <h1 className="mb-6 text-[28px] font-semibold text-ink">Perfil</h1>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} size={64} />
          <div className="min-w-0">
            <p className="text-xl font-semibold text-ink">{user.name}</p>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
              <Shield size={12} /> {user.role}
            </span>
          </div>
          <Button
            variant="secondary"
            className="ml-auto"
            icon={<LogOut size={16} />}
            onClick={() => {
              dispatch({ type: 'logout' });
              navigate('/');
            }}
          >
            Sair da conta
          </Button>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          <Info icon={<User size={15} />} label="Nome" value={user.name} />
          <Info icon={<Mail size={15} />} label="E-mail" value={user.email} />
          <Info icon={<Shield size={15} />} label="Perfil de acesso" value={user.role} />
          <Info icon={<User size={15} />} label="Processos ativos no escritório" value={String(stats.ativos)} />
        </dl>
      </Card>

      <p className="mt-4 text-xs text-muted">
        Sessão autenticada. As páginas privadas exigem login. Ao sair, você será redirecionado à tela de acesso.
      </p>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {icon} {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
