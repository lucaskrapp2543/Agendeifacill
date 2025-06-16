import React from 'react';
import { useNavigate } from 'react-router-dom';

export function Success() {
  const navigate = useNavigate();
  const isPremium = localStorage.getItem('userType') === 'premium';

  const handleRedirect = () => {
    navigate(isPremium ? '/dashboard/premium' : '/dashboard/client');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold text-white mb-6">Parabéns!</h1>
        <p className="text-gray-300 mb-8">
          Seu agendamento foi realizado com sucesso!
        </p>
        <button
          onClick={handleRedirect}
          className="w-full px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
        >
          Ir para meus agendamentos
        </button>
      </div>
    </div>
  );
} 