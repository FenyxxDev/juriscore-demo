import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ArrowRight, Eye, EyeOff, Scale } from 'lucide-react';
import { Alert, Button, Checkbox, Field, Input, Modal, useToast } from '../components/ui';
import { useStore } from '../store';
import { supabase, supabaseConfigured } from '../lib/supabase';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared auth frame: brand panel + form column. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel: identity through type, proportion and hairline structure */}
      <div className="relative hidden overflow-hidden bg-[var(--color-brand-dark)] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(24,90,99,0.35), transparent 70%)' }}
        />
        <div className="relative flex items-center gap-2.5 p-12">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-teal)] text-white">
            <Scale size={17} strokeWidth={2} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">JurisCore</span>
        </div>

        <div className="relative max-w-md px-12">
          <p className="eyebrow text-[var(--color-teal)]">Plataforma jurídica</p>
          <h1 className="mt-4 text-[40px] font-semibold leading-[1.08] tracking-tight text-white">
            Todo o seu escritório sob controle.
          </h1>
          <p className="mt-5 max-w-sm leading-relaxed text-slate-400">
            Processos, prazos, audiências e clientes reunidos com clareza. Saiba em segundos o que exige a sua atenção hoje.
          </p>
        </div>

        <div className="relative flex items-center gap-8 border-t border-white/[0.06] px-12 py-6">
          {[
            ['Processos', 'centralizados'],
            ['Prazos', 'sob controle'],
            ['Documentos', 'organizados'],
          ].map(([a, b]) => (
            <div key={a}>
              <p className="text-[13px] font-medium text-slate-200">{a}</p>
              <p className="text-[12px] text-slate-500">{b}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center bg-panel px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-teal)] text-white">
              <Scale size={16} />
            </span>
            <span className="text-[17px] font-semibold text-ink">JurisCore</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function PasswordInput({ id, value, onChange, invalid, autoComplete }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder="••••••••" value={value} invalid={invalid} onChange={(e) => onChange(e.target.value)} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:bg-slate-100">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const { dispatch, advogados, authed } = useStore();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [erro, setErro] = useState<null | 'credenciais' | 'inativo'>(null);
  const [recuperar, setRecuperar] = useState(false);

  if (authed) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEmailError(EMAIL_RE.test(email.trim()) ? '' : 'Informe um e-mail válido.');
    setSenhaError(senha ? '' : 'Informe sua senha.');
    if (!EMAIL_RE.test(email.trim()) || !senha) return;
    setLoading(true);

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error || !data.user) {
        setLoading(false);
        return setErro('credenciais');
      }
      const conta = advogados.find((a) => a.email.toLowerCase() === data.user.email?.toLowerCase());
      if (!conta) {
        setLoading(false);
        return setErro('credenciais');
      }
      if (!conta.ativo) {
        setLoading(false);
        return setErro('inativo');
      }
      dispatch({ type: 'login', userId: conta.id, lembrar });
      setLoading(false);
      navigate('/dashboard');
      return;
    }

    // Fallback local apenas para a pré-visualização quando as variáveis não foram configuradas.
    setTimeout(() => {
      setLoading(false);
      const conta = advogados.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (!conta || conta.senha !== senha) return setErro('credenciais');
      if (!conta.ativo) return setErro('inativo');
      dispatch({ type: 'login', userId: conta.id, lembrar });
      navigate('/dashboard');
    }, 700);
  }

  return (
    <AuthShell>
      <h2 className="text-[26px] font-semibold tracking-tight text-ink">Bem-vindo ao JurisCore.</h2>

      {erro && (
        <div className="mt-5">
          <Alert tone="error" title={erro === 'credenciais' ? 'E-mail ou senha incorretos.' : 'Conta desativada.'}>
            {erro === 'credenciais' ? 'Verifique os dados e tente novamente.' : 'Procure o administrador do escritório para reativar o acesso.'}
          </Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-4">
        <Field label="E-mail" htmlFor="email" error={emailError}>
          <Input id="email" type="email" autoComplete="email" placeholder="voce@escritorio.com.br" value={email} invalid={!!emailError || erro === 'credenciais'} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha" htmlFor="senha" error={senhaError}>
          <PasswordInput id="senha" autoComplete="current-password" value={senha} onChange={setSenha} invalid={!!senhaError || erro === 'credenciais'} />
        </Field>
        <div className="flex items-center justify-between">
          <Checkbox label="Lembrar de mim" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          <button type="button" onClick={() => setRecuperar(true)} className="text-[13px] font-medium text-[var(--color-teal)] hover:underline">
            Esqueci minha senha
          </button>
        </div>
        <Button type="submit" loading={loading} className="mt-1 w-full" icon={loading ? undefined : <ArrowRight size={16} />}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted">
        Não possui uma conta?{' '}
        <Link to="/cadastro" className="font-medium text-[var(--color-teal)] hover:underline">Cadastre-se</Link>
      </p>

      <p className="mt-10 border-t border-line pt-4 text-center text-[11.5px] leading-relaxed text-[var(--color-faint)]">
        {supabaseConfigured ? 'Acesso protegido pelo Supabase.' : <>Demonstração · <span className="ident">mariana.silva</span>, <span className="ident">ana.costa</span> ou <span className="ident">bruno.tavares</span> @juriscore.com.br · senha <span className="ident">juriscore</span></>}
      </p>

      {recuperar && <RecuperarSenha
        open
        initial={email}
        onClose={() => setRecuperar(false)}
        onSent={(to) => {
          setRecuperar(false);
          toast({ tone: 'success', message: `Se houver uma conta para ${to}, enviaremos um link de redefinição.` });
        }}
      />}
    </AuthShell>
  );
}

function RecuperarSenha({ open, initial, onClose, onSent }: { open: boolean; initial: string; onClose: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState(initial);
  const [err, setErr] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Redefinir senha"
      description="Enviaremos um link de redefinição para o e-mail cadastrado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="form-rec">Enviar link</Button>
        </>
      }
    >
      <form
        id="form-rec"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!EMAIL_RE.test(email.trim())) return setErr('Informe um e-mail válido.');
          onSent(email.trim());
        }}
      >
        <Field label="E-mail" htmlFor="rec-email" error={err}>
          <Input id="rec-email" type="email" value={email} invalid={!!err} onChange={(e) => { setEmail(e.target.value); setErr(''); }} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}
