import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, LaptopMinimal, LogOut, Minus, Smartphone } from 'lucide-react';
import { Avatar, Button, Card, Field, Input, PanelHeader, Segmented, Select, Tabs, cx, useToast } from '../components/ui';
import { AreaList, AreaPicker } from '../components/Areas';
import { perfilLabel } from '../components/MembroDetalhe';
import { EMAIL_RE, PasswordInput } from './Login';
import { SenhaMeter, forcaSenha } from './Cadastro';
import { PERFIS, UFS } from '../data';
import { NOTIF_CATEGORIAS, PERMISSOES, useStore } from '../store';

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
  const set = (k: keyof typeof f, v: string | string[]) => setF((s) => ({ ...s, [k]: v }));
  const isAdv = user.perfil === 'Advogado';

  function salvar() {
    const e: Record<string, string> = {};
    if (!f.nome.trim()) e.nome = 'Informe seu nome.';
    if (!EMAIL_RE.test(f.email)) e.email = 'E-mail inválido.';
    else if (advogados.some((a) => a.id !== user.id && a.email.toLowerCase() === f.email.toLowerCase())) e.email = 'E-mail já utilizado por outra conta.';
    if (isAdv && !f.oab.trim()) e.oab = 'Informe o número da OAB.';
    if (user.perfil !== 'Administrador' && !f.areas.length) e.areas = 'Selecione ao menos uma área.';
    setErr(e);
    if (Object.keys(e).length) return;
    dispatch({ type: 'updateUsuario', id: user.id, patch: { ...f, oab: isAdv ? f.oab : user.oab } });
    toast({ tone: 'success', message: 'Perfil atualizado.' });
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
        <div className="flex justify-end border-t border-line px-5 py-3.5"><Button onClick={salvar}>Salvar alterações</Button></div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Segurança */

function SegurancaTab() {
  const { user, sessoes, dispatch } = useStore();
  const toast = useToast();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});

  function trocar() {
    const e: Record<string, string> = {};
    if (atual !== user.senha) e.atual = 'Senha atual incorreta.';
    if (forcaSenha(nova) < 3) e.nova = 'Use ao menos 8 caracteres, com letras, números e um símbolo.';
    if (nova !== conf) e.conf = 'As senhas não coincidem.';
    setErr(e);
    if (Object.keys(e).length) return;
    dispatch({ type: 'updateUsuario', id: user.id, patch: { senha: nova } });
    setAtual(''); setNova(''); setConf('');
    toast({ tone: 'success', message: 'Senha alterada.' });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <PanelHeader title="Alterar senha" />
        <div className="flex flex-col gap-4 p-5">
          <Field label="Senha atual" htmlFor="s-a" error={err.atual}><PasswordInput id="s-a" value={atual} onChange={setAtual} invalid={!!err.atual} autoComplete="current-password" /></Field>
          <Field label="Nova senha" htmlFor="s-n" error={err.nova}><PasswordInput id="s-n" value={nova} onChange={setNova} invalid={!!err.nova} autoComplete="new-password" /></Field>
          {nova && <SenhaMeter senha={nova} />}
          <Field label="Confirmar nova senha" htmlFor="s-c" error={err.conf}><PasswordInput id="s-c" value={conf} onChange={setConf} invalid={!!err.conf} autoComplete="new-password" /></Field>
          <div className="flex justify-end"><Button onClick={trocar}>Alterar senha</Button></div>
        </div>
      </Card>
      <Card>
        <PanelHeader
          title="Sessões ativas"
          subtitle={`${sessoes.length} dispositivo(s) conectados`}
          action={<Button size="sm" variant="secondary" icon={<LogOut size={14} />} disabled={sessoes.length < 2} onClick={() => { dispatch({ type: 'endSessions' }); toast({ tone: 'success', message: 'As outras sessões foram encerradas.' }); }}>Sair de todas</Button>}
        />
        <ul>
          {sessoes.map((s) => (
            <li key={s.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
              {/celular|iphone|android/i.test(s.dispositivo) ? <Smartphone size={17} className="text-muted" /> : <LaptopMinimal size={17} className="text-muted" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{s.dispositivo}</p>
                <p className="text-[12.5px] text-muted">{s.local} · desde {s.inicio}</p>
              </div>
              {s.atual && <span className="text-[12px] font-medium text-[var(--color-teal)]">Esta sessão</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- Usuários */

function UsuariosTab() {
  const { can, advogados } = useStore();
  const porPerfil = PERFIS.map((p) => ({ p, n: advogados.filter((a) => a.perfil === p && a.ativo).length }));
  return (
    <Card>
      <PanelHeader
        title="Usuários do escritório"
        subtitle={`${advogados.filter((a) => a.ativo).length} ativos · ${advogados.filter((a) => !a.ativo).length} inativos`}
        action={can('gerenciarUsuarios') ? <Link to="/usuarios"><Button size="sm">Gerenciar usuários</Button></Link> : undefined}
      />
      <div className="grid divide-x divide-line sm:grid-cols-3">
        {porPerfil.map(({ p, n }) => (
          <div key={p} className="px-5 py-4">
            <p className="eyebrow">{perfilLabel(p)}</p>
            <p className="tnum mt-1 text-[24px] font-semibold text-ink">{n}</p>
          </div>
        ))}
      </div>
      {!can('gerenciarUsuarios') && (
        <p className="border-t border-line px-5 py-3.5 text-[13px] text-muted">
          Apenas administradores podem convidar usuários ou alterar perfis. Consulte a <Link to="/equipe" className="font-medium text-[var(--color-teal)] hover:underline">equipe</Link>.
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
  const { notifPrefs, prefs, dispatch } = useStore();
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card>
        <PanelHeader title="Categorias" subtitle="Escolha o que aparece no sino de notificações." />
        {NOTIF_CATEGORIAS.map((c) => (
          <Row key={c.id} label={c.label}>
            <Toggle label={c.label} on={notifPrefs[c.id]} onChange={(on) => dispatch({ type: 'setNotifPref', categoria: c.id, on })} />
          </Row>
        ))}
      </Card>
      <Card className="self-start">
        <PanelHeader title="Entrega" />
        <Row label="No aplicativo"><Toggle label="No aplicativo" on={prefs.canalApp} onChange={(v) => dispatch({ type: 'setPrefs', patch: { canalApp: v } })} /></Row>
        <Row label="Por e-mail"><Toggle label="Por e-mail" on={prefs.canalEmail} onChange={(v) => dispatch({ type: 'setPrefs', patch: { canalEmail: v } })} /></Row>
        <Row label="Resumo diário" hint="Enviado às 8h"><Toggle label="Resumo diário" on={prefs.resumoDiario} onChange={(v) => dispatch({ type: 'setPrefs', patch: { resumoDiario: v } })} /></Row>
        <Row label="Avisar prazos com">
          <Select className="w-28" value={prefs.antecedenciaPrazo} onChange={(e) => dispatch({ type: 'setPrefs', patch: { antecedenciaPrazo: Number(e.target.value) } })}>
            {[1, 3, 5, 7, 15].map((n) => <option key={n} value={n}>{n} dia{n > 1 && 's'}</option>)}
          </Select>
        </Row>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------- Preferências */

function PreferenciasTab() {
  const { prefs, dispatch } = useStore();
  return (
    <Card className="max-w-[720px]">
      <Row label="Assistente de IA" hint="Atua somente sobre os registros autorizados.">
        <Toggle label="Assistente de IA" on={prefs.iaAtiva} onChange={(v) => dispatch({ type: 'setPrefs', patch: { iaAtiva: v } })} />
      </Row>
      <Row label="Visualização padrão da agenda">
        <Segmented size="sm" value={prefs.agendaVisao} onChange={(v) => dispatch({ type: 'setPrefs', patch: { agendaVisao: v } })} options={[{ value: 'dia', label: 'Dia' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} />
      </Row>
    </Card>
  );
}



/* ---------------------------------------------------------- Distribuição */

function DistribuicaoTab() {
  const { advogados, processos, prefs, dispatch } = useStore();
  const ativos = processos.filter((p) => !p.arquivado && p.status !== 'encerrado');
  const equipe = advogados.filter((a) => a.ativo && a.perfil === 'Advogado');
  return (
    <div className="grid gap-5">
      <Card>
        <Row label="Critério de distribuição" hint="Aplicado a novos processos.">
          <Segmented
            size="sm"
            value={prefs.distribuicao}
            onChange={(v) => dispatch({ type: 'setPrefs', patch: { distribuicao: v } })}
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
  const { prefs, dispatch } = useStore();
  const toast = useToast();
  const [f, setF] = useState(prefs.escritorio);
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
        <Button onClick={() => { dispatch({ type: 'setPrefs', patch: { escritorio: f } }); toast({ tone: 'success', message: 'Dados do escritório atualizados.' }); }}>Salvar</Button>
      </div>
    </Card>
  );
}
