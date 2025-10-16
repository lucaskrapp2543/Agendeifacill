import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { CacheBuster } from './components/CacheBuster';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ConnectivityChecker } from './components/ConnectivityChecker';
import { EnvironmentError } from './components/EnvironmentError';
import { UpdateNotification } from './components/UpdateNotification';
import { AuthProvider } from './context/AuthContext';
import { SupabaseProvider } from './context/SupabaseContext';
import { registerServiceWorker } from './utils/serviceWorker';

import { PWARedirect } from './components/PWARedirect';

// Teste de configuração - novo computador

// Pages
import BookingPage from './pages/BookingPage';
import CadastroEstabelecimento060622 from './pages/CadastroEstabelecimento060622';
import CadastroPremium060622 from './pages/CadastroPremium060622';
import ClientDashboard from './pages/ClientDashboard';
import EstablishmentDashboard from './pages/EstablishmentDashboard';
import EstablishmentDirectBooking from './pages/EstablishmentDirectBooking';
import LandingPage from './pages/LandingPage';
import LandingVendas from './pages/LandingVendas';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import PremiumDashboard from './pages/PremiumDashboard';
import Register from './pages/Register';
import RegistrationFreeSuccess from './pages/RegistrationFreeSuccess';
import RegistrationSuccess from './pages/RegistrationSuccess';
import { Success } from './pages/Success';
import Suporte060622 from './pages/Suporte060622';

import AdminDashboard from './pages/AdminDashboard';
import BlockedPage from './pages/BlockedPage';
import CadastroAg from './pages/CadastroAg';
import Conhecer from './pages/Conhecer';
import ConhecerV2 from './pages/ConhecerV2';
import ConhecerV3 from './pages/ConhecerV3';
import ConhecerV4 from './pages/ConhecerV4';
import ConhecerV5 from './pages/ConhecerV5';
import RecoveryPassword from './pages/RecoveryPassword';
import ResetPassword from './pages/ResetPassword';
import TesteFree from './pages/TesteFree';
import VerTestesFree from './pages/VerTestesFree';
import VerUsuariosGratis060622 from './pages/VerUsuariosGratis060622';

// Protected Routes
import BlockedCheck from './components/BlockedCheck';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  // Verificar se as variáveis de ambiente estão configuradas
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Registrar Service Worker
  React.useEffect(() => {
    registerServiceWorker();
  }, []);

  // Se as variáveis não estão configuradas, mostrar tela de erro
  if (!supabaseUrl || !supabaseAnonKey) {
    return <EnvironmentError />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CacheBuster />
      <ConnectionStatus />
      <UpdateNotification />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1a1b1c',
            color: '#ffffff',
            border: '1px solid #374151',
            marginTop: '80px', // Adiciona margem para não ficar em cima do header
            zIndex: 9999,
          }
        }}
      />
      <SupabaseProvider>
        <AuthProvider>
          <ConnectivityChecker>
            <Router>
              <PWARedirect />
              <Routes>
                <Route path="/" element={<LandingVendas />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/recovery-password" element={<RecoveryPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/conhecer" element={<Conhecer />} />
                <Route path="/conhecerv2" element={<ConhecerV2 />} />
                <Route path="/conhecerv3" element={<ConhecerV3 />} />
                <Route path="/conhecerv4" element={<ConhecerV4 />} />
                <Route path="/conhecerv5" element={<ConhecerV5 />} />
                <Route path="/cadastroag" element={<CadastroAg />} />
                <Route path="/testefree" element={<TesteFree />} />
                <Route path="/suporte060622" element={<Suporte060622 />} />

                <Route path="/verusuariosgratis060622" element={<VerUsuariosGratis060622 />} />
                <Route
                  path="/ver-testes-free"
                  element={
                    <ProtectedRoute allowedRoles={['support']}>
                      <VerTestesFree />
                    </ProtectedRoute>
                  }
                />
                <Route path="/cadastropremium060622" element={<CadastroPremium060622 />} />
                <Route path="/cadastroestabelecimento060622" element={<CadastroEstabelecimento060622 />} />

                {/* Protected Routes */}
                <Route
                  path="/dashboard/client"
                  element={
                    <ProtectedRoute allowedRoles={['client']}>
                      <ClientDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/premium"
                  element={
                    <ProtectedRoute allowedRoles={['premium']}>
                      <PremiumDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/establishment"
                  element={
                    <ProtectedRoute allowedRoles={['establishment']}>
                      <BlockedCheck>
                        <EstablishmentDashboard />
                      </BlockedCheck>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/admin"
                  element={<AdminDashboard />}
                />

                <Route
                  path="/blocked"
                  element={<BlockedPage />}
                />

                <Route
                  path="/booking/:id"
                  element={<BookingPage />}
                />

                <Route path="/success" element={<Success />} />
                <Route path="/registration-success" element={<RegistrationSuccess />} />
                <Route path="/registrationfree-success" element={<RegistrationFreeSuccess />} />

                {/* Rota dinâmica para agendamento direto */}
                <Route path="/:slug" element={<EstablishmentDirectBooking />} />

                <Route path="*" element={<NotFound />} />
              </Routes>

            </Router>
          </ConnectivityChecker>
        </AuthProvider>
      </SupabaseProvider>
    </div>
  );
}

export default App;