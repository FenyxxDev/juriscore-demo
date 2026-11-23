import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, BriefcaseBusiness, Building2, Check, Copy, Mail, Scale, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Alert, Avatar, Button, Card, Field, Input, useToast } from '../components/ui';
import { AreaList } from '../components/Areas';
import { perfilLabel } from '../components/MembroDetalhe';
import { useStore } from '../store';
import {
  acceptOrganizationInvite,
  createOrganization,
  createOrganizationInvite,
  declineOrganizationInvite,
  loadOrganizationPageData,
  revokeOrganizationInvite,
  type OrganizationPageData,
} from '../lib/organizations';

const EMPTY_PAGE: OrganizationPageData = { organization: null, incomingInvites: [], outgoingInvites: [] };
const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));

function inviteStatus(invite: OrganizationPageData['outgoingInvites'][number]) {
  if (invite.acceptedAt) return { label: 'Aceite', className: 'bg-emerald-50 text-emerald-800' };
  if (invite.declinedAt) return { label: 'Recusado', className: 'bg-slate-100 text-slate-600' };
  if (invite.revokedAt) return { label: 'Cancelado', className: 'bg-slate-100 text-slate-600' };
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return { label: 'Expirado', className: 'bg-amber-50 text-amber-800' };
  return { label: 'A aguardar aceitação', className: 'bg-blue-50 text-blue-800' };
}

