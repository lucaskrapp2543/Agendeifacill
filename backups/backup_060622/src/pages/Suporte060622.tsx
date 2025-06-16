import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { useToast } from '../components/ui/Toaster';

const Suporte060622 = () => {
  const [codigo, setCodigo] = useState('');
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
  const { toast } = useToast();

  const handleValidarCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (codigo === '254390') {
      setMostrarOpcoes(true);
      toast('Código validado com sucesso!', 'success');
    } else {
      toast('Código inválido. Tente novamente.', 'error');
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
        
        <h1 className="text-2xl font-bold text-center mb-8 text-white">Acesso ao Suporte</h1>
        
        {!mostrarOpcoes ? (
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
        ) : (
          <div className="space-y-4">
            <p className="text-center text-green-400 mb-6">
              ✓ Código validado! Escolha uma opção:
            </p>
            
            <Link 
              to="/cadastropremium060622"
              className="w-full btn-accent block text-center"
            >
              Cadastro Premium
            </Link>
            
            <Link 
              to="/cadastroestabelecimento060622"
              className="w-full btn-secondary block text-center"
            >
              Cadastro Estabelecimento
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Suporte060622; 