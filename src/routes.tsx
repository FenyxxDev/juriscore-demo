import { type ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Cadastro } from './pages/Cadastro';
import { AuthEntry, RedefinirSenha } from './pages/AuthEntry';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { ClienteDetalhe } from './pages/ClienteDetalhe';
import { Processos } from './pages/Processos';
import { ProcessoDetalhe } from './pages/ProcessoDetalhe';
import { Agenda } from './pages/Agenda';
import { Prazos } from './pages/Prazos';
import { Tarefas } from './pages/Tarefas';
import { Audiencias } from './pages/Audiencias';
import { Documentos } from './pages/Documentos';
import { Pesquisa } from './pages/Pesquisa';
import { Usuarios } from './pages/Usuarios';
import { Equipe } from './pages/Equipe';
import { Configuracoes } from './pages/Configuracoes';
import { AdminAccessAudit } from './pages/AdminAccessAudit';
import { AttorneyReviewDesk } from './pages/AttorneyReviewDesk';
import { AssistantIntake } from './pages/AssistantIntake';
import type { Perfil } from './data';
import { useStore } from './store';

function RoleOnly({ allowed, children }: { allowed: Perfil[]; children: ReactNode }) {
  const { role } = useStore();
  return allowed.includes(role) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <AuthEntry /> },
  { path: '/cadastro', element: <Cadastro /> },
  { path: '/redefinir-senha', element: <RedefinirSenha /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/clientes', element: <Clientes /> },
      { path: '/clientes/:id', element: <ClienteDetalhe /> },
      { path: '/processos', element: <Processos /> },
      { path: '/processos/:numero', element: <ProcessoDetalhe /> },
      { path: '/agenda', element: <Agenda /> },
      { path: '/prazos', element: <Prazos /> },
      { path: '/tarefas', element: <Tarefas /> },
      { path: '/audiencias', element: <Audiencias /> },
      { path: '/documentos', element: <Documentos /> },
      { path: '/pesquisa', element: <Pesquisa /> },
      { path: '/usuarios', element: <Usuarios /> },
      { path: '/equipe', element: <Equipe /> },
      { path: '/configuracoes', element: <Configuracoes /> },
      { path: '/perfil', element: <Navigate to="/configuracoes" replace /> },
      { path: '/admin/auditoria-acessos', element: <RoleOnly allowed={['Administrador']}><AdminAccessAudit /></RoleOnly> },
      { path: '/advogado/mesa-analise', element: <RoleOnly allowed={['Advogado']}><AttorneyReviewDesk /></RoleOnly> },
      { path: '/assistente/triagem', element: <RoleOnly allowed={['Assistente']}><AssistantIntake /></RoleOnly> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
