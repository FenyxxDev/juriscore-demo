import { useState } from 'react';
import { Navigate } from 'react-router';
import { UserPlus } from 'lucide-react';
import { Avatar, Button, Card, PanelHeader, SearchInput, Select, StatusBadge } from '../components/ui';
import { AreaList } from '../components/Areas';
import { MembroDetalhe, perfilLabel, processosDo } from '../components/MembroDetalhe';
import { NovoMembroModal } from './Equipe';
import { AREAS, PERFIS } from '../data';
import { PERMISSOES, useStore } from '../store';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Usuarios() {
  const { can, advogados, todosProcessos } = useStore();
  const [q, setQ] = useState('');
  const [perfil, setPerfil] = useState('todos');
  const [area, setArea] = useState('todas');
  const [status, setStatus] = useState('todos');
  const [openId, setOpenId] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  if (!can('gerenciarUsuarios')) return <Navigate to="/dashboard" replace />;

  const rows = advogados.filter(
    (a) =>
      (!q || norm(`${a.nome} ${a.email} ${a.oab}`).includes(norm(q))) &&
      (perfil === 'todos' || a.perfil === perfil) &&
      (area === 'todas' || a.areas.includes(area)) &&
      (status === 'todos' || (status === 'ativo') === a.ativo),
  );
  const aberto = advogados.find((a) => a.id === openId);

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Usuários</h1>
          <p className="mt-1 text-[13.5px] text-muted">Contas, perfis de acesso e carga de trabalho do escritório.</p>
        </div>
        <Button icon={<UserPlus size={16} />} onClick={() => setNovo(true)}>Convidar usuário</Button>
      </header>

      <Card>
        <PanelHeader title="Contas" subtitle={`${rows.length} de ${advogados.length} · ${advogados.filter((a) => a.ativo).length} ativas`} />
        <div className="flex flex-wrap gap-2.5 border-b border-line px-5 py-3">
          <SearchInput className="min-w-[220px] flex-1" placeholder="Nome, e-mail ou OAB" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar usuários" />
          <Select value={perfil} onChange={(e) => setPerfil(e.target.value)} aria-label="Perfil">
            <option value="todos">Todos os perfis</option>
            {PERFIS.map((p) => <option key={p} value={p}>{perfilLabel(p)}</option>)}
          </Select>
          <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área jurídica">
            <option value="todas">Todas as áreas</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="text-left">
                {['Usuário', 'Perfil', 'OAB', 'Área jurídica', 'Status', 'Processos', 'Última atividade', 'Permissões'].map((h) => (
                  <th key={h} className="eyebrow px-5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const n = processosDo(a, todosProcessos).filter((p) => !p.arquivado).length;
                const perms = PERMISSOES.filter((x) => x.perfis.includes(a.perfil)).length;
                return (
                  <tr key={a.id} onClick={() => setOpenId(a.id)} className="cursor-pointer border-t border-line transition-colors hover:bg-subtle">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={a.nome} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{a.nome}</p>
                          <p className="truncate text-[12px] text-muted">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink">{perfilLabel(a.perfil)}</td>
                    <td className="ident px-5 py-3 text-[12.5px] text-muted">{a.oab || '·'}</td>
                    <td className="max-w-[240px] px-5 py-3"><AreaList areas={a.areas} /></td>
                    <td className="px-5 py-3"><StatusBadge tone={a.ativo ? 'ativo' : 'inativo'} /></td>
                    <td className="tnum px-5 py-3 text-ink">{n}</td>
                    <td className="tnum px-5 py-3 text-[12.5px] text-muted">{a.ultimaAtividade}</td>
                    <td className="tnum px-5 py-3 text-[12.5px] text-muted">{perms}/{PERMISSOES.length}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={8} className="px-5 py-14 text-center text-[13px] text-muted">Nenhum usuário corresponde aos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {aberto && <MembroDetalhe membro={aberto} onClose={() => setOpenId(null)} />}
      {novo && <NovoMembroModal onClose={() => setNovo(false)} />}
    </div>
  );
}
