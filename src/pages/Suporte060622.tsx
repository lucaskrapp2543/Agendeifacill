import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const Suporte060622 = () => {
  const [codigo, setCodigo] = useState('');
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false);

  const handleValidarCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (codigo === '254390') {
      setMostrarOpcoes(true);
      toast.success('Código validado com sucesso!');
    } else {
      toast.error('Código inválido. Tente novamente.');
      setCodigo('');
    }
  };

  return (
    <div className="min-h-screen bg-[#101112] flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para a página inicial
        </Link>
        
        <div className="flex justify-center mb-6">
          <Shield className="h-10 w-10 text-primary" />
        </div>
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Área de Suporte</h1>
        </div>
        
        <div className="text-center">
          {mostrarOpcoes ? (
            <div className="space-y-4">
              <Link
                to="/cadastropremium060622"
                className="block w-full py-3 px-6 text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Cadastrar Premium
              </Link>
              <Link
                to="/cadastroestabelecimento060622"
                className="block w-full py-3 px-6 text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Cadastrar Estabelecimento
              </Link>
              <Link
                to="/verusuariosgratis060622"
                className="block w-full py-3 px-6 text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Ver Testes Free
              </Link>
            </div>
          ) : (
            <form onSubmit={handleValidarCodigo} className="space-y-4">
              <div>
                <label htmlFor="codigo" className="block text-sm font-medium text-gray-400 mb-1">
                  Código de Acesso (6 dígitos)
                </label>
                <input
                  id="codigo"
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  className="input-field text-center text-lg tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              
              <button
                type="submit"
                className="w-full btn-primary"
                disabled={codigo.length !== 6}
              >
                Validar Código
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Suporte060622; 