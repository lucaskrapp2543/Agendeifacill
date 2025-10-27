import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { checkWhatsAppSubscriber as checkNewSubscriber } from '../lib/subscriberSystem';
import { checkWhatsAppSubscriber, getClientDataFromAuth, getClientProfileData, isNewClient, supabase, testMigration } from '../lib/supabase';
import { checkMonthlyLimit } from '../utils/monthlyLimitValidation';
import { validateOneWeekLimit } from '../utils/oneWeekLimitValidation';
import { validateSubscriberBooking } from '../utils/subscriberBookingValidation';
import { DatePicker } from './DatePicker';
import { MultiServiceSelector } from './MultiServiceSelector';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PixPaymentForm } from './PixPaymentForm';
import { ProfessionalSelector } from './ProfessionalSelector';
import { ServiceList } from './ServiceList';
import { SubscriptionLimitModal } from './SubscriptionLimitModal';
import { TimeSlotSelector } from './TimeSlotSelector';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Professional {
  id: string;
  name: string;
  photo_url?: string;
  offers_child_service?: boolean;
}

interface Appointment {
  id: string;
  client_id: string;
  establishment_id: string;
  service: string;
  professional: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  client_name: string;
  price: number;
  duration: number;
  payment_method?: string;
  pix_proof_url?: string;
  pix_payment_status?: string;
}

interface Establishment {
  id?: string;
  establishment_id?: string;
  owner_id: string;
  business_hours: Record<string, {
    enabled: boolean;
    open1: string;
    close1: string;
    open2: string;
    close2: string;
  }>;
  services_with_prices: Service[];
  professionals: Professional[];
  limit_subscribers_one_week?: boolean;
  punish_client_on_cancel?: boolean; // Adicionado
  payment_methods_enabled?: string[]; // Formas de pagamento habilitadas
  require_cpf?: boolean; // Solicitar CPF no agendamento
  whatsapp?: string; // WhatsApp do estabelecimento
}

interface AppointmentFormProps {
  establishment: Establishment & {
    pix_key?: string;
    pix_key_type?: string;
    use_15_minute_interval?: boolean;
  };
  onSubmit: (data: any) => Promise<void>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  existingAppointments?: Appointment[];
  pix_payment_status?: string;
  pix_proof_url?: string;
  subscriberService?: any; // Serviço de assinante para restringir dias
  isSubscriberBooking?: boolean; // Indica se é agendamento de assinante
  onConvertToSubscriber?: (subscriberData: any) => void; // Callback para converter para assinante
  subscriberDetectionDisabled?: boolean; // Estado externo para desabilitar detecção
  onSubscriberDetectionDisabledChange?: (disabled: boolean) => void; // Callback para mudar o estado
  guestClientData?: { name: string; phone: string } | null; // Dados do cliente convidado (sem login)
  dateSelectedByUser?: boolean; // Indica se a data foi selecionada pelo usuário
}

