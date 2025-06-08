import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SupabaseProvider } from './context/SupabaseContext';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from './components/ui/Toaster';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientDashboard from './pages/ClientDashboard';
import EstablishmentDashboard from './pages/EstablishmentDashboard';
import PremiumDashboard from './pages/PremiumDashboard';
import NotFound from './pages/NotFound';
import BookingPage from './pages/BookingPage';
import { SuccessPage } from './pages/SuccessPage';
import { Success } from './pages/Success';
import Suporte060622 from './pages/Suporte060622';
import CadastroPremium060622 from './pages/CadastroPremium060622';
import CadastroEstabelecimento060622 from './pages/CadastroEstabelecimento060622';

// Protected Routes
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <SupabaseProvider>
      <AuthProvider>
        <Toaster>
          <Router>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/suporte060622" element={<Suporte060622 />} />
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
                path="/booking/:id" 
                element={
                  <ProtectedRoute allowedRoles={['client', 'premium']}>
                    <BookingPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route path="/success" element={<Success />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </Toaster>
      </AuthProvider>
    </SupabaseProvider>
  );
}

export default App;