export function Equipe() {
  const { processos, role, user, advogadosOrganizacao, refreshWorkspace } = useStore();
  const toast = useToast();
  const [page, setPage] = useState<OrganizationPageData>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busyId, setBusyId] = useState('');
  const activeCases = processos.filter((processo) =>
    !processo.arquivado && processo.status !== 'encerrado' && processo.responsavel === user.nome,
  ).length;

  const reload = useCallback(async () => {
    if (!user.email) {
      setPage(EMPTY_PAGE);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      setPage(await loadOrganizationPageData(user.email));
    } catch {
      setLoadError('Não foi possível carregar a organização e os convites. Verifique a ligação e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => { void reload(); }, [reload]);

  async function perform(id: string, action: () => Promise<void>, successMessage: string) {
    setBusyId(id);
    try {
      await action();
      await reload();
      await refreshWorkspace(user.id);
      toast({ tone: 'success', message: successMessage });
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível concluir esta ação.' });
    } finally {
      setBusyId('');
    }
  }

  function submitOrganization(event: FormEvent) {
    event.preventDefault();
    const name = organizationName.trim();
    if (name.length < 2) {
      toast({ tone: 'warning', message: 'Informe um nome de organização com pelo menos dois caracteres.' });
      return;
    }
    void perform('organization', () => createOrganization(name), 'Organização criada. Os demais logins só serão associados após aceitarem um convite.');
    setOrganizationName('');
  }

  function submitInvite(event: FormEvent) {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({ tone: 'warning', message: 'Informe um endereço de e-mail válido.' });
      return;
    }
    void perform('invite', () => createOrganizationInvite(email), 'Convite criado e válido por sete dias. Envie a mensagem à pessoa convidada.');
    setInviteEmail('');
  }

  async function copyInvite(email: string, name: string) {
    const invitationText = `Você foi convidado(a) para integrar ${name} no JurisCore. Entre ou crie uma conta usando exatamente este e-mail: ${email}. Depois, acesse ${window.location.origin}/equipe e aceite o convite. A associação só acontece após a sua aceitação; clientes, processos e documentos continuam privados na conta de cada pessoa.`;
    try {
      await navigator.clipboard.writeText(invitationText);
      toast({ tone: 'success', message: 'Mensagem do convite copiada para enviar por um canal seguro.' });
    } catch {
      toast({ tone: 'error', message: 'Não foi possível copiar a mensagem neste navegador.' });
    }
  }

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-7 md:px-8">
      <header className="mb-6">
        <p className="eyebrow">Conta</p>
        <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Perfil profissional</h1>
        <p className="mt-1 text-[13.5px] text-muted">Informações do login atual, da organização e dos registos privados desta conta.</p>
      </header>

      <Card className="mb-5 overflow-hidden">
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

      {loadError && <Alert tone="error" title={loadError}><Button size="sm" variant="secondary" className="mt-2" onClick={() => void reload()}>Tentar novamente</Button></Alert>}

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Building2 size={17} className="text-teal" /> Organização e convites</h2>
            <p className="mt-1 text-[12.5px] text-muted">O directório profissional é visível apenas após aceitação explícita. Dados de clientes e processos continuam isolados por conta.</p>
          </div>
          {page.organization && <span className="rounded-full bg-teal/10 px-2.5 py-1 text-[11.5px] font-medium text-teal">{page.organization.role === 'owner' ? 'Responsável' : 'Membro'}</span>}
        </div>

        {loading ? (
          <p className="px-5 py-5 text-sm text-muted">A carregar dados de organização…</p>
        ) : (
          <div className="space-y-5 p-5">
            {page.organization ? (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Organização associada</p>
                <p className="mt-1 text-lg font-semibold text-ink">{page.organization.name}</p>
                <p className="mt-1 text-[13px] text-muted">A associação desta conta foi confirmada por convite aceite. O acesso a dados jurídicos continua restrito ao login que os registou.</p>
              </section>
            ) : (
              <section className="rounded-md border border-line bg-subtle p-4">
                <h3 className="text-sm font-semibold text-ink">Ainda não tem uma organização associada</h3>
                <p className="mt-1 text-[13px] leading-5 text-muted">Cada login pode associar-se a uma organização. Pode criar uma ou aceitar um convite dirigido ao seu e-mail confirmado. Não associamos contas por nome do escritório ou domínio de e-mail.</p>
                <form onSubmit={submitOrganization} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1"><Field label="Nome da organização" htmlFor="org-name" required><Input id="org-name" maxLength={120} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Ex.: Escritório Ramos e Associados" /></Field></div>
                  <Button type="submit" loading={busyId === 'organization'} disabled={!!busyId} icon={<Building2 size={15} />}>Criar organização</Button>
                </form>
              </section>
            )}

            {page.incomingInvites.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink">Convites recebidos para {user.email}</h3>
                <div className="space-y-2">
                  {page.incomingInvites.map((invite) => (
                    <div key={invite.id} className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3.5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{invite.organizationName}</p>
                        <p className="mt-0.5 text-[12px] text-muted">Expira em {dateLabel(invite.expiresAt)} · enviado para {invite.invitedEmail}</p>
                      </div>
                      {page.organization ? (
                        <span className="text-[12px] text-muted">Já tem uma organização associada. Recuse este convite se não o pretende manter.</span>
                      ) : (
                        <Button size="sm" disabled={!!busyId} loading={busyId === `accept-${invite.id}`} icon={<Check size={14} />} onClick={() => void perform(`accept-${invite.id}`, () => acceptOrganizationInvite(invite.id), 'Convite aceite. O directório da organização está disponível; os dados jurídicos continuam privados.')}>Aceitar</Button>
                      )}
                      <Button size="sm" variant="secondary" disabled={!!busyId} loading={busyId === `decline-${invite.id}`} onClick={() => void perform(`decline-${invite.id}`, () => declineOrganizationInvite(invite.id), 'Convite recusado.')}>Recusar</Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {page.organization?.role === 'owner' && (
              <>
                <form onSubmit={submitInvite} className="rounded-md border border-line p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><UserPlus size={15} /> Convidar membro</h3>
                  <p className="mt-1 text-[12.5px] leading-5 text-muted">O convite é dirigido a um endereço exacto, válido por sete dias. A pessoa tem de entrar com esse e-mail confirmado e aceitar.</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1"><Field label="E-mail da pessoa convidada" htmlFor="org-invite-email" required><Input id="org-invite-email" type="email" autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="advogado@escritorio.com.br" /></Field></div>
                    <Button type="submit" loading={busyId === 'invite'} disabled={!!busyId} icon={<Mail size={15} />}>Criar convite</Button>
                  </div>
                  <p className="mt-3 text-[12px] text-muted">Não enviamos e-mails automaticamente. Depois de criar o convite, copie a mensagem da lista abaixo e envie-a à pessoa por um canal seguro.</p>
                </form>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Convites enviados</h3>
                  {page.outgoingInvites.length === 0 ? (
                    <p className="rounded-md bg-subtle px-3.5 py-3 text-[13px] text-muted">Ainda não há convites enviados.</p>
                  ) : (
                    <ul className="divide-y divide-line rounded-md border border-line">
                      {page.outgoingInvites.map((invite) => {
                        const status = inviteStatus(invite);
                        const active = !invite.acceptedAt && !invite.declinedAt && !invite.revokedAt && new Date(invite.expiresAt).getTime() > Date.now();
                        return (
                          <li key={invite.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink">{invite.invitedEmail}</p>
                              <p className="mt-0.5 text-[12px] text-muted">Criado em {dateLabel(invite.createdAt)} · expira em {dateLabel(invite.expiresAt)}</p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                            {active && <>
                              <Button size="sm" variant="secondary" icon={<Copy size={13} />} onClick={() => void copyInvite(invite.invitedEmail, page.organization!.name)}>Copiar mensagem</Button>
                              <Button size="sm" variant="ghost" disabled={!!busyId} loading={busyId === `revoke-${invite.id}`} onClick={() => void perform(`revoke-${invite.id}`, () => revokeOrganizationInvite(invite.id), 'Convite cancelado.')}>Cancelar</Button>
                            </>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}

            {page.organization && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink">Advogados disponíveis para atribuição</h3>
                {advogadosOrganizacao.length === 0 ? (
                  <p className="rounded-md bg-subtle px-3.5 py-3 text-[13px] text-muted">Ainda não há advogados activos neste directório. Os nomes podem continuar a ser introduzidos manualmente nos processos.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {advogadosOrganizacao.map((lawyer) => (
                      <li key={lawyer.id} className="flex items-center gap-3 px-3.5 py-3">
                        <Avatar name={lawyer.nome} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{lawyer.nome}</p>
                          <p className="truncate text-[12px] text-muted">{lawyer.email}{lawyer.oab ? ` · ${lawyer.oab}` : ''}</p>
                        </div>
                        <ShieldCheck size={16} className="text-teal" aria-label="Membro aceite da organização" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <Alert tone="info" title="A associação não partilha registos jurídicos">
              A organização serve apenas para confirmar o vínculo profissional e mostrar advogados elegíveis nos selectors. Clientes, processos, documentos, prazos e demais dados continuam privados na conta de origem.
            </Alert>
          </div>
        )}
      </Card>
    </main>
  );
}
