import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { supabase, getSubscriptions } from '../lib/supabase';
import toast from 'react-hot-toast';
import { AppointmentForm } from '../components/AppointmentForm';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { PlusCircle } from 'lucide-react';
import { Phone } from 'lucide-react'; // Certifique-se de que Phone está importado
import { AlertCircle } from 'lucide-react'; // Corrigido de ExclamationCircle para AlertCircle
import { Crown } from 'lucide-react';
import ReadMore from '../components/ReadMore';

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
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [showSubscriptionsDropdown, setShowSubscriptionsDropdown] = useState(false);
  const [showBusinessHours, setShowBusinessHours] = useState(false);
  
  // Estados para agendamento assinante
  const [showSubscriberBooking, setShowSubscriberBooking] = useState(false);
  const [selectedSubscriberService, setSelectedSubscriberService] = useState<any>(null);
  const [convertedSubscriberData, setConvertedSubscriberData] = useState<any>(null); // Dados do assinante convertido

  const bookingFormRef = useRef<HTMLDivElement>(null);

  // Função para converter agendamento normal para assinante
  const handleConvertToSubscriber = (subscriberData: any) => {
    console.log('🔄 Convertendo agendamento para assinante:', subscriberData);
    
    // Salvar dados do assinante
    setConvertedSubscriberData(subscriberData);
    
    // Configurar o serviço de assinante
    const subscriberService = {
      id: subscriberData.subscriptions.id,
      name: subscriberData.subscriptions.name,
      service_duration: subscriberData.subscriptions.service_duration || 30,
      weekdays: subscriberData.subscriptions.weekdays || []
    };
    
    setSelectedSubscriberService(subscriberService);
    
    // Fechar formulário normal e abrir formulário de assinante
    setShowBookingForm(false);
    setShowSubscriberBooking(true);
    
    // Scroll para a seção de assinante
    setTimeout(() => {
      const subscriberSection = document.querySelector('[data-subscriber-booking]');
      if (subscriberSection) {
        subscriberSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
    
    toast.success('Convertido para agendamento de assinante! 🎯');
  };

  const pulseKeyframes = `
    @keyframes pulse-scale {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.7); // Amarelo
      }

      70% {
        transform: scale(1.03); // Levemente mais sutil
        box-shadow: 0 0 0 10px rgba(255, 204, 0, 0);
      }

      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0);
      }
    }
  `;

  useEffect(() => {
    // Adiciona os keyframes ao head do documento
    const styleSheet = document.createElement("style");
    styleSheet.textContent = pulseKeyframes;
    document.head.appendChild(styleSheet);

    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  useEffect(() => {
    fetchEstablishment();
  }, [id]);

  useEffect(() => {
    if (establishment) {
      fetchExistingAppointments();
      fetchSubscriptions();
    }
  }, [establishment, selectedDate]);

  // Efeito para rolar até o formulário quando ele se torna visível
  useEffect(() => {
    if (showBookingForm && bookingFormRef.current) {
      bookingFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showBookingForm]);

  // Efeito para fechar o dropdown quando clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.subscriptions-dropdown')) {
        setShowSubscriptionsDropdown(false);
      }
    };

    if (showSubscriptionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSubscriptionsDropdown]);

  // Debug: Monitorar mudanças no estado establishment
  useEffect(() => {
    console.log('🔄 ESTADO ESTABLISHMENT MUDOU:', establishment);
    if (establishment) {
      console.log('✅ Establishment definido:', establishment.name);
    } else {
      console.log('❌ Establishment é null/undefined');
    }
  }, [establishment]);

  // Debug: Monitorar mudanças no estado subscriptions
  useEffect(() => {
    console.log('👑 ESTADO SUBSCRIPTIONS MUDOU:', subscriptions);
    console.log('📊 Total de assinaturas:', subscriptions.length);
    console.log('🔽 Dropdown deve aparecer?', subscriptions.length > 0);
  }, [subscriptions]);

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

  const fetchSubscriptions = async () => {
    if (!establishment) {
      console.log('❌ Establishment não encontrado para buscar assinaturas');
      return;
    }

    console.log('🔍 Buscando assinaturas para establishment:', establishment.id);
    
    try {
      const { data: subscriptionsData, error } = await getSubscriptions(establishment.id);
      console.log('📋 Assinaturas encontradas:', subscriptionsData);
      console.log('❌ Erro (se houver):', error);
      
      if (error) {
        console.error('❌ Erro ao buscar assinaturas:', error);
        setSubscriptions([]);
        return;
      }
      
      if (subscriptionsData && Array.isArray(subscriptionsData)) {
        setSubscriptions(subscriptionsData);
        console.log('✅ Assinaturas carregadas:', subscriptionsData.length, 'planos');
      } else {
        setSubscriptions([]);
        console.log('⚠️ Nenhuma assinatura encontrada ou dados inválidos');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar assinaturas:', error);
      setSubscriptions([]);
    }
  };

  const handleSubscribeClick = (subscriptionName: string) => {
    if (!establishment?.whatsapp) {
      toast.error('WhatsApp não configurado para este estabelecimento');
      return;
    }

    const message = `Quero ser assinante ${subscriptionName.toLowerCase()}`;
    const whatsappUrl = `https://wa.me/${establishment.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    setShowSubscriptionsDropdown(false);
  };

  const handleSaberMaisClick = () => {
    if (!establishment?.whatsapp) {
      toast.error('WhatsApp não configurado para este estabelecimento');
      return;
    }

    const message = 'Quero informações sobre Assinantes.';
    const whatsappUrl = `https://wa.me/${establishment.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    setShowSubscriptionsDropdown(false);
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
      <div className="min-h-screen" style={{ backgroundColor: '#f0f6ff' }}>
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
      <div className="min-h-screen" style={{ backgroundColor: '#f0f6ff' }}>
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
    <div className="min-h-screen" style={{ backgroundColor: '#f0f6ff' }}>
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

          {/* Mensagem de Demonstração (apenas para IDs 3814 e 3315) */}
          {(id === '3814' || id === '3315') && (
            <div className="bg-yellow-400 text-yellow-900 p-4 rounded-lg flex flex-col items-center justify-center gap-1 mb-4 sm:flex-row sm:gap-2">
              <AlertCircle className="h-8 w-8 sm:h-5 sm:w-5" />
              <p className="font-semibold text-sm sm:text-base text-center animate-pulse-custom-slow">
                Essa é a pagina que seu cliente ira ver ao acessar o seu link, porem com as suas proprias fotos e links personalizados.
              </p>
            </div>
          )}



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
              <p className="text-gray-600">
                <ReadMore 
                  text={establishment.description} 
                  maxLength={60}
                  className="text-gray-600"
                />
              </p>
            )}

            {/* Botões de Ação Principal */}
            <div className="mt-6 flex flex-col space-y-4">
              {/* Botão AGENDAR */}
              <button
                onClick={handleAgendarClick}
                className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-6 rounded-lg text-base uppercase tracking-wide transition-all duration-200 flex items-center justify-center shadow-2xl hover:shadow-3xl border-2 border-gray-300 relative"
              >
                AGENDAR
                <img src="/calendario.png" alt="Calendário" className="h-6 w-6 absolute right-6" />
              </button>



              {/* Dropdown SER ASSINANTE */}
              {subscriptions.length > 0 && (
                <div className="relative subscriptions-dropdown" style={{ position: 'relative', zIndex: 10 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowSubscriptionsDropdown(!showSubscriptionsDropdown);
                    }}
                    className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-6 rounded-lg text-base uppercase tracking-wide transition-all duration-200 flex items-center justify-center shadow-2xl hover:shadow-3xl border-2 border-gray-300 relative"
                  >
                    SER ASSINANTE
                    <img src="/coroa.png" alt="Coroa" className="h-6 w-6 absolute right-6" />
                  </button>
                  
                  {showSubscriptionsDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                      {subscriptions.map((subscription) => (
                        <div
                          key={subscription.id}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-200 last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{subscription.name || 'Assinatura'}</div>
                            <div className="text-sm text-gray-500">
                              R$ {(subscription.value || 0).toFixed(2).replace('.', ',')} / {subscription.duration_months || 1} {subscription.duration_months === 1 ? 'mês' : 'meses'}
                            </div>
                            {subscription.weekdays && subscription.weekdays.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1">
                                📅 {subscription.weekdays.map(day => {
                                  const dayNames = {
                                    'monday': 'Seg',
                                    'tuesday': 'Ter', 
                                    'wednesday': 'Qua',
                                    'thursday': 'Qui',
                                    'friday': 'Sex',
                                    'saturday': 'Sáb',
                                    'sunday': 'Dom'
                                  };
                                  return dayNames[day as keyof typeof dayNames] || day;
                                }).join(', ')}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              handleSubscribeClick(subscription.name);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            Assinar
                          </button>
                        </div>
                      ))}
                      
                      {/* Item fixo SABER MAIS */}
                      <div className="p-3 border-t border-gray-200 bg-gray-50">
                        <button
                          onClick={() => {
                            handleSaberMaisClick();
                          }}
                          className="w-full text-center text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                        >
                          📞 SABER MAIS
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* Botão AVALIE A GENTE */}
              <a
                href={establishment?.review_link && !establishment.review_link.startsWith('http') ? `https://${establishment.review_link}` : establishment.review_link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center font-bold py-4 px-6 rounded-lg text-base uppercase tracking-wide transition-all duration-200 relative ${
                  establishment?.review_link 
                    ? 'bg-white hover:bg-gray-50 text-gray-800 shadow-2xl hover:shadow-3xl border-2 border-gray-300' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 border-2 border-gray-300'
                }`}
              >
                AVALIE A GENTE
                <img src="/google.png" alt="Google" className="h-6 w-6 absolute right-6" />
              </a>

              {/* Botão INSTAGRAM */}
              <a
                href={establishment?.social_media_link && !establishment.social_media_link.startsWith('http') ? `https://${establishment.social_media_link}` : establishment.social_media_link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center font-bold py-4 px-6 rounded-lg text-base uppercase tracking-wide transition-all duration-200 relative ${
                  establishment?.social_media_link 
                    ? 'bg-white hover:bg-gray-50 text-gray-800 shadow-2xl hover:shadow-3xl border-2 border-gray-300' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 border-2 border-gray-300'
                }`}
              >
                INSTAGRAM
                <img src="/INST.png" alt="Instagram" className="h-6 w-6 absolute right-6" />
              </a>

              {/* Botão PAGAR PIX */}
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
                className={`flex items-center justify-center font-bold py-4 px-6 rounded-lg text-base uppercase tracking-wide transition-all duration-200 relative ${
                  establishment?.pix_key 
                    ? 'bg-white hover:bg-gray-50 text-gray-800 shadow-2xl hover:shadow-3xl border-2 border-gray-300' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 border-2 border-gray-300'
                }`}
              >
                PAGAR PIX
                <img src="/PIX.png" alt="PIX" className="h-6 w-6 absolute right-6" />
              </button>

              {/* Botão COMO CHEGAR */}
              <a
                href={establishment?.location_link && !establishment.location_link.startsWith('http') ? `https://${establishment.location_link}` : establishment.location_link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center font-bold py-4 px-6 rounded-lg text-base uppercase tracking-wide transition-all duration-200 relative ${
                  establishment?.location_link 
                    ? 'bg-white hover:bg-gray-50 text-gray-800 shadow-2xl hover:shadow-3xl border-2 border-gray-300' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 border-2 border-gray-300'
                }`}
              >
                COMO CHEGAR
                <img src="/LOCAL.png" alt="Localização" className="h-6 w-6 absolute right-6" />
              </a>


              {/* Tela de Agendamento Assinante - Posicionada após os botões */}
              {showSubscriberBooking && (
                <div data-subscriber-booking className="bg-white rounded-lg shadow-md p-6 text-gray-900 mt-4 z-50 relative">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Agendamento Assinante</h2>
                    <button
                      onClick={() => {
                        setShowSubscriberBooking(false);
                        setSelectedSubscriberService(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  {!selectedSubscriberService ? (
                    // Tela de seleção de serviços
                    <div>
                      <p className="text-lg text-gray-700 mb-6">Selecione qual é o seu:</p>
                      <div className="space-y-4">
                        {subscriptions.map((subscription) => (
                          <div key={subscription.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-gray-900">{subscription.name}</h3>
                                <p className="text-sm text-gray-600">
                                  R$ {subscription.value.toFixed(2).replace('.', ',')}
                                </p>
                                {subscription.weekdays && subscription.weekdays.length > 0 && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    📅 {subscription.weekdays.map(day => {
                                      const dayNames = {
                                        'monday': 'Seg',
                                        'tuesday': 'Ter', 
                                        'wednesday': 'Qua',
                                        'thursday': 'Qui',
                                        'friday': 'Sex',
                                        'saturday': 'Sáb',
                                        'sunday': 'Dom'
                                      };
                                      return dayNames[day as keyof typeof dayNames] || day;
                                    }).join(', ')}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => setSelectedSubscriberService(subscription)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                              >
                                Agendar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Tela de agendamento com restrição de dias
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">{selectedSubscriberService.name}</h3>
                        <button
                          onClick={() => setSelectedSubscriberService(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ← Voltar
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4">
                        📅 Dias disponíveis: {selectedSubscriberService.weekdays?.map(day => {
                          const dayNames = {
                            'monday': 'Segunda',
                            'tuesday': 'Terça', 
                            'wednesday': 'Quarta',
                            'thursday': 'Quinta',
                            'friday': 'Sexta',
                            'saturday': 'Sábado',
                            'sunday': 'Domingo'
                          };
                          return dayNames[day as keyof typeof dayNames] || day;
                        }).join(', ') || 'Não configurado'}
                      </p>

                      <AppointmentForm
                        establishment={establishment}
                        onSubmit={handleSubmit}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                        existingAppointments={existingAppointments}
                        subscriberService={selectedSubscriberService} // Passar o serviço para restringir dias
                        isSubscriberBooking={true} // Indica que é agendamento de assinante
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Seção de Comodidades */}
              <div className="mt-8 mb-6 bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Comodidades</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Clique no item para obter informações
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Wi-fi */}
                  <div 
                    onClick={() => {
                      if (establishment?.wifi_password) {
                        navigator.clipboard.writeText(establishment.wifi_password);
                        toast.success('Senha do Wi-Fi copiada!');
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all duration-200 cursor-pointer bg-white shadow-md hover:shadow-lg border border-gray-200
                      ${establishment?.has_wifi ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                    title={establishment?.has_wifi && establishment?.wifi_password ? "Clique para copiar a senha do Wi-Fi" : establishment?.has_wifi ? "Wi-Fi disponível" : "Wi-Fi indisponível"}
                  >
                    <img src={`/wifi.png?v=${Date.now()}`} alt="Wi-fi" className="h-8 w-8 mb-2 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">Wi-fi</span>
                  </div>

                  {/* Estacionamento */}
                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all duration-200 cursor-default bg-white shadow-md hover:shadow-lg border border-gray-200
                    ${establishment?.has_parking ? 'hover:bg-gray-50' : 'opacity-50'}`}
                  >
                    <img src={`/car.png?v=${Date.now()}`} alt="Estacionamento" className="h-8 w-8 mb-2 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">Estacion.</span>
                  </div>

                  {/* Acessibilidade */}
                  <div className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all duration-200 cursor-default bg-white shadow-md hover:shadow-lg border border-gray-200
                    ${establishment?.has_accessibility ? 'hover:bg-gray-50' : 'opacity-50'}`}
                  >
                    <img src={`/wheelchair.png?v=${Date.now()}`} alt="Acessibilidade" className="h-8 w-8 mb-2 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">Acessib.</span>
                  </div>
                </div>
              </div>

              {/* Seção de Profissionais */}
              {establishment?.professionals && establishment.professionals.length > 0 && (
                <div className="mt-8 mb-6 bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Profissionais</h3>
                  {establishment.professionals.length <= 3 ? (
                    // Layout normal para 3 ou menos profissionais
                    <div className="flex flex-wrap gap-4">
                      {establishment.professionals.map((professional: any) => (
                        <div key={professional.id} className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                            <img
                              src={(professional as any).photo_url || '/fotopessoa.png'}
                              alt={professional.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/fotopessoa.png';
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 mt-2 text-center max-w-20">
                            {professional.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Carrossel horizontal para 4+ profissionais
                    <div className="overflow-hidden">
                      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {establishment.professionals.map((professional: any) => (
                          <div key={professional.id} className="flex flex-col items-center flex-shrink-0">
                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                              <img
                                src={(professional as any).photo_url || '/fotopessoa.png'}
                                alt={professional.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/fotopessoa.png';
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 mt-2 text-center max-w-20">
                              {professional.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de WhatsApp */}
              <a
                href={establishment?.whatsapp ? `https://wa.me/${establishment.whatsapp}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 text-center font-bold py-4 px-6 rounded-lg text-base uppercase tracking-wide transition-all duration-200 ${
                  establishment?.whatsapp 
                    ? 'bg-gradient-to-b from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 text-white shadow-lg hover:shadow-xl' 
                    : 'bg-zinc-900 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                ENTRAR EM CONTATO
                <img src="/wppicon.png" alt="WhatsApp" className="h-5 w-5" />
              </a>

              {/* Seção de Horário de Atendimento */}
              <div className="mt-8 mb-6 bg-white rounded-lg p-6 shadow-md border border-gray-200">
                <button
                  onClick={() => setShowBusinessHours(!showBusinessHours)}
                  className="w-full flex items-center justify-between gap-3 mb-4 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-medium text-gray-900">Horário de atendimento</h3>
                      <p className="text-sm text-gray-500">Clique para ver os horários</p>
                    </div>
                  </div>
                  <ChevronDown 
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      showBusinessHours ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                
                {showBusinessHours && establishment?.business_hours && (
                  <div className="space-y-2">
                    {[
                      { dia: 'Segunda', key: 'monday' },
                      { dia: 'Terça', key: 'tuesday' },
                      { dia: 'Quarta', key: 'wednesday' },
                      { dia: 'Quinta', key: 'thursday' },
                      { dia: 'Sexta', key: 'friday' },
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

                      const isOpen = horarios?.enabled && horarios?.open1;
                      const horarioText = formatHorario(horarios);

                      return (
                        <div 
                          key={dia} 
                          className={`flex justify-between items-center p-3 rounded-lg ${
                            isOpen ? 'bg-green-50' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              isOpen ? 'bg-green-500' : 'bg-gray-400'
                            }`}></div>
                            <span className="text-sm font-medium text-gray-900">{dia}</span>
                            {isHoje && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                Hoje
                              </span>
                            )}
                          </div>
                          <span className={`text-sm font-medium ${
                            isOpen ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {horarioText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Imagem Melhor do Brasil */}
              {establishment?.show_best_of_brazil_image && (
                <div className="mt-6 mb-4">
                  <img 
                    src="/melhordobrasil.png" 
                    alt="Melhor do Brasil" 
                    className="w-full h-auto rounded-lg shadow-lg"
                  />
                </div>
              )}

              {/* Link para Agendei Fácil */}
              <div className="mt-6 text-center">
                <a
                  href="https://agendeifacil.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors underline"
                >
                  Quero Agendei Fácil no meu estabelecimento
                </a>
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
                onConvertToSubscriber={handleConvertToSubscriber}
                // Não vamos mais passar selectedProfessional daqui, será gerenciado dentro do AppointmentForm
              />
            </div>
          )}

          {console.log('🔍 Debug - showSubscriberBooking:', showSubscriberBooking)}
          {showSubscriberBooking && (
            <div className="bg-red-100 border-4 border-red-500 rounded-lg shadow-md p-6 text-gray-900 mt-4 z-50 relative">
              {console.log('🔍 Debug - Renderizando tela de agendamento assinante!')}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Agendamento Assinante</h2>
                <button
                  onClick={() => {
                    setShowSubscriberBooking(false);
                    setSelectedSubscriberService(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {!selectedSubscriberService ? (
                // Tela de seleção de serviços
                <div>
                  <p className="text-lg text-gray-700 mb-6">Selecione qual é o seu:</p>
                  {console.log('🔍 Debug - Renderizando lista de subscriptions:', subscriptions)}
                  <div className="space-y-4">
                    {subscriptions.map((subscription) => {
                      console.log('🔍 Debug - Renderizando subscription:', subscription);
                      return (
                      <div key={subscription.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{subscription.name}</h3>
                            <p className="text-sm text-gray-600">
                              R$ {subscription.value.toFixed(2).replace('.', ',')}
                            </p>
                            {subscription.weekdays && subscription.weekdays.length > 0 && (
                              <p className="text-xs text-blue-600 mt-1">
                                📅 {subscription.weekdays.map(day => {
                                  const dayNames = {
                                    'monday': 'Seg',
                                    'tuesday': 'Ter', 
                                    'wednesday': 'Qua',
                                    'thursday': 'Qui',
                                    'friday': 'Sex',
                                    'saturday': 'Sáb',
                                    'sunday': 'Dom'
                                  };
                                  return dayNames[day as keyof typeof dayNames] || day;
                                }).join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedSubscriberService(subscription)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          >
                            Agendar
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Tela de agendamento com restrição de dias
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{selectedSubscriberService.name}</h3>
                    <button
                      onClick={() => setSelectedSubscriberService(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ← Voltar
                    </button>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      <strong>Dias disponíveis:</strong> {selectedSubscriberService.weekdays?.map(day => {
                        const dayNames = {
                          'monday': 'Segunda-feira',
                          'tuesday': 'Terça-feira', 
                          'wednesday': 'Quarta-feira',
                          'thursday': 'Quinta-feira',
                          'friday': 'Sexta-feira',
                          'saturday': 'Sábado',
                          'sunday': 'Domingo'
                        };
                        return dayNames[day as keyof typeof dayNames] || day;
                      }).join(', ') || 'Não configurado'}
                    </p>
                  </div>

                  <AppointmentForm
                    establishment={establishment}
                    onSubmit={handleSubmit}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    existingAppointments={existingAppointments}
                    subscriberService={selectedSubscriberService} // Passar o serviço para restringir dias
                    isSubscriberBooking={true} // Indica que é agendamento de assinante
                  />
                </div>
              )}
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