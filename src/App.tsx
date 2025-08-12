import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SupabaseProvider } from './context/SupabaseContext';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientDashboard from './pages/ClientDashboard';
import EstablishmentDashboard from './pages/EstablishmentDashboard';
import PremiumDashboard from './pages/PremiumDashboard';
import NotFound from './pages/NotFound';
import BookingPage from './pages/BookingPage';
import EstablishmentDirectBooking from './pages/EstablishmentDirectBooking';
import { SuccessPage } from './pages/SuccessPage';
import { Success } from './pages/Success';
import Suporte060622 from './pages/Suporte060622';
import CadastroPremium060622 from './pages/CadastroPremium060622';
import CadastroEstabelecimento060622 from './pages/CadastroEstabelecimento060622';

import VerTestesFree from './pages/VerTestesFree';
import VerUsuariosGratis060622 from './pages/VerUsuariosGratis060622';
import AdminDashboard from './pages/AdminDashboard';

// Protected Routes
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1b1c',
            color: '#ffffff',
            border: '1px solid #374151'
          }
        }}
      />
    <SupabaseProvider>
      <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
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
                    <EstablishmentDashboard />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/dashboard/admin" 
                element={<AdminDashboard />}
              />

              <Route 
                path="/booking/:id" 
                element={<BookingPage />}
              />
              
              <Route path="/success" element={<Success />} />
              
              {/* Rota dinâmica para agendamento direto */}
              <Route path="/:slug" element={<EstablishmentDirectBooking />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
      </AuthProvider>
    </SupabaseProvider>
    </div>
  );
}

export default App;