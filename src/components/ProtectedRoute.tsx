import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles: string[];
};

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, userRole, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101112]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !userRole) {
    // Salvar a URL atual para redirecionar depois do login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    // Se o usuário não tem permissão, redirecionar para o dashboard apropriado
    if (userRole === 'premium') {
      return <Navigate to="/dashboard/premium" replace />;
    } else if (userRole === 'client') {
      return <Navigate to="/dashboard/client" replace />;
    } else if (userRole === 'establishment') {
      return <Navigate to="/dashboard/establishment" replace />;
    }
    // Fallback para client se não reconhecer o role
    return <Navigate to="/dashboard/client" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;