import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { LogOut } from 'lucide-react';
import { PlusCircle } from 'lucide-react';
import { Phone } from 'lucide-react'; // Certifique-se de que Phone está importado

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  const [establishment, setEstablishment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [forceRender, setForceRender] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [showDemoSuccessModal, setShowDemoSuccessModal] = useState(false); // Novo estado para o modal de demonstração

  const bookingFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEstablishment();
  }, [id]);

  useEffect(() => {
    if (establishment) {
      fetchExistingAppointments();
    }
  }, [establishment, selectedDate]);

  // Efeito para rolar até o formulário quando ele se torna visível
  useEffect(() => {
    if (showBookingForm && bookingFormRef.current) {
      bookingFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showBookingForm]);

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
        .select(`
          *,
          pix_payment_link,
          review_link,
          social_media_link,
          pix_key,
          whatsapp
        `)
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
    if (!user && id !== '3814' && id !== '3315') return; // Se não for demonstração, exige usuário
    if (!establishment) return;

    try {
      if (id === '3814' || id === '3315') {
        // Lógica para agendamento demonstrativo
        toast.success('Atenção! Este foi um agendamento demonstrativo, parabéns! Clique abaixo e volte ao menu iniciar.', {
          duration: 6000 // Aumenta a duração para a mensagem completa
        });
        setShowBookingForm(false); // Esconder formulário após agendamento demonstrativo
        setShowDemoSuccessModal(true); // Exibir modal de sucesso de demonstração
        return; // Sair da função para não salvar no banco
      }

      // Lógica para agendamentos reais (se não for ID 3814 ou 3315)
      const isEstablishmentOwner = user?.id === establishment.owner_id;

      const { error } = await supabase
        .from('appointments')
        .insert([{
          client_id: user?.id, // Corrigido para user?.id
          establishment_id: establishment.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          // TODO: Adicionar is_establishment_booking quando a coluna for criada no banco
          // is_establishment_booking: isEstablishmentOwner,
          ...appointmentData
        }]);

      if (error) throw error;

      toast.success('Agendamento realizado com sucesso!');
      
      // Atualizar lista de agendamentos após sucesso
      await fetchExistingAppointments();
      setShowBookingForm(false); // Esconder formulário após agendamento
      
      // Se for o estabelecimento, redirecionar para o dashboard do estabelecimento
      if (isEstablishmentOwner) {
        navigate('/dashboard/establishment');
      } else {
        navigate('/dashboard/client');
      }
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast.error(error.message || 'Erro ao criar agendamento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgendarClick = () => {
    if (id === '3814' || id === '3315') {
      setShowBookingForm(true);
      return;
    }

    if (!user) {
      // Salvar a URL atual para redirecionamento após o login
      const returnUrl = location.pathname;
      navigate('/login', { state: { returnUrl } });
      return;
    }
    
    setShowBookingForm(true);
  };

  console.log('🔍 RENDER - Estados atuais:');
  console.log('  - isLoading:', isLoading);
  console.log('  - establishment:', establishment);
  console.log('  - establishment existe?', !!establishment);
  console.log('  - forceRender:', forceRender);
  console.log('  - showBookingForm:', showBookingForm);

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
    return (
      <div className="min-h-screen bg-white">
        <div className="container-custom py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-gray-900">Estabelecimento não encontrado</h1>
            <p className="text-gray-600 mb-4">O estabelecimento que você procura não existe ou foi removido.</p>
            <Link to="/" className="text-primary hover:underline">
              Voltar para a página inicial
            </Link>
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
              <ChevronLeft className="w-5 h-5" />
              <span>Voltar</span>
            </Link>
            {user && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            )}
          </div>

          {/* Carrossel de Fotos */}
          <div className="rounded-lg overflow-hidden">
            <PhotoCarousel 
              photos={[
                establishment?.custom_photo_1_url || '/barbeiro ft 1.png',
                establishment?.custom_photo_2_url || '/barbeiro ft 2.png',
                establishment?.custom_photo_3_url || '/barbeiro ft 3.png'
              ]}
              logoUrl={establishment?.logo_url}
              establishmentName={establishment?.name}
            />
          </div>

          {/* Informações do Estabelecimento */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">{establishment?.name}</h1>
            {establishment?.description && (
              <p className="text-gray-600">{establishment.description}</p>
            )}

            {/* Botões de Ação Principal */}
            <div className="mt-6 flex flex-col space-y-4">
              <button
                onClick={handleAgendarClick}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 flex items-center justify-center gap-2"
              >
                AGENDAR
                <img src="/calendario.png" alt="Calendário" className="h-5 w-5" />
              </button>
              <a
                href={establishment?.review_link && !establishment.review_link.startsWith('http') ? `https://${establishment.review_link}` : establishment.review_link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.review_link ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 cursor-not-allowed opacity-50'}`}
              >
                AVALIE A GENTE
                <img src="/google.png" alt="Google" className="h-5 w-5" />
              </a>
              <a
                href={establishment?.social_media_link && !establishment.social_media_link.startsWith('http') ? `https://${establishment.social_media_link}` : establishment.social_media_link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.social_media_link ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 cursor-not-allowed opacity-50'}`}
              >
                INSTAGRAM
                <img src="/INST.png" alt="Instagram" className="h-5 w-5" />
              </a>
              <button
                onClick={() => {
                  if (establishment?.pix_key) {
                    navigator.clipboard.writeText(establishment.pix_key);
                    toast.success('Chave PIX copiada com sucesso!');
                  } else {
                    toast.error('Chave PIX não disponível.');
                  }
                }}
                disabled={!establishment?.pix_key}
                className={`flex items-center justify-center gap-2 text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${
                  establishment?.pix_key ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                PAGAR PIX
                <img src="/PIX.png" alt="PIX" className="h-5 w-5" />
              </button>
              <a
                href={establishment?.location_link && !establishment.location_link.startsWith('http') ? `https://${establishment.location_link}` : establishment.location_link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${
                  establishment?.location_link ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                COMO CHEGAR
                <img src="/LOCAL.png" alt="Localização" className="h-5 w-5" />
              </a>

              {/* Seção de Comodidades */}
              <div className="mt-8 mb-6 bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800">
                <h3 className="text-lg font-medium text-white mb-2">Comodidades</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Clique no item para obter informações
                </p>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {/* Wi-fi */}
                  <div 
                    onClick={() => {
                      if (establishment?.wifi_password) {
                        navigator.clipboard.writeText(establishment.wifi_password);
                        toast.success('Senha do Wi-Fi copiada!');
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-lg transition-colors duration-200 cursor-pointer
                      ${establishment?.has_wifi ? 'bg-[#242628] text-gray-300 hover:bg-[#2a2c2e]' : 'bg-[#242628] text-gray-500 opacity-50 cursor-not-allowed'}`}
                    title={establishment?.has_wifi && establishment?.wifi_password ? "Clique para copiar a senha do Wi-Fi" : establishment?.has_wifi ? "Wi-Fi disponível" : "Wi-Fi indisponível"}
                  >
                    <img src="/wifi.png" alt="Wi-fi" className="h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2" />
                    <span className={`text-xs sm:text-sm font-medium ${!establishment?.has_wifi ? 'line-through' : ''}`}>Wi-fi</span>
                  </div>

                  {/* Estacionamento */}
                  <div className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-lg transition-colors duration-200 cursor-default
                    ${establishment?.has_parking ? 'bg-[#242628] text-gray-300' : 'bg-[#242628] text-gray-500 opacity-50'}`}
                  >
                    <img src="/car.png" alt="Estacionamento" className="h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2" />
                    <span className={`text-xs sm:text-sm font-medium text-center ${!establishment?.has_parking ? 'line-through' : ''}`}>Estacion.</span>
                  </div>

                  {/* Acessibilidade */}
                  <div className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-lg transition-colors duration-200 cursor-default
                    ${establishment?.has_accessibility ? 'bg-[#242628] text-gray-300' : 'bg-[#242628] text-gray-500 opacity-50'}`}
                  >
                    <img src="/wheelchair.png" alt="Acessibilidade" className="h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2" />
                    <span className={`text-xs sm:text-sm font-medium text-center ${!establishment?.has_accessibility ? 'line-through' : ''}`}>Acessib.</span>
                  </div>
                </div>
              </div>

              {/* Botão de WhatsApp */}
              <a
                href={establishment?.whatsapp ? `https://wa.me/${establishment.whatsapp}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${
                  establishment?.whatsapp ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                ENTRAR EM CONTATO
                <img src="/wppicon.png" alt="WhatsApp" className="h-5 w-5" />
              </a>

              {/* Seção de Horário de Atendimento */}
              <div className="mt-8 mb-6 bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800">
                <h3 className="text-lg font-medium text-white mb-2">Horário de atendimento</h3>
                {establishment?.business_hours && (
                  <div className="space-y-2 sm:space-y-3">
                    {[
                      { dia: 'Segunda-Feira', key: 'monday' },
                      { dia: 'Terça-Feira', key: 'tuesday' },
                      { dia: 'Quarta-Feira', key: 'wednesday' },
                      { dia: 'Quinta-Feira', key: 'thursday' },
                      { dia: 'Sexta-Feira', key: 'friday' },
                      { dia: 'Sábado', key: 'saturday' },
                      { dia: 'Domingo', key: 'sunday' }
                    ].map(({ dia, key }) => {
                      const hoje = new Date().getDay();
                      const diaDaSemana = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      const isHoje = diaDaSemana[hoje] === key;
                      const horarios = establishment.business_hours[key];

                      if (!horarios?.enabled) return null;

                      const formatHorario = (horarios: any) => {
                        if (!horarios?.open1) return 'Fechado';
                        
                        let horario = `${horarios.open1} - `;
                        
                        if (horarios.open2 && horarios.close2) {
                          horario += `${horarios.close1} e ${horarios.open2} - ${horarios.close2}`;
                        } else {
                          horario += horarios.close1;
                        }
                        
                        return horario;
                      };

                      return (
                        <div 
                          key={dia} 
                          className={`flex justify-between items-center p-2 sm:p-3 rounded-lg ${
                            isHoje ? 'bg-[#242628] border border-gray-700' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm text-gray-300">{dia.replace('-Feira', '')}</span>
                            {isHoje && (
                              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
                                Hoje
                              </span>
                            )}
                          </div>
                          <span className="text-xs sm:text-sm text-gray-400 text-right">
                            {formatHorario(horarios)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Formulário de Agendamento */}
          {showBookingForm && (
            <div 
              ref={bookingFormRef}
              className="bg-white rounded-lg shadow-md p-6 text-gray-900"
            >
              <h2 className="text-xl font-bold mb-4">Fazer Agendamento</h2>
              <AppointmentForm
                establishment={establishment}
                onSubmit={handleSubmit}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                existingAppointments={existingAppointments}
                // Não vamos mais passar selectedProfessional daqui, será gerenciado dentro do AppointmentForm
              />
            </div>
          )}

          {showDemoSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg text-center max-w-sm mx-auto border border-blue-500">
                <h2 className="text-2xl font-bold text-white mb-4">Atenção!</h2>
                <p className="text-gray-300 mb-6">
                  Este foi um agendamento demonstrativo, parabéns! Clique abaixo e volte ao menu iniciar.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md w-full transition-colors"
                >
                  Finaliza
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 