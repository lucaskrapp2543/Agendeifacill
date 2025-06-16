import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { getEstablishmentByCode, createAppointment } from '../lib/supabase';
import { Calendar, Star, ArrowLeft, LogIn, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BusinessHoursSelector } from '../components/BusinessHoursSelector';
import type { Establishment } from '../types/supabase';

const EstablishmentPage = () => {
  const { establishmentCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [service, setService] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [professional, setProfessional] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState([]);

  useEffect(() => {
    fetchEstablishment();
  }, [establishmentCode]);

  const fetchEstablishment = async () => {
    if (!establishmentCode) return;
    
    try {
      const { data, error } = await getEstablishmentByCode(establishmentCode);
      
      if (error) throw error;
      
      if (!data) {
        toast('Estabelecimento não encontrado', 'error');
        navigate('/');
        return;
      }
      
      setEstablishment(data);
    } catch (error: any) {
      toast(error.message || 'Erro ao carregar estabelecimento', 'error');
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !establishment) return;
    
    const selectedService = establishment.services_with_prices.find(s => s.name === service);
    if (!selectedService) {
      toast('Serviço não encontrado', 'error');
      return;
    }

    setIsBooking(true);

    try {
      const { error } = await createAppointment({
        client_id: user.id,
        client_name: clientName.trim(),
        establishment_id: establishment.id,
        service,
        professional,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: 'pending',
        price: selectedService.price,
        duration: selectedService.duration,
        is_premium: false
      });
      
      if (error) throw error;
      
      toast('Agendamento realizado com sucesso!', 'success');
      navigate('/dashboard/client');
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast(error.message || 'Erro ao criar agendamento', 'error');
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101112] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!establishment) {
    return null;
  }

  // Se não estiver logado, mostra a tela de login/registro
  if (!user) {
    return (
      <div className="min-h-screen bg-[#101112] flex items-center justify-center">
        <div className="card bg-[#1a1b1c] border border-gray-800 p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">{establishment.name}</h2>
            <p className="text-gray-400">{establishment.description}</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Fazer Login
            </button>
            
            <button
              onClick={() => navigate('/register')}
              className="btn-outline w-full flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Criar Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101112]">
      <header className="bg-[#1a1b1c] border-b border-gray-800">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-white">{establishment.name}</span>
            </div>
            {user && (
              <button
                onClick={() => navigate('/dashboard/client')}
                className="btn-outline flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Meu Painel
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="card bg-[#1a1b1c] border border-gray-800">
          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-white">Fazer Agendamento</h2>
              </div>
              <p className="text-sm text-gray-400">{establishment.description}</p>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Seu Nome
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="input-field bg-[#242628] border-gray-800 text-white"
                  placeholder="Digite seu nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Serviço
                </label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="input-field bg-[#242628] border-gray-800 text-white"
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {establishment.services_with_prices.map(service => (
                    <option key={service.id} value={service.name}>
                      {service.name} - R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'} ({service.duration || 0}min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="input-field bg-[#242628] border-gray-800 text-white"
                  required
                />
              </div>

              {appointmentDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Horário
                  </label>
                  <BusinessHoursSelector
                    value={appointmentTime}
                    onChange={setAppointmentTime}
                    selectedDate={new Date(appointmentDate + 'T00:00:00')}
                    businessHours={establishment.business_hours || {}}
                    className="input-field bg-[#242628] border-gray-800 text-white"
                    existingAppointments={existingAppointments}
                    selectedProfessional={professional}
                    selectedServiceDuration={selectedService?.duration || 30}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isBooking}
                className={`btn-primary w-full ${isBooking && 'opacity-50 cursor-not-allowed'}`}
              >
                {isBooking ? 'Agendando...' : 'Confirmar Agendamento'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EstablishmentPage;
