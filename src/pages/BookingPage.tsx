import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { supabase } from '../lib/supabase';
import { AppointmentForm } from '../components/AppointmentForm';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    fetchEstablishment();
  }, [id]);

  // DEBUG: Log quando establishment muda
  useEffect(() => {
    if (establishment) {
      console.log('🔍 BookingPage - Establishment carregado, pronto para renderizar carrossel:', establishment.name);
    }
  }, [establishment]);

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

  // Preparar fotos do carrossel
  const photos = [
    establishment.custom_photo_1_url || '/barbeiro ft 1.png',
    establishment.custom_photo_2_url || '/barbeiro ft 2.png',
    establishment.custom_photo_3_url || '/barbeiro ft 3.png'
  ];

  console.log('🖼️ Fotos do carrossel:', photos);

  // Auto-play do carrossel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhotoIndex((prevIndex) => 
        prevIndex === photos.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [photos.length]);

  const goToPrevious = () => {
    setCurrentPhotoIndex(currentPhotoIndex === 0 ? photos.length - 1 : currentPhotoIndex - 1);
  };

  const goToNext = () => {
    setCurrentPhotoIndex(currentPhotoIndex === photos.length - 1 ? 0 : currentPhotoIndex + 1);
  };

  console.log('🔍 BookingPage - Renderizando página principal com establishment:', establishment.name);

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
          <div className="relative w-full max-w-2xl mx-auto mb-8">
            {/* Container da imagem */}
            <div className="relative h-64 md:h-80 rounded-lg overflow-hidden bg-gray-100 shadow-lg">
              <img
                src={photos[currentPhotoIndex]}
                alt={`${establishment.name} - Foto ${currentPhotoIndex + 1}`}
                className="w-full h-full object-cover transition-opacity duration-500"
                onError={(e) => {
                  console.error('❌ Erro ao carregar imagem:', photos[currentPhotoIndex]);
                  // Tentar carregar foto padrão se a personalizada falhar
                  const defaultPhotos = ['/barbeiro ft 1.png', '/barbeiro ft 2.png', '/barbeiro ft 3.png'];
                  e.currentTarget.src = defaultPhotos[currentPhotoIndex] || '/barbeiro ft 1.png';
                }}
                onLoad={() => {
                  console.log('✅ Imagem carregada com sucesso:', photos[currentPhotoIndex]);
                }}
              />
              
              {/* Overlay com gradiente */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              
              {/* Botões de navegação */}
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
                aria-label="Próxima foto"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Indicadores de posição */}
            <div className="flex justify-center mt-4 space-x-2">
              {photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    index === currentPhotoIndex 
                      ? 'bg-primary scale-110' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Ir para foto ${index + 1}`}
                />
              ))}
            </div>
            
            {/* Contador de fotos */}
            <div className="text-center mt-2">
              <span className="text-sm text-gray-500">
                {currentPhotoIndex + 1} de {photos.length}
              </span>
            </div>
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