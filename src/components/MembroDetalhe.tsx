import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { Mail, PencilLine, Phone } from 'lucide-react';
import { AreaList, AreaTag } from './Areas';
import { Avatar, Modal, StatusBadge, Tabs, cx } from './ui';
import { type Advogado, type Perfil, diasAte } from '../data';
import { PERMISSOES, procLink, useStore } from '../store';

export const perfilLabel = (p: Perfil) => (p === 'Administrador' ? 'Administrador ou Gestor' : p === 'Assistente' ? 'Assistente jurídico' : 'Advogado');
const short = (n: string) => n.split('.')[0];

/** Processes a member is linked to: responsible lawyer, or the lawyer an assistant supports. */
export function processosDo(m: Advogado, todos: ReturnType<typeof useStore>['todosProcessos']) {
  if (m.perfil === 'Assistente') return todos.filter((p) => p.responsavel === m.equipe || m.areas.includes(p.area));
  return todos.filter((p) => p.responsavel === m.nome);
}

export function MembroDetalhe({ membro, onClose }: { membro: Advogado; onClose: () => void }) {
  const { todosProcessos, clientes, tarefas, user } = useStore();
  const [tab, setTab] = useState('Visão geral');
  const podeEditar = user.id === membro.id;

  const procs = processosDo(membro, todosProcessos).filter((p) => !p.arquivado);
  const clis = clientes.filter((c) => procs.some((p) => p.clienteId === c.id));
  const prazos = procs
    .flatMap((p) => p.prazos.filter((x) => x.status !== 'concluido').map((x) => ({ ...x, numero: p.numero })))
    .filter((x) => membro.perfil === 'Assistente' || x.responsavel === membro.nome);
  const auds = procs.flatMap((p) => p.audiencias.map((a) => ({ ...a, numero: p.numero, cliente: p.cliente }))).filter((a) => diasAte(a.data) >= 0);
  const movs = procs
    .flatMap((p) => p.movimentacoes.filter((m) => m.autor === membro.nome).map((m) => ({ ...m, numero: p.numero })))
    .slice(0, 6);
  const tks = tarefas.filter((t) => t.responsavel === membro.nome && t.status !== 'concluido');

  return (
    <Modal open onClose={onClose} title={membro.nome} description={perfilLabel(membro.perfil)} size="lg">
      <>
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={membro.nome} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusBadge tone={membro.ativo ? 'ativo' : 'inativo'} />
                {membro.oab && <span className="ident text-[12.5px] text-ink">{membro.oab}</span>}
              </div>
              <div className="mt-2">
                <p className="eyebrow mb-1">{membro.perfil === 'Assistente' ? 'Áreas acompanhadas' : 'Áreas jurídicas'}</p>
                <AreaList areas={membro.areas} full />
              </div>
            </div>
            {podeEditar && (
              <Link to="/configuracoes?tab=perfil" onClick={onClose} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-[12px] font-medium text-muted hover:bg-subtle hover:text-ink">
                <PencilLine size={14} /> Editar meu perfil
              </Link>
            )}
          </div>

          <div className="mt-5">
            <Tabs
              tabs={[
                { id: 'Visão geral', label: 'Visão geral' },
                { id: 'Processos', label: 'Processos', count: procs.length },
                { id: 'Agenda', label: 'Prazos e audiências', count: prazos.length + auds.length },
                { id: 'Atividade', label: 'Atividade' },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          <div className="mt-4 min-h-[220px]">
            {tab === 'Visão geral' && (
              <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
                <Info label="E-mail"><span className="inline-flex items-center gap-1.5"><Mail size={13} className="text-[var(--color-faint)]" />{membro.email}</span></Info>
                <Info label="Telefone"><span className="inline-flex items-center gap-1.5"><Phone size={13} className="text-[var(--color-faint)]" />{membro.telefone || 'Não informado'}</span></Info>
                {membro.perfil === 'Advogado' && (
                  <>
                    <Info label="OAB · UF"><span className="ident">{membro.oab || 'Não informada'}</span></Info>
                    <Info label="Especialidade">{membro.especialidade || 'Não informada'}{membro.anosExperiencia != null && <span className="text-muted"> · {membro.anosExperiencia} anos de experiência</span>}</Info>
                  </>
                )}
                {membro.perfil === 'Assistente' && <Info label="Advogado responsável ou equipe">{membro.equipe || 'Não definido'}</Info>}
                {membro.perfil === 'Administrador' && (
                  <>
                    <Info label="Cargo">{membro.cargo || 'Não informado'}</Info>
                    <Info label="Escritório">{membro.escritorio || 'Não informado'}</Info>
                  </>
                )}
                <Info label="Clientes relacionados">{clis.length ? clis.map((c) => c.nome).join(', ') : 'Nenhum'}</Info>
                <Info label="Tarefas em aberto">{tks.length}</Info>
                <Info label="Última atividade">{membro.ultimaAtividade}</Info>
                <Info label="Permissões">
                  {PERMISSOES.filter((x) => x.perfis.includes(membro.perfil)).length} de {PERMISSOES.length} ações
                </Info>
              </dl>
            )}

            {tab === 'Processos' && (
              <ul className="divide-y divide-line rounded-md border border-line">
                {procs.map((p) => (
                  <li key={p.numero}>
                    <Link to={procLink(p.numero)} onClick={onClose} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-subtle">
                      <span className="min-w-0">
                        <span className="ident block text-[12.5px] text-ink">{short(p.numero)}</span>
                        <span className="block truncate text-[12px] text-muted">{p.cliente}</span>
                      </span>
                      <AreaTag area={p.area} />
                      <StatusBadge tone={p.status} />
                    </Link>
                  </li>
                ))}
                {!procs.length && <Empty>Nenhum processo atribuído.</Empty>}
              </ul>
            )}

            {tab === 'Agenda' && (
              <ul className="divide-y divide-line rounded-md border border-line">
                {prazos.map((x) => (
                  <li key={x.id}>
                    <Link to={procLink(x.numero, 'Prazos', x.id)} onClick={onClose} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-subtle">
                      <span className="min-w-0">
                        <span className="eyebrow block">Prazo · {short(x.numero)}</span>
                        <span className="block truncate text-[13px] text-ink">{x.descricao}</span>
                      </span>
                      <span className={cx('tnum text-[12.5px]', diasAte(x.data) < 0 ? 'font-medium text-[var(--color-danger)]' : 'text-muted')}>{x.data}</span>
                    </Link>
                  </li>
                ))}
                {auds.map((a) => (
                  <li key={a.id}>
                    <Link to={procLink(a.numero, 'Audiências', a.id)} onClick={onClose} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-subtle">
                      <span className="min-w-0">
                        <span className="eyebrow block">Audiência · {a.cliente}</span>
                        <span className="block truncate text-[13px] text-ink">{a.tipo}</span>
                      </span>
                      <span className="tnum text-[12.5px] text-muted">{a.data}</span>
                    </Link>
                  </li>
                ))}
                {!prazos.length && !auds.length && <Empty>Sem prazos ou audiências em aberto.</Empty>}
              </ul>
            )}

            {tab === 'Atividade' && (
              <ul className="space-y-3">
                {movs.map((m) => (
                  <li key={m.id} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-teal)]" />
                    <div className="min-w-0 text-[13px]">
                      <p className="text-ink"><span className="font-medium">{m.tipo}</span> <span className="text-muted">· {m.data}</span></p>
                      <p className="text-muted">{m.descricao}</p>
                      <Link to={procLink(m.numero, 'Timeline', m.id)} onClick={onClose} className="ident text-[11.5px] text-[var(--color-teal)] hover:underline">{short(m.numero)}</Link>
                    </div>
                  </li>
                ))}
                {!movs.length && <p className="py-10 text-center text-[13px] text-muted">Nenhuma movimentação registrada por este membro.</p>}
              </ul>
            )}
          </div>

      </>
    </Modal>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <li className="px-4 py-10 text-center text-[13px] text-muted">{children}</li>;
}
