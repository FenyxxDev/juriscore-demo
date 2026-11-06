import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, LogOut, Minus } from 'lucide-react';
import { Avatar, Button, Card, Field, Input, PanelHeader, Segmented, Select, Tabs, cx, useToast } from '../components/ui';
import { AreaList, AreaPicker } from '../components/Areas';
import { perfilLabel } from '../components/MembroDetalhe';
import { EMAIL_RE, PasswordInput } from './Login';
import { SenhaMeter, forcaSenha } from './Cadastro';
import { PERFIS, UFS } from '../data';
import { NOTIF_CATEGORIAS, PERMISSOES, type Preferencias, useStore } from '../store';
import { supabase } from '../lib/supabase';

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'notificacoes', label: 'Notificações' },
  { id: 'preferencias', label: 'Preferências' },
];
const TABS_ADMIN = [
  { id: 'usuarios', label: 'Usuários' },
  { id: 'permissoes', label: 'Permissões' },
  { id: 'distribuicao', label: 'Distribuição' },
  { id: 'escritorio', label: 'Escritório' },
];

export function Configuracoes() {
  const [sp, setSp] = useSearchParams();
  const { role } = useStore();
  const tabs = role === 'Administrador' ? [...TABS, ...TABS_ADMIN] : TABS;
  const tab = tabs.some((t) => t.id === sp.get('tab')) ? sp.get('tab')! : 'perfil';
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-7 md:px-8">
      <header className="mb-6">
        <p className="eyebrow">Conta</p>
        <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Configurações</h1>
      </header>
      <Tabs tabs={tabs} active={tab} onChange={(t) => setSp({ tab: t }, { replace: true })} />
      <div className="mt-6">
        {tab === 'perfil' && <PerfilTab />}
        {tab === 'seguranca' && <SegurancaTab />}
        {tab === 'usuarios' && <UsuariosTab />}
        {tab === 'permissoes' && <PermissoesTab />}
        {tab === 'notificacoes' && <NotificacoesTab />}
        {tab === 'preferencias' && <PreferenciasTab />}
        {tab === 'distribuicao' && <DistribuicaoTab />}
        {tab === 'escritorio' && <EscritorioTab />}
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line px-5 py-3.5 last:border-0">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-[var(--color-teal)]' : 'bg-slate-300')}
    >
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

/* ---------------------------------------------------------------- Perfil */

function PerfilTab() {
  const { user, advogados, dispatch } = useStore();
  const toast = useToast();
  const [f, setF] = useState({ nome: user.nome, email: user.email, telefone: user.telefone ?? '', oab: user.oab ?? '', oabUf: user.oabUf ?? 'SP', areas: user.areas, cargo: user.cargo ?? '', especialidade: user.especialidade ?? '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | string[]) => setF((s) => ({ ...s, [k]: v }));
  const isAdv = user.perfil === 'Advogado';

  async function salvar() {
    const e: Record<string, string> = {};
    if (!f.nome.trim()) e.nome = 'Informe seu nome.';
    if (!EMAIL_RE.test(f.email)) e.email = 'E-mail inválido.';
    else if (advogados.some((a) => a.id !== user.id && a.email.toLowerCase() === f.email.toLowerCase())) e.email = 'E-mail já utilizado por outra conta.';
    if (isAdv && !f.oab.trim()) e.oab = 'Informe o número da OAB.';
    if (user.perfil !== 'Administrador' && !f.areas.length) e.areas = 'Selecione ao menos uma área.';
    setErr(e);
    if (Object.keys(e).length) return;
    if (!supabase) {
      toast({ tone: 'error', message: 'Supabase não está configurado.' });
      return;
    }
    setSaving(true);
    const emailChanged = f.email.toLowerCase() !== user.email.toLowerCase();
    try {
      const { error } = await supabase.auth.updateUser({
        ...(emailChanged ? { email: f.email.trim() } : {}),
        data: {
          nome: f.nome.trim(),
          telefone: f.telefone.trim(),
          oab: isAdv ? f.oab.trim() : user.oab,
          oabUf: f.oabUf,
          areas: f.areas,
          cargo: f.cargo.trim(),
          especialidade: f.especialidade.trim(),
        },
      });
      if (error) throw error;
      dispatch({ type: 'updateUsuario', id: user.id, patch: { ...f, email: emailChanged ? user.email : f.email.trim(), oab: isAdv ? f.oab.trim() : user.oab } });
      toast({ tone: 'success', message: emailChanged ? 'Perfil atualizado. Confirme o link enviado para concluir a alteração do e-mail.' : 'Perfil atualizado.' });
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível salvar o perfil.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Avatar name={f.nome || user.nome} size={72} />
        <div>
          <p className="font-semibold text-ink">{f.nome}</p>
          <p className="text-[12.5px] text-muted">{perfilLabel(user.perfil)}</p>
        </div>
        {user.oab && <p className="ident text-[12px] text-muted">OAB {user.oab}/{user.oabUf}</p>}
        <AreaList areas={f.areas} />
      </Card>
      <Card>
        <PanelHeader title={isAdv ? 'Dados profissionais' : 'Dados pessoais'} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="c-nome" error={err.nome} required><Input id="c-nome" value={f.nome} invalid={!!err.nome} onChange={(e) => set('nome', e.target.value)} /></Field>
          <Field label="E-mail" htmlFor="c-email" error={err.email} required><Input id="c-email" value={f.email} invalid={!!err.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Telefone" htmlFor="c-tel"><Input id="c-tel" value={f.telefone} onChange={(e) => set('telefone', e.target.value)} /></Field>
          <Field label="Perfil de acesso" hint="Definido no cadastro"><Input value={perfilLabel(user.perfil)} disabled /></Field>
          {isAdv && (
            <>
              <Field label="OAB" htmlFor="c-oab" error={err.oab} required><Input id="c-oab" className="ident" value={f.oab} invalid={!!err.oab} onChange={(e) => set('oab', e.target.value)} /></Field>
              <Field label="UF da OAB" htmlFor="c-uf"><Select id="c-uf" value={f.oabUf} onChange={(e) => set('oabUf', e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
              <Field label="Especialidade" htmlFor="c-esp"><Input id="c-esp" value={f.especialidade} onChange={(e) => set('especialidade', e.target.value)} /></Field>
            </>
          )}
          {user.perfil === 'Administrador' && <Field label="Cargo" htmlFor="c-cargo"><Input id="c-cargo" value={f.cargo} onChange={(e) => set('cargo', e.target.value)} /></Field>}
          {user.perfil !== 'Administrador' && (
            <div className="sm:col-span-2">
              <Field label={isAdv ? 'Áreas de atuação' : 'Áreas acompanhadas'} error={err.areas} required>
                <AreaPicker value={f.areas} onChange={(v) => set('areas', v)} invalid={!!err.areas} />
              </Field>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-line px-5 py-3.5"><Button loading={saving} onClick={() => { void salvar(); }}>Salvar alterações</Button></div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Segurança */

function SegurancaTab() {
  const toast = useToast();
  const [encerrandoSessoes, setEncerrandoSessoes] = useState(false);
  async function encerrarSessoes() {
    if (!supabase) {
      toast({ tone: 'error', message: 'O Supabase não está configurado.' });
      return;
    }
    if (!window.confirm('Encerrar todas as sessões desta conta, incluindo este dispositivo? Será necessário iniciar sessão novamente.')) return;
    setEncerrandoSessoes(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      toast({ tone: 'success', message: 'Todas as sessões foram encerradas.' });
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível encerrar as sessões.' });
    } finally {
      setEncerrandoSessoes(false);
    }
  }
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function trocar() {
    const e: Record<string, string> = {};
    if (!atual) e.atual = 'Informe sua senha atual.';
    if (forcaSenha(nova) < 3) e.nova = 'Use ao menos 8 caracteres, com letras, números e um símbolo.';
    if (nova !== conf) e.conf = 'As senhas não coincidem.';
    setErr(e);
    if (Object.keys(e).length) return;
    if (!supabase) {
      setErr({ sistema: 'O Supabase não está configurado. A senha não foi alterada.' });
      return;
    }
    setLoading(true);
    try {
      const { data: current, error: currentError } = await supabase.auth.getUser();
      if (currentError || !current.user?.email) {
        setErr({ sistema: 'Sua sessão expirou. Entre novamente antes de alterar a senha.' });
        return;
      }
      const { error: verificationError } = await supabase.auth.signInWithPassword({ email: current.user.email, password: atual });
      if (verificationError) {
        setErr({ atual: 'Senha atual incorreta.' });
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: nova });
      if (updateError) {
        setErr({ sistema: updateError.message || 'Não foi possível alterar a senha.' });
        return;
      }
      setAtual(''); setNova(''); setConf('');
      toast({ tone: 'success', message: 'Senha alterada na conta.' });
    } catch {
      setErr({ sistema: 'Não foi possível alterar a senha. Verifique a conexão e tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <PanelHeader title="Alterar senha" />
        <div className="flex flex-col gap-4 p-5">
          {err.sistema && <p role="alert" className="text-sm text-[var(--color-danger)]">{err.sistema}</p>}
          <Field label="Senha atual" htmlFor="s-a" error={err.atual}><PasswordInput id="s-a" value={atual} onChange={setAtual} invalid={!!err.atual} autoComplete="current-password" /></Field>
          <Field label="Nova senha" htmlFor="s-n" error={err.nova}><PasswordInput id="s-n" value={nova} onChange={setNova} invalid={!!err.nova} autoComplete="new-password" /></Field>
          {nova && <SenhaMeter senha={nova} />}
          <Field label="Confirmar nova senha" htmlFor="s-c" error={err.conf}><PasswordInput id="s-c" value={conf} onChange={setConf} invalid={!!err.conf} autoComplete="new-password" /></Field>
          <div className="flex justify-end"><Button onClick={trocar} loading={loading}>Alterar senha</Button></div>
        </div>
      </Card>
      <Card>
        <PanelHeader
          title="Sessões da conta"
          subtitle="A lista de dispositivos não é fornecida por este painel."
          action={<Button size="sm" variant="secondary" icon={<LogOut size={14} />} loading={encerrandoSessoes} onClick={() => { void encerrarSessoes(); }}>Encerrar todas</Button>}
        />
        <p className="px-5 py-4 text-[13px] leading-6 text-muted">Esta ação revoga globalmente as sessões do Supabase Auth, incluindo a sessão atual. Confirme antes de continuar; terá de iniciar sessão novamente neste dispositivo.</p>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- Usuários */

function UsuariosTab() {
  const { can, user } = useStore();
  const [emailSolicitado, setEmailSolicitado] = useState('');
  const [aprovando, setAprovando] = useState(false);
  const [resultadoAprovacao, setResultadoAprovacao] = useState<{ ok: boolean; mensagem: string } | null>(null);

  async function aprovarSolicitacao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setResultadoAprovacao({ ok: false, mensagem: 'Supabase não está configurado.' });
      return;
    }
    setAprovando(true);
    setResultadoAprovacao(null);
    const { data, error } = await supabase.functions.invoke('aprovar-role', {
      body: { email: emailSolicitado.trim().toLowerCase() },
    });
    setAprovando(false);
    if (error || data?.error) {
      setResultadoAprovacao({
        ok: false,
        mensagem: data?.error ?? 'Não foi possível aprovar. Confirme se existe uma solicitação pendente e se a função segura está publicada.',
      });
      return;
    }
    setResultadoAprovacao({ ok: true, mensagem: `Perfil ${data.perfil} aprovado para ${data.email}.` });
    setEmailSolicitado('');
  }

  return (
    <Card>
        <PanelHeader
          title="Acesso da conta"
          subtitle="Cada login tem os próprios dados e permissões."
          action={can('gerenciarUsuarios') ? <Link to="/usuarios"><Button size="sm">Ver resumo da conta</Button></Link> : undefined}
        />
        <div className="border-t border-line px-5 py-4">
          <p className="eyebrow">Perfil ativo</p>
          <p className="mt-1 text-[14px] font-medium text-ink">{perfilLabel(user.role)}</p>
          <p className="mt-1 text-[12.5px] text-muted">A gestão de convites, partilha de registros e edição de perfis de outras contas ainda não está ativa.</p>
        </div>
      {can('gerenciarUsuarios') && (
        <div className="border-t border-line px-5 py-4">
          <PanelHeader title="Aprovar solicitação de perfil" subtitle="A role só é aplicada pelo Supabase após validação administrativa." />
          <form onSubmit={aprovarSolicitacao} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="E-mail da conta que solicitou Administrador ou Assistente" htmlFor="role-request-email" required>
              <Input
                id="role-request-email"
                type="email"
                autoComplete="email"
                value={emailSolicitado}
                required
                onChange={(event) => setEmailSolicitado(event.target.value)}
              />
            </Field>
            <Button type="submit" loading={aprovando} disabled={!emailSolicitado.trim()}>
              Aprovar solicitação
            </Button>
          </form>
          {resultadoAprovacao && (
            <p aria-live="polite" className={cx('mt-3 text-[13px]', resultadoAprovacao.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>
              {resultadoAprovacao.mensagem}
            </p>
          )}
          <p className="mt-2 text-[12px] text-muted">A função verifica sua role confiável no servidor, a solicitação registrada na conta e a confirmação do e-mail. A escolha do cadastro não concede acesso.</p>
        </div>
      )}
      {!can('gerenciarUsuarios') && (
        <p className="border-t border-line px-5 py-3.5 text-[13px] text-muted">
          Esta tela não permite consultar nem alterar dados de outras contas. Solicitações de perfil são avaliadas separadamente por um administrador.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ Permissões */

function PermissoesTab() {
  const { role } = useStore();
  return (
    <Card>
      <PanelHeader title="Matriz de permissões" subtitle="Definida por perfil. Somente leitura." />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-5 py-2.5 eyebrow">Ação</th>
              {PERFIS.map((p) => <th key={p} className={cx('px-4 py-2.5 text-center eyebrow', p === role && 'text-[var(--color-teal)]')}>{perfilLabel(p)}{p === role && ' · você'}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSOES.map((perm) => (
              <tr key={perm.id} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5 text-ink">{perm.label}</td>
                {PERFIS.map((p) => (
                  <td key={p} className={cx('px-4 py-2.5 text-center', p === role && 'bg-[var(--color-teal)]/4')}>
                    {perm.perfis.includes(p) ? <Check size={15} className="mx-auto text-[var(--color-teal)]" aria-label="Permitido" /> : <Minus size={15} className="mx-auto text-[var(--color-faint)]" aria-label="Não permitido" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- Notificações */

function NotificacoesTab() {
  const { notifPrefs, prefs, saveSettings } = useStore();
  const toast = useToast();
  const save = (p: Parameters<typeof saveSettings>[0], n: Parameters<typeof saveSettings>[1] = {}) =>
    void saveSettings(p, n).catch((error) => toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível guardar a preferência.' }));
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card>
        <PanelHeader title="Categorias" subtitle="Escolha o que aparece no sino de notificações." />
        {NOTIF_CATEGORIAS.map((c) => (
          <Row key={c.id} label={c.label}>
            <Toggle label={c.label} on={notifPrefs[c.id]} onChange={(on) => save({}, { [c.id]: on })} />
          </Row>
        ))}
      </Card>
      <Card className="self-start">
        <PanelHeader title="Entrega" subtitle="Preferências guardadas. Alertas por e-mail e resumo diário ainda não são enviados." />
        <Row label="No aplicativo"><Toggle label="No aplicativo" on={prefs.canalApp} onChange={(v) => save({ canalApp: v })} /></Row>
        <Row label="Por e-mail"><Toggle label="Por e-mail" on={prefs.canalEmail} onChange={(v) => save({ canalEmail: v })} /></Row>
        <Row label="Resumo diário" hint="Configuração guardada; envio agendado ainda indisponível"><Toggle label="Resumo diário" on={prefs.resumoDiario} onChange={(v) => save({ resumoDiario: v })} /></Row>
        <Row label="Avisar prazos com">
          <Select className="w-28" value={prefs.antecedenciaPrazo} onChange={(e) => save({ antecedenciaPrazo: Number(e.target.value) })}>
            {[1, 3, 5, 7, 15].map((n) => <option key={n} value={n}>{n} dia{n > 1 && 's'}</option>)}
          </Select>
        </Row>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------- Preferências */

function PreferenciasTab() {
  const { prefs, saveSettings } = useStore();
  const toast = useToast();
  const save = (patch: Parameters<typeof saveSettings>[0]) =>
    void saveSettings(patch).catch((error) => toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível guardar a preferência.' }));
  return (
    <Card className="max-w-[720px]">
      <Row label="Análise local do assistente" hint="Modo experimental baseado em regras e registros desta conta. Não usa modelo generativo nem serviço externo.">
        <Toggle label="Análise local" on={prefs.iaAtiva} onChange={(v) => save({ iaAtiva: v })} />
      </Row>
      <Row label="Visualização padrão da agenda">
        <Segmented size="sm" value={prefs.agendaVisao} onChange={(v) => save({ agendaVisao: v })} options={[{ value: 'dia', label: 'Dia' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} />
      </Row>
    </Card>
  );
}



/* ---------------------------------------------------------- Distribuição */

function DistribuicaoTab() {
  const { advogados, processos, prefs, saveSettings } = useStore();
  const toast = useToast();
  const save = (distribuicao: Preferencias['distribuicao']) =>
    void saveSettings({ distribuicao }).catch((error) => toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível guardar a preferência.' }));
  const ativos = processos.filter((p) => !p.arquivado && p.status !== 'encerrado');
  const equipe = advogados.filter((a) => a.ativo && a.perfil === 'Advogado');
  return (
    <div className="grid gap-5">
      <Card>
        <Row label="Critério de distribuição" hint="Preferência guardada; distribuição automática ainda não está implementada.">
          <Segmented
            size="sm"
            value={prefs.distribuicao}
            onChange={save}
            options={[{ value: 'area', label: 'Por área' }, { value: 'carga', label: 'Por carga' }, { value: 'manual', label: 'Manual' }]}
          />
        </Row>
      </Card>
      <Card>
        <PanelHeader title="Carga por advogado" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="eyebrow px-5 py-2.5">Advogado</th>
              <th className="eyebrow px-4 py-2.5">Áreas de atuação</th>
              <th className="eyebrow px-5 py-2.5 text-right">Processos ativos</th>
            </tr>
          </thead>
          <tbody>
            {equipe.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5 font-medium text-ink">{a.nome}</td>
                <td className="px-4 py-2.5"><AreaList areas={a.areas} /></td>
                <td className="tnum px-5 py-2.5 text-right text-ink">{ativos.filter((p) => p.responsavel === a.nome).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ Escritório */

function EscritorioTab() {
  const { prefs, saveSettings } = useStore();
  const toast = useToast();
  const [f, setF] = useState(prefs.escritorio);
  useEffect(() => setF(prefs.escritorio), [prefs.escritorio]);
  return (
    <Card className="max-w-[720px]">
      <PanelHeader title="Dados do escritório" />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Razão social" htmlFor="e-nome"><Input id="e-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field></div>
        <Field label="CNPJ" htmlFor="e-cnpj"><Input id="e-cnpj" className="ident" value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} /></Field>
        <Field label="Cidade" htmlFor="e-cid"><Input id="e-cid" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="E-mail institucional" htmlFor="e-mail"><Input id="e-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field></div>
      </div>
      <div className="flex justify-end border-t border-line px-5 py-3.5">
        <Button onClick={() => { void saveSettings({ escritorio: f }).then(() => toast({ tone: 'success', message: 'Dados do escritório guardados.' })).catch((error) => toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível guardar os dados.' })); }}>Salvar</Button>
      </div>
    </Card>
  );
}
