import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Briefcase, Scale, UserCog } from 'lucide-react';
import { Button, Field, Input, Select, cx, useToast } from '../components/ui';
import { AreaPicker } from '../components/Areas';
import { AuthShell, EMAIL_RE, PasswordInput } from './Login';
import { type Advogado, type Perfil, UFS, rel } from '../data';
import { uid, useStore } from '../store';
import { supabase } from '../lib/supabase';

const PERFIL_OPCOES: { id: Perfil; label: string; desc: string; Icon: typeof Scale }[] = [
  { id: 'Administrador', label: 'Administrador ou Gestor', desc: 'Gerencia o escritório, a equipe e os indicadores.', Icon: UserCog },
  { id: 'Advogado', label: 'Advogado', desc: 'Conduz processos, prazos e audiências.', Icon: Scale },
  { id: 'Assistente', label: 'Assistente jurídico', desc: 'Apoia a operação: cadastros, documentos e agenda.', Icon: Briefcase },
];

const ETAPAS = ['Dados pessoais', 'Perfil', 'Atuação'];

/** Força da senha: 0..4 */
export function forcaSenha(s: string) {
  let n = 0;
  if (s.length >= 8) n++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) n++;
  if (/\d/.test(s)) n++;
  if (/[^A-Za-z0-9]/.test(s)) n++;
  return n;
}
export function SenhaMeter({ senha }: { senha: string }) {
  const f = forcaSenha(senha);
  if (!senha) return null;
  const label = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'][f];
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1 flex-1 rounded-full', i < f ? (f < 3 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]') : 'bg-slate-200')} />
        ))}
      </div>
      <span className="w-20 text-right text-[11.5px] text-muted">{label}</span>
    </div>
  );
}