export function AppointmentForm({
  establishment,
  onSubmit,
  selectedDate,
  onSelectDate,
  existingAppointments = [],
  subscriberService,
  isSubscriberBooking = false,
  onConvertToSubscriber,
  subscriberDetectionDisabled: externalSubscriberDetectionDisabled,
  guestClientData,
  onSubscriberDetectionDisabledChange,
  dateSelectedByUser = false
}: AppointmentFormProps) {
  const { user } = useAuth();
  const isEstablishmentOwner = user?.id === establishment?.owner_id;

  // Função para verificar se o dia é válido para assinantes
  const isValidDayForSubscriber = (date: Date, allowedWeekdays: string[]) => {
    if (!allowedWeekdays || allowedWeekdays.length === 0) return true;

    const dayInPortuguese = format(date, 'EEEE', { locale: ptBR }).toLowerCase();
    const weekDayMap: Record<string, string> = {
      'domingo': 'sunday',
      'segunda-feira': 'monday',
      'terça-feira': 'tuesday',
      'quarta-feira': 'wednesday',
      'quinta-feira': 'thursday',
      'sexta-feira': 'friday',
      'sábado': 'saturday'
    };

    const dayInEnglish = weekDayMap[dayInPortuguese];
    return allowedWeekdays.includes(dayInEnglish);
  };

  console.log('🏗️ AppointmentForm - Dados recebidos:');
  console.log('  - establishment:', establishment);
  console.log('  - services_with_prices:', establishment?.services_with_prices);
  console.log('  - professionals:', establishment?.professionals);
  console.log('  - business_hours:', establishment?.business_hours);
  console.log('  - user logado:', user);
  console.log('  - user.id:', user?.id);

  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  // Estado para controlar se a data foi selecionada pelo usuário
  const [hasSelectedDate, setHasSelectedDate] = useState(false);

  // Usar dados do convidado se disponíveis
  useEffect(() => {
    console.log('🔍 DEBUG - useEffect guestClientData:', { guestClientData, isSubscriberBooking });
    if (guestClientData) {
      console.log('🔍 DEBUG - Preenchendo campos com guestClientData:', guestClientData);
      setClientName(guestClientData.name);
      setClientWhatsapp(guestClientData.phone);
    }
  }, [guestClientData]);

  // Estados para dados do perfil do cliente
  const [clientProfileData, setClientProfileData] = useState<any>(null);
  const [isNewClientUser, setIsNewClientUser] = useState(false);
  const [profileDataLoaded, setProfileDataLoaded] = useState(false);

  // Função para forçar atualização dos dados do usuário
  const forceUpdateUserData = async () => {
    if (!user) return;

    setIsLoadingUserData(true);
    try {
      // Buscar dados atualizados da tabela profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData) {
        // Buscar o último agendamento para pegar o WhatsApp atualizado
        const { data: lastAppointment, error: appointmentError } = await supabase
          .from('appointments')
          .select('client_name, client_whatsapp')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let clientName = profileData.name || '';
        let clientWhatsapp = '';

        // Se encontrou agendamento, usar os dados mais recentes
        if (!appointmentError && lastAppointment) {
          clientName = lastAppointment.client_name || clientName;
          clientWhatsapp = lastAppointment.client_whatsapp || '';
        }

        // Se não tem WhatsApp do agendamento, buscar do user_metadata
        if (!clientWhatsapp) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          clientWhatsapp = authUser?.user_metadata?.whatsapp || '';
        }

        setClientName(clientName);
        setClientWhatsapp(clientWhatsapp);

        toast.success('Dados atualizados!');
      }
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      toast.error('Erro ao atualizar dados');
    } finally {
      setIsLoadingUserData(false);
    }
  };

  console.log('🔍 DEBUG - Estados iniciais:', { profileDataLoaded, isNewClientUser, clientProfileData });

  // Reset profileDataLoaded quando o usuário muda
  useEffect(() => {
    if (user) {
      console.log('🔍 DEBUG - Usuário mudou, resetando profileDataLoaded');
      setProfileDataLoaded(false);
    }
  }, [user?.id]);


  // Teste de migração
  useEffect(() => {
    const testMigrationStatus = async () => {
      await testMigration();
    };
    testMigrationStatus();
  }, []);

  // Carregar dados do perfil do cliente
  useEffect(() => {
    const loadClientProfile = async () => {
      console.log('🔍 DEBUG - loadClientProfile iniciado:', { user: !!user, profileDataLoaded, userId: user?.id, guestClientData });

      // Se temos dados do convidado, não buscar dados do perfil
      if (guestClientData) {
        console.log('🔍 DEBUG - Dados do convidado disponíveis, não carregando perfil');
        console.log('🔍 DEBUG - Mantendo dados do convidado:', guestClientData);
        setClientName(guestClientData.name);
        setClientWhatsapp(guestClientData.phone);
        return;
      }

      if (user) { // Removido o !profileDataLoaded para sempre buscar dados atualizados
        console.log('🔍 DEBUG - Entrando no bloco de carregamento de perfil');
        try {
          console.log('🔍 DEBUG - Verificando se é novo cliente para user:', user.id);

          // BUSCAR DADOS ATUALIZADOS DIRETAMENTE DA TABELA PROFILES
          console.log('🔍 DEBUG - Buscando dados atualizados diretamente...');

          // Buscar dados atualizados da tabela profiles
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .single();

          if (!profileError && profileData) {
            console.log('🔍 DEBUG - Dados do perfil encontrados:', profileData);

            // Buscar o último agendamento para pegar o WhatsApp atualizado
            const { data: lastAppointment, error: appointmentError } = await supabase
              .from('appointments')
              .select('client_name, client_whatsapp')
              .eq('client_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            let clientName = profileData.name || '';
            let clientWhatsapp = '';

            // Se encontrou agendamento, usar os dados mais recentes
            if (!appointmentError && lastAppointment) {
              clientName = lastAppointment.client_name || clientName;
              clientWhatsapp = lastAppointment.client_whatsapp || '';
            }

            // Se não tem WhatsApp do agendamento, buscar do user_metadata
            if (!clientWhatsapp) {
              const { data: { user: authUser } } = await supabase.auth.getUser();
              clientWhatsapp = authUser?.user_metadata?.whatsapp || '';
            }

            console.log('🔍 DEBUG - Dados finais encontrados:', { clientName, clientWhatsapp });

            setClientName(clientName);
            setClientWhatsapp(clientWhatsapp);
            setProfileDataLoaded(true);
            return;
          }

          // Fallback: usar dados dos metadados de autenticação
          const authData = await getClientDataFromAuth();
          if (authData) {
            console.log('🔍 DEBUG - Dados encontrados via autenticação:', authData);
            setIsNewClientUser(true);
            setClientProfileData(authData);
            const fullName = `${authData.first_name || ''} ${authData.last_name || ''}`.trim();
            console.log('🔍 DEBUG - Nome completo gerado:', fullName);
            console.log('🔍 DEBUG - WhatsApp do perfil:', authData.whatsapp);
            setClientName(fullName);
            setClientWhatsapp(authData.whatsapp || '');
            setProfileDataLoaded(true);
            return;
          }

          // Se não encontrou nos metadados, verificar na tabela profiles
          const isNew = await isNewClient(user.id);
          console.log('🔍 DEBUG - É novo cliente?', isNew);
          setIsNewClientUser(isNew);

          if (isNew) {
            console.log('🔍 DEBUG - Carregando dados do perfil para novo cliente');
            const { data: profileData, error } = await getClientProfileData(user.id);
            console.log('🔍 DEBUG - Dados do perfil:', profileData, 'Erro:', error);

            if (profileData) {
              setClientProfileData(profileData);
              // Preencher automaticamente com dados do perfil
              const fullName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
              console.log('🔍 DEBUG - Nome completo gerado:', fullName);
              console.log('🔍 DEBUG - WhatsApp do perfil:', profileData.whatsapp);

              setClientName(fullName);
              setClientWhatsapp(profileData.whatsapp || '');
            }
          } else {
            console.log('🔍 DEBUG - Cliente antigo, carregando dados do localStorage');
            // Para clientes antigos, usar o sistema atual
            const lastUserData = localStorage.getItem('lastUserBookingData');
            if (lastUserData) {
              try {
                const { name, whatsapp } = JSON.parse(lastUserData);
                setClientName(name || '');
                setClientWhatsapp(whatsapp || '');
              } catch (error: any) {
                console.error('Erro ao carregar dados salvos:', error);
              }
            }
          }
          setProfileDataLoaded(true);
        } catch (error) {
          console.error('Erro ao carregar perfil do cliente:', error);
          setProfileDataLoaded(true);
        }
      } else {
        console.log('🔍 DEBUG - Condições não atendidas:', { user: !!user, profileDataLoaded });
        console.log('🔍 DEBUG - Motivo:', !user ? 'Usuário não logado' : 'Dados já carregados');
      }
    };

    console.log('🔍 DEBUG - Executando loadClientProfile...');
    loadClientProfile();
  }, [user, profileDataLoaded, guestClientData]);
  const [selectedService, setSelectedService] = useState<Service | undefined>(undefined);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [useMultiService, setUseMultiService] = useState(true);
  const [useCategoryService, setUseCategoryService] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<any>(null);

  // ✅ ESTADO PARA MÚLTIPLOS SERVIÇOS EM CATEGORIAS
  const [selectedCategoryServices, setSelectedCategoryServices] = useState<any[]>([]);
  const [useMultiCategoryService, setUseMultiCategoryService] = useState(true);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [observation, setObservation] = useState<string>('');
  const [isChildService, setIsChildService] = useState<boolean | null>(null);

  // Função para buscar categorias de serviços
  const fetchServiceCategories = async () => {
    if (!establishment?.id) return;

    try {
      const { data: categories, error: categoriesError } = await supabase
        .from('service_categories')
        .select('*')
        .eq('establishment_id', establishment.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (categoriesError) {
        console.error('Erro ao buscar categorias:', categoriesError);
        return;
      }

      const { data: subcategories, error: subcategoriesError } = await supabase
        .from('service_subcategories')
        .select(`
          *,
          service_categories (
            establishment_id
          )
        `)
        .eq('is_active', true)
        .eq('service_categories.establishment_id', establishment.id)
        .order('display_order', { ascending: true });

      if (subcategoriesError) {
        console.error('Erro ao buscar subcategorias:', subcategoriesError);
        return;
      }

      // Combinar categorias com suas subcategorias
      const categoriesWithSubcategories = categories.map((category: any) => ({
        ...category,
        subcategories: subcategories.filter((sub: any) => sub.category_id === category.id)
      }));

      setServiceCategories(categoriesWithSubcategories);
    } catch (error) {
      console.error('Erro ao buscar categorias de serviços:', error);
    }
  };

  useEffect(() => {
    fetchServiceCategories();

    // Se não houver serviços nas configurações, selecionar automaticamente "SERVIÇOS"
    if (establishment?.services_with_prices && establishment.services_with_prices.length === 0) {
      setUseCategoryService(true);
      setUseMultiService(false);
      setSelectedService(undefined);
      setSelectedServices([]);
    }
  }, [establishment?.id, establishment?.services_with_prices]);
  const [isLoading, setIsLoading] = useState(false);

  // Função para scroll automático para a próxima seção
  const scrollToNextSection = (delay = 300) => {
    setTimeout(() => {
      // Procurar pela próxima seção visível
      const sections = document.querySelectorAll('.appointment-section');
      let nextSection = null;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;
        const rect = section.getBoundingClientRect();

        // Se a seção está parcialmente visível ou abaixo da viewport
        if (rect.top > 100) {
          nextSection = section;
          break;
        }
      }

      if (nextSection) {
        nextSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      } else {
        // Se não encontrar seção específica, scroll para baixo
        window.scrollBy({
          top: 200,
          behavior: 'smooth'
        });
      }
    }, delay);
  };

  // Função específica para scroll após selecionar data (vai para horário)
  const scrollToTimeSection = (delay = 300) => {
    setTimeout(() => {
      // Scroll menor e mais preciso para a próxima seção
      window.scrollBy({
        top: 200,
        behavior: 'smooth'
      });
    }, delay);
  };

  // ✅ FUNÇÃO PARA COMBINAR SERVIÇOS GERAIS COM SERVIÇOS ESPECÍFICOS DO PROFISSIONAL
  const getCombinedServices = () => {
    const generalServices = establishment?.services_with_prices || [];

    if (!selectedProfessional) {
      return generalServices;
    }

    // Buscar serviços específicos do profissional selecionado
    const professional = establishment?.professionals?.find(p => p.id === selectedProfessional.id);
    const specificServices = (professional as any)?.specific_services || [];

    // ✅ MODIFICADO: Mostrar serviços específicos mesmo se não houver serviços gerais
    const combinedServices = [
      ...generalServices,
      ...specificServices.map((specific: any) => ({
        id: `specific-${specific.id}`,
        name: `${specific.name} (${professional?.name})`,
        price: specific.price,
        duration: specific.duration
      }))
    ];

    // ✅ Se não há serviços gerais mas há serviços específicos, retorna apenas os específicos
    if (generalServices.length === 0 && specificServices.length > 0) {
      return specificServices.map((specific: any) => ({
        id: `specific-${specific.id}`,
        name: `${specific.name} (${professional?.name})`,
        price: specific.price,
        duration: specific.duration
      }));
    }

    return combinedServices;
  };

  const [pixProofUrl, setPixProofUrl] = useState<string | null>(null);
  const [pixPaymentMethod, setPixPaymentMethod] = useState<'pix_now' | 'pix_local' | null>(null);

  // Estados para detecção automática de assinantes
  const [detectedSubscriber, setDetectedSubscriber] = useState<any>(null);
  const [isCheckingSubscriber, setIsCheckingSubscriber] = useState(false);

  // Usar estado externo se fornecido, senão usar estado local
  const subscriberDetectionDisabled = externalSubscriberDetectionDisabled ?? false;
  const setSubscriberDetectionDisabled = (disabled: boolean) => {
    console.log('🔧 DEBUG - setSubscriberDetectionDisabled chamado:', {
      disabled,
      hasCallback: !!onSubscriberDetectionDisabledChange,
      externalValue: externalSubscriberDetectionDisabled
    });
    if (onSubscriberDetectionDisabledChange) {
      onSubscriberDetectionDisabledChange(disabled);
    }
  };

  // Log quando o componente monta
  console.log('🏗️ AppointmentForm MONTADO - Estado inicial de subscriberDetectionDisabled:', {
    subscriberDetectionDisabled,
    externalSubscriberDetectionDisabled,
    hasCallback: !!onSubscriberDetectionDisabledChange
  });

  // Estados para validação de agendamento de assinantes
  const [subscriberBookingError, setSubscriberBookingError] = useState<string | null>(null);
  const [isValidatingBooking, setIsValidatingBooking] = useState(false);
  const [showSubscriberNotification, setShowSubscriberNotification] = useState(false);

  // Log quando estados de assinante mudam
  useEffect(() => {
    console.log('🚨 DEBUG - subscriberDetectionDisabled mudou para:', subscriberDetectionDisabled);
  }, [subscriberDetectionDisabled]);

  useEffect(() => {
    console.log('🚨 DEBUG - detectedSubscriber mudou para:', detectedSubscriber ? 'EXISTE' : 'NULL');
  }, [detectedSubscriber]);

  useEffect(() => {
    console.log('🚨 DEBUG - showSubscriberNotification mudou para:', showSubscriberNotification);
  }, [showSubscriberNotification]);

  // Estados para modal de limite excedido
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalData, setLimitModalData] = useState<{
    currentUsage: number;
    monthlyLimit: number;
    subscriptionName: string;
  } | null>(null);

  // Estados para validação de remarcação no mesmo dia

  // Estados para validação de 1 agendamento por semana
  const [oneWeekLimitError, setOneWeekLimitError] = useState<string | null>(null);

  // Estados para validação de limite mensal
  const [monthlyLimitValidationDisabled, setMonthlyLimitValidationDisabled] = useState(false);

  // Estados para controle progressivo do formulário
  const [showServiceSection, setShowServiceSection] = useState(false);
  const [showDateSection, setShowDateSection] = useState(false);
  const [showPaymentSection, setShowPaymentSection] = useState(false);

  // Controlar visibilidade das seções progressivamente
  useEffect(() => {
    // Mostrar seção de serviços quando um profissional for selecionado
    setShowServiceSection(!!selectedProfessional);
  }, [selectedProfessional]);

  useEffect(() => {
    // Mostrar seção de data quando um serviço for selecionado OU quando for agendamento de assinante
    const hasService = selectedService || selectedServices.length > 0 || selectedCategoryServices.length > 0;
    const isSubscriberWithService = isSubscriberBooking && subscriberService;
    setShowDateSection(hasService || isSubscriberWithService);
  }, [selectedService, selectedServices, selectedCategoryServices, isSubscriberBooking, subscriberService]);

  useEffect(() => {
    // Mostrar seção de pagamento quando data e horário forem selecionados
    setShowPaymentSection(!!(selectedDate && selectedTime));
  }, [selectedDate, selectedTime]);
  const [monthlyLimitError, setMonthlyLimitError] = useState<string | null>(null);
  const [monthlyLimitData, setMonthlyLimitData] = useState<{
    currentUsage: number;
    monthlyLimit: number | null;
    subscriptionName: string;
  } | null>(null);
  const [isValidatingOneWeek, setIsValidatingOneWeek] = useState(false);

  // Função para validar limite mensal de assinantes
  const validateMonthlyLimit = async () => {
    console.log('🔍 validateMonthlyLimit chamada com:', {
      clientWhatsapp,
      establishmentId: establishment?.id,
      monthlyLimitValidationDisabled
    });

    // Se a validação foi desabilitada (usuário escolheu agendar como normal), não validar
    if (monthlyLimitValidationDisabled) {
      console.log('✅ Validação de limite mensal DESABILITADA - usuário agendando como normal');
      setMonthlyLimitError(null);
      setMonthlyLimitData(null);
      return;
    }

    if (!clientWhatsapp || !establishment?.id) {
      console.log('❌ Dados insuficientes para validar limite mensal');
      setMonthlyLimitError(null);
      setMonthlyLimitData(null);
      return;
    }

    try {
      console.log('🔍 Chamando checkMonthlyLimit...');
      const limitCheck = await checkMonthlyLimit(clientWhatsapp, establishment.id);
      console.log('📊 Resultado do checkMonthlyLimit:', limitCheck);

      if (!limitCheck.canBook && limitCheck.errorMessage) {
        console.log('🚫 Limite mensal excedido:', limitCheck.errorMessage);
        setMonthlyLimitError(limitCheck.errorMessage);
        setMonthlyLimitData({
          currentUsage: limitCheck.currentUsage,
          monthlyLimit: limitCheck.monthlyLimit,
          subscriptionName: limitCheck.subscriptionName
        });
      } else {
        console.log('✅ Limite mensal OK - pode agendar');
        setMonthlyLimitError(null);
        setMonthlyLimitData({
          currentUsage: limitCheck.currentUsage,
          monthlyLimit: limitCheck.monthlyLimit,
          subscriptionName: limitCheck.subscriptionName
        });
      }
    } catch (error) {
      console.error('❌ Erro ao validar limite mensal:', error);
      setMonthlyLimitError(null);
      setMonthlyLimitData(null);
    }
  };


  // Função para validar agendamento de assinantes
  const validateSubscriberBookingDate = async (date: Date) => {
    console.log('🔍 Iniciando validação de agendamento:', {
      clientWhatsapp,
      establishmentId: establishment?.id,
      selectedDate: date.toISOString()
    });

    if (!clientWhatsapp || !establishment?.id) {
      console.log('❌ Dados insuficientes para validação');
      setSubscriberBookingError(null);
      return;
    }

    setIsValidatingBooking(true);
    setSubscriberBookingError(null);

    try {
      const validation = await validateSubscriberBooking(
        clientWhatsapp,
        establishment.id,
        date
      );

      console.log('📋 Resultado da validação:', validation);

      if (!validation.canBook) {
        console.log('❌ Agendamento bloqueado:', validation.message);
        setSubscriberBookingError(validation.message || 'Agendamento não permitido para esta data.');
      } else {
        console.log('✅ Agendamento permitido');
        setSubscriberBookingError(null);
      }
    } catch (error) {
      console.error('❌ Erro ao validar agendamento de assinante:', error);
      setSubscriberBookingError(null); // Em caso de erro, permitir agendamento
    } finally {
      setIsValidatingBooking(false);
    }
  };


  // Função para validar 1 agendamento por semana (APENAS PARA ASSINANTES)
  const validateOneWeekLimitDate = async (date: Date) => {
    console.log('🔍 DEBUG - INICIANDO validação de 1 agendamento por semana:', {
      clientWhatsapp,
      establishmentId: establishment?.id,
      selectedDate: date.toISOString(),
      isSubscriberBooking
    });

    // APENAS aplicar validação se for agendamento de assinante
    if (!isSubscriberBooking) {
      console.log('✅ DEBUG - Não é assinante, pular validação de 1 agendamento por semana');
      setOneWeekLimitError(null);
      return;
    }

    console.log('👤 DEBUG - É assinante, continuando validação...');

    if (!clientWhatsapp || !establishment?.id) {
      console.log('❌ DEBUG - Dados insuficientes para validação de 1 agendamento por semana:', {
        hasClientWhatsapp: !!clientWhatsapp,
        hasEstablishmentId: !!establishment?.id
      });
      setOneWeekLimitError(null);
      return;
    }

    console.log('✅ DEBUG - Dados suficientes, executando validação...');

    setIsValidatingOneWeek(true);
    setOneWeekLimitError(null);

    try {
      const validation = await validateOneWeekLimit(
        clientWhatsapp,
        establishment.id,
        date
      );

      console.log('📋 Resultado da validação de 1 agendamento por semana:', validation);

      if (!validation.canBook) {
        console.log('❌ Agendamento bloqueado:', validation.message);
        setOneWeekLimitError(validation.message || 'Agendamento não permitido para esta data.');
      } else {
        console.log('✅ Agendamento permitido');
        setOneWeekLimitError(null);
      }
    } catch (error) {
      console.error('❌ Erro ao validar 1 agendamento por semana:', error);
      setOneWeekLimitError(null); // Em caso de erro, permitir agendamento
    } finally {
      setIsValidatingOneWeek(false);
    }
  };


  // Removido useEffect que definia automaticamente o método de pagamento

  // Validar agendamento de assinantes quando data ou WhatsApp mudarem
  useEffect(() => {
    console.log('🔄 DEBUG - useEffect de validações executado:', {
      hasClientWhatsapp: !!clientWhatsapp,
      hasEstablishmentId: !!establishment?.id,
      selectedDate: selectedDate.toISOString(),
      isSubscriberBooking
    });

    if (clientWhatsapp && establishment?.id) {
      console.log('🔄 DEBUG - Executando validações...');
      validateSubscriberBookingDate(selectedDate);
      validateOneWeekLimitDate(selectedDate);
      validateMonthlyLimit(); // Nova validação de limite mensal
    } else {
      console.log('🔄 DEBUG - Condições não atendidas para executar validações');
    }
  }, [selectedDate, clientWhatsapp, establishment?.id, isSubscriberBooking]);

  // Detectar automaticamente se o WhatsApp é de um assinante usando o novo sistema
  useEffect(() => {
    console.log('🔄 DEBUG - useEffect detecção de assinante executado:', {
      clientWhatsapp: !!clientWhatsapp,
      establishmentId: !!establishment?.id,
      establishmentObject: establishment,
      isSubscriberBooking,
      subscriberDetectionDisabled
    });
    const checkSubscriber = async () => {
      console.log('🔍 DEBUG - checkSubscriber chamado:', {
        clientWhatsapp: !!clientWhatsapp,
        whatsappLength: clientWhatsapp?.length,
        isSubscriberBooking,
        subscriberDetectionDisabled,
        shouldCheck: clientWhatsapp && clientWhatsapp.length >= 10 && !isSubscriberBooking && !subscriberDetectionDisabled
      });

      if (clientWhatsapp && clientWhatsapp.length >= 10 && !isSubscriberBooking && !subscriberDetectionDisabled) {
        console.log('🔍 MOBILE DEBUG - Iniciando verificação de assinante:', {
          clientWhatsapp,
          establishmentId: establishment.id || establishment.establishment_id,
          userAgent: navigator.userAgent,
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        });

        setIsCheckingSubscriber(true);
        try {
          // Primeiro tentar o novo sistema de assinantes
          const establishmentId = establishment.id || establishment.establishment_id || '';
          console.log('🔍 MOBILE DEBUG - Establishment ID para verificação:', establishmentId);

          const { data: newSubscriberData, error: newError } = await checkNewSubscriber(
            clientWhatsapp,
            establishmentId
          );

          console.log('🔍 MOBILE DEBUG - Resultado novo sistema:', { newSubscriberData, newError });

          if (newSubscriberData && !newError) {
            // Verificar se o assinante está vencido
            const isExpired = newSubscriberData.is_expired ||
              (new Date(newSubscriberData.end_date) < new Date()) ||
              newSubscriberData.payment_status === 'unpaid';

            if (isExpired) {
              console.log('⚠️ Assinante vencido detectado:', newSubscriberData);
              setDetectedSubscriber({
                ...newSubscriberData,
                is_expired: true,
                expiration_message: newSubscriberData.expiration_message ||
                  `Seu plano venceu em ${new Date(newSubscriberData.end_date).toLocaleDateString('pt-BR')}. Renove para continuar agendando.`
              });
              setShowSubscriberNotification(true);
            } else {
              setDetectedSubscriber(newSubscriberData);
              setShowSubscriberNotification(true);
              console.log('🎯 Assinante ativo detectado (novo sistema):', newSubscriberData);
            }
          } else {
            // Fallback para o sistema antigo
            console.log('🔍 MOBILE DEBUG - Tentando sistema antigo...');
            const establishmentId = establishment.id || establishment.establishment_id || '';
            console.log('🔍 MOBILE DEBUG - Establishment ID para sistema antigo:', establishmentId);

            const { data: oldSubscriberData, error: oldError } = await checkWhatsAppSubscriber(
              clientWhatsapp,
              establishmentId
            );

            console.log('🔍 MOBILE DEBUG - Resultado sistema antigo:', { oldSubscriberData, oldError });

            if (oldSubscriberData && !oldError) {
              // Verificar se o assinante está vencido no sistema antigo
              const isExpired = (new Date(oldSubscriberData.end_date) < new Date()) ||
                oldSubscriberData.payment_status === 'unpaid';

              if (isExpired) {
                console.log('⚠️ Assinante vencido detectado (sistema antigo):', oldSubscriberData);
                setDetectedSubscriber({
                  ...oldSubscriberData,
                  is_expired: true,
                  expiration_message: `Seu plano venceu em ${new Date(oldSubscriberData.end_date).toLocaleDateString('pt-BR')}. Renove para continuar agendando.`
                });
              } else {
                setDetectedSubscriber(oldSubscriberData);
                console.log('🎯 Assinante ativo detectado (sistema antigo):', oldSubscriberData);
              }
              setShowSubscriberNotification(true);
            } else {
              setDetectedSubscriber(null);
              setShowSubscriberNotification(false);
            }
          }
        } catch (error) {
          console.error('Erro ao verificar assinante:', error);
        } finally {
          setIsCheckingSubscriber(false);
        }
      } else {
        setDetectedSubscriber(null);
        setShowSubscriberNotification(false);
      }
    };

    // Debounce para evitar muitas verificações
    const timeoutId = setTimeout(checkSubscriber, 1000);
    return () => clearTimeout(timeoutId);
  }, [clientWhatsapp, establishment.id || establishment.establishment_id, isSubscriberBooking, subscriberDetectionDisabled]);

  // VALIDAÇÃO DE LIMITE MENSAL quando já é assinante
  useEffect(() => {
    console.log('🔍 DEBUG - useEffect limite mensal:', {
      clientWhatsapp: !!clientWhatsapp,
      establishmentId: !!establishment?.id,
      isSubscriberBooking,
      clientWhatsappValue: clientWhatsapp,
      establishmentIdValue: establishment?.id
    });

    // SEMPRE validar limite quando tem WhatsApp e establishment, independente de isSubscriberBooking
    if (clientWhatsapp && establishment?.id) {
      console.log('🔍 SEMPRE validando limite mensal...');
      validateMonthlyLimit();
    } else {
      console.log('❌ Condições não atendidas para validar limite mensal');
    }
  }, [clientWhatsapp, establishment?.id, isSubscriberBooking]);

  // Verificar se os dados essenciais existem
  if (!establishment) {
    console.log('❌ AppointmentForm: establishment é null/undefined');
    return <div>Erro: Dados do estabelecimento não disponíveis</div>;
  }

  // ✅ MODIFICADO: Verificar se há serviços gerais OU serviços específicos de QUALQUER profissional
  const hasGeneralServices = establishment.services_with_prices && establishment.services_with_prices.length > 0;
  const hasSpecificServices = establishment.professionals?.some(p => (p as any).specific_services && (p as any).specific_services.length > 0);
  const hasAnyServices = hasGeneralServices || hasSpecificServices || useCategoryService;

  // Só verificar serviços se não estiver usando categorias E não houver nenhum serviço disponível
  if (!useCategoryService && !hasAnyServices) {
    console.log('❌ AppointmentForm: Sem serviços disponíveis');
    return <div>Erro: Nenhum serviço disponível neste estabelecimento</div>;
  }

  if (!establishment.professionals || establishment.professionals.length === 0) {
    console.log('❌ AppointmentForm: Sem profissionais disponíveis');
    return <div>Erro: Nenhum profissional disponível neste estabelecimento</div>;
  }

  if (!establishment.business_hours) {
    console.log('❌ AppointmentForm: Sem horários de funcionamento');
    return <div>Erro: Horários de funcionamento não configurados</div>;
  }


  const handlePixComprovantUpload = (url: string) => {
    setPixProofUrl(url);
  };

  const handlePixMethodSelect = (method: 'pix_now' | 'pix_local') => {
    setPixPaymentMethod(method);
    // Não alterar automaticamente o selectedPaymentMethod aqui
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🚀 Tentativa de submit do formulário');
    console.log('📋 Dados atuais:', {
      clientName,
      clientWhatsapp,
      selectedService: selectedService?.name,
      selectedProfessional: selectedProfessional?.name,
      selectedTime,
      selectedPaymentMethod,
      pixPaymentMethod,
      pixProofUrl,
      selectedDate: format(selectedDate, 'yyyy-MM-dd'),
      observation,
      isChildService
    });

    // Salvar dados do usuário no localStorage para auto-preenchimento futuro
    if (user && clientName.trim() && clientWhatsapp.trim()) {
      const userData = {
        name: clientName.trim(),
        whatsapp: clientWhatsapp.trim()
      };
      localStorage.setItem('lastUserBookingData', JSON.stringify(userData));
      console.log('💾 Dados do usuário salvos no localStorage:', userData);
    }

    // Validação completa - criar lista do que está faltando
    const missingFields = [];

    if (!clientName.trim()) {
      missingFields.push('nome do cliente');
    }

    // Validar CPF se o estabelecimento solicitar
    if (establishment?.require_cpf && !isSubscriberBooking) {
      const cpfNumbers = clientCpf.replace(/\D/g, '');
      if (cpfNumbers.length !== 11) {
        missingFields.push('CPF válido (11 dígitos)');
      }
    }

    // Para assinantes, não validar serviço nem forma de pagamento
    if (!isSubscriberBooking) {
      if (useMultiService) {
        if (selectedServices.length === 0) {
          missingFields.push('pelo menos um serviço');
        }
      } else if (useCategoryService) {
        if (useMultiCategoryService) {
          if (selectedCategoryServices.length === 0) {
            missingFields.push('pelo menos um serviço das categorias');
          }
        } else {
          if (!selectedSubcategory) {
            missingFields.push('serviço das categorias');
          }
        }
      } else {
        if (!selectedService) {
          missingFields.push('serviço');
        }
      }

      if (!selectedPaymentMethod) {
        missingFields.push('forma de pagamento');
      }
    }

    if (!selectedProfessional) {
      missingFields.push('profissional');
    }

    if (!selectedTime) {
      missingFields.push('horário');
    }

    // Validação obrigatória do serviço infantil (só se profissional oferece)
    if (selectedProfessional && selectedProfessional.offers_child_service && isChildService === null) {
      missingFields.push('informação se é serviço infantil');
    }

    // Validação específica para PIX
    if (selectedPaymentMethod === 'pix' && pixPaymentMethod === 'pix_now' && !pixProofUrl) {
      missingFields.push('comprovante do PIX');
    }

    // VALIDAÇÃO DE ASSINANTE - BLOQUEAR AGENDAMENTO SE FORA DA SEMANA
    if (subscriberBookingError) {
      console.log('❌ Agendamento bloqueado para assinante:', subscriberBookingError);

      // Scroll para a mensagem de erro (que já está visível)
      setTimeout(() => {
        const errorElement = document.querySelector('[data-subscriber-error]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Destacar a mensagem com uma animação
          errorElement.classList.add('animate-bounce');
          setTimeout(() => {
            errorElement.classList.remove('animate-bounce');
          }, 1000);
        }
      }, 100);

      return;
    }

    // VALIDAÇÃO DE LIMITE MENSAL - BLOQUEAR AGENDAMENTO SE EXCEDEU LIMITE
    if (monthlyLimitError) {
      console.log('❌ Agendamento bloqueado por limite mensal:', monthlyLimitError);

      // Scroll para a mensagem de erro (que já está visível)
      setTimeout(() => {
        const errorElement = document.querySelector('[data-monthly-limit-error]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Destacar a mensagem com uma animação
          errorElement.classList.add('animate-bounce');
          setTimeout(() => {
            errorElement.classList.remove('animate-bounce');
          }, 1000);
        }
      }, 100);

      return;
    }

    // VALIDAÇÃO DE 1 AGENDAMENTO POR SEMANA - BLOQUEAR SE ASSINANTE JÁ TEM AGENDAMENTO NA SEMANA
    if (oneWeekLimitError) {
      console.log('❌ Agendamento bloqueado para assinante:', oneWeekLimitError);

      // Scroll para a mensagem de erro (que já está visível)
      setTimeout(() => {
        const errorElement = document.querySelector('[data-one-week-error]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Destacar a mensagem com uma animação
          errorElement.classList.add('animate-bounce');
          setTimeout(() => {
            errorElement.classList.remove('animate-bounce');
          }, 1000);
        }
      }, 100);

      return;
    }



    // Se há campos faltando, mostrar mensagem amigável
    if (missingFields.length > 0) {
      const message = missingFields.length === 1
        ? `Por favor, selecione o ${missingFields[0]}.`
        : `Por favor, complete os seguintes campos: ${missingFields.join(', ')}.`;

      alert(message);
      return;
    }

    const whatsappNumbers = clientWhatsapp.replace(/\D/g, '');

    setIsLoading(true);
    try {
      // Calcular totais para múltiplos serviços ou categorias
      let servicesToUse, totalPrice, totalDuration, serviceNames;

      if (useMultiService && selectedServices.length > 0) {
        servicesToUse = selectedServices;
        totalPrice = servicesToUse.reduce((sum, service) => sum + (service?.price || 0), 0);
        totalDuration = servicesToUse.reduce((sum, service) => sum + (service?.duration || 0), 0);
        serviceNames = servicesToUse.map(service => service?.name).filter(Boolean).join(' + ');
      } else if (useCategoryService) {
        if (useMultiCategoryService && selectedCategoryServices.length > 0) {
          // ✅ MÚLTIPLOS SERVIÇOS DE CATEGORIAS
          servicesToUse = selectedCategoryServices;
          totalPrice = selectedCategoryServices.reduce((sum, service) => sum + (service?.price || 0), 0);
          totalDuration = selectedCategoryServices.reduce((sum, service) => sum + (service?.duration || 0), 0);
          serviceNames = selectedCategoryServices.map(service => service?.name).filter(Boolean).join(' + ');
        } else if (selectedSubcategory) {
          // ✅ UM SERVIÇO DE CATEGORIA
          console.log('🔍 DEBUG - Usando serviço de categoria:', selectedSubcategory);
          totalPrice = selectedSubcategory.price;
          totalDuration = selectedSubcategory.duration;
          serviceNames = selectedSubcategory.name;
        }
      } else {
        servicesToUse = [selectedService];
        totalPrice = servicesToUse.reduce((sum, service) => sum + (service?.price || 0), 0);
        totalDuration = servicesToUse.reduce((sum, service) => sum + (service?.duration || 0), 0);
        serviceNames = servicesToUse.map(service => service?.name).filter(Boolean).join(' + ');
      }

      // Debug: verificar a data antes de formatar
      console.log('🔍 DEBUG - Data selecionada:', selectedDate);
      console.log('🔍 DEBUG - Tipo:', typeof selectedDate);
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      console.log('🔍 DEBUG - Data formatada:', formattedDate);

      const appointmentData = {
        client_name: isSubscriberBooking ? `${clientName} (ASSINANTE)` : clientName, // Adicionar (ASSINANTE) apenas no envio
        client_whatsapp: whatsappNumbers,
        client_cpf: establishment?.require_cpf && clientCpf ? clientCpf.replace(/\D/g, '') : null, // Adicionar CPF se solicitado
        service: isSubscriberBooking && subscriberService ? subscriberService.name : serviceNames,
        professional: selectedProfessional?.id || '',
        appointment_date: formattedDate,
        appointment_time: selectedTime,
        duration: isSubscriberBooking && subscriberService ? (subscriberService.service_duration || 30) : totalDuration, // Usar duração total
        price: isSubscriberBooking && subscriberService ? 0 : totalPrice, // Preço total
        payment_method: isSubscriberBooking ? 'assinante' : selectedPaymentMethod,
        observation: observation.trim() || null, // Adicionar observação (null se vazia)
        is_child_service: isChildService === true, // Adicionar serviço infantil (garantir boolean)
        is_subscriber: isSubscriberBooking // Adicionar flag de assinante
      };

      console.log('🚀 DEBUG - Dados do agendamento sendo enviados:', appointmentData);

      await onSubmit(appointmentData);

      // Só navega após sucesso (REMOVIDO: navigate('/success');)
    } catch (error: any) {
      console.error('❌ Erro ao agendar:', error);

      // Verificar se é erro de limite excedido
      if (error.message?.includes('atingiu o limite dos seus serviços como assinante')) {
        // Extrair informações do erro para o modal
        const match = error.message.match(/(\d+)\/(\d+) serviços utilizados/);
        if (match) {
          setLimitModalData({
            currentUsage: parseInt(match[1]),
            monthlyLimit: parseInt(match[2]),
            subscriptionName: 'Assinatura Ativa' // Pode ser melhorado depois
          });
          setShowLimitModal(true);
          return;
        }
      }

      // Tratamento específico para diferentes tipos de erro
      let errorMessage = 'Erro ao realizar agendamento. Tente novamente.';

      if (error.message?.includes('Load failed') || error.message?.includes('TypeError')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message?.includes('fetch')) {
        errorMessage = 'Problema de conectividade. Tente novamente em alguns segundos.';
      } else if (error.message?.includes('RLS') || error.message?.includes('permission')) {
        errorMessage = 'Erro de permissão. Recarregue a página e tente novamente.';
      } else if (error.message?.includes('Conflito de horário')) {
        errorMessage = error.message; // Usar a mensagem específica de conflito
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsapp(e.target.value);
    setClientWhatsapp(formatted);
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value);
    setClientCpf(formatted);
  };

  // Funções para o modal de limite excedido
  const handleRenewSubscription = () => {
    setShowLimitModal(false);
    // Aqui você pode implementar a lógica para renovar assinatura
    // Por exemplo, redirecionar para página de pagamento ou mostrar modal de renovação
    alert('Funcionalidade de renovação será implementada em breve!');
  };

  const handleBookAsNormal = () => {
    setShowLimitModal(false);
    // Marcar como agendamento normal (não assinante)
    // Isso pode ser feito alterando o is_subscriber para false
    // Por enquanto, vamos apenas fechar o modal
    alert('Você pode agendar como cliente normal. O valor será cobrado individualmente.');
  };

  // Pegar o dia da semana em inglês (como está no banco de dados)
  const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase(); // segunda-feira -> monday

  // Debug para verificar o mapeamento
  console.log('🗓️ Data selecionada:', format(selectedDate, 'dd/MM/yyyy'));
  console.log('📅 Dia da semana (inglês):', dayOfWeek);
  console.log('🏢 Horários do estabelecimento:', establishment.business_hours);

  // Garantir que os horários estão no formato correto
  const defaultBusinessHours = {
    enabled: false,
    open1: '',
    close1: '',
    open2: null,
    close2: null
  };

  // Converter os horários do estabelecimento para o formato correto
  const businessHours = establishment.business_hours?.[dayOfWeek] || defaultBusinessHours;

  // Seção 6. HORÁRIO
  // Filtrar agendamentos existentes com base no profissional selecionado
  const filteredExistingAppointments = selectedProfessional
    ? existingAppointments.filter(app => app.professional === selectedProfessional.id)
    : []; // Se nenhum profissional for selecionado, não há agendamentos a bloquear



  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
        {/* 1. NOME DO CLIENTE */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isEstablishmentOwner ? '1. Nome do Cliente (Reserva pelo Estabelecimento)' : '1. Nome do Cliente'}
            {isNewClientUser && !isEstablishmentOwner && (
              <span className="text-xs text-gray-500 ml-2">(Dados fixos do cadastro)</span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={`flex-1 px-4 py-2 rounded-md border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400 ${isNewClientUser && !isEstablishmentOwner ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
              placeholder="Digite seu nome"
              required
              readOnly={isNewClientUser && !isEstablishmentOwner}
            />
            <button
              type="button"
              onClick={forceUpdateUserData}
              disabled={isLoadingUserData}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
              title="Atualizar dados do usuário"
            >
              {isLoadingUserData ? '...' : '🔄'}
            </button>
          </div>
          {user && clientName && (
            <p className="mt-1 text-sm text-blue-600 italic">
              Esse é seu nome?
            </p>
          )}
          {isSubscriberBooking && (
            <p className="mt-1 text-sm text-green-600 font-medium">
              📌 O sufixo "(ASSINANTE)" é fixo para identificação do estabelecimento
            </p>
          )}
          {isEstablishmentOwner && (
            <p className="mt-1 text-sm text-gray-500">
              Você está fazendo uma reserva como estabelecimento para um cliente.
            </p>
          )}
        </div>

        {/* 2. WHATSAPP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>2. WhatsApp</span>
              {isNewClientUser && !isEstablishmentOwner && (
                <span className="text-xs text-gray-500 ml-2">(Dados fixos do cadastro)</span>
              )}
            </div>
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={clientWhatsapp}
              onChange={handleWhatsappChange}
              className={`flex-1 px-4 py-2 rounded-md border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400 ${isNewClientUser && !isEstablishmentOwner ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
              placeholder="(00) 00000-0000"
              required
              maxLength={15}
              readOnly={isNewClientUser && !isEstablishmentOwner}
            />
            <button
              type="button"
              onClick={forceUpdateUserData}
              disabled={isLoadingUserData}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
              title="Atualizar dados do usuário"
            >
              {isLoadingUserData ? '...' : '🔄'}
            </button>
          </div>
          {user && clientWhatsapp && (
            <p className="mt-1 text-sm text-blue-600 italic">
              Esse é seu WhatsApp?
            </p>
          )}
        </div>

        {/* 3. CPF (Condicional - Só aparece se o estabelecimento solicitar) */}
        {establishment?.require_cpf && !isSubscriberBooking && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <span>3. CPF</span>
                <span className="text-red-500 font-bold">*</span>
              </div>
            </label>
            <input
              type="text"
              value={clientCpf}
              onChange={handleCpfChange}
              className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400 bg-white"
              placeholder="000.000.000-00"
              required
              maxLength={14}
            />
            <p className="mt-1 text-xs text-gray-500 italic">
              ℹ️ Este estabelecimento solicita CPF pois emite nota fiscal dos serviços.
            </p>
          </div>
        )}

        <div>
          {/* Notificação de assinante detectado */}
          {(() => {
            const shouldShow = showSubscriberNotification && detectedSubscriber;
            console.log('🎨 DEBUG - RENDERIZAÇÃO da notificação verde:', {
              showSubscriberNotification,
              detectedSubscriber: detectedSubscriber ? 'EXISTE' : 'NULL',
              shouldShow
            });
            return shouldShow;
          })() && (
              <div
                className={`mt-3 p-3 border rounded-lg ${detectedSubscriber.is_expired
                  ? 'bg-red-50 border-red-200'
                  : 'bg-green-50 border-green-200'
                  }`}
                ref={(el) => {
                  if (el) {
                    console.log('✅ NOTIFICAÇÃO VERDE ESTÁ SENDO RENDERIZADA NA TELA!', {
                      detectedSubscriber,
                      showSubscriberNotification,
                      subscriberDetectionDisabled
                    });
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${detectedSubscriber.is_expired
                    ? 'bg-red-500'
                    : 'bg-green-500 animate-pulse'
                    }`}></div>
                  <span className={`text-sm font-medium ${detectedSubscriber.is_expired
                    ? 'text-red-800'
                    : 'text-green-800'
                    }`}>
                    {detectedSubscriber.is_expired ? '⚠️ Plano Vencido Detectado!' : '🎯 Assinante detectado automaticamente!'}
                  </span>
                </div>

                <p className={`text-sm mt-1 ${detectedSubscriber.is_expired
                  ? 'text-red-700'
                  : 'text-green-700'
                  }`}>
                  <strong>Plano:</strong> {detectedSubscriber.subscription_name || 'Plano não identificado'}
                </p>

                <p className={`text-sm ${detectedSubscriber.is_expired
                  ? 'text-red-700'
                  : 'text-green-700'
                  }`}>
                  <strong>Válido até:</strong> {format(new Date(detectedSubscriber.end_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>

                {detectedSubscriber.is_expired && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                    <p className="text-sm text-red-800 font-medium">
                      {detectedSubscriber.expiration_message || 'Seu plano venceu. Renove para continuar agendando.'}
                    </p>
                  </div>
                )}

                {!detectedSubscriber.is_expired ? (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        // Converter para agendamento de assinante
                        setShowSubscriberNotification(false);
                        console.log('🔄 Convertendo para agendamento de assinante:', detectedSubscriber);

                        // VALIDAR LIMITE MENSAL antes de converter
                        if (clientWhatsapp && establishment?.id) {
                          console.log('🔍 Verificando limite mensal antes de converter...');
                          const limitCheck = await checkMonthlyLimit(clientWhatsapp, establishment.id);

                          if (!limitCheck.canBook && limitCheck.errorMessage) {
                            console.log('🚫 Limite mensal excedido, não convertendo:', limitCheck.errorMessage);
                            setMonthlyLimitError(limitCheck.errorMessage);
                            setMonthlyLimitData({
                              currentUsage: limitCheck.currentUsage,
                              monthlyLimit: limitCheck.monthlyLimit,
                              subscriptionName: limitCheck.subscriptionName
                            });
                            return; // Não converte se limite excedido
                          }
                        }

                        // Chamar callback para o componente pai
                        if (onConvertToSubscriber) {
                          onConvertToSubscriber(detectedSubscriber);
                        }
                      }}
                      className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                    >
                      Usar como Assinante
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Marcar como agendamento normal (não assinante)
                        if (onConvertToSubscriber) {
                          onConvertToSubscriber(false);
                        }
                        setShowSubscriberNotification(false);
                        setDetectedSubscriber(null); // ✅ Limpar dados do assinante detectado
                        setSubscriberDetectionDisabled(true); // ✅ Desabilitar detecção de assinante
                        setMonthlyLimitError(null); // ✅ Limpar erro de limite mensal
                        setMonthlyLimitData(null); // ✅ Limpar dados de limite mensal
                        setMonthlyLimitValidationDisabled(true); // ✅ Desabilitar validação de limite mensal
                        console.log('🚫 DEBUG - Detecção de assinante DESABILITADA (Continuar Normal)');
                      }}
                      className="mt-2 ml-2 px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                    >
                      Continuar Normal
                    </button>
                  </>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-sm text-red-700 font-medium">
                      Para agendar, você precisa renovar seu plano.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSubscriberNotification(false)}
                        className="flex-1 px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                      >
                        Agendamento Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Redirecionar para WhatsApp do estabelecimento
                          const establishmentWhatsapp = establishment?.whatsapp;
                          const subscriptionName = detectedSubscriber.subscription_name || 'Plano não identificado';

                          if (establishmentWhatsapp) {
                            const message = `Quero renovar minha assinatura: ${subscriptionName}`;
                            const whatsappUrl = `https://wa.me/${establishmentWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                            window.open(whatsappUrl, '_blank');
                          } else {
                            console.error('WhatsApp do estabelecimento não encontrado');
                          }

                          setShowSubscriberNotification(false);
                        }}
                        className="flex-1 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                      >
                        Renovar Assinatura
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Indicador de verificação */}
          {isCheckingSubscriber && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Verificando se é assinante...
            </div>
          )}

          {/* Mensagem de erro para limitação de agendamento de assinantes */}
          {subscriberBookingError && (
            <div
              data-subscriber-error
              className="mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg shadow-lg animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-xl">🚫</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-red-800 mb-1">
                      Agendamento Restrito
                    </h3>
                    <div className="text-red-500 text-sm font-medium">
                      ⚠️ Atenção
                    </div>
                  </div>
                  <p className="text-sm text-red-700 leading-relaxed mb-2">
                    {subscriberBookingError}
                  </p>
                  <div className="bg-red-100 rounded-md p-2">
                    <p className="text-xs text-red-600 font-medium">
                      💡 Dica: Escolha uma data dentro da semana atual para prosseguir com o agendamento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contador de agendamentos mensais para assinantes */}
          {isSubscriberBooking && monthlyLimitData && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-500 rounded-lg shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-xl">📊</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-blue-800 mb-1">
                    Controle Mensal de Agendamentos
                  </h3>
                  <div className="bg-blue-100 rounded-md p-3 mb-2">
                    <p className="text-sm text-blue-700 font-medium mb-1">
                      <strong>Assinatura:</strong> {monthlyLimitData.subscriptionName}
                    </p>
                    <p className="text-sm text-blue-700 font-medium">
                      <strong>Você já fez:</strong> {monthlyLimitData.currentUsage} {monthlyLimitData.monthlyLimit ? `de ${monthlyLimitData.monthlyLimit}` : ''} agendamentos
                    </p>
                    {monthlyLimitData.monthlyLimit && (
                      <p className="text-sm text-blue-700 font-medium">
                        <strong>Restam:</strong> {Math.max(0, monthlyLimitData.monthlyLimit - monthlyLimitData.currentUsage)} agendamentos
                      </p>
                    )}
                  </div>

                  {/* Progress Bar - só mostra se tem limite */}
                  {monthlyLimitData.monthlyLimit && (
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${monthlyLimitData.currentUsage >= monthlyLimitData.monthlyLimit
                          ? 'bg-red-500'
                          : monthlyLimitData.currentUsage >= monthlyLimitData.monthlyLimit * 0.8
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                          }`}
                        style={{
                          width: `${Math.min(100, (monthlyLimitData.currentUsage / monthlyLimitData.monthlyLimit) * 100)}%`
                        }}
                      ></div>
                    </div>
                  )}

                  <p className="text-xs text-blue-600">
                    {!monthlyLimitData.monthlyLimit
                      ? '✅ Sem limite definido - pode agendar normalmente.'
                      : monthlyLimitData.currentUsage >= monthlyLimitData.monthlyLimit
                        ? '🚫 Limite atingido! Agende como cliente normal.'
                        : monthlyLimitData.currentUsage >= monthlyLimitData.monthlyLimit * 0.8
                          ? '⚠️ Cuidado! Você está próximo do limite mensal.'
                          : '✅ Você ainda pode agendar normalmente.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem de erro para limite mensal excedido */}
          {monthlyLimitError && monthlyLimitData && (
            <div
              data-monthly-limit-error
              className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 rounded-lg shadow-lg animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-xl">⚠️</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-orange-800 mb-1">
                      Limite de Serviços Atingido
                    </h3>
                    <div className="text-orange-500 text-sm font-medium">
                      🔢 Limite
                    </div>
                  </div>
                  <p className="text-sm text-orange-700 leading-relaxed mb-2">
                    {monthlyLimitError}
                  </p>
                  <div className="bg-orange-100 rounded-md p-3 mb-3">
                    <p className="text-xs text-orange-600 font-medium mb-1">
                      <strong>Assinatura:</strong> {monthlyLimitData.subscriptionName}
                    </p>
                    <p className="text-xs text-orange-600 font-medium">
                      <strong>Uso atual:</strong> {monthlyLimitData.currentUsage} de {monthlyLimitData.monthlyLimit} agendamentos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Verificar se o estabelecimento tem WhatsApp configurado
                        if (!establishment?.whatsapp) {
                          alert('❌ WhatsApp do estabelecimento não está configurado. Entre em contato por telefone ou email.');
                          return;
                        }

                        // Abrir WhatsApp do ESTABELECIMENTO para renovação de assinatura
                        const cleanWhatsapp = establishment.whatsapp.replace(/\D/g, '');
                        const whatsappUrl = `https://wa.me/55${cleanWhatsapp}?text=Olá! Gostaria de renovar minha assinatura. Como posso proceder?`;
                        window.open(whatsappUrl, '_blank');
                        alert('Redirecionando para WhatsApp do estabelecimento para renovação da assinatura...');
                      }}
                      className="flex-1 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
                    >
                      🔄 Renovar Assinatura
                    </button>
                    <button
                      onClick={() => {
                        // Marcar como agendamento normal (não assinante)
                        if (onConvertToSubscriber) {
                          onConvertToSubscriber(false);
                        }
                        setMonthlyLimitError(null);
                        setMonthlyLimitData(null);
                        setShowSubscriberNotification(false); // ✅ Fechar também a notificação de assinante
                        setDetectedSubscriber(null); // ✅ Limpar dados do assinante detectado
                        setSubscriberDetectionDisabled(true); // ✅ Desabilitar detecção de assinante
                        setMonthlyLimitValidationDisabled(true); // ✅ Desabilitar validação de limite mensal
                        console.log('🚫 DEBUG - Detecção de assinante DESABILITADA');
                      }}
                      className="flex-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                    >
                      📅 Agendar como cliente normal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading de validação */}
          {isValidatingBooking && (
            <div className="mt-3 flex items-center gap-2 text-blue-600">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-sm">Verificando disponibilidade...</span>
            </div>
          )}



          {/* Mensagem de erro para 1 agendamento por semana */}
          {oneWeekLimitError && (
            <div
              data-one-week-error
              className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-lg shadow-lg animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-xl">🚫</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-red-800 mb-1">
                      Limite de Agendamentos
                    </h3>
                    <div className="text-red-500 text-sm font-medium">
                      🚫 Atenção
                    </div>
                  </div>
                  <p className="text-sm text-red-700 leading-relaxed mb-2">
                    {oneWeekLimitError}
                  </p>
                  <div className="bg-red-100 rounded-md p-2">
                    <p className="text-xs text-red-600 font-medium">
                      💡 Dica: Cancele seu agendamento atual para poder fazer um novo na mesma semana.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading de validação de 1 agendamento por semana */}
          {isValidatingOneWeek && (
            <div className="mt-3 flex items-center gap-2 text-red-600">
              <div className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
              <span className="text-sm">Verificando agendamentos da semana...</span>
            </div>
          )}


        </div>



        {/* 3. PROFISSIONAL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            3. Escolha o Profissional
          </label>
          <ProfessionalSelector
            professionals={establishment.professionals}
            selectedProfessional={selectedProfessional?.id || null}
            onSelectProfessional={(professionalId) => {
              const professional = establishment.professionals.find(p => p.id === professionalId);

              // ✅ LIMPAR APENAS A SELEÇÃO ATUAL (não os modos)
              // Isso evita que serviços específicos de um profissional apareçam com outro
              setSelectedService(undefined);
              setSelectedServices([]);
              setSelectedSubcategory(undefined);
              setSelectedCategoryServices([]);

              // ✅ NÃO LIMPAR OS MODOS (useMultiService, useCategoryService)
              // Isso mantém a interface funcionando

              setSelectedProfessional(professional || undefined);

              // Scroll automático para a próxima seção após selecionar profissional
              if (professional) {
                scrollToNextSection();
              }
            }}
            establishmentId={establishment.id || establishment.establishment_id || ''}
            selectedDate={selectedDate}
            showGoalProgress={false}
          />
        </div>

        {/* 4. SERVIÇO - Oculto para assinantes */}
        {!isSubscriberBooking && showServiceSection && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              4. Escolha o Serviço
            </label>

            {/* Toggle para escolher entre seleção única, múltipla ou categorias */}
            <div className="mb-4 flex gap-2">
              {/* ✅ MODIFICADO: Mostrar apenas "Escolha 1 ou mais serviços" se houver serviços gerais OU específicos */}
              {(hasGeneralServices || hasSpecificServices) && (
                <button
                  type="button"
                  onClick={() => {
                    setUseMultiService(true);
                    setUseCategoryService(false);
                    setSelectedService(undefined);
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${useMultiService && !useCategoryService
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  Escolha 1 ou mais serviços
                </button>
              )}

              {/* Mostrar "Outros Serviços" sempre */}
              <button
                type="button"
                onClick={() => {
                  setUseCategoryService(true);
                  setUseMultiService(false);
                  setSelectedService(undefined);
                  setSelectedServices([]);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${useCategoryService
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                SERVIÇOS EM CATEGORIA
              </button>
            </div>

            {/* Renderizar componente apropriado */}
            {useMultiService ? (
              <MultiServiceSelector
                services={getCombinedServices()}
                selectedServices={selectedServices}
                onSelectServices={(services) => {
                  setSelectedServices(services);

                  // Scroll automático para a próxima seção após selecionar serviços
                  if (services.length > 0) {
                    scrollToNextSection();
                  }
                }}
                maxServices={4}
              />
            ) : useCategoryService ? (
              <div className="space-y-4">
                {/* ✅ BOTÃO PARA MÚLTIPLOS SERVIÇOS EM CATEGORIAS - SEMPRE ATIVO */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setUseMultiCategoryService(true);
                      setSelectedSubcategory(null);
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-primary text-white"
                  >
                    Escolha 1 ou mais serviços
                  </button>
                </div>

                {serviceCategories.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Nenhuma categoria cadastrada
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>O estabelecimento ainda não cadastrou categorias de serviços.</p>
                          <p className="mt-1">Use as outras opções de serviço disponíveis.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Seletor de Categoria */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Escolha a categoria
                      </label>
                      <select
                        value={selectedCategory || ''}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          setSelectedSubcategory(null);

                          // Scroll automático para a próxima seção após selecionar categoria
                          if (e.target.value) {
                            scrollToNextSection();
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-gray-900 bg-white"
                      >
                        <option value="">Selecione uma categoria</option>
                        {serviceCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Seletor de Subcategoria */}
                    {selectedCategory && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Escolha o serviço
                        </label>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const subcategory = serviceCategories
                                .find(cat => cat.id === selectedCategory)
                                ?.subcategories.find((sub: any) => sub.id === e.target.value);

                              if (subcategory) {
                                if (useMultiCategoryService) {
                                  // ✅ MODO MÚLTIPLOS: Adicionar à lista se não exceder limite
                                  if (selectedCategoryServices.length < 4) {
                                    setSelectedCategoryServices(prev => [...prev, subcategory]);

                                    // Scroll automático para a próxima seção após selecionar serviço de categoria
                                    scrollToNextSection();
                                  }
                                } else {
                                  // ✅ MODO ÚNICO: Selecionar apenas um
                                  setSelectedSubcategory(subcategory);

                                  // Scroll automático para a próxima seção após selecionar subcategoria
                                  scrollToNextSection();
                                }
                              }
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-gray-900 bg-white"
                        >
                          <option value="">Selecione um serviço</option>
                          {serviceCategories
                            .find(cat => cat.id === selectedCategory)
                            ?.subcategories.map((subcategory: any) => (
                              <option key={subcategory.id} value={subcategory.id}>
                                {subcategory.name} - R$ {subcategory.price.toFixed(2)} ({subcategory.duration}min)
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* ✅ RESUMO DO SERVIÇO SELECIONADO - UM OU MÚLTIPLOS */}
                    {!useMultiCategoryService && selectedSubcategory && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold text-blue-900">{selectedSubcategory.name}</h4>
                        <div className="flex justify-between mt-2">
                          <span className="text-blue-700">Preço: R$ {selectedSubcategory.price.toFixed(2)}</span>
                          <span className="text-blue-700">Duração: {selectedSubcategory.duration}min</span>
                        </div>
                      </div>
                    )}

                    {/* ✅ LISTA DE SERVIÇOS SELECIONADOS - MÚLTIPLOS */}
                    {useMultiCategoryService && selectedCategoryServices.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-900">Serviços Selecionados:</h4>
                        {selectedCategoryServices.map((service, index) => (
                          <div key={`${service.id}-${index}`} className="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                            <div>
                              <span className="font-medium text-green-900">{service.name}</span>
                              <div className="text-sm text-green-700">
                                R$ {service.price.toFixed(2)} • {service.duration}min
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategoryServices(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Remover
                            </button>
                          </div>
                        ))}

                        {/* ✅ RESUMO TOTAL */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-semibold text-blue-900">Resumo Total:</h4>
                          <div className="flex justify-between mt-2">
                            <span className="text-blue-700">
                              Preço: R$ {selectedCategoryServices.reduce((sum, service) => sum + service.price, 0).toFixed(2)}
                            </span>
                            <span className="text-blue-700">
                              Duração: {selectedCategoryServices.reduce((sum, service) => sum + service.duration, 0)}min
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <ServiceList
                services={getCombinedServices()}
                selectedService={selectedService}
                onSelectService={setSelectedService}
              />
            )}
          </div>
        )}

        {/* Serviço do Assinante - Mostrado apenas para assinantes */}
        {isSubscriberBooking && subscriberService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              3. Serviço Incluído
            </label>
            <div className="w-full p-4 rounded-lg border border-green-200 bg-green-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-800">{subscriberService.name}</h3>
                  <p className="text-sm text-green-600">Incluído na sua assinatura</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-800">GRÁTIS</p>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* 5. DATA */}
        {showDateSection && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              5. Escolha a Data
            </label>
            <DatePicker
              selectedDate={selectedDate}
              onChange={(date) => {
                onSelectDate(date);
                setHasSelectedDate(true); // Marca que o usuário selecionou uma data

                // Scroll automático para a seção de horário após selecionar data
                if (date) {
                  scrollToTimeSection();
                }
              }}
              businessHours={establishment.business_hours}
              allowedWeekdays={subscriberService?.weekdays}
              isSubscriberBooking={isSubscriberBooking}
            />
          </div>
        )}

        {/* 6. HORÁRIO */}
        {showDateSection && hasSelectedDate && (selectedService || (useMultiService && selectedServices.length > 0) || (useCategoryService && (selectedSubcategory || (useMultiCategoryService && selectedCategoryServices.length > 0))) || (isSubscriberBooking && subscriberService)) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              6. Escolha o Horário
            </label>

            {/* Verificar se o dia selecionado é válido para assinantes */}
            {isSubscriberBooking && subscriberService && !isValidDayForSubscriber(selectedDate, subscriberService.weekdays) ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Dia não disponível para este serviço
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Seus dias de agendamento para <strong>{subscriberService.name}</strong> são:</p>
                      <p className="mt-1 font-semibold">
                        {subscriberService.weekdays?.map((day: string) => {
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
                      <p className="mt-2">Por favor, escolha uma data que corresponda a um desses dias da semana.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <TimeSlotSelector
                selectedDate={selectedDate}
                selectedService={isSubscriberBooking && subscriberService ? {
                  id: subscriberService.id,
                  name: subscriberService.name,
                  price: 0, // Preço 0 para assinantes
                  duration: subscriberService.service_duration || 30 // Usar duração da assinatura
                } : useMultiService && selectedServices.length > 0 ? {
                  id: 'multiple',
                  name: selectedServices.map(s => s.name).join(' + '),
                  price: selectedServices.reduce((sum, s) => sum + s.price, 0),
                  duration: selectedServices.reduce((sum, s) => sum + s.duration, 0)
                } : useCategoryService && useMultiCategoryService && selectedCategoryServices.length > 0 ? {
                  id: 'multiple-category',
                  name: selectedCategoryServices.map(s => s.name).join(' + '),
                  price: selectedCategoryServices.reduce((sum, s) => sum + s.price, 0),
                  duration: selectedCategoryServices.reduce((sum, s) => sum + s.duration, 0)
                } : useCategoryService && selectedSubcategory ? {
                  id: selectedSubcategory.id,
                  name: selectedSubcategory.name,
                  price: selectedSubcategory.price,
                  duration: selectedSubcategory.duration
                } : selectedService}
                existingAppointments={filteredExistingAppointments} // Passar agendamentos filtrados
                selectedTime={selectedTime}
                onTimeSelect={(time) => {
                  setSelectedTime(time);

                  // Scroll automático para a seção de observação após selecionar horário
                  if (time) {
                    setTimeout(() => {
                      // Encontrar a seção de observação
                      const observationSection = document.querySelector('textarea[placeholder*="observação"]');
                      if (observationSection) {
                        observationSection.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start'
                        });
                      } else {
                        window.scrollBy({
                          top: 250,
                          behavior: 'smooth'
                        });
                      }
                    }, 300);
                  }
                }}
                filterPastTimes={!!(user && !isEstablishmentOwner)} // Filtrar horários passados apenas para clientes logados
                businessHours={businessHours}
                use15MinuteInterval={establishment.use_15_minute_interval ?? false}
                use20MinuteSchedule={(establishment as any).use_20_minute_schedule ?? false}
                selectedProfessional={selectedProfessional?.id}
                professionalAbsences={selectedProfessional ? (selectedProfessional as any).absences || [] : []}
                professionalBlockedHours={selectedProfessional ? (selectedProfessional as any).blocked_hours?.[selectedDate.toISOString().split('T')[0]] || [] : []}
                professionalWorkHours={selectedProfessional ? (selectedProfessional as any).work_hours || null : null}
              />
            )}
          </div>
        )}

        {/* 6. OBSERVAÇÃO - Opcional */}
        {selectedTime && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observação
            </label>
            <textarea
              value={observation}
              onChange={(e) => {
                if (e.target.value.length <= 100) {
                  setObservation(e.target.value);
                }
              }}
              placeholder="Quer colocar alguma observação para o barbeiro?"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
              maxLength={100}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                (Opcional) Máximo 100 caracteres
              </p>
              <span className={`text-xs ${observation.length > 90 ? 'text-red-500' : 'text-gray-400'}`}>
                {observation.length}/100
              </span>
            </div>
          </div>
        )}

        {/* 7. FORMA DE PAGAMENTO - Oculto para assinantes */}
        {showPaymentSection && (selectedService || (useMultiService && selectedServices.length > 0) || (useCategoryService && (selectedSubcategory || (useMultiCategoryService && selectedCategoryServices.length > 0)))) && !isSubscriberBooking && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              7. Forma de Pagamento
            </label>
            <PaymentMethodSelector
              selectedMethod={selectedPaymentMethod}
              onMethodSelect={(method) => {
                setSelectedPaymentMethod(method);

                // Scroll automático para o botão de agendar após selecionar método de pagamento
                if (method) {
                  // Pequeno delay para garantir que a UI foi atualizada
                  setTimeout(() => {
                    const submitButton = document.querySelector('button[type="submit"]');
                    if (submitButton) {
                      submitButton.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                      });
                    } else {
                      window.scrollBy({
                        top: 300,
                        behavior: 'smooth'
                      });
                    }
                  }, 300);
                }
              }}
              showPixOptions={!!establishment.pix_key}
              pixPaymentMethod={pixPaymentMethod}
              onPixMethodSelect={handlePixMethodSelect}
              enabledMethods={establishment.payment_methods_enabled}
            />

            {/* Formulário PIX quando selecionado */}
            {selectedPaymentMethod === 'pix' && establishment.pix_key && (
              <div className="mt-4">
                <PixPaymentForm
                  establishment={establishment}
                  selectedService={useMultiService && selectedServices.length > 0 ? {
                    id: 'multiple',
                    name: selectedServices.map(s => s.name).join(' + '),
                    price: selectedServices.reduce((sum, s) => sum + s.price, 0),
                    duration: selectedServices.reduce((sum, s) => sum + s.duration, 0)
                  } : useCategoryService && useMultiCategoryService && selectedCategoryServices.length > 0 ? {
                    id: 'multiple-category',
                    name: selectedCategoryServices.map(s => s.name).join(' + '),
                    price: selectedCategoryServices.reduce((sum, s) => sum + s.price, 0),
                    duration: selectedCategoryServices.reduce((sum, s) => sum + s.duration, 0)
                  } : useCategoryService && selectedSubcategory ? {
                    id: selectedSubcategory.id,
                    name: selectedSubcategory.name,
                    price: selectedSubcategory.price,
                    duration: selectedSubcategory.duration
                  } : selectedService || { id: '', name: '', price: 0, duration: 0 }}
                  onPixMethodSelect={handlePixMethodSelect}
                  onPixProofUpload={handlePixComprovantUpload}
                  pixPaymentMethod={pixPaymentMethod}
                  pixProofUrl={pixProofUrl}
                />
              </div>
            )}
          </div>
        )}

        {/* Pagamento já incluído - Mostrado apenas para assinantes */}
        {isSubscriberBooking && subscriberService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              7. Pagamento
            </label>
            <div className="w-full p-4 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
                <p className="text-blue-800 font-medium">Pagamento já incluído na sua assinatura</p>
              </div>
            </div>
          </div>
        )}

        {/* 7. SERVIÇO INFANTIL - Obrigatório (só se profissional oferece) */}
        {selectedTime && selectedProfessional && selectedProfessional.offers_child_service && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serviço infantil? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="childService"
                  value="true"
                  checked={isChildService === true}
                  onChange={() => setIsChildService(true)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Sim</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="childService"
                  value="false"
                  checked={isChildService === false}
                  onChange={() => setIsChildService(false)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Não</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              (Obrigatório) Informe se é um serviço para criança
            </p>
          </div>
        )}

        {/* RESUMO DO AGENDAMENTO */}
        {((selectedService && selectedProfessional && selectedPaymentMethod && selectedTime) ||
          (useMultiService && selectedServices.length > 0 && selectedProfessional && selectedPaymentMethod && selectedTime) ||
          (useCategoryService && ((selectedSubcategory && selectedProfessional && selectedPaymentMethod && selectedTime) || (useMultiCategoryService && selectedCategoryServices.length > 0 && selectedProfessional && selectedPaymentMethod && selectedTime))) ||
          (isSubscriberBooking && subscriberService && selectedProfessional && selectedTime)) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-primary mb-2">📋 Resumo do Agendamento:</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <div><strong>Cliente:</strong> {isSubscriberBooking ? `${clientName} (ASSINANTE)` : (clientName || 'Não informado')}</div>
                <div><strong>WhatsApp:</strong> {clientWhatsapp || 'Não informado'}</div>
                <div><strong>Serviço:</strong> {
                  isSubscriberBooking && subscriberService
                    ? `${subscriberService.name} - GRÁTIS (Incluído na assinatura)`
                    : useMultiService && selectedServices.length > 0
                      ? `${selectedServices.map(s => s.name).join(' + ')} - R$ ${selectedServices.reduce((sum, s) => sum + s.price, 0).toFixed(2).replace('.', ',')}`
                      : useCategoryService && useMultiCategoryService && selectedCategoryServices.length > 0
                        ? `${selectedCategoryServices.map(s => s.name).join(' + ')} - R$ ${selectedCategoryServices.reduce((sum, s) => sum + s.price, 0).toFixed(2).replace('.', ',')}`
                        : useCategoryService && selectedSubcategory
                          ? `${selectedSubcategory.name} - R$ ${selectedSubcategory.price.toFixed(2).replace('.', ',')}`
                          : `${selectedService?.name || ''} - R$ ${selectedService?.price.toFixed(2).replace('.', ',') || '0,00'}`
                }</div>
                <div><strong>Profissional:</strong> {selectedProfessional?.name || ''}</div>
                <div><strong>Pagamento:</strong> {
                  isSubscriberBooking
                    ? 'Já incluído na assinatura'
                    : selectedPaymentMethod === 'pix' ? (pixPaymentMethod === 'pix_now' ? 'PIX (Pagar agora)' : 'PIX (Pagar no local)') :
                      selectedPaymentMethod === 'credito' ? 'Cartão de Crédito' :
                        selectedPaymentMethod === 'debito' ? 'Cartão de Débito' :
                          selectedPaymentMethod === 'dinheiro' ? 'Dinheiro' : selectedPaymentMethod
                }</div>
                <div><strong>Data:</strong> {format(selectedDate, 'dd/MM/yyyy')}</div>
                <div><strong>Horário:</strong> {selectedTime}</div>
                <div><strong>Duração:</strong> {
                  isSubscriberBooking && subscriberService
                    ? `${subscriberService.service_duration || 30} minutos` // Usar duração da assinatura
                    : `${selectedService?.duration || 30} minutos`
                }</div>
                {observation && (
                  <div><strong>Observação:</strong> <em>"{observation}"</em></div>
                )}
                {selectedProfessional && selectedProfessional.offers_child_service && (
                  <div><strong>Serviço infantil:</strong> {isChildService === null ? 'Não informado' : (isChildService ? 'Sim' : 'Não')}</div>
                )}
              </div>
            </div>
          )}

        {/* BOTÃO DE SUBMIT */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-md text-white font-medium ${isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-primary hover:bg-primary/90'
            }`}
        >
          {isLoading ? 'Agendando...' : 'Confirmar Agendamento'}
        </button>
      </form>

      {/* Modal de limite excedido */}
      {limitModalData && (
        <SubscriptionLimitModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          onRenewSubscription={handleRenewSubscription}
          onBookAsNormal={handleBookAsNormal}
          currentUsage={limitModalData.currentUsage}
          monthlyLimit={limitModalData.monthlyLimit}
          subscriptionName={limitModalData.subscriptionName}
        />
      )}
    </div>
  );
} 