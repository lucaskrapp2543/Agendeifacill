import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NotFound = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  const goToDashboard = () => {
    if (userRole === 'establishment') {
      navigate('/dashboard/establishment', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="container-custom py-6">
        <nav className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-white">AgendaFácil</span>
          </Link>

          {userRole === 'establishment' && (
            <button 
              onClick={goToDashboard}
              className="btn-primary flex items-center gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
              Ir para o Dashboard
            </button>
          )}
        </nav>
      </header>

      <div className="container-custom py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-red-700 mb-2">Página não encontrada</h2>
            <p className="text-red-600">A página que você está procurando não existe.</p>
            {userRole === 'establishment' && (
              <button 
                onClick={goToDashboard}
                className="mt-4 btn-primary flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="h-5 w-5" />
                Ir para o Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;