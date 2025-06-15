import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { supabase } from '../lib/supabase';
import { AppointmentForm } from '../components/AppointmentForm';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [establishment, setEstablishment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchEstablishment();
  }, [id]);

  const fetchEstablishment = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('establishments')
        .select(`
          *,
          custom_photo_1_url,
          custom_photo_2_url,
          custom_photo_3_url
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        console.log('Dados do estabelecimento:', data);
        setEstablishment(data);
      }
    } catch (error: any) {
      console.error('Error fetching establishment:', error);
      toast(error.message || 'Erro ao carregar estabelecimento', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast(error.message || 'Erro ao sair', 'error');
    }
  };

  const handleSubmit = async (appointmentData: any) => {
    if (!user || !establishment) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .insert([{
          client_id: user.id,
          establishment_id: establishment.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          ...appointmentData
        }]);

      if (error) throw error;

      toast('Agendamento realizado com sucesso!', 'success');
      navigate('/dashboard/client');
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast(error.message || 'Erro ao criar agendamento', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101112] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="min-h-screen bg-[#101112] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white">Estabelecimento não encontrado</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center text-primary hover:text-primary/90"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101112]">
      <header className="bg-[#1a1b1c] border-b border-gray-800">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-white">AgendaFácil</span>
            </Link>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-400">{user.email}</span>
                <button onClick={handleLogout} className="btn-outline">
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="btn-outline">
                  Entrar
                </Link>
                <Link to="/register" className="btn-primary">
                  Criar conta
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{establishment.name}</h1>
              <p className="text-gray-400">{establishment.address}</p>
            </div>
          </div>

          {/* CARROSSEL DE FOTOS */}
          <div className="bg-[#1a1b1c] rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Fotos do Estabelecimento
            </h3>
            
            <PhotoCarousel
              customPhotos={[
                establishment.custom_photo_1_url,
                establishment.custom_photo_2_url,
                establishment.custom_photo_3_url
              ]}
              establishmentName={establishment.name}
            />
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-6 text-white">Agendar Horário</h2>
            <AppointmentForm
              establishment={establishment}
              onSubmit={handleSubmit}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>
      </main>
    </div>
  );
} 