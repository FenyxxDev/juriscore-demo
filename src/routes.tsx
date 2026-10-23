import { Navigate, createBrowserRouter } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Cadastro } from './pages/Cadastro';
import { Clientes } from './pages/Clientes';
import { Configuracoes } from './pages/Configuracoes';

export const router = createBrowserRouter([
  { path: '/', element: <Login /> },
  { path: '/cadastro', element: <Cadastro /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/clientes', element: <Clientes /> },
      { path: '/configuracoes', element: <Configuracoes /> },
      { path: '/dashboard', element: <Navigate to="/clientes" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