const maskTel = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export function Cadastro() {
  const { advogados, dispatch, authed } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [etapa, setEtapa] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    nome: '', email: '', telefone: '', senha: '', confirmar: '',
    perfil: '' as Perfil | '',
    oab: '', oabUf: 'PE', especialidade: '', anos: '', areas: [] as string[],
    equipe: '', cargo: '', escritorio: '',
  });
  const set = (k: keyof typeof f) => (v: string | string[]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrs((e) => ({ ...e, [k]: '' }));
  };

  if (authed) return <Navigate to="/dashboard" replace />;
  const advogadosAtivos = advogados.filter((a) => a.perfil === 'Advogado' && a.ativo);

  function validar(step: number) {
    const e: Record<string, string> = {};
    const req = 'Campo obrigatório.';
    if (step === 0) {
      if (!f.nome.trim()) e.nome = req;
      else if (f.nome.trim().split(/\s+/).length < 2) e.nome = 'Informe nome e sobrenome.';
      if (!f.email.trim()) e.email = req;
      else if (!EMAIL_RE.test(f.email.trim())) e.email = 'E-mail inválido.';
      else if (advogados.some((a) => a.email.toLowerCase() === f.email.trim().toLowerCase())) e.email = 'Este e-mail já está cadastrado.';
      if (!f.telefone.trim()) e.telefone = req;
      else if (f.telefone.replace(/\D/g, '').length < 10) e.telefone = 'Telefone incompleto.';
      if (!f.senha) e.senha = req;
      else if (forcaSenha(f.senha) < 3) e.senha = 'Senha fraca. Use 8 ou mais caracteres com maiúsculas, minúsculas e números.';
      if (!f.confirmar) e.confirmar = req;
      else if (f.confirmar !== f.senha) e.confirmar = 'As senhas não coincidem.';
    }
    if (step === 1 && !f.perfil) e.perfil = 'Selecione um perfil para continuar.';
    if (step === 2) {
      if (f.perfil === 'Advogado') {
        if (!f.oab.trim()) e.oab = req;
        else if (!/^\d{3,6}$/.test(f.oab.replace(/\D/g, ''))) e.oab = 'Número de OAB inválido.';
        if (!f.especialidade.trim()) e.especialidade = req;
        if (!f.areas.length) e.areas = 'Selecione ao menos uma área de atuação.';
      }
      if (f.perfil === 'Assistente') {
        if (!f.areas.length) e.areas = 'Selecione ao menos uma área acompanhada.';
        if (!f.equipe) e.equipe = req;
      }
      if (f.perfil === 'Administrador') {
        if (!f.cargo.trim()) e.cargo = req;
        if (!f.escritorio.trim()) e.escritorio = req;
      }
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validar(etapa)) return;
    if (etapa < 2) return setEtapa(etapa + 1);
    if (!supabase) {
      toast({ tone: 'error', message: 'O cadastro está temporariamente indisponível. Configure o Supabase.' });
      return;
    }
    setLoading(true);
    const perfil = f.perfil as Perfil;
    const oabNum = f.oab.replace(/\D/g, '');
    const usuario: Advogado = {
      id: uid('adv'),
      nome: f.nome.trim(),
      email: f.email.trim().toLowerCase(),
      senha: '',
      telefone: f.telefone,
      perfil,
      ativo: true,
      oab: perfil === 'Advogado' ? `OAB/${f.oabUf} ${oabNum.replace(/(\d)(?=(\d{3})+$)/, '$1.')}` : '',
      oabUf: perfil === 'Advogado' ? f.oabUf : undefined,
      especialidade: perfil === 'Advogado' ? f.especialidade.trim() : undefined,
      anosExperiencia: perfil === 'Advogado' && f.anos ? Number(f.anos) : undefined,
      areas: perfil === 'Administrador' ? [] : f.areas,
      equipe: perfil === 'Assistente' ? f.equipe : undefined,
      cargo: perfil === 'Administrador' ? f.cargo.trim() : undefined,
      escritorio: perfil === 'Administrador' ? f.escritorio.trim() : undefined,
      ultimaAtividade: rel(0),
    };

    const { data, error } = await supabase.auth.signUp({
      email: usuario.email,
      password: f.senha,
      options: {
        data: {
          nome: usuario.nome,
          telefone: usuario.telefone,
          perfil: usuario.perfil,
          oab: usuario.oab,
          oabUf: usuario.oabUf,
          especialidade: usuario.especialidade,
          anosExperiencia: usuario.anosExperiencia,
          areas: usuario.areas,
          equipe: usuario.equipe,
          cargo: usuario.cargo,
          escritorio: usuario.escritorio,
        },
      },
    });

    setLoading(false);
    if (error) {
      setErrs((e) => ({ ...e, email: /already registered|already exists/i.test(error.message) ? 'Este e-mail já está cadastrado.' : error.message }));
      setEtapa(0);
      return;
    }

    if (data.session && data.user) {
      dispatch({ type: 'register', usuario: { ...usuario, id: data.user.id } });
      dispatch({ type: 'login', userId: data.user.id, lembrar: true });
      toast({ tone: 'success', message: 'Conta criada. Bem-vindo ao JurisCore.' });
      navigate('/dashboard');
    } else {
      toast({ tone: 'success', message: 'Conta criada. Confirme o seu e-mail para entrar.' });
      navigate('/');
    }
  }

  return (
    <AuthShell>
      <h2 className="text-[26px] font-semibold tracking-tight text-ink">
        {etapa === 0 ? 'Crie sua conta' : etapa === 1 ? 'Qual é o seu perfil?' : PERFIL_OPCOES.find((p) => p.id === f.perfil)?.label}
      </h2>

      <ol className="mt-4 flex gap-2" aria-label="Etapas do cadastro">
        {ETAPAS.map((e, i) => (
          <li key={e} className="flex-1">
            <span className={cx('block h-0.5 rounded-full', i <= etapa ? 'bg-[var(--color-teal)]' : 'bg-slate-200')} />
            <span className={cx('eyebrow mt-1.5 block', i === etapa && 'text-ink')}>
              {i + 1}. {e}
            </span>
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {etapa === 0 && (
          <>
            <Field label="Nome completo" htmlFor="c-nome" error={errs.nome} required>
              <Input id="c-nome" autoComplete="name" value={f.nome} invalid={!!errs.nome} onChange={(e) => set('nome')(e.target.value)} autoFocus />
            </Field>
            <Field label="E-mail" htmlFor="c-email" error={errs.email} required>
              <Input id="c-email" type="email" autoComplete="email" placeholder="voce@escritorio.com.br" value={f.email} invalid={!!errs.email} onChange={(e) => set('email')(e.target.value)} />
            </Field>
            <Field label="Telefone" htmlFor="c-tel" error={errs.telefone} required>
              <Input id="c-tel" inputMode="tel" placeholder="(00) 00000-0000" value={f.telefone} invalid={!!errs.telefone} onChange={(e) => set('telefone')(maskTel(e.target.value))} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Senha" htmlFor="c-senha" error={errs.senha} required>
                <PasswordInput id="c-senha" autoComplete="new-password" value={f.senha} onChange={set('senha')} invalid={!!errs.senha} />
              </Field>
              <Field label="Confirmar senha" htmlFor="c-conf" error={errs.confirmar} required>
                <PasswordInput id="c-conf" autoComplete="new-password" value={f.confirmar} onChange={set('confirmar')} invalid={!!errs.confirmar} />
              </Field>
            </div>
            <SenhaMeter senha={f.senha} />
          </>
        )}

        {etapa === 1 && (
          <div role="radiogroup" className="flex flex-col gap-2">
            {PERFIL_OPCOES.map(({ id, label, desc, Icon }) => {
              const on = f.perfil === id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  key={id}
                  onClick={() => set('perfil')(id)}
                  className={cx(
                    'flex items-start gap-3.5 rounded-md border px-4 py-3.5 text-left transition-colors',
                    on ? 'border-[var(--color-teal)] bg-[var(--color-teal)]/[0.05]' : 'border-line-strong hover:border-[var(--color-faint)]',
                  )}
                >
                  <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md', on ? 'bg-[var(--color-teal)] text-white' : 'bg-slate-100 text-muted')}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{label}</span>
                    <span className="block text-[12.5px] text-muted">{desc}</span>
                  </span>
                  <span className={cx('mt-1 h-4 w-4 shrink-0 rounded-full border', on ? 'border-[5px] border-[var(--color-teal)]' : 'border-line-strong')} />
                </button>
              );
            })}
            {errs.perfil && <p className="text-[12.5px] text-[var(--color-danger)]">{errs.perfil}</p>}
            <p className="mt-1 text-[12px] text-[var(--color-faint)]">O perfil define suas permissões e só pode ser alterado pelo administrador do escritório.</p>
          </div>
        )}

        {etapa === 2 && f.perfil === 'Advogado' && (
          <>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label="OAB" htmlFor="c-oab" error={errs.oab} required>
                <Input id="c-oab" inputMode="numeric" className="ident" placeholder="000000" value={f.oab} invalid={!!errs.oab} onChange={(e) => set('oab')(e.target.value)} autoFocus />
              </Field>
              <Field label="UF" htmlFor="c-uf">
                <Select id="c-uf" className="h-9.5 w-full" value={f.oabUf} onChange={(e) => set('oabUf')(e.target.value)}>
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Especialidade" htmlFor="c-esp" error={errs.especialidade} required>
                <Input id="c-esp" placeholder="Ex.: Contencioso trabalhista" value={f.especialidade} invalid={!!errs.especialidade} onChange={(e) => set('especialidade')(e.target.value)} />
              </Field>
              <Field label="Anos de experiência" htmlFor="c-anos">
                <Input id="c-anos" type="number" min={0} max={60} className="tnum" value={f.anos} onChange={(e) => set('anos')(e.target.value)} />
              </Field>
            </div>
            <Field label="Áreas de atuação" error={errs.areas} required>
              <AreaPicker value={f.areas} onChange={set('areas')} invalid={!!errs.areas} />
            </Field>
          </>
        )}

        {etapa === 2 && f.perfil === 'Assistente' && (
          <>
            <Field label="Advogado responsável ou equipe" htmlFor="c-eq" error={errs.equipe} required>
              <Select id="c-eq" className="h-9.5 w-full" value={f.equipe} onChange={(e) => set('equipe')(e.target.value)} autoFocus>
                <option value="">Selecione</option>
                {advogadosAtivos.map((a) => <option key={a.id} value={a.nome}>{a.nome} · {a.oab}</option>)}
              </Select>
            </Field>
            <Field label="Áreas do escritório que acompanha" error={errs.areas} required>
              <AreaPicker value={f.areas} onChange={set('areas')} invalid={!!errs.areas} />
            </Field>
          </>
        )}

        {etapa === 2 && f.perfil === 'Administrador' && (
          <>
            <Field label="Cargo" htmlFor="c-cargo" error={errs.cargo} required>
              <Input id="c-cargo" placeholder="Ex.: Sócio administrador" value={f.cargo} invalid={!!errs.cargo} onChange={(e) => set('cargo')(e.target.value)} autoFocus />
            </Field>
            <Field label="Escritório" htmlFor="c-esc" error={errs.escritorio} required>
              <Input id="c-esc" placeholder="Razão social ou nome do escritório" value={f.escritorio} invalid={!!errs.escritorio} onChange={(e) => set('escritorio')(e.target.value)} />
            </Field>
          </>
        )}

        <div className="mt-1 flex gap-2">
          {etapa > 0 && (
            <Button type="button" variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => { setErrs({}); setEtapa(etapa - 1); }}>
              Voltar
            </Button>
          )}
          <Button type="submit" loading={loading} className="flex-1" icon={loading ? undefined : <ArrowRight size={16} />}>
            {etapa < 2 ? 'Continuar' : 'Criar conta'}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted">
        Já possui uma conta?{' '}
        <Link to="/" className="font-medium text-[var(--color-teal)] hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
