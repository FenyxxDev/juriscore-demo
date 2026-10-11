import { Navigate, createBrowserRouter } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

export const router = createBrowserRouter([
  { path: '/', element: <Login /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
