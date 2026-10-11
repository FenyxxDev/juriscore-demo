import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router';
import { ToastProvider } from './components/ui';
import { StoreProvider, useStore } from './store';
import { router } from './routes';
import { supabase } from './lib/supabase';
import { rel, type Advogado, type Perfil } from './data';

function SessionBootstrap() {
  const { dispatch, advogados } = useStore();
  const started = useRef(false);

  useEffect(() => {
    if (!supabase || started.current) return;
    started.current = true;
    let cancelled = false;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const supaUser = data.session?.user;
      const email = supaUser?.email?.toLowerCase();
      const conta = email ? advogados.find((a) => a.email.toLowerCase() === email) : undefined;
      if (conta) {
        dispatch({ type: 'login', userId: conta.id, lembrar: true });
        return;
      }
      if (!supaUser || !email) return;
      const meta = supaUser.user_metadata ?? {};
      const { data: existingProfile } = await supabase.from('profiles').select('data').eq('id', supaUser.id).maybeSingle();
      await supabase.from('profiles').upsert({
        id: supaUser.id,
        data: { ...((existingProfile?.data as Record<string, unknown> | null) ?? {}), ...meta, email },
      });
      const perfil: Perfil = meta.perfil === 'Administrador' || meta.perfil === 'Assistente' ? meta.perfil : 'Advogado';
      const usuario: Advogado = {
        id: supaUser.id,
        nome: meta.nome || email.split('@')[0],
        email,
        senha: '',
        telefone: meta.telefone || meta.phone || '',
        perfil,
        ativo: true,
        oab: meta.oab || '',
        oabUf: meta.oabUf,
        especialidade: meta.especialidade,
        anosExperiencia: meta.anosExperiencia,
        areas: Array.isArray(meta.areas) ? meta.areas : [],
        equipe: meta.equipe,
        cargo: meta.cargo,
        escritorio: meta.escritorio,
        ultimaAtividade: rel(0),
      };
      dispatch({ type: 'register', usuario });
      dispatch({ type: 'login', userId: usuario.id, lembrar: true });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') dispatch({ type: 'logout' });
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [dispatch]);

  return null;
}

export default function App() {
  return (
    <StoreProvider>
      <SessionBootstrap />
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </StoreProvider>
  );
}
