import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PromoBanner } from '../components/PromoBanner';

const LandingPage = () => {
  const { user, userRole } = useAuth();

  return (
    <div className="min-h-screen bg-black">
      <header className="container-custom py-6">
        <nav className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            {user ? (
              <Link 
                to={`/dashboard/${userRole}`} 
                className="btn-primary"
              >
                Acessar Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/suporte060622" className="btn-accent">
                  SUPORTE
                </Link>
                <div className="relative group">
                  <button className="btn-secondary">
                    Cadastrar
                  </button>
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-2">
                      <a 
                        href="https://pay.kiwify.com.br/ApygJMY" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Cadastrar como estabelecimento
                      </a>
                      <Link 
                        to="/register?role=client" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Cadastrar como cliente
                      </Link>
                    </div>
                  </div>
                </div>
                <Link to="/login" className="btn-primary">
                  Entrar
                </Link>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="container-custom py-4">
        <section className="text-center max-w-3xl mx-auto py-4">
          <PromoBanner />

          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-6 text-white">Como funciona</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="card">
                <div className="text-3xl font-bold text-primary mb-2">01</div>
                <h3 className="text-lg font-medium mb-2">Crie sua conta</h3>
                <p className="text-gray-600">Escolha o tipo de conta que melhor atende suas necessidades.</p>
              </div>
              
              <div className="card">
                <div className="text-3xl font-bold text-primary mb-2">02</div>
                <h3 className="text-lg font-medium mb-2">Conecte-se</h3>
                <p className="text-gray-600">Cliente: Use o código do estabelecimento para agendar.<br/>Estabelecimento: Crie seu perfil e compartilhe seu código.</p>
              </div>
              
              <div className="card">
                <div className="text-3xl font-bold text-primary mb-2">03</div>
                <h3 className="text-lg font-medium mb-2">Gerencie seus agendamentos</h3>
                <p className="text-gray-600">Visualize, crie e gerencie agendamentos em um painel intuitivo.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#1a1b1c] text-white py-8">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Calendar className="h-6 w-6 mr-2" />
              <span className="font-bold text-lg">AgendaFácil</span>
            </div>
            <div className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} AgendaFácil. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
