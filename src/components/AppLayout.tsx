import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Bell,
  CalendarDays,
  CheckSquare,
  Check,
  CheckCheck,
  ChevronRight,
  FileText,
  Gavel,
  ListChecks,
  LogOut,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import { Avatar, cx } from './ui';
import { AssistantProvider } from './Assistant';
import type { Perfil } from '../data';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';

type NavItem = { to: string; label: string; icon: typeof Bell; roles?: Perfil[] };

const navGroups: { heading: string; items: NavItem[] }[] = [
  { heading: 'Gestão', items: [{ to: '/clientes', label: 'Clientes', icon: Users }] },
];

function SidebarItem({ to, label, Icon }: { to: string; label: string; Icon: typeof Bell }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cx(
              'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-teal)] transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon size={17} className="shrink-0" strokeWidth={1.75} />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const { authed, role } = useStore();
  if (!authed) return <Navigate to="/" replace />;

  return (
    <AssistantProvider>
      <div className="flex h-screen overflow-hidden bg-canvas">
        {/* Sidebar */}
        <aside className="hidden w-[236px] shrink-0 flex-col bg-[var(--color-brand-dark)] md:flex">
          <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-teal)] text-white">
              <Scale size={17} strokeWidth={2} />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-white">JurisCore</span>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            {navGroups.map((g) => {
              const items = g.items.filter((it) => !it.roles || it.roles.includes(role));
              if (items.length === 0) return null;
              return (
                <div key={g.heading}>
                  <p className="eyebrow px-2.5 pb-1.5 text-slate-500">{g.heading}</p>
                  <div className="space-y-0.5">
                    {items.map((n) => (
                      <SidebarItem key={n.to} to={n.to} label={n.label} Icon={n.icon} />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.06] p-3">
            <RoleSwitcher />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AssistantProvider>
  );
}

function RoleSwitcher() {
  const { user } = useStore();
  return (
    <Link
      to="/configuracoes"
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.05]"
    >
      <Avatar name={user.name} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">{user.name}</span>
        <span className="block truncate text-[11.5px] text-slate-400">{user.role === 'Administrador' ? 'Administrador ou Gestor' : user.role === 'Assistente' ? 'Assistente jurídico' : user.role}</span>
      </span>
      <ChevronRight size={15} className="text-slate-500" />
    </Link>
  );
}

function Notificacoes() {
  const { notificacoes, naoLidas, dispatch } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const list = notificacoes;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações (${naoLidas} não lidas)`}
        aria-expanded={open}
        className={cx('relative rounded-md p-2 transition-colors hover:bg-slate-100 hover:text-ink', open ? 'bg-slate-100 text-ink' : 'text-muted')}
      >
        <Bell size={18} strokeWidth={1.75} />
        {naoLidas > 0 && (
          <span className="tnum absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>
      {open && <button className="fixed inset-0 z-30 cursor-default" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} />}
      {open && (
        <div role="dialog" aria-label="Notificações" className="absolute right-0 top-full z-40 mt-2 flex max-h-[min(640px,80vh)] w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-md border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-[14px] font-semibold text-ink">Notificações</p>
              <p className="text-[12px] text-muted">{naoLidas ? `${naoLidas} não lida(s)` : 'Tudo lido'}</p>
            </div>
            <button
              disabled={!naoLidas}
              onClick={() => dispatch({ type: 'markAllRead', ids: notificacoes.map((n) => n.id) })}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-[var(--color-teal)] hover:bg-slate-50 disabled:text-[var(--color-faint)] disabled:hover:bg-transparent"
            >
              <CheckCheck size={14} /> Marcar todas como lidas
            </button>
          </div>
          <div className="border-b border-line px-4 py-2">
            <span className="text-[12px] font-semibold text-ink">Todas</span>
          </div>
          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {list.map((n) => (
              <li key={n.id} className={cx('group flex gap-3 px-4 py-3', !n.lida && 'bg-[var(--color-teal)]/[0.03]')}>
                <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.lida ? 'bg-transparent' : n.categoria === 'prazos-atrasados' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-teal)]')} />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    dispatch({ type: 'markRead', id: n.id });
                    setOpen(false);
                    navigate(n.to);
                  }}
                >
                  <p className={cx('eyebrow', n.categoria === 'prazos-atrasados' && 'text-[var(--color-danger)]')}>{n.titulo} · {n.data}</p>
                  <p className={cx('mt-0.5 text-[13px] leading-snug', n.lida ? 'text-muted' : 'font-medium text-ink')}>{n.texto}</p>
                  <p className="mt-1 text-[11.5px] text-[var(--color-faint)]">{n.lida ? 'Lida' : 'Não lida'}</p>
                </button>
                {!n.lida && (
                  <button
                    onClick={() => dispatch({ type: 'markRead', id: n.id })}
                    aria-label="Marcar como lida"
                    title="Marcar como lida"
                    className="h-7 w-7 shrink-0 rounded-md text-[var(--color-faint)] hover:bg-slate-100 hover:text-ink"
                  >
                    <Check size={14} className="mx-auto" />
                  </button>
                )}
              </li>
            ))}
            {list.length === 0 && <li className="px-4 py-12 text-center text-[13px] text-muted">Nenhuma notificação nesta categoria.</li>}
          </ul>
          <Link to="/configuracoes?tab=notificacoes" onClick={() => setOpen(false)} className="border-t border-line px-4 py-2.5 text-center text-[12.5px] font-medium text-muted hover:bg-slate-50 hover:text-ink">
            Preferências de notificação
          </Link>
        </div>
      )}
    </div>
  );
}

function Topbar() {
  const { pathname } = useLocation();
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    // Primeiro limpa a sessão local e muda de rota: a UI não fica dependente da rede.
    dispatch({ type: 'logout' });
    navigate('/', { replace: true });
    // O logout remoto é melhor-effort e tem limite de tempo para não travar a aplicação.
    if (supabase) {
      void Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => window.setTimeout(resolve, 2500)),
      ]).catch(() => undefined);
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-panel px-5 md:px-7">
      <span className="flex items-center gap-2 md:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-teal)] text-white">
          <Scale size={15} />
        </span>
        <span className="font-semibold text-ink">JurisCore</span>
      </span>
      <form
        className="relative hidden max-w-md flex-1 md:block"
        onSubmit={(e) => {
          e.preventDefault();
          const v = (new FormData(e.currentTarget).get('q') as string)?.trim();
          navigate(v ? `/pesquisa?q=${encodeURIComponent(v)}` : '/pesquisa');
        }}
      >
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
        <input
          key={pathname}
          name="q"
          type="search"
          placeholder="Buscar processos, clientes, documentos…"
          aria-label="Busca global"
          className="h-9 w-full rounded-md border border-line bg-canvas pl-9 pr-16 text-sm text-ink placeholder:text-[var(--color-faint)] focus:border-[var(--color-teal)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line-strong bg-white px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-faint)] lg:block">
          ⏎
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <Notificacoes />
        <NavLink to="/dashboard" aria-label="Dashboard" className="rounded-md p-2 text-muted transition-colors hover:bg-slate-100 hover:text-ink">
          <Settings size={18} strokeWidth={1.75} />
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-slate-100 hover:text-ink"
        >
          <LogOut size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
