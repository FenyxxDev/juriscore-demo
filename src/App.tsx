import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import type { User } from '@supabase/supabase-js';
import { ToastProvider } from './components/ui';
import { StoreProvider, useStore } from './store';
import { router } from './routes';
import { supabase } from './lib/supabase';
import { rel, type Advogado, type Perfil } from './data';

const isPerfil = (value: unknown): value is Perfil =>
  value === 'Administrador' || value === 'Advogado' || value === 'Assistente';

function SessionBootstrap() {
  const { dispatch, refreshWorkspace } = useStore();

  useEffect(() => {
    if (!supabase) return;
    const client = supabase as NonNullable<typeof supabase>;
    let cancelled = false;
    let activeUserId: string | null = null;
    let generation = 0;

    async function bootstrap(supaUser: User) {
      const email = supaUser.email?.trim().toLowerCase();
      if (!email || cancelled || activeUserId === supaUser.id) return;

      const request = ++generation;
      if (activeUserId && activeUserId !== supaUser.id) dispatch({ type: 'logout' });
      activeUserId = supaUser.id;

      const metadata = supaUser.user_metadata ?? {};
      const requestedPerfil = metadata.perfil_solicitado ?? metadata.perfil;
      const trustedPerfil = supaUser.app_metadata?.perfil;
      const privilegedRequest = requestedPerfil === 'Administrador' || requestedPerfil === 'Assistente';

      // Um perfil privilegiado solicitado não pode acessar nem mesmo após uma
      // restauração de sessão até que a role correspondente esteja aprovada.
      if (privilegedRequest && trustedPerfil !== requestedPerfil) {
        activeUserId = null;
        await client.auth.signOut({ scope: 'local' });
        if (!cancelled) dispatch({ type: 'logout' });
        return;
      }

      // Roles vêm exclusivamente de app_metadata, gravada por operação confiável.
      const perfil: Perfil = isPerfil(trustedPerfil) ? trustedPerfil : 'Advogado';
      const safeMetadata = { ...metadata };
      delete safeMetadata.perfil;
      delete safeMetadata.perfil_solicitado;

      // A policy de profiles permite INSERT próprio como Advogado e não permite
      // UPDATE. Evita upsert: só cria o perfil ausente e nunca altera dados/RLS.
      const { data: existingProfile, error: profileReadError } = await client
        .from('profiles')
        .select('id')
        .eq('id', supaUser.id)
        .maybeSingle();
      if (!profileReadError && !existingProfile) {
        await client.from('profiles').insert({
          id: supaUser.id,
          data: { ...safeMetadata, email, perfil: 'Advogado' },
        });
      }

      if (cancelled || request !== generation) return;
      const usuario: Advogado = {
        id: supaUser.id,
        nome: typeof metadata.nome === 'string' && metadata.nome.trim() ? metadata.nome.trim() : email.split('@')[0],
        email,
        senha: '',
        telefone: typeof metadata.telefone === 'string' ? metadata.telefone : typeof metadata.phone === 'string' ? metadata.phone : '',
        perfil,
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
      dispatch({ type: 'register', usuario });
      dispatch({ type: 'login', userId: usuario.id, lembrar: true });

      // A falha ao carregar os módulos não concede dados antigos; as listas só
      // são hidratadas após consultas autorizadas pelo Supabase/RLS.
      try {
        await refreshWorkspace(usuario.id);
      } catch {
        // As páginas com carregamento próprio apresentam os erros de conexão.
      }
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        activeUserId = null;
        generation += 1;
        dispatch({ type: 'logout' });
        return;
      }
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        // O callback é diferido para não fazer chamadas Supabase dentro do listener.
        queueMicrotask(() => {
          void bootstrap(session.user).catch(() => {
            activeUserId = null;
            if (!cancelled) dispatch({ type: 'logout' });
          });
        });
      }
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      if (data.session?.user) return bootstrap(data.session.user);
    }).catch(() => {
      if (!cancelled) dispatch({ type: 'logout' });
    });

    return () => {
      cancelled = true;
      generation += 1;
      listener.subscription.unsubscribe();
    };
  }, [dispatch, refreshWorkspace]);

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
