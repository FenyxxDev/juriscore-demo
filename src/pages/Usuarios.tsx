import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, RefreshCw, Search, ShieldCheck, UserCheck, UserRoundX, X } from 'lucide-react';
import { Card } from '../components/ui';
import { useStore } from '../store';
import {
  aprovarPerfilAdmin,
  definirUsuarioAtivo,
  listarUsuariosAdmin,
  negarPerfilAdmin,
  type UsuarioAdmin,
} from '../lib/admin-users';

type Filtro = 'todos' | 'pendentes' | 'liberados' | 'desativados' | 'rejeitados';
type Acao = 'aprovar' | 'rejeitar' | 'ativar' | 'desativar';

const formatarData = (value: string | null) => {
  if (!value) return 'Nunca';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

function estadoUsuario(usuario: UsuarioAdmin) {
  if (!usuario.ativo) return { label: 'Desativado', style: 'bg-red-50 text-red-700 ring-red-200' };
  if (usuario.estadoAprovacao === 'pendente') return { label: 'Aguardando perfil', style: 'bg-amber-50 text-amber-800 ring-amber-200' };
  if (usuario.estadoAprovacao === 'rejeitado') return { label: 'Perfil não liberado', style: 'bg-red-50 text-red-700 ring-red-200' };
  if (!usuario.emailConfirmadoEm) return { label: 'E-mail pendente', style: 'bg-slate-100 text-slate-600 ring-slate-200' };
  return { label: 'Ativo', style: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
}

export function Usuarios() {
  const { role, user } = useStore();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async (page: number) => {
    setCarregando(true);
    setErro('');
    try {
      const result = await listarUsuariosAdmin(page);
      setUsuarios(result.users);
      setTemMais(result.hasMore);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar as contas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'Administrador') void carregar(pagina);
    else setCarregando(false);
  }, [carregar, pagina, role]);

  const visiveis = useMemo(() => {
    const query = busca.trim().toLocaleLowerCase('pt-BR');
    return usuarios.filter((usuario) => {
      const correspondeBusca = !query || [usuario.nome, usuario.email, usuario.perfilAprovado, usuario.perfilSolicitado]
        .some((value) => value?.toLocaleLowerCase('pt-BR').includes(query));
      const correspondeFiltro = filtro === 'todos'
        || (filtro === 'pendentes' && usuario.estadoAprovacao === 'pendente')
        || (filtro === 'liberados' && usuario.estadoAprovacao === 'liberado' && usuario.ativo)
        || (filtro === 'desativados' && !usuario.ativo)
        || (filtro === 'rejeitados' && usuario.estadoAprovacao === 'rejeitado');
      return correspondeBusca && correspondeFiltro;
    });
  }, [busca, filtro, usuarios]);

  async function executar(usuario: UsuarioAdmin, acao: Acao) {
    if (acao === 'desativar' && usuario.id === user.id) {
      setErro('Não é possível desativar a própria conta por este painel.');
      return;
    }
    const perguntas: Record<Acao, string> = {
      aprovar: `Aprovar o perfil ${usuario.perfilSolicitado} para ${usuario.email}?`,
      rejeitar: `Não liberar o perfil solicitado por ${usuario.email}? O pedido ficará marcado como rejeitado.`,
      ativar: `Reativar o acesso de ${usuario.email}?`,
      desativar: `Desativar ${usuario.email}? Novos logins serão bloqueados. Sessões abertas podem continuar até o token atual expirar.`,
    };
    if (!window.confirm(perguntas[acao])) return;

    setOcupado(usuario.id);
    setErro('');
    setMensagem('');
    try {
      if (acao === 'aprovar') await aprovarPerfilAdmin(usuario.email);
      else if (acao === 'rejeitar') await negarPerfilAdmin(usuario.id);
      else await definirUsuarioAtivo(usuario.id, acao === 'ativar');
      setMensagem(acao === 'aprovar' ? 'Perfil aprovado.' : acao === 'rejeitar' ? 'Pedido de perfil rejeitado.' : acao === 'ativar' ? 'Conta reativada.' : 'Conta desativada.');
      await carregar(pagina);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
    } finally {
      setOcupado(null);
    }
  }

  if (role !== 'Administrador') {
    return <main className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-xl font-semibold text-ink">Acesso restrito</h1><p className="mt-2 text-sm text-muted">A gestão de contas está disponível apenas para o perfil Administrador.</p></main>;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 rounded-md bg-[var(--color-teal)]/10 p-2 text-[var(--color-teal)]"><ShieldCheck size={20} /></span>
          <div>
            <p className="eyebrow">Administração · Acesso</p>
            <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Gestão de usuários</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-muted">Contas do Supabase Auth, pedidos de perfil, cargo autorizado e último login bem-sucedido.</p>
          </div>
        </div>
        <button type="button" onClick={() => void carregar(pagina)} disabled={carregando} className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </header>

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div><h2 className="text-sm font-semibold text-ink">Contas registadas</h2><p className="mt-1 text-xs text-muted">Página {pagina} · {usuarios.length} conta(s) carregada(s)</p></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1 || carregando} className="rounded border border-line px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button>
            <button type="button" onClick={() => setPagina((p) => p + 1)} disabled={!temMais || carregando} className="rounded border border-line px-3 py-1.5 text-xs disabled:opacity-40">Seguinte</button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Pesquisar nome, e-mail ou perfil" className="w-full rounded-md border border-line-strong bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--color-teal)]" />
          </label>
          <div className="flex flex-wrap gap-1.5" aria-label="Filtrar contas">
            {([
              ['todos', 'Todas'], ['pendentes', 'Aguardando'], ['liberados', 'Liberados'], ['desativados', 'Desativados'], ['rejeitados', 'Rejeitados'],
            ] as [Filtro, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFiltro(value)} aria-pressed={filtro === value} className={`rounded-full px-3 py-1.5 text-xs font-medium ${filtro === value ? 'bg-[var(--color-brand)] text-white' : 'bg-subtle text-muted hover:bg-slate-100'}`}>{label}</button>
            ))}
          </div>
        </div>

        <p className="px-5 pt-3 text-[11px] text-muted">A pesquisa e os filtros consideram apenas as contas desta página. Use “Seguinte” para avançar.</p>

        {erro && <div role="alert" className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-800">{erro}</div>}
        {mensagem && <div role="status" className="mx-5 mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">{mensagem}</div>}

        {carregando ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted"><RefreshCw size={16} className="animate-spin" /> A carregar contas...</div>
        ) : visiveis.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted">Não foram encontradas contas para este filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead><tr className="border-b border-line bg-subtle/70 text-[11px] uppercase tracking-wide text-muted"><th className="px-5 py-3 font-semibold">Usuário</th><th className="px-4 py-3 font-semibold">Cargo</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Cadastro</th><th className="px-4 py-3 font-semibold">Último login</th><th className="px-5 py-3 text-right font-semibold">Ações</th></tr></thead>
              <tbody className="divide-y divide-line">
                {visiveis.map((usuario) => {
                  const estado = estadoUsuario(usuario);
                  const self = usuario.id === user.id;
                  const podeAprovar = !self && ['Administrador', 'Assistente'].includes(usuario.perfilSolicitado ?? '') && usuario.perfilAprovado !== usuario.perfilSolicitado;
                  const ocupada = ocupado === usuario.id;
                  return (
                    <tr key={usuario.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-5 py-4"><p className="text-[13px] font-medium text-ink">{usuario.nome || 'Nome não informado'}{self && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted">Você</span>}</p><p className="mt-1 text-[12px] text-muted">{usuario.email}</p>{!usuario.emailConfirmadoEm && <p className="mt-1 text-[11px] text-amber-700">E-mail ainda não confirmado</p>}</td>
                      <td className="px-4 py-4"><p className="text-[13px] text-ink">{usuario.perfilAprovado || usuario.perfilSolicitado || 'Sem perfil'}</p>{podeAprovar && <p className="mt-1 text-[11px] text-muted">Solicitado</p>}</td>
                      <td className="px-4 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${estado.style}`}>{estado.label}</span></td>
                      <td className="px-4 py-4 text-[12px] text-muted">{formatarData(usuario.criadoEm)}</td>
                      <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 text-[12px] text-muted"><Clock3 size={13} />{formatarData(usuario.ultimoLoginEm)}</span></td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1.5">
                        {podeAprovar && <>
                          <button type="button" onClick={() => void executar(usuario, 'aprovar')} disabled={ocupada || !usuario.emailConfirmadoEm} title={!usuario.emailConfirmadoEm ? 'A conta precisa confirmar o e-mail antes da aprovação.' : 'Aprovar perfil solicitado'} className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"><Check size={13} /> Aprovar</button>
                          {usuario.estadoAprovacao === 'pendente' && <button type="button" onClick={() => void executar(usuario, 'rejeitar')} disabled={ocupada} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"><X size={13} /> Negar</button>}
                        </>}
                        {!self && <button type="button" onClick={() => void executar(usuario, usuario.ativo ? 'desativar' : 'ativar')} disabled={ocupada} className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[11px] font-medium disabled:opacity-40 ${usuario.ativo ? 'border-line-strong text-ink hover:bg-slate-50' : 'border-[var(--color-teal)]/30 text-[var(--color-teal)] hover:bg-[var(--color-teal)]/5'}`}>
                          {usuario.ativo ? <><UserRoundX size={13} /> Desativar</> : <><UserCheck size={13} /> Ativar</>}
                        </button>}
                        {self && !podeAprovar && <span className="inline-flex items-center gap-1 text-[11px] text-muted"><ShieldCheck size={13} /> Conta atual</span>}
                        {ocupada && <span className="self-center text-[11px] text-muted">A guardar...</span>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4"><div className="flex items-start gap-2.5"><Clock3 size={16} className="mt-0.5 text-[var(--color-teal)]" /><p className="text-[12px] leading-5 text-muted"><strong className="text-ink">Último login</strong> é a última autenticação bem-sucedida informada pelo Supabase; não representa todas as ações feitas dentro do sistema.</p></div></Card>
        <Card className="p-4"><div className="flex items-start gap-2.5"><X size={16} className="mt-0.5 text-muted" /><p className="text-[12px] leading-5 text-muted">Esta página apresenta pedidos de perfil e contas autenticadas. Tentativas com senha incorreta não são registadas por esta versão.</p></div></Card>
      </div>
      <p className="mt-3 text-[11.5px] leading-5 text-muted">A desativação bloqueia novos logins e renovações de sessão pelo Supabase Auth. Um token já emitido pode permanecer válido até expirar. Este painel não dá acesso a clientes, processos ou documentos de outras contas.</p>
    </main>
  );
}
