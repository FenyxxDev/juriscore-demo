import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { ToastProvider } from './components/ui';
import { StoreProvider, useStore } from './store';
import { router } from './routes';
import { supabase } from './lib/supabase';
import { rel, type Advogado, type Perfil } from './data';

const isPerfil = (value: unknown): value is Perfil =>
  value === 'Administrador' || value === 'Advogado' || value === 'Assistente';

function SessionBootstrap() {
  const { dispatch } = useStore();

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled || error) return;

      const supaUser = data.session?.user;
      const email = supaUser?.email?.trim().toLowerCase();
      if (!supaUser || !email) return;

      const metadata = supaUser.user_metadata ?? {};
      const requestedPerfil = metadata.perfil_solicitado ?? metadata.perfil;
      const trustedPerfil = supaUser.app_metadata?.perfil;
      const privilegedRequest = requestedPerfil === 'Administrador' || requestedPerfil === 'Assistente';

      // Um perfil privilegiado solicitado não pode acessar nem mesmo após uma
      // restauração de sessão até que a role correspondente esteja aprovada.
      if (privilegedRequest && trustedPerfil !== requestedPerfil) {
        await supabase.auth.signOut();
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
      const { data: existingProfile, error: profileReadError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', supaUser.id)
        .maybeSingle();
      if (!profileReadError && !existingProfile) {
        await supabase.from('profiles').insert({
          id: supaUser.id,
          data: { ...safeMetadata, email, perfil: 'Advogado' },
        });
      }

      if (cancelled) return;
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
    })().catch(() => {
      // Falha ao consultar metadados não concede acesso nem role privilegiada.
      if (!cancelled) dispatch({ type: 'logout' });
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
