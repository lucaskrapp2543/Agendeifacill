import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PromoBanner } from '../components/PromoBanner';
import WhatsAppButton from '../components/WhatsAppButton';

const LandingPage = () => {
  const { user, userRole } = useAuth();

  return (
    <div className="min-h-screen bg-black">
      <WhatsAppButton />
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
              <div className="flex items-center gap-2">
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
                <a 
                  href="https://wa.link/1jj7uf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md:hidden flex items-center justify-center w-10 h-10 bg-[#25D366] rounded-full shadow-lg"
                  aria-label="Chat no WhatsApp"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 16 16"
                    className="w-6 h-6"
                    style={{ fill: 'white' }}
                  >
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                  </svg>
                </a>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="container-custom py-4">
        <section className="text-center max-w-3xl mx-auto py-4">
          <div className="mb-8">
            <img 
              src="/logoagendei.png" 
              alt="Logo Agendei" 
              className="mx-auto mb-6 max-w-[200px]"
            />
            <h2 className="text-xl font-medium text-white mb-4">ABRA O VIDEO E VIRE A TELA PARA VER MELHOR</h2>
            <div className="aspect-video w-full mb-8">
              <iframe
                className="w-full h-full rounded-lg shadow-lg"
                src="https://www.youtube.com/embed/YUamwYx77Lw"
                title="Vídeo de apresentação"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>

            <PromoBanner />

            <div className="space-y-6 mt-8">
              <a 
                href="https://pay.kiwify.com.br/ApygJMY"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-90 transition-opacity"
              >
                <img 
                  src="/planomensal.png" 
                  alt="Plano Mensal" 
                  className="mx-auto rounded-lg shadow-lg max-w-[200px] w-full"
                />
              </a>

              <a 
                href="https://pay.kiwify.com.br/77necFv"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-90 transition-opacity"
              >
                <img 
                  src="/planoanual.png" 
                  alt="Plano Anual" 
                  className="mx-auto rounded-lg shadow-lg max-w-[200px] w-full"
                />
              </a>
            </div>
          </div>

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
