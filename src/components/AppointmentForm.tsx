import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { checkWhatsAppSubscriber as checkNewSubscriber } from '../lib/subscriberSystem';
import { checkWhatsAppSubscriber, getClientDataFromAuth, getClientProfileData, isNewClient, supabase, testMigration } from '../lib/supabase';
import { checkMonthlyLimit } from '../utils/monthlyLimitValidation';
import { validateOneWeekLimit } from '../utils/oneWeekLimitValidation';
import { validatePendingClientBookingLimit } from '../utils/pendingClientBookingValidation';
import { validateSubscriberBooking } from '../utils/subscriberBookingValidation';
import { DatePicker } from './DatePicker';
import { MultiServiceSelector } from './MultiServiceSelector';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PixPaymentForm } from './PixPaymentForm';
import { ProfessionalSelector } from './ProfessionalSelector';
// import { ServiceList } from './ServiceList'; // ✅ removido: agora sempre permite multi-seleção
import { SubscriptionLimitModal } from './SubscriptionLimitModal';
import { TimeSlotSelector } from './TimeSlotSelector';

const DEFAULT_SERVICE_IMAGE_URL = '/SERVIÇOS2.png';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url?: string | null;
  excluded_professional_ids?: string[] | null;
}

interface BookingHighlightedProduct {
  id: string;
  name: string;
  sale_price: number;
  image_url?: string | null;
  stock_quantity?: number | null;
  highlight_for_client_booking?: boolean | null;
}

interface Professional {
  id: string;
  name: string;
  photo_url?: string;
  offers_child_service?: boolean;
  work_hours?: {
    [key: string]: {
      enabled: boolean;
      entry_time?: string;
      break_start?: string;
      break_end?: string;
      exit_time?: string;
    };
  } | null;
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
  limit_client_pending_booking?: boolean;
  punish_client_on_cancel?: boolean; // Adicionado
  payment_methods_enabled?: string[]; // Formas de pagamento habilitadas
  require_cpf?: boolean; // Solicitar CPF no agendamento
  whatsapp?: string; // WhatsApp do estabelecimento
  booking_min_advance_hours?: number; // Antecedência mínima (em horas) para agendamento no booking público
  closed_time_enabled?: boolean; // Tempo fechado: grade fixa de horários
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
  subscriberExtraServices?: any[]; // Serviços extras pagos no fluxo de assinante
  isSubscriberBooking?: boolean; // Indica se é agendamento de assinante
  requireAdvancePayment?: boolean; // Se true: não exigir forma de pagamento/PIX aqui (pagamento será no PaymentModal)
  onConvertToSubscriber?: (subscriberData: any) => void; // Callback para converter para assinante
  onOpenRenewSubscription?: (detectedSubscriber: any) => void; // Callback para abrir fluxo de renovação (dados + pagamento)
  subscriberDetectionDisabled?: boolean; // Estado externo para desabilitar detecção
  onSubscriberDetectionDisabledChange?: (disabled: boolean) => void; // Callback para mudar o estado
  guestClientData?: { name: string; phone: string } | null; // Dados do cliente convidado (sem login)
  onRequestChangeSubscriberService?: () => void; // Solicita voltar para seleção de serviço da assinatura
  externalCurrentStep?: number; // Controle opcional de etapa por componente pai (modo chat)
  onExternalCurrentStepChange?: (step: number) => void; // Notifica mudança de etapa no modo controlado
  bookingHighlightedProducts?: BookingHighlightedProduct[];
}

