import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { AppointmentForm } from '../components/AppointmentForm';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  const [establishment, setEstablishment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [forceRender, setForceRender] = useState(0); // Força re-renderização

  useEffect(() => {
    fetchEstablishment();
  }, [id]);

  useEffect(() => {
    if (establishment) {
      fetchExistingAppointments();
    }
  }, [establishment, selectedDate]);

  // Debug: Monitorar mudanças no estado establishment
  useEffect(() => {
    console.log('🔄 ESTADO ESTABLISHMENT MUDOU:', establishment);
    if (establishment) {
      console.log('✅ Establishment definido:', establishment.name);
    } else {
      console.log('❌ Establishment é null/undefined');
    }
  }, [establishment]);

  const fetchEstablishment = async () => {
    if (!id) {
      console.log('❌ Nenhum código fornecido na URL');
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔍 Buscando estabelecimento com código:', id);
      console.log('🔗 URL do Supabase:', import.meta.env.VITE_SUPABASE_URL || 'NÃO DEFINIDA');
      console.log('🔑 Chave do Supabase:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA');
      
      // Primeiro, vamos verificar se há estabelecimentos no banco
      console.log('📊 Verificando estabelecimentos disponíveis...');
      const { data: allEstablishments, error: countError } = await supabase
        .from('establishments')
        .select('code, name')
        .limit(10);

      if (countError) {
        console.error('❌ Erro ao verificar estabelecimentos:', countError);
        console.error('❌ Detalhes do erro:', JSON.stringify(countError, null, 2));
      } else {
        console.log('📊 Estabelecimentos disponíveis:', allEstablishments?.map(e => `${e.code} - ${e.name}`) || []);
        console.log('📊 Total encontrados:', allEstablishments?.length || 0);
      }
      
      console.log('🎯 Buscando especificamente pelo código:', id);
      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .eq('code', id)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar estabelecimento:', error);
        console.error('❌ Código do erro:', error.code);
        console.error('❌ Mensagem do erro:', error.message);
        console.error('❌ Detalhes completos:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data) {
        console.log('❌ Nenhum estabelecimento encontrado com código:', id);
        throw new Error(`Estabelecimento com código "${id}" não encontrado`);
      }

      console.log('✅ Estabelecimento encontrado:', data);
      setEstablishment(data);
      
    } catch (error: any) {
      console.error('❌ Error fetching establishment:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      toast.error(`Estabelecimento com código "${id}" não encontrado`);
    } finally {
      console.log('🏁 Finalizando busca, setIsLoading(false)');
      setIsLoading(false);
    }
  };

  const fetchExistingAppointments = async () => {
    if (!establishment) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishment.id)
        .neq('status', 'cancelled');

      if (error) throw error;

      console.log('📅 Agendamentos existentes carregados:', data);
      setExistingAppointments(data || []);
    } catch (error: any) {
      console.error('Error fetching existing appointments:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(error.message || 'Erro ao sair');
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

      toast.success('Agendamento realizado com sucesso!');
      
      // Atualizar lista de agendamentos após sucesso
      await fetchExistingAppointments();
      
      navigate('/dashboard/client');
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast.error(error.message || 'Erro ao criar agendamento');
    }
  };

  console.log('🔍 RENDER - Estados atuais:');
  console.log('  - isLoading:', isLoading);
  console.log('  - establishment:', establishment);
  console.log('  - establishment existe?', !!establishment);
  console.log('  - forceRender:', forceRender);

  // SOLUÇÃO ALTERNATIVA: Se temos dados mas establishment é null, tentar buscar novamente
  if (!isLoading && !establishment && id) {
    console.log('🔄 TENTATIVA DE RECUPERAÇÃO: Dados perdidos, tentando buscar novamente...');
    setTimeout(() => {
      fetchEstablishment();
    }, 100);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container-custom py-8">
          <div className="flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!establishment) {
    console.log('❌ Estado: SEM ESTABELECIMENTO - Renderizando página de erro');
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-white border-b border-gray-200">
          <div className="container-custom py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold text-gray-900">AgendaFácil</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="container-custom py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8">
              <h2 className="text-2xl font-semibold text-red-900 mb-4">
                🔍 Estabelecimento não encontrado
              </h2>
              <p className="text-red-700 mb-6">
                O código <strong>"{id}"</strong> não existe no sistema
              </p>
              
              <div className="bg-white rounded-lg p-6 mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">💡 Possíveis soluções:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Verifique se o código foi digitado corretamente</li>
                  <li>• O código deve ter exatamente 4 dígitos (ex: 2020, 1234)</li>
                  <li>• Confirme com o estabelecimento qual é o código correto</li>
                  <li>• O estabelecimento pode não ter sido configurado ainda</li>
                </ul>
              </div>

              <div className="text-center">
                <button
                  onClick={() => navigate(-1)}
                  className="btn-outline"
                >
                  Voltar
                </button>
              </div>

              <div className="mt-8 text-sm text-gray-600">
                <p>Tem um estabelecimento?</p>
                <Link to="/dashboard" className="text-primary hover:underline">
                  Acesse o dashboard para configurar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ Estado: RENDERIZANDO PÁGINA PRINCIPAL');
  console.log('🏢 Estabelecimento para renderizar:', establishment);

  // Pegar o dia da semana em inglês (como está no banco de dados)
  const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase(); // segunda-feira -> monday
  const businessHoursForDay = establishment.business_hours[dayOfWeek];
  
  // Debug para verificar o mapeamento
  console.log('🗓️ Data selecionada:', format(selectedDate, 'dd/MM/yyyy'));
  console.log('📅 Dia da semana (inglês):', dayOfWeek);
  console.log('🏢 Horários do estabelecimento:', establishment.business_hours);
  console.log('⏰ Horários para este dia:', businessHoursForDay);

  // Converter formato dos horários do banco de dados para o formato da interface
  const convertBusinessHours = (businessHours: any) => {
    if (!businessHours) return null;
    
    const { open, close, enabled } = businessHours;
    return {
      enabled: enabled || false,
      open1: open || '09:00',
      close1: close || '18:00',
      open2: null,
      close2: null
    };
  };

  // Garantir que os horários estão no formato correto (HH:mm)
  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formattedBusinessHours = businessHoursForDay ? {
    enabled: businessHoursForDay.enabled,
    open1: formatTime(businessHoursForDay.open) || '',
    close1: formatTime(businessHoursForDay.close) || '',
    open2: null,
    close2: null
  } : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-gray-200">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-gray-900">AgendaFácil</span>
            </Link>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-600">{user.email}</span>
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
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {establishment?.name || 'Nome não disponível'}
              </h1>
              <p className="text-gray-600">
                {establishment?.description || establishment?.address || 'Descrição não disponível'}
              </p>
            </div>
          </div>

          {/* Carrossel de Fotos */}
          <PhotoCarousel establishment={establishment} />

          <div className="card">
            <h2 className="text-lg font-semibold mb-6 text-white">
              Agendar Horário
            </h2>
            <AppointmentForm
              establishment={{
                ...establishment,
                business_hours: establishment.business_hours
              }}
              onSubmit={handleSubmit}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              existingAppointments={existingAppointments}
            />
          </div>
        </div>
      </main>
    </div>
  );
} 