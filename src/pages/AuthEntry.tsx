import { type FormEvent, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router';
import { Alert, Button, Field, Input, useToast } from '../components/ui';
import type { Advogado, Perfil } from '../data';
import { rel } from '../data';
import { supabase } from '../lib/supabase';
import { useStore } from '../store';
import { AuthShell, Login, PasswordInput } from './Login';

const isPerfil = (value: unknown): value is Perfil =>
  value === 'Administrador' || value === 'Advogado' || value === 'Assistente';

function isRecoveryRedirect() {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return query.get('type') === 'recovery' || fragment.get('type') === 'recovery';
}

function toAdvogado(user: User): Advogado {
  const metadata = user.user_metadata ?? {};
  const nome = typeof metadata.nome === 'string' && metadata.nome.trim()
    ? metadata.nome.trim()
    : user.email?.split('@')[0] ?? 'Utilizador';
  const telefone = typeof metadata.telefone === 'string'
    ? metadata.telefone
    : typeof metadata.phone === 'string' ? metadata.phone : '';
  return {
    id: user.id,
    nome,
    email: (user.email ?? '').trim().toLowerCase(),
    senha: '',
    telefone,
    perfil: isPerfil(user.app_metadata?.perfil) ? user.app_metadata.perfil : 'Advogado',
    ativo: true,
    oab: typeof metadata.oab === 'string' ? metadata.oab : '',
    oabUf: typeof metadata.oabUf === 'string' ? metadata.oabUf : undefined,
    especialidade: typeof metadata.especialidade === 'string' ? metadata.especialidade : undefined,
    anosExperiencia: typeof metadata.anosExperiencia === 'number' ? metadata.anosExperiencia : undefined,
    areas: Array.isArray(metadata.areas) ? metadata.areas.filter((area): area is string => typeof area === 'string') : [],
    equipe: typeof metadata.equipe === 'string' ? metadata.equipe : undefined,
    cargo: typeof metadata.cargo === 'string' ? metadata.cargo : undefined,
    escritorio: typeof metadata.escritorio === 'string' ? metadata.escritorio : undefined,
    ultimaAtividade: rel(0),
  };
}

/** Entrada pública que detecta o retorno do link de recuperação do Supabase. */
export function AuthEntry() {
  const [recovering, setRecovering] = useState(isRecoveryRedirect);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  return recovering ? <RedefinirSenha /> : <Login />;
}

export function RedefinirSenha() {
  const navigate = useNavigate();
  const toast = useToast();
  const { dispatch } = useStore();
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro('');
    if (nova.length < 8 || !/[A-Za-z]/.test(nova) || !/\d/.test(nova) || !/[^A-Za-z0-9]/.test(nova)) {
      setErro('Use ao menos 8 caracteres, com letras, números e um símbolo.');
      return;
    }
    if (nova !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (!supabase) {
      setErro('O Supabase não está configurado.');
      return;
    }

    setLoading(true);
    try {
      const { data: current, error: currentError } = await supabase.auth.getUser();
      if (currentError || !current.user) {
        setErro('O link expirou ou não é válido. Solicite uma nova redefinição de senha.');
        return;
      }
      const { data, error: updateError } = await supabase.auth.updateUser({ password: nova });
      if (updateError || !data.user) {
        setErro(updateError?.message ?? 'Não foi possível atualizar a senha. Tente novamente.');
        return;
      }
      const usuario = toAdvogado(data.user);
      dispatch({ type: 'register', usuario });
      dispatch({ type: 'login', userId: usuario.id, lembrar: true });
      toast({ tone: 'success', message: 'Senha redefinida com sucesso.' });
      navigate('/dashboard', { replace: true });
    } catch {
      setErro('Não foi possível atualizar a senha. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-[26px] font-semibold tracking-tight text-ink">Definir nova senha</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Crie uma senha nova para voltar a acessar sua conta.</p>
      {erro && <div className="mt-5"><Alert tone="error" title="Não foi possível redefinir a senha">{erro}</Alert></div>}
      <form onSubmit={salvar} noValidate className="mt-7 flex flex-col gap-4">
        <Field label="Nova senha" htmlFor="nova-senha">
          <PasswordInput id="nova-senha" value={nova} onChange={setNova} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar nova senha" htmlFor="confirmar-senha">
          <Input id="confirmar-senha" type="password" autoComplete="new-password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} />
        </Field>
        <Button type="submit" loading={loading} className="mt-1 w-full">Salvar nova senha</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Se o link expirou, <a className="font-medium text-[var(--color-teal)] hover:underline" href="/">solicite outro</a>.</p>
    </AuthShell>
  );
}