export function AppointmentForm({
  establishment,
  onSubmit,
  selectedDate,
  onSelectDate,
  existingAppointments = [],
  subscriberService,
  subscriberExtraServices = [],
  isSubscriberBooking = false,
  requireAdvancePayment = false,
  onConvertToSubscriber,
  onOpenRenewSubscription,
  subscriberDetectionDisabled: externalSubscriberDetectionDisabled,
  guestClientData,
  onSubscriberDetectionDisabledChange,
  onRequestChangeSubscriberService,
  externalCurrentStep,
  onExternalCurrentStepChange,
  bookingHighlightedProducts = [],
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

  // ✅ Ref para rastrear o último userId que foi processado (evita loops e garante execução correta)
  const lastProcessedUserIdRef = useRef<string | undefined>(undefined);

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
    const currentUserId = user?.id;
    // ✅ Se o userId mudou, resetar o flag e atualizar a ref
    if (currentUserId !== lastProcessedUserIdRef.current) {
      console.log('🔍 DEBUG - Usuário mudou, resetando profileDataLoaded', {
        previous: lastProcessedUserIdRef.current,
        current: currentUserId
      });
      lastProcessedUserIdRef.current = currentUserId;
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
      const currentUserId = user?.id;
      console.log('🔍 DEBUG - loadClientProfile iniciado:', {
        user: !!user,
        profileDataLoaded,
        userId: currentUserId,
        lastProcessed: lastProcessedUserIdRef.current,
        guestClientData
      });

      // ✅ CRÍTICO: Evitar loop infinito - não executar se já carregou para este usuário
      if (profileDataLoaded && user && currentUserId === lastProcessedUserIdRef.current) {
        console.log('🔍 DEBUG - Dados já carregados para este usuário, pulando execução');
        return;
      }

      // ✅ Se o usuário mudou, precisamos processar novamente
      if (currentUserId && currentUserId !== lastProcessedUserIdRef.current) {
        console.log('🔍 DEBUG - Novo usuário detectado, resetando profileDataLoaded');
        setProfileDataLoaded(false);
        lastProcessedUserIdRef.current = currentUserId;
      }

      // Se temos dados do convidado, não buscar dados do perfil
      if (guestClientData) {
        console.log('🔍 DEBUG - Dados do convidado disponíveis, não carregando perfil');
        console.log('🔍 DEBUG - Mantendo dados do convidado:', guestClientData);
        setClientName(guestClientData.name);
        setClientWhatsapp(guestClientData.phone);
        return;
      }

      if (user && !profileDataLoaded) { // ✅ Adicionar verificação !profileDataLoaded para evitar loop
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
            // ✅ Marcar que processamos este userId
            lastProcessedUserIdRef.current = currentUserId;
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
            // ✅ Marcar que processamos este userId
            lastProcessedUserIdRef.current = currentUserId;
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
          // ✅ Marcar que processamos este userId
          lastProcessedUserIdRef.current = currentUserId;
        } catch (error) {
          console.error('Erro ao carregar perfil do cliente:', error);
          setProfileDataLoaded(true);
          // ✅ Mesmo em erro, marcar que tentamos processar
          lastProcessedUserIdRef.current = currentUserId;
        }
      } else {
        console.log('🔍 DEBUG - Condições não atendidas:', { user: !!user, profileDataLoaded });
        console.log('🔍 DEBUG - Motivo:', !user ? 'Usuário não logado' : 'Dados já carregados');
      }
    };

    console.log('🔍 DEBUG - Executando loadClientProfile...');
    loadClientProfile();
    // ✅ CORREÇÃO CRÍTICA: Usar user?.id em vez de user para evitar re-execuções desnecessárias
    // E usar useRef para rastrear o último userId processado, garantindo que:
    // - Quando user muda de null para objeto: funciona (user?.id muda de undefined para id)
    // - Quando user muda de objeto para null: funciona (user?.id muda de id para undefined)  
    // - Quando user.id muda: funciona (user?.id muda)
    // - Quando user objeto muda mas id é o mesmo: não re-executa (correto, dados já carregados)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, guestClientData]);
  const [selectedService, setSelectedService] = useState<Service | undefined>(undefined);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [useMultiService, setUseMultiService] = useState(false); // ✅ evita cair no dropdown antigo; usamos botões abaixo
  // ✅ CORRIGIDO: Começar como true se houver categorias, senão false
  const [useCategoryService, setUseCategoryService] = useState(true); // ✅ sempre começar em categorias
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<any>(null);

  // ✅ ESTADO PARA MÚLTIPLOS SERVIÇOS EM CATEGORIAS
  const [selectedCategoryServices, setSelectedCategoryServices] = useState<any[]>([]);
  const [useMultiCategoryService, setUseMultiCategoryService] = useState(true);
  // ✅ NOVO: Serviços específicos selecionados do profissional (somam com categorias)
  const [selectedProfessionalSpecificServices, setSelectedProfessionalSpecificServices] = useState<Service[]>([]);
  // ✅ NOVO: qual lista mostrar no step 2 (tabs)
  const [serviceTab, setServiceTab] = useState<'category' | 'professional'>('category');
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedBookingProductIds, setSelectedBookingProductIds] = useState<string[]>([]);
  const [selectedBookingProductImagePreview, setSelectedBookingProductImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [observation, setObservation] = useState<string>('');
  const [isChildService, setIsChildService] = useState<boolean | null>(null);

  const getMinimumAdvanceMinutes = () => {
    const rawMinutes = Number((establishment as any)?.booking_min_advance_minutes ?? 0);
    if (Number.isFinite(rawMinutes) && rawMinutes > 0) {
      return Math.max(0, Math.floor(rawMinutes));
    }
    // Fallback legado: configuração antiga em horas
    const rawHours = Number((establishment as any)?.booking_min_advance_hours ?? 0);
    if (!Number.isFinite(rawHours) || rawHours <= 0) return 0;
    return Math.max(0, Math.floor(rawHours * 60));
  };

  const isTimeInsideAdvanceWindow = (time: string) => {
    const minMinutes = getMinimumAdvanceMinutes();
    if (!time || minMinutes <= 0) return false;

    const [hourStr, minuteStr] = String(time).split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

    const slotDateTime = new Date(selectedDate);
    slotDateTime.setHours(hour, minute, 0, 0);

    const minAllowedDateTime = new Date();
    minAllowedDateTime.setMinutes(minAllowedDateTime.getMinutes() + minMinutes);

    return slotDateTime < minAllowedDateTime;
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = String(time || '00:00').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
    return hours * 60 + minutes;
  };

  const getSelectedDurationForValidation = (): number => {
    if (isSubscriberBooking) return getResolvedSubscriberDuration() + getResolvedSubscriberExtraDuration();
    if (useMultiService) {
      return (selectedServices || []).reduce((sum, s) => sum + (Number((s as any)?.duration) || 0), 0);
    }
    if (useCategoryService) {
      const specificDur = (selectedProfessionalSpecificServices || []).reduce(
        (sum, s) => sum + (Number((s as any)?.duration) || 0),
        0
      );
      if (useMultiCategoryService) {
        const categoryDur = (selectedCategoryServices || []).reduce((sum, s: any) => sum + (Number(s?.duration) || 0), 0);
        return specificDur + categoryDur;
      }
      return specificDur + (Number((selectedSubcategory as any)?.duration) || 0);
    }
    return Number((selectedService as any)?.duration) || 0;
  };

  const isSelectedTimeInsideProfessionalBreak = (): boolean => {
    if (!selectedProfessional || !selectedTime) return false;

    const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
    const dayWork = (selectedProfessional as any)?.work_hours?.[dayKey];
    if (!dayWork || dayWork.enabled !== true) return false;
    if (!dayWork.break_start || !dayWork.break_end) return false;

    const start = timeToMinutes(selectedTime);
    const duration = Math.max(1, Math.round(getSelectedDurationForValidation() || 30));
    const end = start + duration;

    const breakStart = timeToMinutes(dayWork.break_start);
    const breakEnd = timeToMinutes(dayWork.break_end);

    const serviceStartsInBreak = start >= breakStart && start < breakEnd;
    const serviceEndsInBreak = end > breakStart && end <= breakEnd;
    const serviceEncompassesBreak = start <= breakStart && end >= breakEnd;

    return serviceStartsInBreak || serviceEndsInBreak || serviceEncompassesBreak;
  };

  // ✅ Cupom de desconto (booking)
  const [cupomInput, setCupomInput] = useState<string>('');
  const [cupomAplicado, setCupomAplicado] = useState<{ code: string; percent: number } | null>(null);
  const [isApplyingCupom, setIsApplyingCupom] = useState(false);

  // Se virar agendamento de assinante, cupom não se aplica
  useEffect(() => {
    if (isSubscriberBooking) {
      setCupomAplicado(null);
      setCupomInput('');
    }
  }, [isSubscriberBooking]);

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
          service_categories!inner (
            establishment_id
          )
        `)
        .eq('is_active', true)
        .eq('service_categories.establishment_id', establishment.id)
        .order('category_id', { ascending: true })
        .order('display_order', { ascending: true });

      if (subcategoriesError) {
        console.error('Erro ao buscar subcategorias:', subcategoriesError);
        return;
      }

      // ✅ Ocultar no booking público, mas manter visível no fluxo interno do estabelecimento
      // Suporta os dois campos possíveis no banco: hidden_from_booking e oculto_da_reserva
      const isHiddenInBooking = (o: any) => Boolean(o?.hidden_from_booking ?? o?.oculto_da_reserva);
      const shouldRespectBookingHidden = !isEstablishmentOwner;

      const visibleCategories = shouldRespectBookingHidden
        ? (categories || []).filter((c: any) => !isHiddenInBooking(c))
        : (categories || []);
      const visibleSubcategories = shouldRespectBookingHidden
        ? (subcategories || []).filter((s: any) => !isHiddenInBooking(s))
        : (subcategories || []);

      // Combinar categorias com suas subcategorias (já filtradas)
      const categoriesWithSubcategories = visibleCategories.map((category: any) => ({
        ...category,
        subcategories: visibleSubcategories.filter((sub: any) => sub.category_id === category.id)
      }));

      setServiceCategories(categoriesWithSubcategories);
    } catch (error) {
      console.error('Erro ao buscar categorias de serviços:', error);
    }
  };

  useEffect(() => {
    fetchServiceCategories();

    // ✅ CORRIGIDO: Se houver categorias OU não houver serviços gerais, usar categorias por padrão
    if (serviceCategories.length > 0 || (establishment?.services_with_prices && establishment.services_with_prices.length === 0)) {
      setUseCategoryService(true);
      setUseMultiService(false);
      setSelectedService(undefined);
      setSelectedServices([]);
    }
  }, [establishment?.id, establishment?.services_with_prices, serviceCategories.length]);

  // ✅ CORRIGIDO: Ativar categorias automaticamente quando houver categorias cadastradas
  useEffect(() => {
    if (serviceCategories.length > 0 && !useCategoryService) {
      setUseCategoryService(true);
      setUseMultiService(false);
      console.log('✅ Categorias detectadas, ativando modo categorias automaticamente');
    }
  }, [serviceCategories.length]);

  // ✅ NOVO: Auto-selecionar categoria única quando categorias são carregadas e profissional já está selecionado
  useEffect(() => {
    if (selectedProfessional && serviceCategories.length === 1 && !selectedCategory) {
      const singleCategory = serviceCategories[0];
      setUseCategoryService(true);
      setUseMultiService(false);
      setSelectedCategory(singleCategory.id);
      console.log('✅ Auto-selecionando categoria única após carregar:', singleCategory.name);
    }
  }, [serviceCategories, selectedProfessional, selectedCategory]);
  const [isLoading, setIsLoading] = useState(false);

  const availableBookingProducts = (bookingHighlightedProducts || []).filter((product: any) => {
    const highlighted = Boolean(product?.highlight_for_client_booking);
    const stock = Number(product?.stock_quantity ?? 0);
    const hasStock = !Number.isFinite(stock) || stock > 0;
    return highlighted && hasStock;
  });

  const selectedBookingProducts = availableBookingProducts.filter((product: any) =>
    selectedBookingProductIds.includes(String(product?.id || ''))
  );

  useEffect(() => {
    const validIds = new Set(availableBookingProducts.map((product: any) => String(product?.id || '')));
    setSelectedBookingProductIds((previous) => previous.filter((id) => validIds.has(String(id))));
  }, [bookingHighlightedProducts, availableBookingProducts.length]);

  const normalizeCupom = (raw: string) =>
    String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  // Valor base atual (sem cupom), para recalcular UI e payload
  const getPrecoBaseAtual = () => {
    if (isSubscriberBooking && subscriberService) return getResolvedSubscriberExtraPrice();
    if (useMultiService) {
      return (selectedServices || []).reduce((sum, s) => sum + (Number((s as any)?.price) || 0), 0);
    }
    if (useCategoryService) {
      const specificSum = (selectedProfessionalSpecificServices || []).reduce(
        (sum, s) => sum + (Number((s as any)?.price) || 0),
        0
      );
      if (useMultiCategoryService) {
        const categorySum = (selectedCategoryServices || []).reduce((sum, s: any) => sum + (Number(s?.price) || 0), 0);
        return specificSum + categorySum;
      }
      const singleCategoryPrice = Number((selectedSubcategory as any)?.price) || 0;
      return specificSum + singleCategoryPrice;
    }
    return Number((selectedService as any)?.price) || 0;
  };

  const precoBaseAtual = getPrecoBaseAtual();
  const descontoPercent = cupomAplicado ? Number(cupomAplicado.percent) || 0 : 0;
  const descontoValorAtual = cupomAplicado ? round2((precoBaseAtual * descontoPercent) / 100) : 0;
  const precoFinalAtual = cupomAplicado ? Math.max(0, round2(precoBaseAtual - descontoValorAtual)) : precoBaseAtual;
  const bookingProductsTotal = round2(
    selectedBookingProducts.reduce((sum: number, product: any) => sum + (Number(product?.sale_price) || 0), 0)
  );
  const precoFinalComProdutos = round2(precoFinalAtual + bookingProductsTotal);

  const aplicarCupom = async () => {
    if (!establishment?.id) return;
    if (isSubscriberBooking) return;

    const code = normalizeCupom(cupomInput);
    if (!code) {
      toast.error('Digite um cupom (ex: NEY1)');
      return;
    }
    setIsApplyingCupom(true);
    try {
      const { data, error } = await supabase.rpc('validate_discount_coupon', {
        p_establishment_id: establishment.id,
        p_code: code,
      });
      if (error) {
        console.error('❌ Erro ao validar cupom:', error);
        toast.error(error.message || 'Erro ao validar cupom');
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const valid = Boolean(row?.valid);
      const percent = Number(row?.discount_percent);
      if (!valid || !Number.isFinite(percent) || percent <= 0) {
        toast.error('Cupom inválido ou inativo');
        setCupomAplicado(null);
        return;
      }
      setCupomAplicado({ code, percent });
      setCupomInput(code);
      toast.success(`Cupom aplicado: -${percent}%`);
    } catch (e: any) {
      console.error('❌ Erro inesperado ao aplicar cupom:', e);
      toast.error(e?.message || 'Erro ao aplicar cupom');
    } finally {
      setIsApplyingCupom(false);
    }
  };


  // ✅ FUNÇÃO PARA COMBINAR SERVIÇOS GERAIS COM SERVIÇOS ESPECÍFICOS DO PROFISSIONAL
  const getCombinedServices = () => {
    const generalServices = establishment?.services_with_prices || [];

    if (!selectedProfessional) {
      return generalServices;
    }

    // Buscar serviços específicos do profissional selecionado
    const professional = establishment?.professionals?.find(p => p.id === selectedProfessional.id);

    // ✅ Compat: aceita formatos legados de serviços específicos (name/service_name, id opcional)
    const specificServices = professional && (professional as any).specific_services
      ? (Array.isArray((professional as any).specific_services)
        ? (professional as any).specific_services
          .map((s: any, index: number) =>
            normalizeSpecificService(
              s,
              `${String(selectedProfessional?.id || 'prof')}-${index}-${String(s?.name || s?.service_name || '')}`
            )
          )
          .filter(Boolean)
        : [])
      : [];

    console.log('🔧 DEBUG getCombinedServices:', {
      professionalId: selectedProfessional.id,
      professionalName: professional?.name,
      specificServicesCount: specificServices.length,
      specificServices: specificServices,
      generalServicesCount: generalServices.length
    });

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

  const normalizeSpecificService = (raw: any, fallbackKey: string): Service | null => {
    const name = String(raw?.name || raw?.service_name || '').trim();
    const price = Number(raw?.price ?? raw?.service_price ?? 0);
    const duration = Number(raw?.duration ?? raw?.service_duration_minutes ?? 0);
    const rawId = String(raw?.id || raw?.service_id || '').trim();

    if (!name || !Number.isFinite(price) || price <= 0) return null;

    return {
      id: rawId || `specific-generated-${fallbackKey}`,
      name,
      price,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 30,
    };
  };

  const parseExcludedProfessionalIds = (raw: any): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((id: any) => String(id || '').trim())
      .filter(Boolean);
  };

  const isCategoryBlockedForSelectedProfessional = (category: any): boolean => {
    const selectedProfessionalId = String(selectedProfessional?.id || '').trim();
    if (!selectedProfessionalId) return false;
    const excludedIds = parseExcludedProfessionalIds((category as any)?.excluded_professional_ids);
    return excludedIds.includes(selectedProfessionalId);
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
  const [showNormalSubscriberConfirm, setShowNormalSubscriberConfirm] = useState(false);

  // Se mudou o assinante detectado ou sumiu a notificação, resetar confirmação
  useEffect(() => {
    setShowNormalSubscriberConfirm(false);
  }, [detectedSubscriber, showSubscriberNotification]);

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
  const [pendingClientBookingError, setPendingClientBookingError] = useState<string | null>(null);

  // Estados para validação de limite mensal
  const [monthlyLimitValidationDisabled, setMonthlyLimitValidationDisabled] = useState(false);

  // ✅ NOVO: Sistema de steps tipo quiz
  const [currentStep, setCurrentStep] = useState(1); // 1: Profissional, 2: Serviço, 3: Dia, 4: Horário, 5: Pagamento

  // Modo controlado opcional de etapa (fallback total para o modo interno atual).
  useEffect(() => {
    if (typeof externalCurrentStep !== 'number') return;
    if (externalCurrentStep < 1 || externalCurrentStep > 5) return;
    if (externalCurrentStep !== currentStep) {
      setCurrentStep(externalCurrentStep);
    }
  }, [externalCurrentStep, currentStep]);

  useEffect(() => {
    if (onExternalCurrentStepChange) {
      onExternalCurrentStepChange(currentStep);
    }
  }, [currentStep, onExternalCurrentStepChange]);

  // Auto-selecionar profissional para assinantes se houver apenas um ou se o serviço de assinante tiver profissional definido
  useEffect(() => {
    if (isSubscriberBooking && !selectedProfessional && establishment.professionals) {
      // Se há apenas um profissional, selecionar automaticamente
      if (establishment.professionals.length === 1) {
        console.log('🔄 Auto-selecionando único profissional para assinante:', establishment.professionals[0]);
        setSelectedProfessional(establishment.professionals[0]);
      }
      // Se o serviço de assinante tem um profissional específico, usar ele
      else if (subscriberService?.professional_id) {
        const prof = establishment.professionals.find(p => p.id === subscriberService.professional_id);
        if (prof) {
          console.log('🔄 Auto-selecionando profissional do serviço de assinante:', prof);
          setSelectedProfessional(prof);
        }
      }
    }
  }, [isSubscriberBooking, subscriberService, establishment.professionals, selectedProfessional]);

  const [monthlyLimitError, setMonthlyLimitError] = useState<string | null>(null);
  const [monthlyLimitData, setMonthlyLimitData] = useState<{
    currentUsage: number;
    monthlyLimit: number | null;
    subscriptionName: string;
  } | null>(null);
  const isServiceSpecificLimitError = /limite do servi[cç]o/i.test(String(monthlyLimitError || ''));
  const [isValidatingOneWeek, setIsValidatingOneWeek] = useState(false);
  const [isValidatingPendingClientBooking, setIsValidatingPendingClientBooking] = useState(false);

  function getResolvedSubscriberDuration(): number {
    const raw = (subscriberService as any)?.service_duration ?? (subscriberService as any)?.duration;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  function getResolvedSubscriberExtraDuration(): number {
    return (subscriberExtraServices || []).reduce(
      (sum, service) => sum + (Number((service as any)?.duration) || 0),
      0
    );
  }

  function getResolvedSubscriberExtraPrice(): number {
    return (subscriberExtraServices || []).reduce(
      (sum, service) => sum + (Number((service as any)?.price) || 0),
      0
    );
  }

  function getSubscriberServiceLabelForPayload(): string {
    const baseName = String((subscriberService as any)?.booking_service_name || (subscriberService as any)?.name || '').trim();
    const extraNames = (subscriberExtraServices || [])
      .map((service: any) => String(service?.name || '').trim())
      .filter(Boolean);
    if (extraNames.length === 0) return baseName;
    return `${baseName} + Extra: ${extraNames.join(' + ')}`;
  }

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
      const limitCheck = await checkMonthlyLimit(
        clientWhatsapp,
        establishment.id,
        selectedDate,
        isSubscriberBooking
          ? {
            id: String((subscriberService as any)?.service_id || (subscriberService as any)?.id || '').trim() || null,
            name: String((subscriberService as any)?.name || '').trim() || null,
            limit: Number((subscriberService as any)?.service_limit || 0) || null,
          }
          : undefined
      );
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

  const validatePendingClientBookingDate = async () => {
    if (!clientWhatsapp || !establishment?.id) {
      setPendingClientBookingError(null);
      return;
    }

    setIsValidatingPendingClientBooking(true);
    setPendingClientBookingError(null);

    try {
      const validation = await validatePendingClientBookingLimit(
        clientWhatsapp,
        establishment.id,
        Boolean(establishment?.limit_client_pending_booking)
      );

      if (!validation.canBook) {
        setPendingClientBookingError(validation.message || 'Voce ainda tem servico pendente nesta barbearia.');
      } else {
        setPendingClientBookingError(null);
      }
    } catch (error) {
      console.error('Erro ao validar bloqueio de cliente por pendencia:', error);
      setPendingClientBookingError(null);
    } finally {
      setIsValidatingPendingClientBooking(false);
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
      validatePendingClientBookingDate();
      validateMonthlyLimit(); // Nova validação de limite mensal
    } else {
      console.log('🔄 DEBUG - Condições não atendidas para executar validações');
    }
  }, [selectedDate, clientWhatsapp, establishment?.id, isSubscriberBooking, establishment?.limit_client_pending_booking]);

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
            const paymentStatus = String((newSubscriberData as any)?.payment_status || '').toLowerCase().trim();
            const isPending = paymentStatus === 'unpaid';
            // Verificar se o assinante está vencido (não confundir com pendente)
            const isExpired = Boolean(newSubscriberData.is_expired) || (new Date(newSubscriberData.end_date) < new Date());

            if (isExpired) {
              console.log('⚠️ Assinante vencido detectado:', newSubscriberData);
              setDetectedSubscriber({
                ...newSubscriberData,
                is_expired: true,
                expiration_message: newSubscriberData.expiration_message ||
                  `Seu plano venceu em ${new Date(newSubscriberData.end_date).toLocaleDateString('pt-BR')}. Renove para continuar agendando.`
              });
              setShowSubscriberNotification(true);
            } else if (isPending) {
              setDetectedSubscriber({
                ...newSubscriberData,
                payment_status: 'unpaid',
                is_pending: true,
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
              const paymentStatus = String((oldSubscriberData as any)?.payment_status || '').toLowerCase().trim();
              const isPending = paymentStatus === 'unpaid';
              // Verificar se o assinante está vencido (não confundir com pendente)
              const isExpired = (new Date(oldSubscriberData.end_date) < new Date());

              if (isExpired) {
                console.log('⚠️ Assinante vencido detectado (sistema antigo):', oldSubscriberData);
                setDetectedSubscriber({
                  ...oldSubscriberData,
                  is_expired: true,
                  expiration_message: `Seu plano venceu em ${new Date(oldSubscriberData.end_date).toLocaleDateString('pt-BR')}. Renove para continuar agendando.`
                });
              } else if (isPending) {
                setDetectedSubscriber({
                  ...oldSubscriberData,
                  payment_status: 'unpaid',
                  is_pending: true,
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

  // ✅ MODIFICADO: Verificar se há serviços gerais OU serviços específicos do PROFISSIONAL SELECIONADO
  // Se o estabelecimento já usa categorias ativas, não cair no layout legado.
  const hasConfiguredCategories = serviceCategories.length > 0;
  const visibleLegacyServicesForSelectedProfessional = hasConfiguredCategories ? [] : (establishment.services_with_prices || []);
  const visibleServiceCategories = serviceCategories
    .map((category: any) => ({
      ...category,
      subcategories: category?.subcategories || [],
    }))
    .filter((category: any) => !isCategoryBlockedForSelectedProfessional(category) && (category?.subcategories || []).length > 0);

  useEffect(() => {
    if (selectedCategory && !visibleServiceCategories.some((category: any) => category.id === selectedCategory)) {
      setSelectedCategory(undefined);
      setSelectedSubcategory(undefined);
      setSelectedCategoryServices([]);
    }
  }, [selectedProfessional?.id, serviceCategories]);

  const hasGeneralServices = visibleLegacyServicesForSelectedProfessional.length > 0;

  // Verificar serviços específicos apenas do profissional selecionado
  const selectedProfessionalData = selectedProfessional
    ? establishment.professionals?.find(p => p.id === selectedProfessional.id)
    : null;

  const normalizedSpecificServicesForSelectedProfessional: Service[] = selectedProfessionalData
    ? (Array.isArray((selectedProfessionalData as any).specific_services)
      ? (selectedProfessionalData as any).specific_services
        .map((s: any, index: number) =>
          normalizeSpecificService(
            s,
            `${String((selectedProfessionalData as any)?.id || selectedProfessional?.id || 'prof')}-${index}-${String(s?.name || s?.service_name || '')}`
          )
        )
        .filter(Boolean)
      : [])
    : [];

  const hasSpecificServices = normalizedSpecificServicesForSelectedProfessional.length > 0;

  // ✅ Serviços específicos disponíveis do profissional selecionado (para o booking)
  const professionalSpecificServicesForBooking: Service[] = hasSpecificServices && selectedProfessionalData
    ? normalizedSpecificServicesForSelectedProfessional
      .map((s: Service) => ({
        id: `specific-${s.id}`,
        name: `${s.name} (${(selectedProfessionalData as any)?.name || selectedProfessional?.name || 'Profissional'})`,
        price: Number(s.price) || 0,
        duration: Number(s.duration) || 0
      }))
    : [];

  // ✅ Controlar quais botões/tabs aparecem (categoria só se existir)
  const hasCategoryTab = visibleServiceCategories.length > 0;
  const hasProfessionalTab = professionalSpecificServicesForBooking.length > 0;
  const hasAnyTab = hasCategoryTab || hasProfessionalTab;

  // ✅ Garantir que o tab selecionado é válido e o modo não “força categoria” quando não existe
  useEffect(() => {
    if (!hasAnyTab) {
      // Sem tabs (sem categorias e sem serviço específico): cair no modo normal
      setUseCategoryService(false);
      setUseMultiService(true);
      return;
    }

    // Com tabs: usar o bloco de tabs
    setUseCategoryService(true);
    setUseMultiService(false);

    // Se o usuário está no tab de categoria mas não existe categoria, jogar pro profissional
    if (serviceTab === 'category' && !hasCategoryTab && hasProfessionalTab) {
      setServiceTab('professional');
    }
    // Se o usuário está no tab profissional mas não existe serviço específico, jogar pra categoria
    if (serviceTab === 'professional' && !hasProfessionalTab && hasCategoryTab) {
      setServiceTab('category');
    }
  }, [hasAnyTab, hasCategoryTab, hasProfessionalTab, serviceTab]);

  console.log('🔧 DEBUG hasSpecificServices:', {
    selectedProfessionalId: selectedProfessional?.id,
    selectedProfessionalName: selectedProfessional?.name,
    hasSpecificServices,
    hasGeneralServices,
    specificServices: selectedProfessionalData ? (selectedProfessionalData as any).specific_services : null,
    generalServicesCount: visibleLegacyServicesForSelectedProfessional.length
  });

  // ✅ CORRIGIDO: Mostrar botão "Escolha 1 ou mais serviços" APENAS se houver serviços específicos
  // Se não houver serviços específicos, mostrar apenas "SERVIÇOS EM CATEGORIA"
  const shouldShowMultiServiceButton = hasSpecificServices; // Apenas serviços específicos

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
          const totalSelected = (selectedCategoryServices?.length || 0) + (selectedProfessionalSpecificServices?.length || 0);
          if (totalSelected === 0) {
            missingFields.push('pelo menos um serviço');
          }
        } else {
          const totalSelected = (selectedProfessionalSpecificServices?.length || 0) + (selectedSubcategory ? 1 : 0);
          if (totalSelected === 0) {
            missingFields.push('pelo menos um serviço');
          }
        }
      } else {
        if (!selectedService) {
          missingFields.push('serviço');
        }
      }

      // Se for pagamento antecipado, a forma de pagamento será escolhida no PaymentModal (Pagar.me)
      if (!requireAdvancePayment) {
        if (!selectedPaymentMethod) {
          missingFields.push('forma de pagamento');
        }
      }

      // ✅ Bloquear caso o cliente tente agendar apenas serviço(s) sem tempo (0 min)
      // Regra: precisa ter pelo menos 5 minutos no total para seguir (0 min só pode ser extra junto com outro)
      const duracaoSelecionada = (() => {
        if (useMultiService) {
          return (selectedServices || []).reduce((sum, s) => sum + (Number((s as any)?.duration) || 0), 0);
        }
        if (useCategoryService) {
          const specificDur = (selectedProfessionalSpecificServices || []).reduce(
            (sum, s) => sum + (Number((s as any)?.duration) || 0),
            0
          );
          if (useMultiCategoryService) {
            const categoryDur = (selectedCategoryServices || []).reduce((sum, s: any) => sum + (Number(s?.duration) || 0), 0);
            return specificDur + categoryDur;
          }
          const singleDur = Number((selectedSubcategory as any)?.duration) || 0;
          return specificDur + singleDur;
        }
        return Number((selectedService as any)?.duration) || 0;
      })();

      if (duracaoSelecionada < 5) {
        toast.error(
          'Esse serviço não adiciona tempo. Para agendar, selecione outro serviço junto (mínimo 5 minutos).'
        );
        return;
      }
    }

    if (!selectedProfessional) {
      missingFields.push('profissional');
    }

    if (!selectedTime) {
      missingFields.push('horário');
    }

    if (selectedTime && isTimeInsideAdvanceWindow(selectedTime)) {
      const minHours = getMinimumAdvanceHours();
      const hourLabel = minHours === 1 ? '1 hora' : `${minHours} horas`;
      toast.error(`Voce esta em cima da hora para agendar. Tente um horario mais a frente (minimo de ${hourLabel} de antecedencia).`);
      return;
    }

    if (selectedTime && isSelectedTimeInsideProfessionalBreak()) {
      toast.error('Esse horario cai dentro do intervalo do profissional. Escolha outro horario.');
      return;
    }

    // Validação obrigatória do serviço infantil (só se profissional oferece)
    if (selectedProfessional && selectedProfessional.offers_child_service && isChildService === null) {
      missingFields.push('informação se é serviço infantil');
    }

    // Validação específica para PIX (somente no fluxo antigo, sem pagamento antecipado)
    if (!requireAdvancePayment) {
      if (selectedPaymentMethod === 'pix' && pixPaymentMethod === 'pix_now' && !pixProofUrl) {
        missingFields.push('comprovante do PIX');
      }
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

    if (pendingClientBookingError) {
      console.log('❌ Agendamento bloqueado por pendencia de atendimento:', pendingClientBookingError);
      setTimeout(() => {
        const errorElement = document.querySelector('[data-pending-client-booking-error]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    const normalizeWhatsappForStorage = (raw: string) => {
      const digits = String(raw || '').replace(/\D/g, '');
      if (!digits) return '';

      // Se veio com "55" duplicado antes de outro DDI (ex: 5554...), remove o primeiro 55
      if (digits.startsWith('55') && digits.length >= 4) {
        const after = digits.slice(2);
        const known = [
          { code: '351', minLength: 12 },
          { code: '244', minLength: 12 },
          { code: '54', minLength: 12 },
          { code: '56', minLength: 11 },
          { code: '55', minLength: 12 },
          { code: '34', minLength: 11 },
          { code: '1', minLength: 11 },
        ];
        const hasOtherCountryCode = known.some(({ code, minLength }) => after.startsWith(code) && after.length >= minLength);
        if (hasOtherCountryCode) return after;
      }

      // Se já tem DDI válido, mantém
      const known = [
        { code: '351', minLength: 12 },
        { code: '244', minLength: 12 },
        { code: '54', minLength: 12 },
        { code: '56', minLength: 11 },
        { code: '55', minLength: 12 },
        { code: '34', minLength: 11 },
        { code: '1', minLength: 11 },
      ];
      const hasCountryCode = known.some(({ code, minLength }) => digits.startsWith(code) && digits.length >= minLength);
      if (hasCountryCode) return digits;

      // Senão, assume BR e adiciona 55 (para 10/11 dígitos)
      if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
      return digits;
    };

    const whatsappNumbers = normalizeWhatsappForStorage(clientWhatsapp);

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
        const categorySelected = useMultiCategoryService
          ? (selectedCategoryServices || [])
          : (selectedSubcategory ? [selectedSubcategory] : []);
        servicesToUse = [...(selectedProfessionalSpecificServices || []), ...categorySelected];
        totalPrice = (servicesToUse || []).reduce((sum: number, service: any) => sum + (Number(service?.price) || 0), 0);
        totalDuration = (servicesToUse || []).reduce((sum: number, service: any) => sum + (Number(service?.duration) || 0), 0);
        serviceNames = (servicesToUse || []).map((service: any) => service?.name).filter(Boolean).join(' + ');
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

      const subscriberExtraPrice = getResolvedSubscriberExtraPrice();
      const subscriberBaseDuration = getResolvedSubscriberDuration();
      const subscriberExtraDuration = getResolvedSubscriberExtraDuration();
      const subscriberTotalDuration = subscriberBaseDuration + subscriberExtraDuration;
      const basePrice = isSubscriberBooking && subscriberService ? subscriberExtraPrice : Number(totalPrice || 0);
      const appliedPercent = cupomAplicado ? Number(cupomAplicado.percent) || 0 : 0;
      const discountAmount = cupomAplicado ? round2((basePrice * appliedPercent) / 100) : 0;
      const finalPrice = cupomAplicado ? Math.max(0, round2(basePrice - discountAmount)) : basePrice;
      const selectedBookingProductsForPayload = selectedBookingProducts.map((product: any) => ({
        product_id: String(product?.id || '').trim(),
        name: String(product?.name || '').trim() || 'Produto',
        price: Number(product?.sale_price || 0),
        duration: 0,
        quantity: 1,
        item_type: 'booking_product',
      })).filter((item: any) => item.product_id && Number.isFinite(item.price) && item.price > 0);
      // Em agendamentos de assinante, salvar extras também em additional_products (preço zero),
      // para a duração ficar consistente na agenda mesmo quando houver variação de fluxo/UI.
      const subscriberExtraProductsForPayload = isSubscriberBooking
        ? (subscriberExtraServices || [])
          .map((service: any) => ({
            product_id: `subscriber_extra_${String(service?.id || '').trim() || String(service?.name || '').trim()}`,
            name: `Extra assinatura: ${String(service?.name || '').trim() || 'Servico extra'}`,
            price: 0,
            duration: Number((service as any)?.duration || 0),
            quantity: 1,
            item_type: 'subscriber_extra',
          }))
          .filter((item: any) => {
            const hasId = String(item.product_id || '').trim().length > 0;
            const hasDuration = Number.isFinite(Number(item.duration)) && Number(item.duration) > 0;
            return hasId && hasDuration;
          })
        : [];
      const combinedAdditionalProducts =
        [...selectedBookingProductsForPayload, ...subscriberExtraProductsForPayload];
      const bookingProductsTotalForPayload = round2(
        selectedBookingProductsForPayload.reduce((sum: number, item: any) => sum + (Number(item?.price) || 0), 0)
      );
      const finalPriceWithProducts = round2(finalPrice + bookingProductsTotalForPayload);

      const appointmentData = {
        client_name: isSubscriberBooking ? `${clientName} (ASSINANTE)` : clientName, // Adicionar (ASSINANTE) apenas no envio
        client_whatsapp: whatsappNumbers,
        client_cpf: establishment?.require_cpf && clientCpf ? clientCpf.replace(/\D/g, '') : null, // Adicionar CPF se solicitado
        service: isSubscriberBooking && subscriberService
          ? getSubscriberServiceLabelForPayload()
          : serviceNames,
        professional: selectedProfessional?.id || '',
        appointment_date: formattedDate,
        appointment_time: selectedTime,
        duration: isSubscriberBooking && subscriberService ? subscriberTotalDuration : totalDuration, // Duração assinatura + extras
        price_original: cupomAplicado ? basePrice : null,
        coupon_code: cupomAplicado ? cupomAplicado.code : null,
        coupon_discount_percent: cupomAplicado ? appliedPercent : null,
        coupon_discount_amount: cupomAplicado ? discountAmount : null,
        price: isSubscriberBooking && subscriberService ? subscriberExtraPrice : finalPrice, // Assinatura grátis, cobra só extras/serviço
        total_price: finalPriceWithProducts,
        additional_products: combinedAdditionalProducts.length > 0 ? combinedAdditionalProducts : null,
        payment_method: isSubscriberBooking ? 'assinante' : (requireAdvancePayment ? 'pendente' : selectedPaymentMethod),
        observation: observation.trim() || null, // Adicionar observação (null se vazia)
        is_child_service: isChildService === true, // Adicionar serviço infantil (garantir boolean)
        is_subscriber: isSubscriberBooking, // Adicionar flag de assinante
        subscription_id: isSubscriberBooking
          ? String((subscriberService as any)?.subscription_id || (subscriberService as any)?.id || '').trim() || null
          : null,
        subscriber_service_id: isSubscriberBooking
          ? String((subscriberService as any)?.service_id || '').trim() || null
          : null,
        subscriber_service_name: isSubscriberBooking
          ? String((subscriberService as any)?.name || '').trim() || null
          : null,
        subscriber_service_limit: isSubscriberBooking
          ? Number((subscriberService as any)?.service_limit || 0) || null
          : null
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
  // Compatibilidade (dados legados): alguns estabelecimentos antigos podem ter
  // profissional salvo como id, professional_id ou até nome.
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const selectedProfessionalIdNorm = norm(selectedProfessional?.id);
  const selectedProfessionalNameNorm = norm((selectedProfessional as any)?.name);

  const filteredExistingAppointments = selectedProfessional
    ? existingAppointments.filter((app: any) => {
      const appDateStr = app?.appointment_date == null ? '' : String(app.appointment_date).slice(0, 10);
      if (appDateStr !== selectedDateStr) return false;

      const appProfessionalNorm = norm(app?.professional);
      const appProfessionalIdNorm = norm(app?.professional_id);
      const appProfessionalNameNorm = norm(app?.professional_name);

      const matchesById =
        appProfessionalNorm === selectedProfessionalIdNorm ||
        appProfessionalIdNorm === selectedProfessionalIdNorm;

      const matchesByName =
        selectedProfessionalNameNorm.length > 0 &&
        (
          appProfessionalNorm === selectedProfessionalNameNorm ||
          appProfessionalNameNorm === selectedProfessionalNameNorm
        );

      return matchesById || matchesByName;
    })
    : [];



  // Função para calcular o progresso
  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  // Função para verificar se pode avançar para o próximo step
  const canGoToNextStep = () => {
    switch (currentStep) {
      case 1: // Profissional
        return !!selectedProfessional;
      case 2: // Serviço
        return !!(
          selectedService ||
          selectedServices.length > 0 ||
          selectedCategoryServices.length > 0 ||
          selectedProfessionalSpecificServices.length > 0 ||
          Boolean(selectedSubcategory) ||
          (isSubscriberBooking && subscriberService)
        );
      case 3: // Dia
        return hasSelectedDate;
      case 4: // Horário
        return !!selectedTime;
      case 5: // Pagamento
        return !!(selectedPaymentMethod || isSubscriberBooking);
      default:
        return false;
    }
  };

  const getDuracaoTotalServicosSelecionados = (): number => {
    if (isSubscriberBooking) return getResolvedSubscriberDuration() + getResolvedSubscriberExtraDuration();
    // multi-serviço (lista)
    if (useMultiService) {
      return (selectedServices || []).reduce((sum, s) => sum + (Number((s as any)?.duration) || 0), 0);
    }
    // categorias
    if (useCategoryService) {
      const specificDur = (selectedProfessionalSpecificServices || []).reduce(
        (sum, s) => sum + (Number((s as any)?.duration) || 0),
        0
      );
      if (useMultiCategoryService) {
        const categoryDur = (selectedCategoryServices || []).reduce((sum, s: any) => sum + (Number(s?.duration) || 0), 0);
        return specificDur + categoryDur;
      }
      return specificDur + (Number((selectedSubcategory as any)?.duration) || 0);
    }
    // serviço único
    return Number((selectedService as any)?.duration) || 0;
  };

  const bloquearServicoSemTempo = (): boolean => {
    // Regra: serviço de 0 min pode existir, mas NÃO pode ser agendado sozinho.
    // Para avançar, a duração total precisa ser pelo menos 5 min.
    if (isSubscriberBooking) return false;
    const totalDuracao = getDuracaoTotalServicosSelecionados();
    if (totalDuracao >= 5) return false;

    // Só exibir se realmente existe seleção de serviço
    const temServicoSelecionado =
      Boolean(selectedService) ||
      (selectedServices && selectedServices.length > 0) ||
      (selectedCategoryServices && selectedCategoryServices.length > 0) ||
      (selectedProfessionalSpecificServices && selectedProfessionalSpecificServices.length > 0) ||
      Boolean(selectedSubcategory);

    if (!temServicoSelecionado) return false;

    toast.error(
      'Esse serviço não adiciona tempo. Para agendar, selecione outro serviço junto (mínimo 5 minutos).'
    );
    return true;
  };

  // Função para avançar para o próximo step
  const goToNextStep = () => {
    if (currentStep === 2 && bloquearServicoSemTempo()) return;
    if (canGoToNextStep() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      // Não fazer scroll - deixar o usuário continuar descendo naturalmente
    }
  };

  // Função para voltar ao step anterior
  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      // Não fazer scroll - deixar o usuário continuar descendo naturalmente
    }
  };

  return (
    <div className="space-y-6">
      {/* CSS para animação de vibração do serviço infantil */}
      <style>
        {`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
          .shake-animation {
            animation: shake 0.5s ease-in-out infinite;
          }
        `}
      </style>

      {/* Barra de Progresso */}
      <div className="w-full bg-white/10 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-[#e6d7b1] to-[#d9c08c] h-3 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="text-center text-sm text-white/70 mb-4">
        Etapa {currentStep} de {totalSteps}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-black/30 p-6 rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        {/* 1. NOME DO CLIENTE */}
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-2">
            {isEstablishmentOwner ? '1. Nome do Cliente (Reserva pelo Estabelecimento)' : '1. Nome do Cliente'}
            {isNewClientUser && !isEstablishmentOwner && (
              <span className="text-xs text-white/50 ml-2">(Dados fixos do cadastro)</span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={`flex-1 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e6d7b1]/30 focus:border-[#e6d7b1]/40 ${isNewClientUser && !isEstablishmentOwner ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              placeholder="Digite seu nome"
              required
              readOnly={isNewClientUser && !isEstablishmentOwner}
            />
            <button
              type="button"
              onClick={forceUpdateUserData}
              disabled={isLoadingUserData}
              className="px-3 py-2 bg-white/10 text-white rounded-xl hover:bg-white/15 disabled:opacity-50 text-sm font-semibold border border-white/10"
              title="Atualizar dados do usuário"
            >
              {isLoadingUserData ? '...' : '🔄'}
            </button>
          </div>
          {user && clientName && (
            <p className="mt-1 text-sm text-[#e6d7b1] italic">
              Esse é seu nome?
            </p>
          )}
          {isSubscriberBooking && (
            <p className="mt-1 text-sm text-emerald-300 font-semibold">
              📌 O sufixo "(ASSINANTE)" é fixo para identificação do estabelecimento
            </p>
          )}
          {isEstablishmentOwner && (
            <p className="mt-1 text-sm text-white/60">
              Você está fazendo uma reserva como estabelecimento para um cliente.
            </p>
          )}
        </div>

        {/* 2. WHATSAPP */}
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-white/70" />
              <span>2. WhatsApp</span>
              {isNewClientUser && !isEstablishmentOwner && (
                <span className="text-xs text-white/50 ml-2">(Dados fixos do cadastro)</span>
              )}
            </div>
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={clientWhatsapp}
              onChange={handleWhatsappChange}
              className={`flex-1 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e6d7b1]/30 focus:border-[#e6d7b1]/40 ${isNewClientUser && !isEstablishmentOwner ? 'opacity-60 cursor-not-allowed' : ''
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
              className="px-3 py-2 bg-white/10 text-white rounded-xl hover:bg-white/15 disabled:opacity-50 text-sm font-semibold border border-white/10"
              title="Atualizar dados do usuário"
            >
              {isLoadingUserData ? '...' : '🔄'}
            </button>
          </div>
          {user && clientWhatsapp && (
            <p className="mt-1 text-sm text-[#e6d7b1] italic">
              Esse é seu WhatsApp?
            </p>
          )}
        </div>

        {/* 3. CPF (Condicional - Só aparece se o estabelecimento solicitar) */}
        {establishment?.require_cpf && !isSubscriberBooking && (
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">
              <div className="flex items-center gap-2">
                <span>3. CPF</span>
                <span className="text-red-300 font-extrabold">*</span>
              </div>
            </label>
            <input
              type="text"
              value={clientCpf}
              onChange={handleCpfChange}
              className="w-full px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e6d7b1]/30 focus:border-[#e6d7b1]/40"
              placeholder="000.000.000-00"
              required
              maxLength={14}
            />
            <p className="mt-1 text-xs text-white/55 italic">
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
                className={`mt-3 p-4 rounded-2xl border ${detectedSubscriber.is_expired
                  ? 'bg-red-500/10 border-red-500/25'
                  : 'bg-emerald-500/10 border-emerald-400/25'
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
                    ? 'bg-red-400'
                    : (String((detectedSubscriber as any)?.payment_status || '').toLowerCase() === 'unpaid' || (detectedSubscriber as any)?.is_pending)
                      ? 'bg-yellow-400 animate-pulse'
                      : 'bg-emerald-400 animate-pulse'
                    }`}></div>
                  <span className={`text-sm font-medium ${detectedSubscriber.is_expired
                    ? 'text-red-200'
                    : (String((detectedSubscriber as any)?.payment_status || '').toLowerCase() === 'unpaid' || (detectedSubscriber as any)?.is_pending)
                      ? 'text-yellow-200'
                      : 'text-emerald-200'
                    }`}>
                    {detectedSubscriber.is_expired
                      ? '⚠️ Plano Vencido Detectado!'
                      : (String((detectedSubscriber as any)?.payment_status || '').toLowerCase() === 'unpaid' || (detectedSubscriber as any)?.is_pending)
                        ? '⏳ Assinatura pendente'
                        : '🎯 Assinante detectado automaticamente!'}
                  </span>
                </div>

                <p className={`text-sm mt-1 ${detectedSubscriber.is_expired
                  ? 'text-red-200/90'
                  : 'text-emerald-200/90'
                  }`}>
                  <strong>Plano:</strong> {detectedSubscriber.subscription_name || 'Plano não identificado'}
                </p>

                <p className={`text-sm ${detectedSubscriber.is_expired
                  ? 'text-red-200/90'
                  : 'text-emerald-200/90'
                  }`}>
                  <strong>Válido até:</strong> {format(new Date(detectedSubscriber.end_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>

                {detectedSubscriber.is_expired && (
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl">
                    <p className="text-sm text-red-200 font-medium">
                      {detectedSubscriber.expiration_message || 'Seu plano venceu. Renove para continuar agendando.'}
                    </p>
                  </div>
                )}

                {!detectedSubscriber.is_expired ? (
                  <>
                    {(String((detectedSubscriber as any)?.payment_status || '').toLowerCase() === 'unpaid' || (detectedSubscriber as any)?.is_pending) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const phone = String(establishment?.whatsapp || '').replace(/\D/g, '');
                            if (!phone) {
                              toast.error('WhatsApp não configurado para este estabelecimento');
                              return;
                            }
                            const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
                            const message = 'Ola! minha assinatura está como não paga no sistema';
                            window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
                          }}
                          className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
                        >
                          validar sistema em dia
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          setShowNormalSubscriberConfirm(false);
                          // Converter para agendamento de assinante
                          setShowSubscriberNotification(false);
                          console.log('🔄 Convertendo para agendamento de assinante:', detectedSubscriber);

                          // VALIDAR LIMITE MENSAL antes de converter
                          if (clientWhatsapp && establishment?.id) {
                            console.log('🔍 Verificando limite mensal antes de converter...');
                            const limitCheck = await checkMonthlyLimit(clientWhatsapp, establishment.id, selectedDate);

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
                        className="mt-2 px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition-colors"
                      >
                        Agendar como Assinante
                      </button>
                    )}
                    {showNormalSubscriberConfirm ? (
                      <div className="mt-3 p-3 rounded-xl border border-white/10 bg-white/5">
                        <p className="text-xs text-white/80">
                          Tem certeza que não vai usar a assinatura? Se continuar normal, será necessário pagar pelo serviço escolhido.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
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
                              setShowNormalSubscriberConfirm(false);
                              console.log('🚫 DEBUG - Detecção de assinante DESABILITADA (Continuar Normal confirmado)');
                            }}
                            className="px-3 py-1 rounded text-xs border border-gray-500/40 text-gray-200 hover:bg-white/10 transition-colors"
                          >
                            Continuar normal
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              // mesma ação do botão principal (assinante)
                              setShowNormalSubscriberConfirm(false);
                              setShowSubscriberNotification(false);
                              console.log('🔄 Convertendo para agendamento de assinante (via confirmação):', detectedSubscriber);

                              // VALIDAR LIMITE MENSAL antes de converter
                              if (clientWhatsapp && establishment?.id) {
                                console.log('🔍 Verificando limite mensal antes de converter...');
                                const limitCheck = await checkMonthlyLimit(clientWhatsapp, establishment.id, selectedDate);

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

                              if (onConvertToSubscriber) {
                                onConvertToSubscriber(detectedSubscriber);
                              }
                            }}
                            className="px-3 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            Agendar como assinante
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowNormalSubscriberConfirm(true)}
                        className="mt-2 ml-2 px-2 py-1 text-[11px] text-white/55 hover:text-white/80 underline decoration-white/20 hover:decoration-white/40 transition-colors"
                      >
                        Continuar sem assinatura
                      </button>
                    )}
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
                          if (onOpenRenewSubscription) {
                            onOpenRenewSubscription(detectedSubscriber);
                            setShowSubscriberNotification(false);
                          } else {
                            const establishmentWhatsapp = establishment?.whatsapp;
                            const subscriptionName = detectedSubscriber.subscription_name || 'Plano não identificado';
                            if (establishmentWhatsapp) {
                              const message = `Quero renovar minha assinatura: ${subscriptionName}`;
                              const whatsappUrl = `https://wa.me/${establishmentWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                              window.open(whatsappUrl, '_blank');
                            }
                            setShowSubscriberNotification(false);
                          }
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
                        ? (isServiceSpecificLimitError
                          ? '🚫 Limite deste serviço atingido. Escolha outro serviço da assinatura.'
                          : '🚫 Limite atingido! Agende como cliente normal.')
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
                  {isServiceSpecificLimitError ? (
                    <div className="space-y-2">
                      <div className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700">
                        Escolha outro serviço da assinatura que ainda tenha saldo disponível.
                      </div>
                      {onRequestChangeSubscriberService && (
                        <button
                          type="button"
                          onClick={onRequestChangeSubscriberService}
                          className="w-full px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 transition-colors"
                        >
                          🔁 Trocar serviço da assinatura
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (onOpenRenewSubscription && detectedSubscriber) {
                            onOpenRenewSubscription(detectedSubscriber);
                            setMonthlyLimitError(null);
                            setMonthlyLimitData(null);
                            setShowSubscriberNotification(false);
                            return;
                          }
                          if (!establishment?.whatsapp) {
                            alert('❌ WhatsApp do estabelecimento não está configurado. Entre em contato por telefone ou email.');
                            return;
                          }
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
                  )}
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

          {pendingClientBookingError && (
            <div
              data-pending-client-booking-error
              className="mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg shadow-lg animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-xl">🚫</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-red-800 mb-1">
                    Cliente com servico pendente
                  </h3>
                  <p className="text-sm text-red-700 leading-relaxed mb-2">
                    {pendingClientBookingError}
                  </p>
                  <div className="bg-red-100 rounded-md p-2">
                    <p className="text-xs text-red-600 font-medium">
                      Assim que o profissional marcar o atendimento como concluido, o cliente consegue agendar novamente.
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

          {isValidatingPendingClientBooking && (
            <div className="mt-3 flex items-center gap-2 text-red-600">
              <div className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
              <span className="text-sm">Verificando pendencia de atendimento no telefone...</span>
            </div>
          )}


        </div>



        {/* STEP 1: PROFISSIONAL */}
        {currentStep === 1 && (
          <div data-subscriber-professional-step>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
              1. Escolha o Profissional
            </label>
            <ProfessionalSelector
              professionals={establishment.professionals.filter((p: any) => !p.hidden_from_booking)}
              selectedProfessional={selectedProfessional?.id || null}
              onSelectProfessional={(professionalId) => {
                const professional = establishment.professionals.filter((p: any) => !p.hidden_from_booking).find(p => p.id === professionalId);

                // ✅ LIMPAR APENAS A SELEÇÃO ATUAL (não os modos)
                // Isso evita que serviços específicos de um profissional apareçam com outro
                setSelectedService(undefined);
                setSelectedServices([]);
                setSelectedSubcategory(undefined);
                setSelectedCategoryServices([]);
                setSelectedProfessionalSpecificServices([]);
                setServiceTab('category');

                setSelectedProfessional(professional || undefined);

                // ✅ NOVO: Se houver apenas 1 categoria, selecionar automaticamente
                if (professional && visibleServiceCategories.length === 1) {
                  const singleCategory = visibleServiceCategories[0];
                  setUseCategoryService(true);
                  setUseMultiService(false);
                  setSelectedCategory(singleCategory.id);
                  console.log('✅ Auto-selecionando categoria única:', singleCategory.name);
                }

                // ✅ Avançar automaticamente para a próxima etapa após selecionar profissional
                if (professional) {
                  setTimeout(() => {
                    setCurrentStep(2);
                    // Scroll automático para mostrar as categorias/serviços - DESCE, NÃO SOBE
                    setTimeout(() => {
                      const categoriesSection = document.querySelector('[data-categories-section]');
                      if (categoriesSection) {
                        const rect = categoriesSection.getBoundingClientRect();
                        const scrollPosition = window.scrollY + rect.top - 100; // 100px de margem do topo
                        window.scrollTo({
                          top: scrollPosition,
                          behavior: 'smooth'
                        });
                      } else {
                        // Scroll genérico para BAIXO
                        window.scrollBy({
                          top: 400,
                          behavior: 'smooth'
                        });
                      }
                    }, 200);
                  }, 300);
                }
              }}
              establishmentId={establishment.id || establishment.establishment_id || ''}
              establishment={establishment}
              selectedDate={selectedDate}
              showGoalProgress={false}
            />
          </div>
        )}

        {/* STEP 2: SERVIÇO - Oculto para assinantes */}
        {currentStep === 2 && !isSubscriberBooking && (
          <div data-categories-section>
            {/* Botão Voltar fixo no topo */}
            {currentStep > 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-2 rounded-xl transition-colors font-semibold hover:bg-white/5"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#A1A1A1'
                  }}
                >
                  ← Voltar
                </button>
              </div>
            )}
            <label className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
              4. Escolha o Serviço
            </label>

            {/* Toggle: SERVIÇOS EM CATEGORIA / SERVIÇO ESPECÍFICO PROFISSIONAL */}
            <div className="mb-4 flex gap-2">
              {/* Só mostrar se o profissional tiver serviço específico */}
              {professionalSpecificServicesForBooking.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setUseCategoryService(true);
                    setUseMultiService(false);
                    setServiceTab('professional');
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-extrabold transition-colors"
                  style={{
                    background: serviceTab === 'professional' ? '#E6C78B' : '#151515',
                    color: serviceTab === 'professional' ? '#0B0B0B' : '#A1A1A1',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  SERVIÇO ESPECÍFICO PROFISSIONAL
                </button>
              )}

              {/* Só mostrar SERVIÇOS EM CATEGORIA se existir pelo menos 1 categoria */}
              {visibleServiceCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setUseCategoryService(true);
                    setUseMultiService(false);
                    setServiceTab('category');
                    setSelectedService(undefined);
                    setSelectedServices([]);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-extrabold transition-colors"
                  style={{
                    background: serviceTab === 'category' ? '#E6C78B' : '#151515',
                    color: serviceTab === 'category' ? '#0B0B0B' : '#A1A1A1',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  SERVIÇOS EM CATEGORIA
                </button>
              )}
            </div>

            {/* Renderizar componente apropriado */}
            {/* ✅ CORRIGIDO: Verificar useCategoryService PRIMEIRO para evitar conflito com MultiServiceSelector */}
            {useCategoryService ? (
              <div className="space-y-4">
                {/* TAB: SERVIÇO ESPECÍFICO PROFISSIONAL */}
                {serviceTab === 'professional' && professionalSpecificServicesForBooking.length > 0 ? (
                  <div className="space-y-3">
                    <div
                      className="p-3 rounded-2xl"
                      style={{
                        background: '#151515',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <div className="text-center text-base font-extrabold" style={{ color: '#E6C78B' }}>
                        Selecione o serviço do profissional
                      </div>
                    </div>

                    <div className="space-y-3">
                      {professionalSpecificServicesForBooking.map((svc: any) => {
                        const isSelected = selectedProfessionalSpecificServices.some(s => s.id === svc.id);
                        const totalSelected = (selectedProfessionalSpecificServices?.length || 0) + (selectedCategoryServices?.length || 0);
                        const isDisabled = !isSelected && totalSelected >= 4;

                        return (
                          <div
                            key={svc.id}
                            className={`w-full p-4 rounded-2xl transition-colors ${isDisabled ? 'opacity-60' : ''}`}
                            style={{
                              background: isSelected ? 'rgba(230,199,139,0.10)' : '#151515',
                              border: `1px solid ${isSelected ? 'rgba(230,199,139,0.45)' : 'rgba(255,255,255,0.06)'}`,
                              boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                            }}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <div>
                                <h4 className="font-extrabold text-white">{svc.name}</h4>
                                <p className="text-sm" style={{ color: '#A1A1A1' }}>
                                  {svc.duration}min • R$ {Number(svc.price || 0).toFixed(2)}
                                </p>
                              </div>
                              <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center ${isSelected ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                                {isSelected ? '✓' : '+'}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedProfessionalSpecificServices(prev => prev.filter(s => s.id !== svc.id));
                                  } else if (!isDisabled) {
                                    setSelectedProfessionalSpecificServices(prev => [...prev, svc]);
                                  }
                                }}
                                disabled={isDisabled}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${isSelected
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {isSelected ? '✓ Selecionado' : 'Selecionar Serviço'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isSelected && !isDisabled) {
                                    setSelectedProfessionalSpecificServices(prev => [...prev, svc]);
                                  }
                                  setTimeout(() => {
                                    setCurrentStep(3);
                                    setTimeout(() => {
                                      window.scrollBy({
                                        top: 300,
                                        behavior: 'smooth'
                                      });
                                    }, 100);
                                  }, 300);
                                }}
                                disabled={isDisabled}
                                className={`flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  visibleServiceCategories.length === 0 ? (
                    <div className="space-y-4" data-services-section>
                      <div
                        className="p-3 rounded-2xl"
                        style={{
                          background: '#151515',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <div className="text-center text-base font-extrabold" style={{ color: '#E6C78B' }}>
                          📋 Selecione um ou mais serviços
                        </div>
                      </div>

                      <div className="space-y-3">
                        {visibleLegacyServicesForSelectedProfessional
                          .filter((s: any) => s && s.id && s.name)
                          .map((raw: any) => {
                            const svc = {
                              id: `legacy-${raw.id}`,
                              name: raw.name,
                              price: Number(raw.price) || 0,
                              duration: Number(raw.duration) || 0,
                            };

                            const isSelected = selectedCategoryServices.some((x: any) => x.id === svc.id);
                            const totalSelected = (selectedCategoryServices?.length || 0) + (selectedProfessionalSpecificServices?.length || 0);
                            const isDisabled = !isSelected && totalSelected >= 4;

                            return (
                              <div
                                key={svc.id}
                                className={`w-full p-4 rounded-2xl transition-colors ${isDisabled ? 'opacity-60' : ''}`}
                                style={{
                                  background: isSelected ? 'rgba(230,199,139,0.10)' : '#151515',
                                  border: `1px solid ${isSelected ? 'rgba(230,199,139,0.45)' : 'rgba(255,255,255,0.06)'}`,
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                                }}
                              >
                                <div className="flex justify-between items-center mb-3">
                                  <div>
                                    <h4 className="font-extrabold text-white">{svc.name}</h4>
                                    <p className="text-sm" style={{ color: '#A1A1A1' }}>
                                      {svc.duration}min • R$ {Number(svc.price || 0).toFixed(2)}
                                    </p>
                                  </div>
                                  <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center ${isSelected ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                                    {isSelected ? '✓' : '+'}
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // garantir que modo antigo não conflite
                                      setSelectedSubcategory(null);
                                      if (isSelected) {
                                        setSelectedCategoryServices(prev => prev.filter((x: any) => x.id !== svc.id));
                                      } else if (!isDisabled) {
                                        setSelectedCategoryServices(prev => [...prev, svc]);
                                      }
                                    }}
                                    disabled={isDisabled}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${isSelected
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {isSelected ? '✓ Selecionado' : 'Selecionar Serviço'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSubcategory(null);
                                      if (!isSelected && !isDisabled) {
                                        setSelectedCategoryServices(prev => [...prev, svc]);
                                      }
                                      setTimeout(() => {
                                        setCurrentStep(3);
                                        setTimeout(() => {
                                          window.scrollBy({
                                            top: 300,
                                            behavior: 'smooth'
                                          });
                                        }, 100);
                                      }, 300);
                                    }}
                                    disabled={isDisabled}
                                    className={`flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    Agendar
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                        {((selectedCategoryServices?.length || 0) + (selectedProfessionalSpecificServices?.length || 0)) >= 4 && (
                          <p className="text-xs" style={{ color: '#A1A1A1' }}>
                            Limite máximo de 4 serviços atingido. Remova algum para selecionar outro.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Seletor de Categoria - CATEGORIAS VISÍVEIS */}
                      <div>
                        <div
                          className="p-3 rounded-2xl mb-3"
                          style={{
                            background: '#151515',
                            border: '1px solid rgba(255,255,255,0.06)'
                          }}
                        >
                          <div className="text-center text-base font-extrabold" style={{ color: '#E6C78B' }}>
                            📋 Selecione uma categoria
                          </div>
                        </div>
                        {/* Lista de categorias como botões visíveis */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {visibleServiceCategories.map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(category.id);
                                setSelectedSubcategory(null);
                                // ✅ NÃO LIMPAR selectedCategoryServices - permite selecionar serviços de diferentes categorias
                                // Scroll automático para mostrar os serviços da categoria - DESCE, NÃO SOBE
                                setTimeout(() => {
                                  const servicesSection = document.querySelector('[data-services-section]');
                                  if (servicesSection) {
                                    const rect = servicesSection.getBoundingClientRect();
                                    const scrollPosition = window.scrollY + rect.top - 100; // 100px de margem do topo
                                    window.scrollTo({
                                      top: scrollPosition,
                                      behavior: 'smooth'
                                    });
                                  } else {
                                    // Scroll genérico para BAIXO
                                    window.scrollBy({
                                      top: 400,
                                      behavior: 'smooth'
                                    });
                                  }
                                }, 200);
                              }}
                              className="p-4 rounded-2xl transition-all text-left"
                              style={{
                                background: selectedCategory === category.id ? '#E6C78B' : '#151515',
                                color: selectedCategory === category.id ? '#0B0B0B' : '#FFFFFF',
                                border: '1px solid rgba(255,255,255,0.06)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                                transform: selectedCategory === category.id ? 'scale(1.02)' : undefined
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-base">{category.name}</span>
                                {selectedCategory === category.id && (
                                  <span className="text-black text-xl">✓</span>
                                )}
                              </div>
                              {category.description && (
                                <p
                                  className="text-sm mt-1"
                                  style={{ color: selectedCategory === category.id ? 'rgba(11,11,11,0.7)' : '#A1A1A1' }}
                                >
                                  {category.description}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Seletor de Subcategoria */}
                      {selectedCategory && (() => {
                        const selectedCategoryData = visibleServiceCategories.find(cat => cat.id === selectedCategory);
                        const hasSubcategories = selectedCategoryData?.subcategories && selectedCategoryData.subcategories.length > 0;

                        if (!hasSubcategories) {
                          return null; // Não mostrar nada se não houver subcategorias
                        }

                        return (
                          <div data-services-section>
                            <div
                              className="p-3 rounded-2xl mb-3"
                              style={{
                                background: '#151515',
                                border: '1px solid rgba(255,255,255,0.06)'
                              }}
                            >
                              <div className="text-center text-base font-extrabold" style={{ color: '#E6C78B' }}>
                                📋 Selecione um ou mais serviços
                              </div>
                            </div>

                            {/* ✅ Sempre usar cards (remove o dropdown antigo) */}
                            <div className="space-y-3">
                              {visibleServiceCategories
                                .find(cat => cat.id === selectedCategory)
                                ?.subcategories.map((subcategory: any) => {
                                  const isSelected = selectedCategoryServices.some(service => service.id === subcategory.id);
                                  const totalSelected = (selectedCategoryServices?.length || 0) + (selectedProfessionalSpecificServices?.length || 0);
                                  const isDisabled = !isSelected && totalSelected >= 4;
                                  const serviceImageUrl = String((subcategory as any).image_url || '').trim() || DEFAULT_SERVICE_IMAGE_URL;

                                  return (
                                    <div
                                      key={subcategory.id}
                                      className={`w-full p-4 rounded-2xl transition-colors ${isDisabled ? 'opacity-60' : ''}`}
                                      style={{
                                        background: isSelected ? 'rgba(230,199,139,0.10)' : '#151515',
                                        border: `1px solid ${isSelected ? 'rgba(230,199,139,0.45)' : 'rgba(255,255,255,0.06)'}`,
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                                      }}
                                    >
                                      <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <img
                                            src={serviceImageUrl}
                                            alt={`Foto de ${subcategory.name}`}
                                            className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover border border-white/10 bg-black/20 shrink-0"
                                            loading="lazy"
                                            decoding="async"
                                          />
                                          <div className="min-w-0">
                                            <h4 className="font-extrabold text-white truncate">{subcategory.name}</h4>
                                            <p className="text-sm" style={{ color: '#A1A1A1' }}>
                                              R$ {subcategory.price.toFixed(2)} • {subcategory.duration}min
                                            </p>
                                          </div>
                                        </div>
                                        <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center ${isSelected ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                                          {isSelected ? '✓' : '+'}
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // Se tiver vindo do modo antigo (selectedSubcategory), limpar pra não conflitar
                                            setSelectedSubcategory(null);
                                            if (isSelected) {
                                              setSelectedCategoryServices(prev => prev.filter(service => service.id !== subcategory.id));
                                            } else if (!isDisabled) {
                                              setSelectedCategoryServices(prev => [...prev, subcategory]);
                                            }
                                          }}
                                          disabled={isDisabled}
                                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${isSelected
                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                          {isSelected ? '✓ Selecionado' : 'Selecionar Serviço'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedSubcategory(null);
                                            if (!isSelected && !isDisabled) {
                                              setSelectedCategoryServices(prev =>
                                                (prev || []).some((s: any) => s.id === subcategory.id) ? prev : [...prev, subcategory]
                                              );
                                            }
                                            setTimeout(() => {
                                              setCurrentStep(3);
                                              setTimeout(() => {
                                                window.scrollBy({
                                                  top: 300,
                                                  behavior: 'smooth'
                                                });
                                              }, 100);
                                            }, 300);
                                          }}
                                          disabled={isDisabled}
                                          className={`flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                          Agendar
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                              {((selectedCategoryServices?.length || 0) + (selectedProfessionalSpecificServices?.length || 0)) >= 4 && (
                                <p className="text-xs text-green-700">
                                  Limite máximo de 4 serviços atingido. Remova algum para selecionar outro.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ✅ RESUMO DO SERVIÇO SELECIONADO - UM OU MÚLTIPLOS */}
                      {/* ✅ LISTA DE SERVIÇOS SELECIONADOS - MÚLTIPLOS (sempre) */}
                      {selectedCategoryServices.length > 0 && (
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
                                Preço: R$ {[...(selectedProfessionalSpecificServices || []), ...(selectedCategoryServices || [])]
                                  .reduce((sum: number, service: any) => sum + (Number(service?.price) || 0), 0)
                                  .toFixed(2)}
                              </span>
                              <span className="text-blue-700">
                                Duração: {[...(selectedProfessionalSpecificServices || []), ...(selectedCategoryServices || [])]
                                  .reduce((sum: number, service: any) => sum + (Number(service?.duration) || 0), 0)}min
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <MultiServiceSelector
                services={getCombinedServices().filter((service: any) => service && service.id && service.name)} // ✅ Filtrar serviços inválidos
                selectedServices={selectedServices}
                onSelectServices={(services) => {
                  // ✅ multi-seleção também fora de categorias
                  setSelectedServices(services);
                  // evitar conflito com modo antigo de 1 serviço
                  setSelectedService(undefined);
                }}
                onBookServices={(services) => {
                  setSelectedServices(services);
                  setSelectedService(undefined);
                  // Bloquear se selecionar apenas serviços sem tempo (ex: 0 min)
                  const total = (services || []).reduce((sum, s) => sum + (Number((s as any)?.duration) || 0), 0);
                  if (!isSubscriberBooking && total < 5) {
                    toast.error(
                      'Esse serviço não adiciona tempo. Para agendar, selecione outro serviço junto (mínimo 5 minutos).'
                    );
                    return;
                  }
                  // Avançar automaticamente para a etapa de data
                  setTimeout(() => {
                    setCurrentStep(3);
                    // Scroll para a seção de data
                    setTimeout(() => {
                      window.scrollBy({
                        top: 300,
                        behavior: 'smooth'
                      });
                    }, 100);
                  }, 300);
                }}
                maxServices={4}
              />
            )}

            {/* Botão para avançar após selecionar serviço */}
            {((selectedService || selectedServices.length > 0 || selectedCategoryServices.length > 0 || selectedProfessionalSpecificServices.length > 0 || selectedSubcategory) || (isSubscriberBooking && subscriberService)) && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="w-full px-4 py-3 rounded-xl transition-colors font-extrabold active:scale-[0.99]"
                  style={{ background: '#E6C78B', color: '#0B0B0B' }}
                >
                  ESCOLHER DIA →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Serviço do Assinante - Mostrado apenas para assinantes no step 2 */}
        {currentStep === 2 && isSubscriberBooking && subscriberService && (
          <div>
            {/* Botão Voltar fixo no topo */}
            {currentStep > 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-2 rounded-xl transition-colors font-semibold hover:bg-white/5"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#A1A1A1'
                  }}
                >
                  ← Voltar
                </button>
              </div>
            )}
            <label className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
              2. Serviço Incluído
            </label>
            <div
              className="w-full p-4 rounded-2xl"
              style={{
                background: '#151515',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-white">{subscriberService.name}</h3>
                  <p className="text-sm" style={{ color: '#A1A1A1' }}>Incluído na sua assinatura</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold" style={{ color: '#E6C78B' }}>GRÁTIS</p>
                </div>
              </div>
            </div>
            {/* Botão para avançar */}
            <div className="mt-6">
              <button
                type="button"
                onClick={goToNextStep}
                className="w-full px-4 py-3 rounded-xl transition-colors font-extrabold active:scale-[0.99]"
                style={{ background: '#E6C78B', color: '#0B0B0B' }}
              >
                ESCOLHER DIA →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DATA */}
        {currentStep === 3 && (
          <div>
            {/* Botão Voltar fixo no topo */}
            {currentStep > 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-2 rounded-xl transition-colors font-semibold hover:bg-white/5"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#A1A1A1'
                  }}
                >
                  ← Voltar
                </button>
              </div>
            )}
            <label className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
              5. Escolha a Data
            </label>
            <div
              className="rounded-2xl p-3"
              style={{
                background: '#151515',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
              }}
            >
              <DatePicker
                selectedDate={selectedDate}
                onChange={(date) => {
                  onSelectDate(date);
                  setHasSelectedDate(true); // Marca que o usuário selecionou uma data
                  // ✅ Avançar automaticamente para a próxima etapa após selecionar data
                  setTimeout(() => {
                    setCurrentStep(4);
                  }, 300);
                }}
                businessHours={establishment.business_hours}
                allowedWeekdays={subscriberService?.weekdays}
                isSubscriberBooking={isSubscriberBooking}
              />
            </div>
          </div>
        )}

        {/* STEP 4: HORÁRIO */}
        {currentStep === 4 && (
          <div>
            {/* Botão Voltar fixo no topo */}
            {currentStep > 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-2 rounded-xl transition-colors font-semibold hover:bg-white/5"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#A1A1A1'
                  }}
                >
                  ← Voltar
                </button>
              </div>
            )}
            <label className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
              6. Escolha o Horário
            </label>

            {/* Verificar se o dia selecionado é válido para assinantes */}
            {isSubscriberBooking && subscriberService && !isValidDayForSubscriber(selectedDate, subscriberService.weekdays) ? (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(230,199,139,0.08)',
                  border: '1px solid rgba(230,199,139,0.18)'
                }}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5" style={{ color: '#E6C78B' }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-extrabold text-white">
                      Dia não disponível para este serviço
                    </h3>
                    <div className="mt-2 text-sm" style={{ color: '#A1A1A1' }}>
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
                  // IMPORTANTE: na grade de horários, assinante precisa considerar assinatura + extras selecionados.
                  // Sem isso, poderia liberar slot que estoura em cima do próximo agendamento.
                  duration: getResolvedSubscriberDuration() + getResolvedSubscriberExtraDuration()
                } : useMultiService && selectedServices.length > 0 ? {
                  id: 'multiple',
                  name: selectedServices.map(s => s.name).join(' + '),
                  price: selectedServices.reduce((sum, s) => sum + s.price, 0),
                  duration: selectedServices.reduce((sum, s) => sum + s.duration, 0)
                } : useCategoryService ? (() => {
                  const categorySelected = useMultiCategoryService
                    ? (selectedCategoryServices || [])
                    : (selectedSubcategory ? [selectedSubcategory] : []);
                  const all = [...(selectedProfessionalSpecificServices || []), ...categorySelected];
                  if (all.length === 0) return selectedService;
                  return {
                    id: 'category-selection',
                    name: all.map((s: any) => s?.name).filter(Boolean).join(' + '),
                    price: all.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0),
                    duration: all.reduce((sum: number, s: any) => sum + (Number(s?.duration) || 0), 0),
                  };
                })() : selectedService}
                existingAppointments={filteredExistingAppointments} // Passar agendamentos filtrados
                selectedTime={selectedTime}
                onTimeSelect={(time) => {
                  if (isTimeInsideAdvanceWindow(time)) {
                    const minHours = getMinimumAdvanceHours();
                    const hourLabel = minHours === 1 ? '1 hora' : `${minHours} horas`;
                    toast.error(`Voce esta em cima da hora para agendar. Tente um horario mais a frente (minimo de ${hourLabel} de antecedencia).`);
                    return;
                  }
                  setSelectedTime(time);
                  // ✅ Avançar automaticamente para a próxima etapa após selecionar horário
                  if (time) {
                    setTimeout(() => {
                      setCurrentStep(5);
                      // Scroll automático para mostrar a forma de pagamento - DESCE, NÃO SOBE
                      setTimeout(() => {
                        const paymentSection = document.querySelector('[data-payment-section]') ||
                          document.querySelector('label:contains("Forma de Pagamento")');
                        if (paymentSection) {
                          const rect = paymentSection.getBoundingClientRect();
                          const scrollPosition = window.scrollY + rect.top - 100; // 100px de margem do topo
                          window.scrollTo({
                            top: scrollPosition,
                            behavior: 'smooth'
                          });
                        } else {
                          // Scroll genérico para BAIXO
                          window.scrollBy({
                            top: 400,
                            behavior: 'smooth'
                          });
                        }
                      }, 200);
                    }, 300);
                  }
                }}
                filterPastTimes={true} // Sempre filtrar horários passados
                minimumAdvanceMinutes={getMinimumAdvanceMinutes()}
                businessHours={businessHours}
                use15MinuteInterval={establishment.use_15_minute_interval ?? false}
                use20MinuteSchedule={(establishment as any).use_20_minute_schedule ?? false}
                use60MinuteSchedule={(establishment as any).use_60_minute_schedule ?? false}
                closedTimeEnabled={(establishment as any).closed_time_enabled ?? false}
                selectedProfessional={selectedProfessional?.id}
                professionalAbsences={(() => {
                  const absences = selectedProfessional ? (selectedProfessional as any).absences || [] : [];
                  console.log('🔍 DEBUG ABSENCES - Professional:', selectedProfessional?.name, 'Absences:', absences);
                  return absences;
                })()}
                professionalBlockedHours={(() => {
                  // IMPORTANTE: usar data LOCAL (não UTC) para bater com `format(selectedDate, 'yyyy-MM-dd')`
                  // e com as chaves salvas em `blocked_hours`. `toISOString()` pode deslocar o dia.
                  const dateKey = format(selectedDate, 'yyyy-MM-dd');
                  const blockedHours = selectedProfessional ? (selectedProfessional as any).blocked_hours?.[dateKey] || [] : [];
                  console.log('🔍 DEBUG BLOCKED HOURS - Professional:', selectedProfessional?.name, 'Date:', dateKey, 'Blocked:', blockedHours);
                  console.log('🔍 DEBUG BLOCKED HOURS - Full blocked_hours object:', selectedProfessional ? (selectedProfessional as any).blocked_hours : 'NO PROFESSIONAL');
                  return blockedHours;
                })()}
                professionalWorkHours={selectedProfessional ? (selectedProfessional as any).work_hours || null : null}
                hideIntervalSlots={true}
              />
            )}
            {/* Botão para avançar após selecionar horário */}
            {selectedTime && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="w-full px-4 py-3 rounded-xl transition-colors font-extrabold active:scale-[0.99]"
                  style={{ background: '#E6C78B', color: '#0B0B0B' }}
                >
                  ESCOLHER PRODUTOS E PAGAMENTO →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: FORMA DE PAGAMENTO - Oculto para assinantes */}
        {currentStep === 5 && !isSubscriberBooking && (
          <div data-payment-section>
            {/* Botão Voltar fixo no topo */}
            {currentStep > 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-2 rounded-xl transition-colors font-semibold hover:bg-white/5"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#A1A1A1'
                  }}
                >
                  ← Voltar
                </button>
              </div>
            )}
            {availableBookingProducts.length > 0 && (
              <div
                className="mb-5 p-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(160deg, rgba(230,199,139,0.14) 0%, rgba(21,21,21,0.98) 45%, rgba(21,21,21,1) 100%)',
                  border: '1px solid rgba(230,199,139,0.35)',
                  boxShadow: '0 14px 36px rgba(0,0,0,0.52)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(230,199,139,0.22)', color: '#F5E7C2' }}>
                    ✨ Vitrine Premium
                  </span>
                </div>
                <label className="block text-base font-extrabold mb-2" style={{ color: '#F5E7C2' }}>
                  Quer aproveitar e garantir também?
                </label>
                <p className="text-xs mb-3" style={{ color: '#D3D3D3' }}>
                  Selecione um ou mais produtos adicionais para incluir no seu agendamento.
                </p>
                <div className="space-y-2">
                  {availableBookingProducts.map((product: any) => {
                    const productId = String(product?.id || '');
                    const selected = selectedBookingProductIds.includes(productId);
                    const imageUrl = String(product?.image_url || '').trim();
                    return (
                      <div key={`booking-product-${productId}`} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingProductIds((prev) =>
                              prev.includes(productId)
                                ? prev.filter((id) => id !== productId)
                                : [...prev, productId]
                            );
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                            selected
                              ? 'text-white'
                              : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                          }`}
                          style={
                            selected
                              ? {
                                background: 'linear-gradient(135deg, rgba(230,199,139,0.30) 0%, rgba(16,185,129,0.45) 100%)',
                                borderColor: 'rgba(230,199,139,0.85)',
                                boxShadow: '0 8px 22px rgba(0,0,0,0.35)'
                              }
                              : undefined
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={String(product?.name || 'Produto')}
                                  className="h-10 w-10 rounded-lg object-cover border border-white/25 shrink-0"
                                  loading="lazy"
                                />
                              ) : null}
                              <div className="font-semibold truncate">{String(product?.name || 'Produto')}</div>
                            </div>
                            {selected && <span className="text-[10px] font-black px-2 py-1 rounded-full bg-black/30 shrink-0">SELECIONADO</span>}
                          </div>
                          <div className="text-xs opacity-95 mt-0.5">+ R$ {Number(product?.sale_price || 0).toFixed(2).replace('.', ',')}</div>
                        </button>
                        {imageUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedBookingProductImagePreview({
                                url: imageUrl,
                                name: String(product?.name || 'Produto')
                              })
                            }
                            className="text-[11px] px-2 py-1 rounded-md border border-[#E6C78B]/60 text-[#F5E7C2] hover:bg-[#E6C78B]/15 transition-colors"
                          >
                            Ver foto
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs font-bold" style={{ color: '#F5E7C2' }}>
                  Total de produtos: R$ {Number(bookingProductsTotal || 0).toFixed(2).replace('.', ',')}
                </div>
              </div>
            )}
            {requireAdvancePayment ? (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(230,199,139,0.08)',
                  border: '1px solid rgba(230,199,139,0.18)'
                }}
              >
                <p className="text-sm text-white/85">
                  💳 <strong>Pagamento antecipado obrigatório.</strong> Após clicar em finalizar, você será direcionado para o pagamento {(() => {
                    // Verificar qual gateway está configurado
                    const hasMP = !!String((establishment as any)?.mercadopago_access_token || '').trim();
                    const hasPM = !!String((establishment as any)?.pagarme_recipient_id || '').trim();
                    const exigirMP = Boolean((establishment as any)?.exigir_pagamento_antecipado_mercadopago === true);
                    const exigirPM = Boolean((establishment as any)?.exigir_pagamento_antecipado === true);

                    // Prioridade: Mercado Pago se marcado
                    if (hasMP && exigirMP) {
                      return '(Mercado Pago)';
                    } else if (hasPM && exigirPM) {
                      return '(Pagar.me)';
                    }
                    return '(Mercado Pago ou Pagar.me)';
                  })()} para confirmar o agendamento.
                </p>
              </div>
            ) : (
              <>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
                  7. Forma de Pagamento
                </label>
                <PaymentMethodSelector
                  selectedMethod={selectedPaymentMethod}
                  onMethodSelect={(method) => {
                    setSelectedPaymentMethod(method);
                    // Scroll automático para o botão FINALIZAR AGENDAMENTO - DESCE, NÃO SOBE
                    setTimeout(() => {
                      const submitButton = document.querySelector('button[type="submit"]');
                      if (submitButton) {
                        const rect = submitButton.getBoundingClientRect();
                        const scrollPosition = window.scrollY + rect.top - 100; // 100px de margem do topo
                        window.scrollTo({
                          top: scrollPosition,
                          behavior: 'smooth'
                        });
                      } else {
                        // Scroll genérico para BAIXO
                        window.scrollBy({
                          top: 400,
                          behavior: 'smooth'
                        });
                      }
                    }, 200);
                  }}
                  showPixOptions={!!establishment.pix_key && !(!!String((establishment as any)?.mercadopago_access_token || '').trim())}
                  pixPaymentMethod={pixPaymentMethod}
                  onPixMethodSelect={handlePixMethodSelect}
                  enabledMethods={establishment.payment_methods_enabled}
                />
                <p className="mt-2 text-xs" style={{ color: '#A1A1A1' }}>
                  Qual forma de pagamento você irá usar no estabelecimento? Crédito e débito são pagos no local.
                </p>
              </>
            )}

            {/* Formulário PIX manual (só sem Mercado Pago; com MP conectado, PIX é via Mercado Pago na finalização) */}
            {!requireAdvancePayment && selectedPaymentMethod === 'pix' && establishment.pix_key && !(!!String((establishment as any)?.mercadopago_access_token || '').trim()) && (
              <div className="mt-4">
                <PixPaymentForm
                  establishment={establishment}
                  selectedService={useMultiService && selectedServices.length > 0 ? {
                    id: 'multiple',
                    name: selectedServices.map(s => s.name).join(' + '),
                    price: selectedServices.reduce((sum, s) => sum + s.price, 0),
                    duration: selectedServices.reduce((sum, s) => sum + s.duration, 0)
                  } : useCategoryService ? (() => {
                    const categorySelected = useMultiCategoryService
                      ? (selectedCategoryServices || [])
                      : (selectedSubcategory ? [selectedSubcategory] : []);
                    const all = [...(selectedProfessionalSpecificServices || []), ...categorySelected];
                    if (all.length === 0) return selectedService || { id: '', name: '', price: 0, duration: 0 };
                    return {
                      id: 'category-selection',
                      name: all.map((s: any) => s?.name).filter(Boolean).join(' + '),
                      price: all.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0),
                      duration: all.reduce((sum: number, s: any) => sum + (Number(s?.duration) || 0), 0),
                    };
                  })() : selectedService || { id: '', name: '', price: 0, duration: 0 }}
                  onPixMethodSelect={handlePixMethodSelect}
                  onPixProofUpload={handlePixComprovantUpload}
                  pixPaymentMethod={pixPaymentMethod}
                  pixProofUrl={pixProofUrl}
                />
              </div>
            )}
            {/* OBSERVAÇÃO - Mostrada no step 5 antes do botão finalizar */}
            {selectedTime && (
              <div className="mt-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
                  Observação (Opcional)
                </label>
                <textarea
                  value={observation}
                  onChange={(e) => {
                    if (e.target.value.length <= 100) {
                      setObservation(e.target.value);
                    }
                  }}
                  placeholder="Quer colocar alguma observação para o barbeiro?"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E6C78B]/25 resize-none"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                  rows={3}
                  maxLength={100}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs" style={{ color: '#A1A1A1' }}>
                    (Opcional) Máximo 100 caracteres
                  </p>
                  <span className="text-xs" style={{ color: observation.length > 90 ? '#E6C78B' : '#A1A1A1' }}>
                    {observation.length}/100
                  </span>
                </div>
              </div>
            )}

            {/* SERVIÇO INFANTIL - Obrigatório (só se profissional oferece) - Destacado e antes do botão finalizar */}
            {selectedTime && selectedProfessional && selectedProfessional.offers_child_service && (
              <div
                className={`mt-6 p-4 rounded-2xl ${isChildService === null ? 'shake-animation' : ''}`}
                style={{
                  background: 'rgba(230,199,139,0.08)',
                  border: '1px solid rgba(230,199,139,0.18)'
                }}
              >
                <label className="block text-lg font-extrabold text-white mb-3 flex items-center gap-2">
                  <span style={{ color: '#E6C78B' }} className="text-2xl">⚠️</span>
                  <span>Serviço infantil? <span style={{ color: '#E6C78B' }} className="text-xl">*</span></span>
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="childService"
                      value="true"
                      checked={isChildService === true}
                      onChange={() => setIsChildService(true)}
                      className="mr-2 w-5 h-5 cursor-pointer"
                    />
                    <span className="text-base font-semibold" style={{ color: '#A1A1A1' }}>Sim</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="childService"
                      value="false"
                      checked={isChildService === false}
                      onChange={() => setIsChildService(false)}
                      className="mr-2 w-5 h-5 cursor-pointer"
                    />
                    <span className="text-base font-semibold" style={{ color: '#A1A1A1' }}>Não</span>
                  </label>
                </div>
                <p className="text-sm font-semibold mt-2" style={{ color: '#E6C78B' }}>
                  ⚠️ (Obrigatório) Informe se é um serviço para criança
                </p>
              </div>
            )}

            {/* CUPOM DE DESCONTO - abaixo do serviço infantil */}
            {selectedTime && !isSubscriberBooking && (
              <div
                className="mt-4 p-4 rounded-2xl"
                style={{
                  background: '#151515',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                }}
              >
                <label className="block text-sm font-extrabold mb-2" style={{ color: '#E6C78B' }}>
                  Cupom de desconto (opcional)
                </label>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    value={cupomInput}
                    onChange={(e) => setCupomInput(e.target.value)}
                    placeholder="Ex: NEY1"
                    className="flex-1 px-4 py-3 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E6C78B]/25"
                    style={{
                      background: '#0F0F0F',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    disabled={isApplyingCupom}
                  />
                  <button
                    type="button"
                    onClick={aplicarCupom}
                    disabled={isApplyingCupom}
                    className="px-4 py-3 rounded-xl font-extrabold transition-colors disabled:opacity-60"
                    style={{ background: '#E6C78B', color: '#0B0B0B' }}
                  >
                    {isApplyingCupom ? 'Aplicando...' : 'Aplicar cupom'}
                  </button>
                  {cupomAplicado && (
                    <button
                      type="button"
                      onClick={() => {
                        setCupomAplicado(null);
                        toast.success('Cupom removido');
                      }}
                      className="px-4 py-3 rounded-xl font-extrabold transition-colors"
                      style={{ background: '#2A2A2A', color: '#FFFFFF' }}
                    >
                      Remover
                    </button>
                  )}
                </div>

                {cupomAplicado && (
                  <div className="mt-3 text-sm" style={{ color: '#A1A1A1' }}>
                    <div>
                      <strong className="text-white">Cupom aplicado:</strong> {cupomAplicado.code} —{' '}
                      <strong className="text-white">-{Number(cupomAplicado.percent).toFixed(2).replace('.', ',')}%</strong>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Valor original:{' '}
                        <strong className="text-white">
                          R$ {Number(precoBaseAtual || 0).toFixed(2).replace('.', ',')}
                        </strong>
                      </span>
                      <span>
                        Desconto:{' '}
                        <strong className="text-white">
                          -R$ {Number(descontoValorAtual || 0).toFixed(2).replace('.', ',')}
                        </strong>
                      </span>
                      <span>
                        Total com cupom:{' '}
                        <strong style={{ color: '#E6C78B' }}>
                          R$ {Number(precoFinalAtual || 0).toFixed(2).replace('.', ',')}
                        </strong>
                      </span>
                      {bookingProductsTotal > 0 && (
                        <span>
                          + Produtos:{' '}
                          <strong className="text-white">
                            R$ {Number(bookingProductsTotal || 0).toFixed(2).replace('.', ',')}
                          </strong>
                        </span>
                      )}
                      <span>
                        Total final:{' '}
                        <strong style={{ color: '#E6C78B' }}>
                          R$ {Number(precoFinalComProdutos || 0).toFixed(2).replace('.', ',')}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RESUMO DO AGENDAMENTO - Fluxo Normal */}
            {(selectedPaymentMethod || requireAdvancePayment) && ((selectedService && selectedProfessional && selectedTime) ||
              (useMultiService && selectedServices.length > 0 && selectedProfessional && selectedTime) ||
              (useCategoryService && selectedProfessional && selectedTime && (selectedProfessionalSpecificServices.length > 0 || selectedCategoryServices.length > 0 || Boolean(selectedSubcategory)))) && (
                <div
                  className="mt-6 p-4 rounded-2xl"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                  }}
                >
                  <h3 className="font-extrabold mb-2" style={{ color: '#E6C78B' }}>📋 Resumo do Agendamento:</h3>
                  <div className="text-sm space-y-1" style={{ color: '#A1A1A1' }}>
                    <div><strong className="text-white">Cliente:</strong> {clientName || 'Não informado'}</div>
                    <div><strong className="text-white">WhatsApp:</strong> {clientWhatsapp || 'Não informado'}</div>
                    <div><strong className="text-white">Serviço:</strong> {
                      useMultiService && selectedServices.length > 0
                        ? `${selectedServices.map(s => s.name).join(' + ')} - R$ ${selectedServices.reduce((sum, s) => sum + s.price, 0).toFixed(2).replace('.', ',')}`
                        : useCategoryService
                          ? (() => {
                            const categorySelected = useMultiCategoryService
                              ? (selectedCategoryServices || [])
                              : (selectedSubcategory ? [selectedSubcategory] : []);
                            const all = [...(selectedProfessionalSpecificServices || []), ...categorySelected];
                            const total = all.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
                            const names = all.map((s: any) => s?.name).filter(Boolean).join(' + ');
                            return `${names} - R$ ${Number(total || 0).toFixed(2).replace('.', ',')}`;
                          })()
                          : `${selectedService?.name || ''} - R$ ${selectedService?.price.toFixed(2).replace('.', ',') || '0,00'}`
                    }</div>
                    <div><strong className="text-white">Profissional:</strong> {selectedProfessional?.name || ''}</div>
                    <div><strong className="text-white">Pagamento:</strong> {requireAdvancePayment
                      ? 'Pagamento antecipado (Pagar.me)'
                      : (selectedPaymentMethod === 'pix' ? (pixPaymentMethod === 'pix_now' ? 'PIX (Pagar agora)' : 'PIX (Pagar no local)') :
                        selectedPaymentMethod === 'credito' ? 'Cartão de Crédito' :
                          selectedPaymentMethod === 'debito' ? 'Cartão de Débito' :
                            selectedPaymentMethod === 'dinheiro' ? 'Dinheiro' : selectedPaymentMethod)
                    }</div>
                    <div><strong className="text-white">Data:</strong> {format(selectedDate, 'dd/MM/yyyy')}</div>
                    <div><strong className="text-white">Horário:</strong> {selectedTime}</div>
                    <div><strong className="text-white">Duração:</strong> {
                      useMultiService && selectedServices.length > 0
                        ? `${selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0)} minutos`
                        : useCategoryService
                          ? (() => {
                            const categorySelected = useMultiCategoryService
                              ? (selectedCategoryServices || [])
                              : (selectedSubcategory ? [selectedSubcategory] : []);
                            const all = [...(selectedProfessionalSpecificServices || []), ...categorySelected];
                            const total = all.reduce((sum: number, s: any) => sum + (Number(s?.duration) || 0), 0);
                            return `${total || 30} minutos`;
                          })()
                          : `${selectedService?.duration || 30} minutos`
                    }</div>
                    {observation && (
                      <div><strong className="text-white">Observação:</strong> <em>"{observation}"</em></div>
                    )}
                    {selectedProfessional && selectedProfessional.offers_child_service && (
                      <div><strong className="text-white">Serviço infantil:</strong> {isChildService === null ? 'Não informado' : (isChildService ? 'Sim' : 'Não')}</div>
                    )}
                    {cupomAplicado && !isSubscriberBooking && (
                      <div>
                        <strong className="text-white">Cupom aplicado:</strong> {cupomAplicado.code} (
                        -{Number(cupomAplicado.percent).toFixed(2).replace('.', ',')}%) —{' '}
                        <strong style={{ color: '#E6C78B' }}>
                          Total: R$ {Number(precoFinalAtual || 0).toFixed(2).replace('.', ',')}
                        </strong>
                      </div>
                    )}
                    {selectedBookingProducts.length > 0 && (
                      <div>
                        <strong className="text-white">Produtos adicionais:</strong>{' '}
                        {selectedBookingProducts.map((product: any) => String(product?.name || 'Produto')).join(' + ')} —{' '}
                        <strong style={{ color: '#E6C78B' }}>
                          R$ {Number(bookingProductsTotal || 0).toFixed(2).replace('.', ',')}
                        </strong>
                      </div>
                    )}
                    <div>
                      <strong className="text-white">Total final do agendamento:</strong>{' '}
                      <strong style={{ color: '#E6C78B' }}>
                        R$ {Number(precoFinalComProdutos || 0).toFixed(2).replace('.', ',')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

            {/* Botão para finalizar após selecionar forma de pagamento (ou pagamento antecipado) - AGORA DEPOIS DO RESUMO */}
            {(selectedPaymentMethod || requireAdvancePayment) && (
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-xl font-extrabold transition-colors active:scale-[0.99]"
                  style={{
                    background: isLoading ? '#3a3a3a' : '#E6C78B',
                    color: isLoading ? '#FFFFFF' : '#0B0B0B',
                    opacity: isLoading ? 0.7 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isLoading ? 'Agendando...' : (requireAdvancePayment ? 'FINALIZAR E PAGAR' : 'FINALIZAR AGENDAMENTO')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pagamento já incluído - Mostrado apenas para assinantes no step 5 */}
        {currentStep === 5 && isSubscriberBooking && subscriberService && (
          <div>
            {/* Botão Voltar fixo no topo */}
            {currentStep > 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium border border-blue-300 shadow-sm"
                >
                  ← Voltar
                </button>
              </div>
            )}
            {availableBookingProducts.length > 0 && (
              <div
                className="mb-5 p-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(160deg, rgba(230,199,139,0.14) 0%, rgba(21,21,21,0.98) 45%, rgba(21,21,21,1) 100%)',
                  border: '1px solid rgba(230,199,139,0.35)',
                  boxShadow: '0 14px 36px rgba(0,0,0,0.52)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(230,199,139,0.22)', color: '#F5E7C2' }}>
                    ✨ Vitrine Premium
                  </span>
                </div>
                <label className="block text-base font-extrabold mb-2" style={{ color: '#F5E7C2' }}>
                  Quer aproveitar e garantir também?
                </label>
                <p className="text-xs mb-3" style={{ color: '#D3D3D3' }}>
                  Selecione um ou mais produtos adicionais para incluir no seu agendamento.
                </p>
                <div className="space-y-2">
                  {availableBookingProducts.map((product: any) => {
                    const productId = String(product?.id || '');
                    const selected = selectedBookingProductIds.includes(productId);
                    const imageUrl = String(product?.image_url || '').trim();
                    return (
                      <div key={`booking-product-subscriber-${productId}`} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingProductIds((prev) =>
                              prev.includes(productId)
                                ? prev.filter((id) => id !== productId)
                                : [...prev, productId]
                            );
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                            selected
                              ? 'text-white'
                              : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                          }`}
                          style={
                            selected
                              ? {
                                background: 'linear-gradient(135deg, rgba(230,199,139,0.30) 0%, rgba(16,185,129,0.45) 100%)',
                                borderColor: 'rgba(230,199,139,0.85)',
                                boxShadow: '0 8px 22px rgba(0,0,0,0.35)'
                              }
                              : undefined
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={String(product?.name || 'Produto')}
                                  className="h-10 w-10 rounded-lg object-cover border border-white/25 shrink-0"
                                  loading="lazy"
                                />
                              ) : null}
                              <div className="font-semibold truncate">{String(product?.name || 'Produto')}</div>
                            </div>
                            {selected && <span className="text-[10px] font-black px-2 py-1 rounded-full bg-black/30 shrink-0">SELECIONADO</span>}
                          </div>
                          <div className="text-xs opacity-95 mt-0.5">+ R$ {Number(product?.sale_price || 0).toFixed(2).replace('.', ',')}</div>
                        </button>
                        {imageUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedBookingProductImagePreview({
                                url: imageUrl,
                                name: String(product?.name || 'Produto')
                              })
                            }
                            className="text-[11px] px-2 py-1 rounded-md border border-[#E6C78B]/60 text-[#F5E7C2] hover:bg-[#E6C78B]/15 transition-colors"
                          >
                            Ver foto
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs font-bold" style={{ color: '#F5E7C2' }}>
                  Total de produtos: R$ {Number(bookingProductsTotal || 0).toFixed(2).replace('.', ',')}
                </div>
              </div>
            )}
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
              {getResolvedSubscriberExtraPrice() > 0 && (
                <p className="text-xs text-blue-800 mt-2">
                  Serviços extras selecionados: <strong>R$ {Number(getResolvedSubscriberExtraPrice() || 0).toFixed(2).replace('.', ',')}</strong>
                </p>
              )}
            </div>

            {/* OBSERVAÇÃO - Mostrada no step 5 antes do botão finalizar */}
            {selectedTime && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observação (Opcional)
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

            {/* SERVIÇO INFANTIL - Obrigatório (só se profissional oferece) - Destacado e antes do botão finalizar */}
            {selectedTime && selectedProfessional && selectedProfessional.offers_child_service && (
              <div className={`mt-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg ${isChildService === null ? 'shake-animation' : ''}`}>
                <label className="block text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-red-500 text-2xl">⚠️</span>
                  <span>Serviço infantil? <span className="text-red-500 text-xl">*</span></span>
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="childService"
                      value="true"
                      checked={isChildService === true}
                      onChange={() => setIsChildService(true)}
                      className="mr-2 w-5 h-5 cursor-pointer"
                    />
                    <span className="text-base font-medium text-gray-700">Sim</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="childService"
                      value="false"
                      checked={isChildService === false}
                      onChange={() => setIsChildService(false)}
                      className="mr-2 w-5 h-5 cursor-pointer"
                    />
                    <span className="text-base font-medium text-gray-700">Não</span>
                  </label>
                </div>
                <p className="text-sm font-semibold text-red-600 mt-2">
                  ⚠️ (Obrigatório) Informe se é um serviço para criança
                </p>
              </div>
            )}

            {/* RESUMO DO AGENDAMENTO - Mostrado no step 5 ANTES do botão */}
            {((selectedService && selectedProfessional && (selectedPaymentMethod || isSubscriberBooking) && selectedTime) ||
              (useMultiService && selectedServices.length > 0 && selectedProfessional && (selectedPaymentMethod || isSubscriberBooking) && selectedTime) ||
              (useCategoryService && selectedProfessional && (selectedPaymentMethod || isSubscriberBooking) && selectedTime && (selectedProfessionalSpecificServices.length > 0 || selectedCategoryServices.length > 0 || Boolean(selectedSubcategory))) ||
              (isSubscriberBooking && subscriberService && selectedProfessional && selectedTime)) && (
                <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-primary mb-2">📋 Resumo do Agendamento:</h3>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div><strong>Cliente:</strong> {isSubscriberBooking ? `${clientName} (ASSINANTE)` : (clientName || 'Não informado')}</div>
                    <div><strong>WhatsApp:</strong> {clientWhatsapp || 'Não informado'}</div>
                    <div><strong>Serviço:</strong> {
                      isSubscriberBooking && subscriberService
                        ? (() => {
                          const extrasNames = (subscriberExtraServices || [])
                            .map((service: any) => String(service?.name || '').trim())
                            .filter(Boolean);
                          const extrasPrice = getResolvedSubscriberExtraPrice();
                          if (extrasNames.length === 0) {
                            return `${subscriberService.name} - GRÁTIS (Incluído na assinatura)`;
                          }
                          return `${subscriberService.name} + Extra: ${extrasNames.join(' + ')} - R$ ${Number(extrasPrice || 0).toFixed(2).replace('.', ',')}`;
                        })()
                        : useMultiService && selectedServices.length > 0
                          ? `${selectedServices.map(s => s.name).join(' + ')} - R$ ${selectedServices.reduce((sum, s) => sum + s.price, 0).toFixed(2).replace('.', ',')}`
                          : useCategoryService
                            ? (() => {
                              const categorySelected = useMultiCategoryService
                                ? (selectedCategoryServices || [])
                                : (selectedSubcategory ? [selectedSubcategory] : []);
                              const all = [...(selectedProfessionalSpecificServices || []), ...categorySelected];
                              const total = all.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
                              const names = all.map((s: any) => s?.name).filter(Boolean).join(' + ');
                              return `${names} - R$ ${Number(total || 0).toFixed(2).replace('.', ',')}`;
                            })()
                            : `${selectedService?.name || ''} - R$ ${selectedService?.price.toFixed(2).replace('.', ',') || '0,00'}`
                    }</div>
                    <div><strong>Profissional:</strong> {selectedProfessional?.name || ''}</div>
                    <div><strong>Pagamento:</strong> {
                      isSubscriberBooking
                        ? (getResolvedSubscriberExtraPrice() > 0
                          ? 'Assinatura (grátis) + extras'
                          : 'Já incluído na assinatura')
                        : selectedPaymentMethod === 'pix' ? (pixPaymentMethod === 'pix_now' ? 'PIX (Pagar agora)' : 'PIX (Pagar no local)') :
                          selectedPaymentMethod === 'credito' ? 'Cartão de Crédito' :
                            selectedPaymentMethod === 'debito' ? 'Cartão de Débito' :
                              selectedPaymentMethod === 'dinheiro' ? 'Dinheiro' : selectedPaymentMethod
                    }</div>
                    <div><strong>Data:</strong> {format(selectedDate, 'dd/MM/yyyy')}</div>
                    <div><strong>Horário:</strong> {selectedTime}</div>
                    <div><strong>Duração:</strong> {
                      isSubscriberBooking && subscriberService
                        ? `${getResolvedSubscriberDuration() + getResolvedSubscriberExtraDuration()} minutos` // Assinatura + extras
                        : useMultiService && selectedServices.length > 0
                          ? `${selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0)} minutos`
                          : useCategoryService
                            ? (() => {
                              const categorySelected = useMultiCategoryService
                                ? (selectedCategoryServices || [])
                                : (selectedSubcategory ? [selectedSubcategory] : []);
                              const all = [...(selectedProfessionalSpecificServices || []), ...categorySelected];
                              const total = all.reduce((sum: number, s: any) => sum + (Number(s?.duration) || 0), 0);
                              return `${total || 30} minutos`;
                            })()
                            : `${selectedService?.duration || 30} minutos`
                    }</div>
                    {observation && (
                      <div><strong>Observação:</strong> <em>"{observation}"</em></div>
                    )}
                    {selectedProfessional && selectedProfessional.offers_child_service && (
                      <div><strong>Serviço infantil:</strong> {isChildService === null ? 'Não informado' : (isChildService ? 'Sim' : 'Não')}</div>
                    )}
                    {selectedBookingProducts.length > 0 && (
                      <div>
                        <strong>Produtos adicionais:</strong>{' '}
                        {selectedBookingProducts.map((product: any) => String(product?.name || 'Produto')).join(' + ')} —{' '}
                        <strong>
                          R$ {Number(bookingProductsTotal || 0).toFixed(2).replace('.', ',')}
                        </strong>
                      </div>
                    )}
                    <div>
                      <strong>Total final do agendamento:</strong>{' '}
                      <strong>
                        R$ {Number((getResolvedSubscriberExtraPrice() + bookingProductsTotal) || 0).toFixed(2).replace('.', ',')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

            {/* Botão para finalizar - AGORA VEM DEPOIS DO RESUMO */}
            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${isLoading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
              >
                {isLoading ? 'Agendando...' : 'FINALIZAR AGENDAMENTO'}
              </button>
            </div>
          </div>
        )}
      </form>

      {selectedBookingProductImagePreview && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedBookingProductImagePreview(null)}
        >
          <div
            className="max-w-2xl w-full rounded-2xl border border-[#E6C78B]/40 bg-[#111] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-[#F5E7C2]">
                {selectedBookingProductImagePreview.name}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedBookingProductImagePreview(null)}
                className="text-xs px-2 py-1 rounded bg-white/10 text-white hover:bg-white/20"
              >
                Fechar
              </button>
            </div>
            <img
              src={selectedBookingProductImagePreview.url}
              alt={selectedBookingProductImagePreview.name}
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

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