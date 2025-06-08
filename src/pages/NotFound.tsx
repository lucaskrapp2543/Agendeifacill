import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 px-4">
      <div className="text-center">
        <Calendar className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-xl text-gray-700 mb-6">Página não encontrada</p>
        <Link to="/" className="btn-primary inline-flex items-center">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para o início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;