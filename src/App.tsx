import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { ToastProvider } from './components/ui';
import { StoreProvider, useStore } from './store';
import { router } from './routes';
import { supabase } from './lib/supabase';

function SessionBootstrap() {
  const { dispatch, advogados } = useStore();

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email?.toLowerCase();
      const conta = email ? advogados.find((a) => a.email.toLowerCase() === email) : undefined;
      if (conta) dispatch({ type: 'login', userId: conta.id, lembrar: true });
    });
  }, [advogados, dispatch]);

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
