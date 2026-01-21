import { SubscriptionPixModal } from '../components/SubscriptionPixModal';
import { format } from 'date-fns';
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Download, Home, LogOut, ThumbsUp, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppointmentForm } from '../components/AppointmentForm';
import { PaymentModal } from '../components/PaymentModal';
import { QuickBookingModal } from '../components/QuickBookingModal';
import ReadMore from '../components/ReadMore';
import { useAuth } from '../context/AuthContext';
import { createGuestClientAndLogin, getSubscriptions, supabase, updateClientLastAccess } from '../lib/supabase';
import { validateOneWeekLimit } from '../utils/oneWeekLimitValidation';
import { validateSameDayReschedule } from '../utils/sameDayRescheduleValidation';

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  console.log('🔍 DEBUG - BookingPage - user:', user);
  console.log('🔍 DEBUG - BookingPage - user.id:', user?.id);

  const [establishment, setEstablishment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookingBlocked, setIsBookingBlocked] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [forceRender, setForceRender] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [showDemoSuccessModal, setShowDemoSuccessModal] = useState(false); // Novo estado para o modal de demonstração
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [showSubscriptionPixModal, setShowSubscriptionPixModal] = useState(false);
  const [selectedSubscriptionForPix, setSelectedSubscriptionForPix] = useState<any | null>(null);
  const [showSubscriptionsDropdown, setShowSubscriptionsDropdown] = useState(false);
  const [showBusinessHours, setShowBusinessHours] = useState(false);
  const [duplicateCarouselIndex, setDuplicateCarouselIndex] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installGuideTitle, setInstallGuideTitle] = useState('Instalar o app');
  const [installGuideSteps, setInstallGuideSteps] = useState<string[]>([]);


  // Funções para o carrossel duplicado - Filtrar apenas fotos selecionadas
  const duplicatePhotos = [
    establishment?.custom_photo_1_url,
    establishment?.custom_photo_2_url,
    establishment?.custom_photo_3_url,
    establishment?.custom_photo_4_url,
    establishment?.custom_photo_5_url,
    establishment?.custom_photo_6_url,
    establishment?.custom_photo_7_url,
  ].filter(Boolean); // Remove valores undefined/null

  // Debug: verificar se as fotos estão sendo carregadas
  console.log('🔍 DEBUG FOTOS:');
  console.log('📸 Fotos do carrossel:', duplicatePhotos);
  console.log('📸 Total de fotos:', duplicatePhotos.length);
  console.log('🏢 Estabelecimento:', establishment);
  console.log('📸 Fotos individuais:', {
    photo1: establishment?.custom_photo_1_url,
    photo2: establishment?.custom_photo_2_url,
    photo3: establishment?.custom_photo_3_url,
    photo4: establishment?.custom_photo_4_url,
    photo5: establishment?.custom_photo_5_url,
    photo6: establishment?.custom_photo_6_url,
    photo7: establishment?.custom_photo_7_url,
  });

  const goToPreviousDuplicate = () => {
    setDuplicateCarouselIndex((prevIndex) =>
      prevIndex === 0 ? duplicatePhotos.length - 1 : prevIndex - 1
    );
  };

  const goToNextDuplicate = () => {
    setDuplicateCarouselIndex((prevIndex) => (prevIndex + 1) % duplicatePhotos.length);
  };

  const goToSlideDuplicate = (index: number) => {
    setDuplicateCarouselIndex(index);
  };

  // Estados para agendamento assinante
  const [showSubscriberBooking, setShowSubscriberBooking] = useState(false);
  const [selectedSubscriberService, setSelectedSubscriberService] = useState<any>(null);
  const [convertedSubscriberData, setConvertedSubscriberData] = useState<any>(null); // Dados do assinante convertido
  const [showLoginModal, setShowLoginModal] = useState(false); // Estado para controlar o modal de login
  const [subscriberDetectionDisabled, setSubscriberDetectionDisabled] = useState(false); // Estado para desabilitar detecção de assinante
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false); // Modal de agendamento rápido
  const [guestClientData, setGuestClientData] = useState<{ name: string; phone: string } | null>(null); // Dados do cliente convidado

  // ✅ Fila de espera (booking público)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([]);
  const [isLoadingWaitlist, setIsLoadingWaitlist] = useState(false);
  const [showLeaveWaitlistForm, setShowLeaveWaitlistForm] = useState(false);
  const [leaveWaitlistPhone, setLeaveWaitlistPhone] = useState('');
  const [showJoinWaitlistForm, setShowJoinWaitlistForm] = useState(false);
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [waitlistServiceId, setWaitlistServiceId] = useState('');

  // Pagamento antecipado (Pagar.me) no booking público
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number>(0);
  const [pendingCustomerData, setPendingCustomerData] = useState<{ name: string; phone?: string; email?: string; document?: string } | null>(null);
  const [paymentIsOptional, setPaymentIsOptional] = useState(false);
  const [showOptionalPayPrompt, setShowOptionalPayPrompt] = useState(false);

  const bookingFormRef = useRef<HTMLDivElement>(null);
  const retryFetchEstablishmentRef = useRef(0);
  const isReloadingRef = useRef(false); // ✅ Proteção contra reload loops

  // Persistência leve do fluxo "QUERO AGENDAR" (evita voltar pro início se houver remount/reload no mobile)
  const QUICK_BOOKING_FLOW_KEY = 'agf_quick_booking_flow'; // 'modal' | 'form'
  const QUICK_BOOKING_DATA_KEY = 'agf_quick_booking_data'; // { name, phone }

  const safeSessionGet = (key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const safeSessionSet = (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  };
  const safeSessionRemove = (key: string) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  // Função para converter agendamento normal para assinante OU de volta para cliente normal
  const handleConvertToSubscriber = (subscriberData: any | false) => {
    if (subscriberData === false) {
      // Converter de volta para cliente normal
      console.log('🔄 Convertendo agendamento para cliente normal');

      // Limpar dados de assinante
      setConvertedSubscriberData(null);
      setSelectedSubscriberService(null);
      setSubscriberDetectionDisabled(true); // ✅ Desabilitar detecção de assinante

      // Fechar formulário de assinante e abrir formulário normal
      setShowSubscriberBooking(false);
      setShowBookingForm(true);

      toast.success('Convertido para agendamento normal! 👤');
      return;
    }

    // Converter para assinante (código original)
    console.log('🔄 Convertendo agendamento para assinante:', subscriberData);

    // Salvar dados do assinante
    setConvertedSubscriberData(subscriberData);

    // Configurar o serviço de assinante - compatível com novo e antigo sistema
    const subscriberService = {
      id: subscriberData.subscription_id || subscriberData.subscriptions?.id,
      name: subscriberData.subscription_name || subscriberData.subscriptions?.name,
      service_duration: subscriberData.subscriptions?.service_duration || 30,
      weekdays: subscriberData.weekdays || subscriberData.subscriptions?.weekdays || []
    };

    console.log('🔧 Serviço de assinante configurado:', subscriberService);
    console.log('🔍 DEBUG - Weekdays do serviço:', subscriberService.weekdays);
    console.log('🔍 DEBUG - Nome do serviço:', subscriberService.name);

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

    /* Batimento (não pisca): escala + glow suave */
    @keyframes agf-heartbeat {
      0%   { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
      18%  { transform: scale(1.045); box-shadow: 0 18px 46px rgba(0,0,0,0.72), 0 0 18px rgba(230,199,139,0.25); }
      35%  { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
      52%  { transform: scale(1.03); box-shadow: 0 18px 44px rgba(0,0,0,0.70), 0 0 14px rgba(230,199,139,0.18); }
      70%  { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
      100% { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
    }

    .agf-heartbeat-cta {
      animation: agf-heartbeat 1.9s ease-in-out infinite;
      will-change: transform, box-shadow;
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

  // ✅ SOLUÇÃO DEFINITIVA: Limpar cache e Service Worker ao entrar no booking
  useEffect(() => {
    // Limpar Service Workers existentes (especialmente em mobile)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          console.log('🗑️ Removendo Service Worker no booking:', registration.scope);
          registration.unregister().catch(() => {});
        });
      });
    }

    // Limpar caches do navegador
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('agendafacil') || cacheName.includes('booking')) {
            console.log('🗑️ Limpando cache:', cacheName);
            caches.delete(cacheName).catch(() => {});
          }
        });
      });
    }

    // Forçar busca sem cache
    fetchEstablishment();
  }, [id]);

  // ✅ Recuperar fluxo do "quero agendar" se a página remountar (piscadas/reloads em mobile)
  useEffect(() => {
    const flow = safeSessionGet(QUICK_BOOKING_FLOW_KEY);
    if (flow === 'modal') {
      setShowQuickBookingModal(true);
      return;
    }
    if (flow === 'form') {
      const raw = safeSessionGet(QUICK_BOOKING_DATA_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.name && parsed?.phone) {
            setGuestClientData({ name: String(parsed.name), phone: String(parsed.phone) });
          }
        } catch {
          // ignore
        }
      }
      setShowBookingForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Retry controlado: evita setTimeout/fetch durante render (isso causa flicker e resets em celular)
  useEffect(() => {
    if (isLoading) return;
    if (establishment) return;
    if (!id) return;

    if (retryFetchEstablishmentRef.current >= 2) return;
    retryFetchEstablishmentRef.current += 1;
    console.log('🔄 Retry controlado: tentando buscar estabelecimento novamente...', retryFetchEstablishmentRef.current);

    const t = setTimeout(() => {
      fetchEstablishment();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, establishment, id]);

  useEffect(() => {
    if (establishment) {
      fetchExistingAppointments();
      fetchSubscriptions();
    }
  }, [establishment, selectedDate]);

  // Atualizar último acesso do cliente quando logado
  useEffect(() => {
    const updateLastAccess = async () => {
      if (user && user.phone) {
        try {
          console.log('🕐 Atualizando último acesso para cliente logado:', user.phone);
          await updateClientLastAccess(user.phone);
        } catch (error) {
          console.error('❌ Erro ao atualizar último acesso:', error);
        }
      }
    };

    updateLastAccess();
  }, [user]);

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
      // ✅ FORÇAR busca sem cache (evita dados antigos)
      const { data, error } = await supabase
        .from('establishments')
        .select(`
            *,
            pix_payment_link,
            review_link,
            social_media_link,
            pix_key,
            whatsapp,
            custom_photo_4_url,
            custom_photo_5_url,
            custom_photo_6_url,
            custom_photo_7_url,
            carousel_position,
            use_pagarme_subscription_pix,
            pagarme_recipient_id,
            mercadopago_access_token,
            use_mercadopago_subscription_pix
          `)
        .eq('code', id)
        .single();
      
      // ✅ Adicionar timestamp para evitar cache do navegador
      const fetchTimestamp = Date.now();
      console.log('⏰ Timestamp da busca:', fetchTimestamp);

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

      // Verificar se o booking está bloqueado
      if (data.booking_blocked) {
        console.log('🚫 Booking bloqueado para este estabelecimento');
        // ✅ Mesmo bloqueado, manter o estabelecimento carregado para permitir ações (ex.: botão para mandar mensagem)
        setEstablishment(data);
        setIsBookingBlocked(true);
        setIsLoading(false);
        return;
      }

      // ✅ Preferir serviços do sistema novo (categorias/subcategorias).
      // Importante: buscar direto via join (!inner) para não depender de listar categorias antes.
      let servicesFromCategories: any[] = [];
      try {
        const { data: subs, error: subErr } = await supabase
          .from('service_subcategories')
          .select(
            `
            id,
            name,
            price,
            duration,
            display_order,
            is_active,
            service_categories!inner (
              establishment_id,
              display_order
            )
          `
          )
          .eq('is_active', true)
          .eq('service_categories.establishment_id', data.id)
          .order('service_categories(display_order)', { ascending: true })
          .order('display_order', { ascending: true });

        if (subErr) {
          console.warn('⚠️ BookingPage - erro ao buscar serviços por categorias (subcategorias):', subErr);
        } else {
          servicesFromCategories = (subs || [])
            .filter((s: any) => s?.id && s?.name)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              price: Number(s.price || 0),
              duration: Number(s.duration || 30),
            }));
        }
      } catch (e) {
        console.warn('⚠️ BookingPage - erro inesperado ao buscar serviços por categorias:', e);
      }

      const usingCategories = servicesFromCategories.length > 0;
      const resolvedServices = usingCategories
        ? servicesFromCategories
        : (data as any)?.services_with_prices || [];

      console.log('🧩 BOOKING SERVICES SOURCE:', {
        establishmentId: data.id,
        usingCategories,
        categoriesCount: servicesFromCategories.length,
        legacyCount: Array.isArray((data as any)?.services_with_prices) ? (data as any).services_with_prices.length : 0,
        sample: resolvedServices.slice(0, 10).map((s: any) => ({ id: s?.id, name: s?.name })),
      });

      const resolvedEstablishment = {
        ...data,
        services_with_prices: resolvedServices,
      };

      console.log('✅ Estabelecimento encontrado:', resolvedEstablishment);
      setEstablishment(resolvedEstablishment);
      setIsBookingBlocked(false);

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

  // Capturar o beforeinstallprompt para instalação PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const isPWA = () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSPWA = (window.navigator as any).standalone === true;
    return isStandalone || isIOSPWA;
  };

  const handleDownloadApp = async () => {
    if (deferredPrompt) {
      try {
        // @ts-ignore
        await deferredPrompt.prompt();
        // @ts-ignore
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          return;
        }
      } catch { }
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIOS) {
      setInstallGuideTitle('Como instalar no iPhone');
      setInstallGuideSteps([
        'Toque no botão Compartilhar (□↑)',
        'Escolha "Adicionar à Tela Inicial"',
        'Toque em "Adicionar" para confirmar'
      ]);
    } else if (isAndroid) {
      setInstallGuideTitle('Como instalar no Android');
      setInstallGuideSteps([
        'Toque nos 3 pontos (⋮) do navegador',
        'Selecione "Adicionar à tela inicial"',
        'Confirme tocando em "Adicionar"'
      ]);
    } else {
      setInstallGuideTitle('Como instalar no seu navegador');
      setInstallGuideSteps([
        'Clique nos 3 pontos (⋮) no canto do navegador',
        'Clique em "Instalar Agendei Fácil"',
        'Depois clique em "Instalar" para confirmar'
      ]);
    }
    setShowInstallGuide(true);
  };

  const fetchExistingAppointments = async () => {
    if (!establishment) return;

    try {
      // ✅ LIMPEZA AUTOMÁTICA: liberar horários presos por pagamento pendente antigo
      // Se o cliente fechou a aba antes de pagar, o agendamento pode ficar em pending_payment e bloquear a vaga.
      // Aqui cancelamos pendências antigas para não "travar" o booking.
      // ✅ CORRIGIDO: NÃO cancelar se tiver payment_transaction_id (pagamento foi iniciado e pode estar sendo processado)
      // ✅ CORRIGIDO: Aumentar tempo limite para 15 minutos (webhook pode demorar)
      const thresholdMinutes = 15; // Aumentado de 2 para 15 minutos para dar tempo do webhook processar
      const thresholdDate = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
      await supabase
        .from('appointments')
        .update({ status: 'cancelled', payment_status: 'failed' })
        .eq('establishment_id', establishment.id)
        .eq('status', 'pending_payment')
        .is('payment_transaction_id', null) // ✅ CORRIGIDO: Só cancelar se NÃO tiver transaction_id (pagamento não foi iniciado)
        .lt('created_at', thresholdDate);

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

  // ✅ Se o PIX é obrigatório e o usuário fechar/recarregar a página sem pagar,
  // precisamos cancelar o pending_payment para não "travar" o horário.
  // Usamos fetch keepalive direto no REST do Supabase para aumentar a chance de concluir no unload.
  useEffect(() => {
    if (!showPaymentModal) return;
    if (!pendingAppointmentId) return;
    if (paymentIsOptional) return;

    const appointmentId = pendingAppointmentId;

    const cancelPendingPaymentKeepalive = () => {
      try {
        const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
        const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
        if (!supabaseUrl || !anonKey) return;

        void fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${encodeURIComponent(appointmentId)}`, {
          method: 'PATCH',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ status: 'cancelled', payment_status: 'failed' }),
          // @ts-expect-error - keepalive existe em browsers modernos
          keepalive: true,
        });
      } catch {
        // silêncio: é melhor tentar do que bloquear o usuário
      }
    };

    const handleBeforeUnload = () => cancelPendingPaymentKeepalive();
    const handlePageHide = () => cancelPendingPaymentKeepalive();
    const handleVisibilityChange = () => {
      if (document.hidden) cancelPendingPaymentKeepalive();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showPaymentModal, pendingAppointmentId, paymentIsOptional]);

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
        // 👁️ FILTRAR assinaturas ocultas (is_hidden = true) para não mostrar no Booking
        const visibleSubscriptions = subscriptionsData.filter(sub => !sub.is_hidden);

        console.log('📋 Total de assinaturas:', subscriptionsData.length);
        console.log('👁️ Assinaturas ocultas:', subscriptionsData.filter(sub => sub.is_hidden).length);
        console.log('✅ Assinaturas visíveis:', visibleSubscriptions.length);

        setSubscriptions(visibleSubscriptions);
        console.log('✅ Assinaturas carregadas no Booking:', visibleSubscriptions.length, 'planos visíveis');
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
    // Buscar a assinatura completa para verificar se tem link personalizado
    const subscription = subscriptions.find(sub => sub.name === subscriptionName);

    // Verificar Pagar.me: SEMPRE priorizar valor do banco de dados
    // Se estiver false no banco, NÃO usar Pagar.me mesmo que localStorage diga true
    const isPagarmeSubscriptionPixEnabled = Boolean((establishment as any)?.use_pagarme_subscription_pix === true);
    
    // Verificar Mercado Pago: SEMPRE priorizar valor do banco de dados
    // ✅ Usar try-catch para evitar erro se coluna não existir ainda
    let isMercadoPagoSubscriptionPixEnabled = false;
    try {
      isMercadoPagoSubscriptionPixEnabled = Boolean((establishment as any)?.use_mercadopago_subscription_pix === true);
    } catch {
      // Coluna ainda não existe no banco, usar false
      isMercadoPagoSubscriptionPixEnabled = false;
    }
    const hasMercadoPagoAccessToken = !!String((establishment as any)?.mercadopago_access_token || '').trim();

    // Se Mercado Pago estiver ativado e conectado, usar Mercado Pago
    if (isMercadoPagoSubscriptionPixEnabled && hasMercadoPagoAccessToken) {
      if (!subscription) {
        toast.error('Assinatura não encontrada');
        return;
      }
      // Abrir modal de pagamento Mercado Pago
      setSelectedSubscriptionForPix(subscription);
      setShowSubscriptionPixModal(true);
      setShowSubscriptionsDropdown(false);
      return;
    }

    // Se Pagar.me PIX estiver ativado, abrir modal de pagamento (sem cobrança automática)
    if (isPagarmeSubscriptionPixEnabled) {
      if (!subscription) {
        toast.error('Assinatura não encontrada');
        return;
      }
      setSelectedSubscriptionForPix(subscription);
      setShowSubscriptionPixModal(true);
      setShowSubscriptionsDropdown(false);
      return;
    }

    // Se tiver link personalizado, redirecionar para ele
    if (subscription && subscription.custom_link && subscription.custom_link.trim()) {
      const customLink = subscription.custom_link.trim();
      window.open(customLink, '_blank');
      setShowSubscriptionsDropdown(false);
      return;
    }

    // Comportamento padrão: WhatsApp
    if (!establishment?.whatsapp) {
      toast.error('WhatsApp não configurado para este estabelecimento');
      return;
    }

    const message = `Quero ser assinante ${subscriptionName.toLowerCase()}`;
    let phoneNumber = establishment.whatsapp.replace(/\D/g, '');

    // Adicionar código do país se não tiver
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = '55' + phoneNumber;
    }

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
    setShowSubscriptionsDropdown(false);
  };

  const handleSaberMaisClick = () => {
    if (!establishment?.whatsapp) {
      toast.error('WhatsApp não configurado para este estabelecimento');
      return;
    }

    const message = 'Quero informações sobre Assinantes.';
    let phoneNumber = establishment.whatsapp.replace(/\D/g, '');

    // Adicionar código do país se não tiver
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = '55' + phoneNumber;
    }

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

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
    if (id === '3814' || id === '3315') {
      // Lógica para agendamento demonstrativo
      toast.success('Atenção! Este foi um agendamento demonstrativo, parabéns! Clique abaixo e volte ao menu iniciar.', {
        duration: 6000 // Aumenta a duração para a mensagem completa
      });
      setShowBookingForm(false); // Esconder formulário após agendamento demonstrativo
      setShowDemoSuccessModal(true); // Exibir modal de sucesso de demonstração

      // REDIRECIONAMENTO ESPECÍFICO: APENAS para /booking/3814
      if (id === '3814') {
        // Aguardar um pouco para o usuário ver a mensagem de sucesso
        setTimeout(() => {
          navigate('/conhecer');
        }, 2000); // 2 segundos de delay
      }

      return; // Sair da função para não salvar no banco
    }

    if (!establishment) return;

    // Se não tem user, mas tem guestClientData, criar/fazer login automaticamente
    let currentUser = user;
    if (!currentUser && guestClientData) {
      console.log('🔍 Criando/fazendo login para cliente convidado...');
      const { user: newUser, error: createError } = await createGuestClientAndLogin(
        guestClientData.name,
        guestClientData.phone
      );

      if (createError) {
        toast.error('Erro ao criar conta: ' + createError.message);
        return;
      }

      currentUser = newUser;
      console.log('✅ Cliente convidado criado/autenticado:', newUser?.id);
    }

    if (!currentUser) {
      toast.error('Erro: usuário não identificado');
      return;
    }

    // Helper: evita ficar preso para sempre em chamadas do Supabase
    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
        )
      ]);
    };

    try {
      // Lógica para agendamentos reais
      const isEstablishmentOwner = currentUser?.id === establishment.owner_id;

      // ✅ PAGAMENTO ANTECIPADO (Pagar.me ou Mercado Pago) - Booking público
      // Regra: se exigir pagamento antecipado, o agendamento só confirma após pagar.
      const exigirPagamentoAntecipado = (establishment as any)?.exigir_pagamento_antecipado === true;
      const exigirPagamentoAntecipadoMercadoPago = (establishment as any)?.exigir_pagamento_antecipado_mercadopago === true;
      const pagamentoAdiantadoLiberadoAdmin = (establishment as any)?.pagamento_adiantado_liberado_admin === true;
      const pagamentoAdiantadoOpcional = (establishment as any)?.pagamento_adiantado_opcional === true;
      const pagamentoAdiantadoOpcionalMercadoPago = (establishment as any)?.pagamento_adiantado_opcional_mercadopago === true;
      const pagarmeRecipientId = String((establishment as any)?.pagarme_recipient_id || '').trim();
      const mercadopagoAccessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
      const isSubscriber = appointmentData?.is_subscriber === true;
      const valorAgendamento = Number(appointmentData?.price || 0);
      
      // Verificar se tem Pagar.me ou Mercado Pago configurado
      const hasPagarMe = !!pagarmeRecipientId;
      const hasMercadoPago = !!mercadopagoAccessToken;
      
      // ✅ CORRIGIDO: Cada gateway funciona INDEPENDENTE do outro
      // Se Mercado Pago está configurado para exigir → usar Mercado Pago
      // Se Pagar.me está configurado para exigir → usar Pagar.me
      // Prioridade: Mercado Pago se ambos estiverem marcados
      const usarMercadoPago = hasMercadoPago && exigirPagamentoAntecipadoMercadoPago;
      const usarPagarMe = !usarMercadoPago && hasPagarMe && exigirPagamentoAntecipado;
      
      // ✅ CORRIGIDO: Remover dependência de pagamento_adiantado_liberado_admin
      // Se algum gateway está configurado para exigir pagamento, funciona independente
      const pagamentoAdiantadoAtivo = (usarPagarMe || usarMercadoPago) && !isSubscriber && valorAgendamento > 0;
      const precisaPagamento = pagamentoAdiantadoAtivo && !(usarPagarMe ? pagamentoAdiantadoOpcional : pagamentoAdiantadoOpcionalMercadoPago);
      const permitePagamentoOpcional = pagamentoAdiantadoAtivo && (usarPagarMe ? pagamentoAdiantadoOpcional : pagamentoAdiantadoOpcionalMercadoPago);

      console.log('💳 DEBUG - BookingPage/handleSubmit pagamento:', {
        exigirPagamentoAntecipado,
        exigirPagamentoAntecipadoMercadoPago,
        pagamentoAdiantadoLiberadoAdmin,
        pagamentoAdiantadoOpcional,
        pagamentoAdiantadoOpcionalMercadoPago,
        isSubscriber,
        valorAgendamento,
        precisaPagamento,
        usarPagarMe,
        usarMercadoPago,
        hasPagarmeRecipientId: Boolean(pagarmeRecipientId),
        hasMercadoPagoToken: Boolean(mercadopagoAccessToken),
        pagarmeRecipientIdPreview: pagarmeRecipientId ? `${pagarmeRecipientId.slice(0, 6)}...${pagarmeRecipientId.slice(-4)}` : null
      });

      if (precisaPagamento) {
        if (usarPagarMe && !pagarmeRecipientId) {
          toast.error('Este estabelecimento exige pagamento antecipado, mas ainda não configurou o recebedor Pagar.me. Fale com o estabelecimento.');
          return;
        }
        if (usarMercadoPago && !mercadopagoAccessToken) {
          toast.error('Este estabelecimento exige pagamento antecipado, mas ainda não configurou o Mercado Pago. Fale com o estabelecimento.');
          return;
        }

        console.log('🧾 DEBUG - Criando agendamento pending_payment no Supabase...', {
          establishment_id: establishment.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          appointment_time: appointmentData?.appointment_time,
          professional: appointmentData?.professional,
          service: appointmentData?.service,
          price: appointmentData?.price
        });

        const { data: inserted, error: insertError } = await withTimeout(
          supabase
            .from('appointments')
            .insert([{
              client_id: currentUser.id,
              establishment_id: establishment.id,
              establishment_code: establishment.code,
              appointment_date: format(selectedDate, 'yyyy-MM-dd'),
              status: 'pending_payment',
              payment_status: 'pending',
              payment_method: 'pendente',
              ...appointmentData
            }])
            .select('id')
            .single(),
          20000,
          'insert appointments (pending_payment)'
        );

        if (insertError) throw insertError;

        console.log('✅ DEBUG - Agendamento pending_payment criado:', inserted?.id);
        setPendingAppointmentId(inserted.id);
        setPendingPaymentAmount(valorAgendamento);
        setPendingCustomerData({
          name: appointmentData?.client_name || guestClientData?.name || 'Cliente',
          phone: appointmentData?.client_whatsapp || guestClientData?.phone,
          email: currentUser?.email || undefined,
          document: appointmentData?.client_cpf || undefined,
        });
        setPaymentIsOptional(false);
        setShowPaymentModal(true);
        // Armazenar qual gateway usar (Pagar.me ou Mercado Pago)
        (window as any).__paymentGateway = usarPagarMe ? 'pagarme' : 'mercadopago';
        return;
      }

      // 🔥 VALIDAÇÃO DE 1 AGENDAMENTO POR SEMANA PARA ASSINANTES
      if (appointmentData.is_subscriber && currentUser?.id) {
        console.log('🔍 Validando limitação de 1 agendamento por semana...');

        const validation = await validateOneWeekLimit(
          currentUser.id,
          establishment.id,
          new Date(appointmentData.appointment_date)
        );

        if (!validation.canBook) {
          console.log('🚫 Agendamento bloqueado:', validation.message);
          toast.error(validation.message || 'Erro na validação');
          return;
        }

        console.log('✅ Validação de 1 agendamento por semana passou');
      }

      // 🔥 VALIDAÇÃO DE REMARCAÇÃO NO MESMO DIA PARA ASSINANTES
      if (appointmentData.is_subscriber && currentUser?.id) {
        console.log('🔍 Validando remarcação no mesmo dia...');

        const sameDayValidation = await validateSameDayReschedule(
          currentUser.id,
          establishment.id,
          new Date(appointmentData.appointment_date),
          appointmentData.is_subscriber
        );

        if (!sameDayValidation.canBook) {
          console.log('🚫 Agendamento bloqueado por remarcação no mesmo dia:', sameDayValidation.message);
          toast.error(sameDayValidation.message || 'Erro na validação de remarcação');
          return;
        }

        console.log('✅ Validação de remarcação no mesmo dia passou');
      }

      // 🔥 VALIDAÇÃO DE PUNIÇÃO POR CANCELAMENTO - REMOVIDA
      // Sistema de punição foi removido conforme remove_punishment_feature.sql

      console.log('🧾 DEBUG - Criando agendamento normal no Supabase...', {
        establishment_id: establishment.id,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: appointmentData?.appointment_time,
        professional: appointmentData?.professional,
        service: appointmentData?.service,
        price: appointmentData?.price,
        payment_method: appointmentData?.payment_method
      });

      const { data: insertedAppointment, error } = await withTimeout(
        supabase
          .from('appointments')
          .insert([{
            client_id: currentUser.id,
            establishment_id: establishment.id,
            establishment_code: establishment.code, // Salvar código do estabelecimento
            appointment_date: format(selectedDate, 'yyyy-MM-dd'),
            ...appointmentData
          }])
          .select('id')
          .single(),
        20000,
        'insert appointments (normal)'
      );

      if (error) throw error;

      toast.success('Agendamento realizado com sucesso!');

      // Store appointment data for dashboard reminder modal
      // Buscar o nome do profissional do banco de dados
      let professionalName = 'Não especificado';
      try {
        const { data: professionalData } = await supabase
          .from('establishments')
          .select('professionals')
          .eq('id', establishment.id)
          .single();

        if (professionalData?.professionals) {
          const professional = professionalData.professionals.find((p: any) => p.id === appointmentData.professional);
          professionalName = professional?.name || 'Não especificado';
        }
      } catch (error) {
        console.error('Erro ao buscar nome do profissional:', error);
      }

      const appointmentInfo = {
        serviceName: appointmentData.service || 'Serviço não especificado',
        establishmentName: establishment?.name || '',
        establishmentCode: establishment?.code || '', // Adicionar código do estabelecimento
        appointmentDate: format(selectedDate, 'dd/MM/yyyy'),
        appointmentTime: appointmentData.appointment_time,
        location: establishment?.location || establishment?.address || '',
        professionalName: professionalName,
        paymentMethod: appointmentData.payment_method || 'Não especificada',
        appointmentId: currentUser.id,
        uniqueKey: Date.now().toString() // Chave única baseada no timestamp
      };
      localStorage.setItem('reminder_creation_data', JSON.stringify(appointmentInfo));

      // Atualizar lista de agendamentos após sucesso
      await fetchExistingAppointments();
      setShowBookingForm(false); // Esconder formulário após agendamento

      // Salvar o telefone no localStorage para usar na página de visualização
      const phoneForViewAppointments = (appointmentData?.client_whatsapp || guestClientData?.phone || '').toString();
      if (phoneForViewAppointments) {
        const cleanPhone = phoneForViewAppointments.replace(/\D/g, '');
        localStorage.setItem('last_booking_phone', cleanPhone);
        console.log('📱 Telefone salvo para visualização:', cleanPhone);
      }

      // Se pagamento é opcional, perguntar se deseja pagar agora (mas já salvamos telefone/reminder acima)
      if (permitePagamentoOpcional) {
        const hasPaymentGateway = (usarPagarMe && pagarmeRecipientId) || (usarMercadoPago && mercadopagoAccessToken);
        if (!hasPaymentGateway) {
          // Sem gateway configurado: só seguir como normal
          console.warn('⚠️ Pagamento opcional ativo, mas sem gateway configurado. Seguindo sem pagamento.');
        } else {
          setPendingAppointmentId(insertedAppointment?.id || null);
          setPendingPaymentAmount(valorAgendamento);
          setPendingCustomerData({
            name: appointmentData?.client_name || guestClientData?.name || 'Cliente',
            phone: appointmentData?.client_whatsapp || guestClientData?.phone,
            email: currentUser?.email || undefined,
            document: appointmentData?.client_cpf || undefined,
          });
          setPaymentIsOptional(true);
          setShowOptionalPayPrompt(true);
          // Armazenar qual gateway usar (Pagar.me ou Mercado Pago)
          (window as any).__paymentGateway = usarPagarMe ? 'pagarme' : 'mercadopago';
          return;
        }
      }

      // Redirecionar para a página de visualização de agendamentos
      toast.success('Redirecionando para seus agendamentos...');
      setTimeout(() => {
        const cleanPhone = phoneForViewAppointments ? phoneForViewAppointments.replace(/\D/g, '') : '';
        // ✅ Proteção contra múltiplos redirects
        if (isReloadingRef.current) return;
        isReloadingRef.current = true;
        window.location.href = cleanPhone ? `/view-appointments?phone=${encodeURIComponent(cleanPhone)}` : '/view-appointments';
      }, 1000);
    } catch (error: any) {
      // Supabase costuma trazer { message, details, hint, code }
      const code = error?.code || error?.status || undefined;
      const details = error?.details || error?.hint || undefined;
      console.error('Error creating appointment:', error);
      toast.error(
        [error?.message || 'Erro ao criar agendamento', code ? `(código: ${code})` : null, details ? `- ${details}` : null]
          .filter(Boolean)
          .join(' ')
      );
    } finally {
      setIsLoading(false);
    }
  };



  const handleAgendarClick = () => {
    if (id === '3814' || id === '3315') {
      setShowBookingForm(true);
      safeSessionSet(QUICK_BOOKING_FLOW_KEY, 'form');
      return;
    }

    // NOVO FLUXO: Sempre usar modal de agendamento rápido (sem login)
    setShowQuickBookingModal(true);
    safeSessionSet(QUICK_BOOKING_FLOW_KEY, 'modal');
  };

  // Função para continuar após preencher nome e telefone
  const handleContinueQuickBooking = (name: string, phone: string) => {
    setGuestClientData({ name, phone });
    setShowQuickBookingModal(false);
    setShowBookingForm(true);

    safeSessionSet(QUICK_BOOKING_FLOW_KEY, 'form');
    safeSessionSet(QUICK_BOOKING_DATA_KEY, JSON.stringify({ name, phone }));
  };

  const normalizePhoneDigits = (phone: string) => String(phone || '').replace(/\D/g, '');
  const filaEsperaAtiva = Boolean((establishment as any)?.fila_espera_ativa);
  const filaEsperaFechada = Boolean((establishment as any)?.fila_espera_fechada);

  // Prefill de nome/telefone para fila (se já coletou no fluxo rápido)
  useEffect(() => {
    if (!guestClientData) return;
    if (!waitlistName) setWaitlistName(guestClientData.name || '');
    if (!waitlistPhone) setWaitlistPhone(guestClientData.phone || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestClientData]);

  const fetchWaitlist = async () => {
    if (!establishment?.id) return;
    setIsLoadingWaitlist(true);
    try {
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('id, client_name, client_whatsapp, service_name, service_price, service_duration_minutes, started_at, created_at')
        .eq('establishment_id', establishment.id)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true });

      if (error) {
        const msg = String((error as any)?.message || '');
        // Fallback para banco ainda não migrado (colunas novas não existem)
        if (msg.includes('does not exist') && msg.includes('waitlist_entries')) {
          const { data: legacyData, error: legacyError } = await supabase
            .from('waitlist_entries')
            .select('id, client_name, client_whatsapp, service_name, created_at')
            .eq('establishment_id', establishment.id)
            .eq('status', 'waiting')
            .order('created_at', { ascending: true });
          if (legacyError) throw legacyError;
          setWaitlistEntries(((legacyData as any[]) || []).map((r: any) => ({ ...r })));
          return;
        }
        throw error;
      }
      setWaitlistEntries((data as any[]) || []);
    } catch (e: any) {
      console.error('❌ Erro ao carregar fila (booking):', e);
      toast.error(e?.message || 'Erro ao carregar fila de espera');
    } finally {
      setIsLoadingWaitlist(false);
    }
  };

  useEffect(() => {
    if (!showWaitlistModal) return;
    fetchWaitlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWaitlistModal, establishment?.id]);

  const fmtBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const labelServicoFila = (s: any) => {
    const nome = String(s?.name || 'Serviço').trim() || 'Serviço';
    const preco = Number(s?.price ?? 0);
    const dur = Number(s?.duration ?? s?.service_duration ?? 0);
    const partes: string[] = [nome];
    if (Number.isFinite(preco) && preco > 0) partes.push(fmtBRL(preco));
    if (Number.isFinite(dur) && dur > 0) partes.push(`${dur}min`);
    return partes.join(' — ');
  };

  const calcularMinutosRestantes = (entries: any[], idx: number): number | null => {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const first = entries[0];
    const startedAt = first?.started_at ? new Date(first.started_at) : null;
    const dur0 = Number(first?.service_duration_minutes ?? 0);
    if (!startedAt || !Number.isFinite(dur0) || dur0 <= 0) return null;

    let finish = startedAt.getTime() + dur0 * 60_000;
    for (let i = 1; i <= idx; i++) {
      const d = Number(entries[i]?.service_duration_minutes ?? 0);
      if (i === idx) break;
      if (Number.isFinite(d) && d > 0) finish += d * 60_000;
    }
    // Para o item idx, estimar início = finish; fim = início + duração do idx
    const dIdx = Number(entries[idx]?.service_duration_minutes ?? 0);
    if (idx === 0) {
      // restante do atual
      const ms = finish - Date.now();
      return Math.max(0, Math.ceil(ms / 60_000));
    }
    if (!Number.isFinite(dIdx) || dIdx <= 0) return null;
    const startIdx = finish;
    const ms = startIdx - Date.now();
    return Math.max(0, Math.ceil(ms / 60_000));
  };

  const handleEntrarNaFila = async () => {
    if (!establishment?.id) return;
    if (!filaEsperaAtiva) {
      toast.error('Fila de espera não está ativa neste estabelecimento.');
      return;
    }
    if (filaEsperaFechada) {
      toast.error('Fila de espera está fechada no momento.');
      return;
    }

    const nome = String(waitlistName || '').trim();
    const phoneDigits = normalizePhoneDigits(waitlistPhone);
    const serviceId = String(waitlistServiceId || '').trim();

    if (!nome) {
      toast.error('Informe seu nome.');
      return;
    }
    if (!phoneDigits) {
      toast.error('Informe seu telefone/WhatsApp.');
      return;
    }
    if (!serviceId) {
      toast.error('Selecione um serviço.');
      return;
    }

    const servico = ((establishment as any)?.services_with_prices || []).find((s: any) => String(s.id) === serviceId);
    const serviceName = String(servico?.name || 'Serviço').trim() || 'Serviço';
    const servicePrice = Number(servico?.price ?? 0);
    const serviceDuration = Number(servico?.duration ?? servico?.service_duration ?? 0);

    const profissionalPadraoId = String((establishment as any)?.fila_espera_profissional_id || '').trim();
    if (!profissionalPadraoId) {
      toast.error('Fila de espera ainda não foi configurada com um profissional. Peça ao estabelecimento para ativar corretamente no dashboard.');
      return;
    }

    try {
      // Garantir que existe um "cliente convidado" logado (sem exigir email/senha)
      const guestRes = await createGuestClientAndLogin(nome, phoneDigits);
      if (guestRes?.error) throw guestRes.error;

      const now = new Date();
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const appointmentDate = format(now, 'yyyy-MM-dd');
      const appointmentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      // Criar um "agendamento" ligado à fila para contabilizar no profissional (respeita configs do profissional)
      const insertAppointmentPayload: any = {
        client_id: (guestRes as any)?.user?.id,
        establishment_id: establishment.id,
        establishment_code: establishment.code,
        client_name: nome,
        client_whatsapp: phoneDigits,
        service: serviceName,
        professional: profissionalPadraoId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration: Number.isFinite(serviceDuration) ? serviceDuration : 0,
        price: Number.isFinite(servicePrice) ? servicePrice : 0,
        status: 'pending',
        is_waitlist: true,
      };

      let insertedAppointmentId: string | null = null;
      {
        const { data: insertedAppointment, error: apptErr } = await supabase
          .from('appointments')
          .insert([insertAppointmentPayload])
          .select('id')
          .single();

        if (apptErr) {
          const msg = String((apptErr as any)?.message || '');
          // Fallback para banco ainda não migrado (coluna is_waitlist não existe)
          if (msg.includes('does not exist') && msg.includes('is_waitlist')) {
            const { data: insertedLegacy, error: apptLegacyErr } = await supabase
              .from('appointments')
              .insert([
                {
                  ...insertAppointmentPayload,
                  is_waitlist: undefined,
                } as any,
              ])
              .select('id')
              .single();
            if (apptLegacyErr) throw apptLegacyErr;
            insertedAppointmentId = insertedLegacy?.id || null;
          } else {
            throw apptErr;
          }
        } else {
          insertedAppointmentId = insertedAppointment?.id || null;
        }
      }

      if (!insertedAppointmentId) {
        throw new Error('Não foi possível criar o agendamento da fila.');
      }

      // Criar entrada na fila referenciando o agendamento
      const waitlistPayload: any = {
        establishment_id: establishment.id,
        appointment_id: insertedAppointmentId,
        client_name: nome,
        client_whatsapp: phoneDigits,
        service_id: serviceId,
        service_name: serviceName,
        service_price: Number.isFinite(servicePrice) ? servicePrice : null,
        service_duration_minutes: Number.isFinite(serviceDuration) ? serviceDuration : null,
        professional_id: profissionalPadraoId,
        source: 'booking',
        status: 'waiting',
      };

      let insertedEntryId: string | null = null;
      {
        const { data: insertedEntry, error: wlErr } = await supabase
          .from('waitlist_entries')
          .insert(waitlistPayload)
          .select('id')
          .single();

        if (wlErr) {
          const msg = String((wlErr as any)?.message || '');
          // Fallback para banco ainda não migrado (colunas novas não existem)
          if (msg.includes('schema cache') || (msg.includes('does not exist') && msg.includes('waitlist_entries'))) {
            const { data: insertedLegacy, error: wlLegacyErr } = await supabase
              .from('waitlist_entries')
              .insert({
                establishment_id: establishment.id,
                appointment_id: insertedAppointmentId,
                client_name: nome,
                client_whatsapp: phoneDigits,
                service_id: serviceId,
                service_name: serviceName,
                source: 'booking',
                status: 'waiting',
              } as any)
              .select('id')
              .single();
            if (wlLegacyErr) throw wlLegacyErr;
            insertedEntryId = insertedLegacy?.id || null;
          } else {
            throw wlErr;
          }
        } else {
          insertedEntryId = insertedEntry?.id || null;
        }
      }

      if (!insertedEntryId) {
        throw new Error('Não foi possível criar a entrada da fila.');
      }

      // Link reverso (opcional)
      try {
        await supabase
          .from('appointments')
          .update({ waitlist_entry_id: insertedEntryId } as any)
          .eq('id', insertedAppointmentId);
      } catch {
        // ignore
      }

      toast.success('✅ Você entrou na fila de espera!');
      setShowJoinWaitlistForm(false);
      setWaitlistServiceId('');
      await fetchWaitlist();
    } catch (e: any) {
      console.error('❌ Erro ao entrar na fila:', e);
      toast.error(e?.message || 'Erro ao entrar na fila');
    }
  };

  const handleSairDaFila = async () => {
    if (!establishment?.id) return;
    if (!filaEsperaAtiva) {
      toast.error('Fila de espera não está ativa neste estabelecimento.');
      return;
    }
    if (filaEsperaFechada) {
      toast.error('Fila de espera está fechada no momento.');
      return;
    }

    const phoneDigits = normalizePhoneDigits(leaveWaitlistPhone);
    if (!phoneDigits) {
      toast.error('Informe o telefone/WhatsApp que você usou para entrar na fila.');
      return;
    }
    const phoneAlt =
      phoneDigits.startsWith('55') ? phoneDigits.slice(2) : phoneDigits.length >= 10 ? `55${phoneDigits}` : '';

    try {
      // Pegar a entrada mais recente desse telefone (se a pessoa entrou mais de uma vez)
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('id, appointment_id')
        .eq('establishment_id', establishment.id)
        .eq('status', 'waiting')
        .in('client_whatsapp', [phoneDigits, phoneAlt].filter(Boolean))
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      const entryId = (data as any[])?.[0]?.id;
      const appointmentId = (data as any[])?.[0]?.appointment_id;
      if (!entryId) {
        toast.error('Não encontrei ninguém na fila com esse telefone.');
        return;
      }

      const { error: updErr } = await supabase.from('waitlist_entries').update({ status: 'cancelled' } as any).eq('id', entryId);
      if (updErr) {
        // Dica comum: falta policy de UPDATE pro cliente (RLS)
        const msg = String((updErr as any)?.message || '');
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('rls')) {
          toast.error('Sem permissão para sair da fila. O dono precisa rodar o SQL FINAL atualizado (policy de cancelamento).');
          return;
        }
        throw updErr;
      }

      // Se tiver appointment ligado, cancelar também (se o cliente tiver permissão)
      if (appointmentId) {
        try {
          await supabase.from('appointments').update({ status: 'cancelled' } as any).eq('id', appointmentId);
        } catch {
          // ignore
        }
      }

      toast.success('✅ Você saiu da fila.');
      setShowLeaveWaitlistForm(false);
      setLeaveWaitlistPhone('');
      await fetchWaitlist();
    } catch (e: any) {
      console.error('❌ Erro ao sair da fila:', e);
      toast.error(e?.message || 'Erro ao sair da fila');
    }
  };

  console.log('🔍 RENDER - Estados atuais:');
  console.log('  - isLoading:', isLoading);
  console.log('  - establishment:', establishment);
  console.log('  - establishment existe?', !!establishment);
  console.log('  - forceRender:', forceRender);
  console.log('  - showBookingForm:', showBookingForm);

  // ⛔ Removido retry durante render (causava flicker/instabilidade em mobile)

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

  // Verificar se o booking está bloqueado
  if (isBookingBlocked) {
    const whatsappRaw = establishment?.whatsapp as string | undefined;
    const whatsappDigits = (whatsappRaw || '').replace(/\D/g, '');
    const whatsappE164 =
      whatsappDigits.length === 0 ? '' : whatsappDigits.startsWith('55') ? whatsappDigits : `55${whatsappDigits}`;

    const handleMandarMensagemBarbeiro = () => {
      if (!whatsappE164) {
        toast.error('WhatsApp do barbeiro não está cadastrado.');
        return;
      }

      const mensagem = encodeURIComponent(
        'Opa, fui agendar no Agendei Fácil e não consegui. O que houve?\n\n' +
          'Preciso agendar e não abriu para mim. Diz: "Página desativada temporariamente".'
      );

      window.open(`https://wa.me/${whatsappE164}?text=${mensagem}`, '_blank', 'noopener,noreferrer');
    };

    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f0f6ff' }}>
        <div className="container-custom py-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4 text-gray-900">Estabelecimento Inativo</h1>
            <p className="text-gray-600 mb-4 text-lg">Este estabelecimento está inativo.</p>
            <button
              type="button"
              onClick={handleMandarMensagemBarbeiro}
              className="inline-flex items-center justify-center mt-2 mb-4 px-5 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              Mandar mensagem barbeiro
            </button>
            <div className="mt-1">
              <div className="text-xs text-gray-500">
                {whatsappE164 ? 'Abrirá o WhatsApp para falar com o estabelecimento.' : 'Estabelecimento sem WhatsApp cadastrado.'}
              </div>
            </div>
            <Link to="/" className="text-primary hover:underline">
              Voltar para a página inicial
            </Link>
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
     <div
       className="app-background relative overflow-x-hidden text-white"
       style={{
         background:
           'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.42) 100%), radial-gradient(circle at top center, #262626 0%, #161616 35%, #0B0B0B 70%), #0B0B0B'
       }}
     >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-white/80 hover:text-[#e6d7b1] transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <span>Voltar</span>
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Salvar código do estabelecimento no localStorage para usar na página de agendamentos
                  if (establishment?.code) {
                    localStorage.setItem('current_establishment_code', establishment.code);
                  }
                  if (establishment?.id) {
                    localStorage.setItem('current_establishment_id', establishment.id);
                  }
                  navigate('/view-appointments');
                }}
                className="text-[#e6d7b1] hover:text-[#f3e7c7] font-semibold text-sm transition-colors"
              >
                Meus Agendamentos
              </button>
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sair</span>
                </button>
              )}
            </div>
          </div>

          {/* Mensagem de Demonstração (apenas para IDs 3814 e 3315) */}
          {(id === '3814' || id === '3315') && (
            <div className="bg-[#1b160b] text-[#f3e7c7] p-4 rounded-2xl flex flex-col items-center justify-center gap-1 mb-4 sm:flex-row sm:gap-2 border border-[#3b2a16]">
              <AlertCircle className="h-8 w-8 sm:h-5 sm:w-5" />
              <p className="font-semibold text-sm sm:text-base text-center animate-pulse-custom-slow">
                Essa é a pagina que seu cliente ira ver ao acessar o seu link, porem com as suas proprias fotos e links personalizados.
              </p>
            </div>
          )}




          {/* Carrossel atrás do perfil (se configurado) */}
          {establishment?.carousel_position === 'behind' && (
            <div className="relative mb-12">
              {/* Container do carrossel */}
              <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-300 shadow-lg">
                {/* Imagem atual */}
                <div className="relative w-full h-full">
                  <img
                    src={duplicatePhotos[duplicateCarouselIndex]}
                    alt={`Foto ${duplicateCarouselIndex + 1}`}
                    className="w-full h-full object-cover transition-opacity duration-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const defaultPhotos = ['/barbeiro ft 1.png', '/barbeiro ft 2.png', '/barbeiro ft 3.png'];
                      target.src = defaultPhotos[duplicateCarouselIndex % defaultPhotos.length];
                    }}
                  />

                  {/* Overlay escuro para melhor contraste dos botões */}
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                </div>

                {/* Botão Anterior */}
                <button
                  onClick={goToPreviousDuplicate}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Botão Próximo */}
                <button
                  onClick={goToNextDuplicate}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Indicadores (bolinhas) - No lado esquerdo */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-10">
                  {duplicatePhotos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlideDuplicate(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${index === duplicateCarouselIndex
                        ? 'bg-white'
                        : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                        }`}
                      aria-label={`Ir para foto ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Contador */}
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-10">
                  {duplicateCarouselIndex + 1} / {duplicatePhotos.length}
                </div>
              </div>

              {/* Logo do Estabelecimento - Sobreposta para fora do carrossel */}
              <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 z-20">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white">
                  <img
                    src={establishment?.logo_url || '/fotopessoa.png'}
                    alt={establishment?.name || 'Logo'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/fotopessoa.png';
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Logo do Estabelecimento - Só aparece quando carrossel não está atrás */}
          {establishment?.carousel_position !== 'behind' && (
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/15 shadow-2xl bg-black/30">
                <img
                  src={establishment?.logo_url || '/fotopessoa.png'}
                  alt={establishment?.name || 'Logo'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/fotopessoa.png';
                  }}
                />
              </div>
            </div>
          )}

          {/* Informações do Estabelecimento */}
          <div className="text-center space-y-2 relative z-30" style={{ marginTop: establishment?.carousel_position === 'behind' ? '80px' : '20px' }}>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">{establishment?.name}</h1>
            {establishment?.description && (
              <p className="text-white/70">
                <ReadMore
                  text={establishment.description}
                  maxLength={60}
                  className="text-white/70"
                />
              </p>
            )}

            {/* Botões de Ação Principal */}
            <div className="mt-6 flex flex-col space-y-6 relative z-10">
              {/* Card premium (estilo do exemplo) */}
              <div
                className="w-full rounded-2xl overflow-hidden border shadow-[0_18px_55px_rgba(0,0,0,0.55)]"
                style={{
                  borderColor: 'rgba(230,199,139,0.20)',
                  background:
                    'radial-gradient(140% 140% at 50% 0%, rgba(230,199,139,0.14) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.65) 100%)',
                }}
              >
                <div className="px-4 pt-5 pb-4 text-center">
                  <div
                    className="text-base text-white/80"
                    style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}
                  >
                    Bem-vindo ao nosso
                  </div>
                  <div className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-wide text-[#E6C78B] drop-shadow">
                    ESTABELECIMENTO
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {/* Item 1 */}
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rotate-45 rounded-xl border border-[#E6C78B]/35 bg-black/25 shadow-[0_10px_30px_rgba(0,0,0,0.55)] flex items-center justify-center">
                        <div className="-rotate-45">
                          <Home className="w-6 h-6 text-[#E6C78B]" />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] leading-tight font-semibold text-white/75">
                        Ambiente<br />Aconchegante
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rotate-45 rounded-xl border border-[#E6C78B]/35 bg-black/25 shadow-[0_10px_30px_rgba(0,0,0,0.55)] flex items-center justify-center">
                        <div className="-rotate-45">
                          <Users className="w-6 h-6 text-[#E6C78B]" />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] leading-tight font-semibold text-white/75">
                        Profissionais<br />Experientes
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rotate-45 rounded-xl border border-[#E6C78B]/35 bg-black/25 shadow-[0_10px_30px_rgba(0,0,0,0.55)] flex items-center justify-center">
                        <div className="-rotate-45">
                          <ThumbsUp className="w-6 h-6 text-[#E6C78B]" />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] leading-tight font-semibold text-white/75">
                        Atendimento<br />de Qualidade
                      </div>
                    </div>
                  </div>
                </div>

                <div className="-mt-2">
                  {/* CTA igual ao exemplo: tarja grande + botão menor escuro "encaixado" */}
                  <div className="px-6 pt-3 pb-7 flex justify-center">
                    <div className="w-full max-w-[520px]">
                      {/* Tarja grande dourada */}
                      <button
                        onClick={handleAgendarClick}
                        className="w-full font-extrabold py-4 px-6 text-base sm:text-lg uppercase tracking-wide transition-all duration-300 flex items-center justify-center text-black rounded-2xl border border-[#f3e7c7]/60 bg-gradient-to-r from-[#e6d7b1] to-[#d9c08c] shadow-[0_18px_45px_rgba(0,0,0,0.40)] hover:brightness-105 active:scale-[0.99]"
                      >
                        AGENDE SEU HORÁRIO
                      </button>

                      {/* Botão menor escuro "encaixado" (SEM cortar no rodapé do card) */}
                      <div className="flex justify-center -mt-4">
                        <button
                          onClick={handleAgendarClick}
                          className="w-[230px] sm:w-[260px] font-extrabold py-2.5 px-4 text-sm uppercase tracking-[0.18em] rounded-2xl transition-all duration-300 border border-[#f3e7c7]/60 bg-[#0b0c0f] text-[#E6C78B] hover:bg-black/70 active:scale-[0.99] agf-heartbeat-cta"
                        >
                          RESERVAR AGORA
                        </button>
                      </div>

                      {/* ✅ Botão Fila de Espera (aba/modal) */}
                      {filaEsperaAtiva && (
                        <div className="flex justify-center mt-3">
                          <button
                            type="button"
                            onClick={() => {
              if (filaEsperaFechada) return;
              setShowWaitlistModal(true);
              setShowJoinWaitlistForm(false);
                            }}
            className={`w-[230px] sm:w-[260px] font-extrabold py-2.5 px-4 text-sm uppercase tracking-[0.18em] rounded-2xl transition-all duration-300 border border-white/15 active:scale-[0.99] ${
              filaEsperaFechada
                ? 'bg-white/5 text-white/50 cursor-not-allowed'
                : 'bg-white/5 text-white/90 hover:bg-white/10'
            }`}
                          >
            {filaEsperaFechada ? 'FILA FECHADA' : 'FILA DE ESPERA'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dropdown SER ASSINANTE */}
              {subscriptions.length > 0 && (
                <div className="relative subscriptions-dropdown" style={{ position: 'relative', zIndex: 100 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowSubscriptionsDropdown(!showSubscriptionsDropdown);
                    }}
                    className="w-full font-extrabold py-4 px-6 text-base uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-3 relative group text-black rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                  >
                    <img src="/coroa.png" alt="Coroa" className="h-10 w-10 relative z-10" />
                    <span className="relative z-10 text-white/70">PLANOS MENSAIS</span>
                    <ChevronRight className="h-5 w-5 relative z-10 opacity-70" />
                  </button>

                  {showSubscriptionsDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f0f10] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto" style={{ zIndex: 100 }}>
                      {subscriptions.map((subscription) => (
                        <div
                          key={subscription.id}
                          className="flex items-center justify-between p-3 hover:bg-white/5 border-b border-white/10 last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{subscription.name || 'Assinatura'}</div>
                            <div className="text-sm text-white/60">
                              R$ {(subscription.value || 0).toFixed(2).replace('.', ',')} / {subscription.duration_months || 1} {subscription.duration_months === 1 ? 'mês' : 'meses'}
                            </div>
                            {subscription.weekdays && subscription.weekdays.length > 0 && (
                              <div className="text-xs text-[#e6d7b1] mt-1">
                                📅 {subscription.weekdays.map((day: string) => {
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
                          <div className="flex items-center gap-2">
                            {subscription.description && (
                              <button
                                onClick={() => {
                                  // Mostrar tooltip com descrição
                                  alert(`📋 ${subscription.name}\n\n${subscription.description}`);
                                }}
                                className="bg-white/10 hover:bg-white/15 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors border border-white/10"
                                title="Ver informações sobre esta assinatura"
                              >
                                Sobre
                              </button>
                            )}
                            <button
                              onClick={() => {
                                handleSubscribeClick(subscription.name);
                              }}
                              className="bg-[#e6d7b1] hover:bg-[#f3e7c7] text-black px-3 py-1 rounded-lg text-sm font-extrabold transition-colors"
                            >
                              Assinar
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Item fixo SABER MAIS */}
                      <div className="p-3 border-t border-white/10 bg-black/30">
                        <button
                          onClick={() => {
                            handleSaberMaisClick();
                          }}
                          className="w-full text-center text-[#e6d7b1] hover:text-[#f3e7c7] font-semibold text-sm transition-colors"
                        >
                          📞 SABER MAIS
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* Imagens INSTAGRAM, PIX e WHATSAPP lado a lado */}
              <div className="flex items-center justify-center gap-6 relative my-10">
                {/* Linha esquerda - vai da borda até antes do Instagram com distância */}
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 h-px bg-white/10" style={{ width: 'calc(50% - 120px)' }}></div>

                {/* Linha direita - vai depois do WhatsApp até a borda com distância */}
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 h-px bg-white/10" style={{ width: 'calc(50% - 120px)' }}></div>
                {/* Instagram */}
                <a
                  href={establishment?.social_media_link && !establishment.social_media_link.startsWith('http') ? `https://${establishment.social_media_link}` : establishment.social_media_link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group transition-all duration-200 ${establishment?.social_media_link
                    ? 'cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                    }`}
                >
                  <div className="booking-social-icon transition-transform duration-200 group-hover:scale-[1.03]">
                    <img
                      src="/INST.png"
                      alt="Instagram"
                      className="absolute inset-0 m-auto h-11 w-11 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                    />
                  </div>
                </a>

                {/* PIX */}
                <button
                  onClick={() => {
                    console.log('🔍 PIX Click - establishment:', establishment);
                    console.log('🔍 PIX Click - pix_key:', establishment?.pix_key);

                    if (establishment?.pix_key) {
                      // Método que funciona no mobile e desktop
                      const copyToClipboard = (text: string) => {
                        // Criar um input temporário
                        const input = document.createElement('input');
                        input.value = text;
                        input.style.position = 'fixed';
                        input.style.opacity = '0';
                        input.style.left = '-9999px';
                        document.body.appendChild(input);

                        // Selecionar e copiar
                        input.select();
                        input.setSelectionRange(0, 99999); // Para mobile

                        try {
                          const successful = document.execCommand('copy');
                          if (successful) {
                            console.log('✅ PIX copiado com sucesso:', text);
                            toast.success('Chave PIX copiada com sucesso!');
                          } else {
                            throw new Error('Falha na cópia');
                          }
                        } catch (err) {
                          console.error('❌ Erro ao copiar PIX:', err);
                          toast.error('Erro ao copiar chave PIX. Tente novamente.');
                        } finally {
                          // Remover o input temporário
                          document.body.removeChild(input);
                        }
                      };

                      copyToClipboard(establishment.pix_key);
                    } else {
                      console.log('❌ PIX não disponível');
                      toast.error('Chave PIX não disponível.');
                    }
                  }}
                  disabled={!establishment?.pix_key}
                  className={`group transition-all duration-200 ${establishment?.pix_key
                    ? 'cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                    }`}
                >
                  <div className="booking-social-icon transition-transform duration-200 group-hover:scale-[1.03]">
                    <img
                      src="/PIX.png"
                      alt="PIX"
                      className="absolute inset-0 m-auto h-11 w-11 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                    />
                  </div>
                </button>

                {/* WhatsApp */}
                <a
                  href={establishment?.whatsapp ? (() => {
                    let phoneNumber = establishment.whatsapp.replace(/\D/g, '');

                    // Lista de códigos de países com validação de tamanho mínimo
                    const countryCodes = [
                      { code: '351', minLength: 12 },
                      { code: '244', minLength: 12 },
                      { code: '54', minLength: 12 },
                      { code: '56', minLength: 11 },
                      { code: '55', minLength: 12 },
                      { code: '34', minLength: 11 },
                      { code: '1', minLength: 11 }
                    ];

                    // Verificar se o número já começa com algum código de país E tem tamanho válido
                    const hasCountryCode = countryCodes.some(
                      ({ code, minLength }) => phoneNumber.startsWith(code) && phoneNumber.length >= minLength
                    );

                    // Se não tiver código de país e for número brasileiro (10 ou 11 dígitos), adicionar 55
                    if (!hasCountryCode) {
                      if (phoneNumber.length >= 10 && phoneNumber.length <= 11) {
                        phoneNumber = '55' + phoneNumber;
                      }
                    }

                    return `https://wa.me/${phoneNumber}`;
                  })() : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group transition-all duration-200 ${establishment?.whatsapp
                    ? 'cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                    }`}
                >
                  <div className="booking-social-icon transition-transform duration-200 group-hover:scale-[1.03]">
                    <img
                      src="/wppicon.png"
                      alt="WhatsApp"
                      className="absolute inset-0 m-auto h-11 w-11 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                    />
                  </div>
                </a>
              </div>

              {/* Botões NOS AVALIE e LOCAL - Abaixo dos ícones */}
              <div className="flex gap-3 mt-6">
                {/* Botão NOS AVALIE */}
                <a
                  href={establishment?.review_link && !establishment.review_link.startsWith('http') ? `https://${establishment.review_link}` : establishment.review_link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex-1 font-extrabold py-3 px-4 text-sm uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 relative group rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${establishment?.review_link
                    ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-60'
                    }`}
                >
                  <img src="/google.png" alt="Google" className="h-5 w-5 relative z-10" />
                  <span className="relative z-10 whitespace-nowrap text-[#e6d7b1]">AVALIE-NOS</span>
                  {establishment?.review_link && <ChevronRight className="h-4 w-4 relative z-10 opacity-80 flex-shrink-0 text-white/70" />}
                </a>

                {/* Botão LOCAL */}
                <a
                  href={establishment?.location_link && !establishment.location_link.startsWith('http') ? `https://${establishment.location_link}` : establishment.location_link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex-1 font-extrabold py-3 px-4 text-sm uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 relative group rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${establishment?.location_link
                    ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-60'
                    }`}
                >
                  <img src="/LOCAL.png" alt="Localização" className="h-5 w-5 relative z-10" />
                  <span className="relative z-10 whitespace-nowrap text-[#e6d7b1]">LOCAL</span>
                  {establishment?.location_link && <ChevronRight className="h-4 w-4 relative z-10 opacity-80 flex-shrink-0 text-white/70" />}
                </a>
              </div>

              {/* Tela de Agendamento Assinante - Posicionada após os botões */}
              {showSubscriberBooking && (
                <div data-subscriber-booking className="bg-white/5 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] border border-white/10 p-6 text-white mt-4 z-50 relative">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-extrabold">Agendamento Assinante</h2>
                    <button
                      onClick={() => {
                        setShowSubscriberBooking(false);
                        setSelectedSubscriberService(null);
                      }}
                      className="text-white/60 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  {!selectedSubscriberService ? (
                    // Tela de seleção de serviços
                    <div>
                      <p className="text-lg text-white/75 mb-6">Selecione qual é o seu:</p>
                      <div className="space-y-4">
                        {subscriptions.map((subscription) => (
                          <div key={subscription.id} className="border border-white/10 rounded-2xl p-4 bg-black/30 hover:bg-white/5 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-extrabold text-white">{subscription.name}</h3>
                                <p className="text-sm text-white/60">
                                  R$ {subscription.value.toFixed(2).replace('.', ',')}
                                </p>
                                {subscription.weekdays && subscription.weekdays.length > 0 && (
                                  <p className="text-xs text-[#e6d7b1] mt-1">
                                    📅 {subscription.weekdays.map((day: string) => {
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
                        📅 Dias disponíveis: {selectedSubscriberService.weekdays?.map((day: string) => {
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
                        guestClientData={guestClientData} // Passar dados do cliente para preenchimento automático
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Carrossel de Fotos embaixo (se configurado ou padrão) */}
              {(establishment?.carousel_position === 'below' || !establishment?.carousel_position) && (
                <div className="mt-4 mb-2 rounded-lg overflow-hidden">
                  <div className="relative">
                    <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden bg-gray-100">
                      {/* Imagem atual */}
                      <div className="relative w-full h-full">
                        <img
                          src={duplicatePhotos[duplicateCarouselIndex]}
                          alt={`Foto ${duplicateCarouselIndex + 1}`}
                          className="w-full h-full object-cover transition-opacity duration-500"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const defaultPhotos = ['/barbeiro ft 1.png', '/barbeiro ft 2.png', '/barbeiro ft 3.png'];
                            target.src = defaultPhotos[duplicateCarouselIndex % defaultPhotos.length];
                          }}
                        />

                        {/* Overlay escuro para melhor contraste dos botões */}
                        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                      </div>

                      {/* Botão Anterior */}
                      <button
                        onClick={goToPreviousDuplicate}
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                        aria-label="Foto anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      {/* Botão Próximo */}
                      <button
                        onClick={goToNextDuplicate}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                        aria-label="Próxima foto"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>

                      {/* Indicadores (bolinhas) - No lado esquerdo */}
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-10">
                        {duplicatePhotos.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => goToSlideDuplicate(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-200 ${index === duplicateCarouselIndex
                              ? 'bg-white'
                              : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                              }`}
                            aria-label={`Ir para foto ${index + 1}`}
                          />
                        ))}
                      </div>

                      {/* Contador */}
                      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-10">
                        {duplicateCarouselIndex + 1} / {duplicatePhotos.length}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Profissionais (premium) - acima de Comodidades */}
              {establishment?.professionals && establishment.professionals.filter((p: any) => !p.hidden_from_booking).length > 0 && (
                <div className="mt-8 mb-6">
                  <div
                    className="rounded-2xl px-4 py-4 border shadow-[0_18px_55px_rgba(0,0,0,0.55)]"
                    style={{
                      background:
                        'radial-gradient(120% 140% at 50% 0%, rgba(230,199,139,0.10) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.55) 100%)',
                      borderColor: 'rgba(230,199,139,0.22)'
                    }}
                  >
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="h-px w-10 bg-[#E6C78B]/40" />
                      <div className="text-center">
                        <div className="text-[12px] font-extrabold tracking-[0.22em] text-[#E6C78B] drop-shadow">
                          NOSSOS PROFISSIONAIS
                        </div>
                      </div>
                      <div className="h-px w-10 bg-[#E6C78B]/40" />
                    </div>

                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex items-start justify-center gap-5 pb-1 min-w-max px-1">
                        {establishment.professionals
                          .filter((p: any) => !p.hidden_from_booking)
                          .map((professional: any) => (
                            <div
                              key={professional.id}
                              className="flex flex-col items-center flex-shrink-0 select-none"
                              aria-label={`Profissional ${professional.name}`}
                            >
                              <div
                                className="relative w-[68px] h-[68px] rounded-full overflow-hidden"
                                style={{
                                  border: '2px solid rgba(230,199,139,0.60)',
                                  boxShadow: '0 14px 35px rgba(0,0,0,0.55)'
                                }}
                              >
                                <img
                                  src={(professional as any).photo_url || '/fotopessoa.png'}
                                  alt={professional.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/fotopessoa.png';
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                              </div>
                              <span className="mt-2 text-sm font-semibold text-white/90 text-center max-w-[90px] truncate">
                                {professional.name}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Comodidades - Só mostra se houver pelo menos 1 ativa */}
              {(establishment?.has_wifi || establishment?.has_parking || establishment?.has_accessibility || establishment?.has_air_conditioning) && (
                <div
                  className="mt-8 mb-6 p-6"
                  style={{
                    background: '#1A1A1A',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                  }}
                >
                  <h3 className="text-center text-xl font-semibold" style={{ color: '#E6C78B' }}>
                    Comodidades
                  </h3>
                  <p className="text-center text-sm mt-2" style={{ color: '#A1A1A1' }}>
                    Selecione uma comodidade para saber mais.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {/* Wi-Fi */}
                    {establishment?.has_wifi && (
                      <button
                        type="button"
                        onClick={() => {
                          if (establishment?.wifi_password) {
                            navigator.clipboard.writeText(establishment.wifi_password);
                            toast.success('Senha do Wi-Fi copiada!');
                          }
                        }}
                        className="flex flex-col items-center justify-center py-6 px-4 active:scale-[0.97] transition-transform"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                        title={establishment?.wifi_password ? 'Clique para copiar a senha do Wi-Fi' : 'Wi-Fi disponível'}
                      >
                        {establishment?.wifi_network_name && (
                          <span className="text-xs font-semibold mb-2" style={{ color: '#E6C78B' }}>
                            {establishment.wifi_network_name}
                          </span>
                        )}
                        <img
                          src={`/wifi.png?v=${Date.now()}`}
                          alt="Wi-Fi"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Wi-Fi
                        </span>
                      </button>
                    )}

                    {/* Estacionamento */}
                    {establishment?.has_parking && (
                      <div
                        className="flex flex-col items-center justify-center py-6 px-4"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                      >
                        <img
                          src={`/car.png?v=${Date.now()}`}
                          alt="Estacionamento"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Estacionamento
                        </span>
                      </div>
                    )}

                    {/* Acessibilidade */}
                    {establishment?.has_accessibility && (
                      <div
                        className="flex flex-col items-center justify-center py-6 px-4"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                      >
                        <img
                          src={`/wheelchair.png?v=${Date.now()}`}
                          alt="Acessibilidade"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Acessibilidade
                        </span>
                      </div>
                    )}

                    {/* Climatizado */}
                    {establishment?.has_air_conditioning && (
                      <div
                        className="flex flex-col items-center justify-center py-6 px-4"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                      >
                        <img
                          src={`/arcondicionado.png?v=${Date.now()}`}
                          alt="Climatizado"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Climatizado
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seção de Horário de Atendimento */}
              <div className="mt-8 mb-6 bg-white/5 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] border border-white/10">
                <button
                  onClick={() => setShowBusinessHours(!showBusinessHours)}
                  className="w-full flex items-center justify-between gap-3 mb-4 hover:bg-white/5 p-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center border border-white/10">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-extrabold text-white">Horário de atendimento</h3>
                      <p className="text-sm text-white/60">Clique para ver os horários</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-white/60 transition-transform duration-200 ${showBusinessHours ? 'rotate-180' : ''
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
                          className={`flex justify-between items-center p-3 rounded-xl border border-white/10 ${isOpen ? 'bg-emerald-500/10' : 'bg-white/5'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-white/30'
                              }`}></div>
                            <span className="text-sm font-semibold text-white">{dia}</span>
                            {isHoje && (
                              <span className="text-xs px-2 py-1 bg-emerald-500/15 text-emerald-200 rounded-full border border-emerald-400/20">
                                Hoje
                              </span>
                            )}
                          </div>
                          <span className={`text-sm font-semibold ${isOpen ? 'text-emerald-200' : 'text-white/60'
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
                  {/* Botão Baixar App abaixo da imagem */}
                  {!isPWA() && (
                    <div className="mt-3">
                      <button
                        onClick={handleDownloadApp}
                        className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/15 transition-colors font-semibold border border-white/10"
                      >
                        <Download className="w-4 h-4" />
                        Baixar app
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Modal bonito com instruções de instalação */}
              {showInstallGuide && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0f0f10] rounded-2xl border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.7)] w-full max-w-md overflow-hidden">
                    <div className="bg-gradient-to-r from-[#e6d7b1] to-[#d9c08c] p-5">
                      <h3 className="text-black text-lg font-extrabold flex items-center gap-2">
                        📲 {installGuideTitle}
                      </h3>
                      <p className="text-black/70 text-sm mt-1">Instale o app do Agendei Fácil e tenha acesso rápido aos seus agendamentos.</p>
                    </div>
                    <div className="p-5 space-y-3 text-white">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✅</span>
                        <p className="text-sm">{installGuideSteps[0]}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✅</span>
                        <p className="text-sm">{installGuideSteps[1]}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✅</span>
                        <p className="text-sm">{installGuideSteps[2]}</p>
                      </div>
                      <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/70">
                        Dica: após instalar, o app abre em tela cheia e fica no seu menu de apps 📱
                      </div>
                    </div>
                    <div className="p-4 bg-black/30 flex justify-end gap-2 border-t border-white/10">
                      <button
                        onClick={() => setShowInstallGuide(false)}
                        className="px-4 py-2 text-white/80 hover:text-white"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={() => setShowInstallGuide(false)}
                        className="px-4 py-2 bg-[#e6d7b1] text-black rounded-xl hover:bg-[#f3e7c7] font-extrabold"
                      >
                        Entendi
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Link para Agendei Fácil */}
              <div className="mt-6 text-center">
                <a
                  href={id === '8160' ? '/conhecerv4' : 'https://agendeifacil.com'}
                  target={id === '8160' ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="text-[#e6d7b1] hover:text-[#f3e7c7] text-sm font-semibold transition-colors underline"
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
              className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-6 text-white"
            >
              <h2 className="text-xl font-extrabold mb-4 text-white">Fazer Agendamento</h2>
              <AppointmentForm
                establishment={establishment}
                onSubmit={handleSubmit}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                existingAppointments={existingAppointments}
                requireAdvancePayment={(() => {
                  // Verificar Pagar.me
                  const hasPagarMe = !!String((establishment as any)?.pagarme_recipient_id || '').trim();
                  const exigirPagarMe = (establishment as any)?.exigir_pagamento_antecipado === true;
                  
                  // Verificar Mercado Pago
                  const hasMercadoPago = !!String((establishment as any)?.mercadopago_access_token || '').trim();
                  const exigirMercadoPago = (establishment as any)?.exigir_pagamento_antecipado_mercadopago === true;
                  
                  // ✅ CORRIGIDO: Cada gateway funciona INDEPENDENTE do outro
                  // Se Mercado Pago está configurado para exigir → ativar
                  // Se Pagar.me está configurado para exigir → ativar
                  const usarMercadoPago = hasMercadoPago && exigirMercadoPago;
                  const usarPagarMe = hasPagarMe && exigirPagarMe;
                  
                  // Se QUALQUER um estiver configurado para exigir pagamento, ativar
                  const algumGatewayExigePagamento = usarMercadoPago || usarPagarMe;
                  
                  if (!algumGatewayExigePagamento) {
                    return false; // Nenhum gateway exige pagamento
                  }
                  
                  // ✅ CORRIGIDO: Remover dependência de pagamento_adiantado_liberado_admin
                  // Cada gateway funciona independente - se está configurado para exigir, funciona
                  // Verificar se é opcional (depende de qual gateway está sendo usado)
                  const pagamentoAdiantadoOpcional = usarMercadoPago
                    ? (establishment as any)?.pagamento_adiantado_opcional_mercadopago === true
                    : (establishment as any)?.pagamento_adiantado_opcional === true;
                  
                  // Se algum gateway exige E não é opcional → precisa pagamento
                  const precisaPagamento = algumGatewayExigePagamento && !pagamentoAdiantadoOpcional;
                  
                  return precisaPagamento;
                })()}
                onConvertToSubscriber={handleConvertToSubscriber}
                subscriberDetectionDisabled={subscriberDetectionDisabled}
                onSubscriberDetectionDisabledChange={setSubscriberDetectionDisabled}
                guestClientData={guestClientData}
              // Não vamos mais passar selectedProfessional daqui, será gerenciado dentro do AppointmentForm
              />
            </div>
          )}

          {showSubscriberBooking && (
            <div className="bg-red-100 border-4 border-red-500 rounded-lg shadow-md p-6 text-gray-900 mt-4 z-50 relative">
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
                                📅 {subscription.weekdays.map((day: string) => {
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

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      <strong>Dias disponíveis:</strong> {selectedSubscriberService.weekdays?.map((day: string) => {
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
                    guestClientData={guestClientData} // Passar dados do cliente para preenchimento automático
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

      {/* ✅ Modal Fila de Espera */}
      {showWaitlistModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-3 sm:p-4 pt-6 sm:pt-4">
          <div
            className="w-full max-w-xl rounded-2xl shadow-2xl border border-white/10 bg-[#0f0f10] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🕒</span>
                <div className="text-sm font-extrabold text-white">Fila de espera</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWaitlistModal(false);
                  setShowJoinWaitlistForm(false);
                  setShowLeaveWaitlistForm(false);
                }}
                className="p-2 rounded-lg hover:bg-white/5 text-white/90"
                aria-label="Fechar"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-white/80 leading-relaxed">
                Veja a fila atual por ordem de chegada e entre na fila de espera.
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                {isLoadingWaitlist ? (
                  <div className="text-sm text-white/70">Carregando fila...</div>
                ) : waitlistEntries.length === 0 ? (
                  <div className="text-sm text-white/70">Nenhuma pessoa na fila no momento.</div>
                ) : (
                  <div className="space-y-2">
                    {waitlistEntries.map((e: any, idx: number) => {
                      const isAtual = idx === 0;
                      const isProximo = idx === 1;
                      const boxClass = isAtual
                        ? 'border-emerald-400/40 bg-emerald-500/10'
                        : isProximo
                          ? 'border-amber-400/40 bg-amber-500/10'
                          : 'border-white/10 bg-black/20';

                      return (
                      <div
                        key={e.id}
                        className={`rounded-xl border ${boxClass} p-3 flex items-start justify-between gap-2`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-white truncate">
                            {isAtual ? `${e.client_name} — em atendimento` : isProximo ? `Próximo: ${e.client_name}` : e.client_name}
                          </div>
                          <div className="text-[11px] text-white/60 space-y-0.5">
                            <div>
                              Serviço: <span className="font-semibold text-white/80">{e.service_name}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {Number.isFinite(Number(e.service_price)) && (
                                <span>
                                  Valor: <span className="font-semibold text-white/85">{fmtBRL(Number(e.service_price))}</span>
                                </span>
                              )}
                              {Number.isFinite(Number(e.service_duration_minutes)) && Number(e.service_duration_minutes) > 0 && (
                                <span>
                                  Tempo: <span className="font-semibold text-white/85">{Number(e.service_duration_minutes)}min</span>
                                </span>
                              )}
                              {idx === 0 && e.started_at && (
                                <span>
                                  Início: <span className="font-semibold text-white/85">{String(new Date(e.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</span>
                                </span>
                              )}
                              {(() => {
                                const min = calcularMinutosRestantes(waitlistEntries, idx);
                                if (min === null) return null;
                                return (
                                  <span>
                                    {idx === 0 ? 'Falta:' : 'Estimativa:'}{' '}
                                    <span className="font-semibold text-white/85">{min}min</span>
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {showLeaveWaitlistForm ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="text-sm font-extrabold text-white">Sair da fila</div>
                  <div className="text-xs text-white/70">
                    Digite o mesmo telefone/WhatsApp que você usou para entrar na fila.
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Telefone / WhatsApp</label>
                    <input
                      value={leaveWaitlistPhone}
                      onChange={(e) => setLeaveWaitlistPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                      placeholder="(DD) 9xxxx-xxxx"
                      inputMode="tel"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSairDaFila}
                      className="flex-1 px-4 py-3 rounded-xl font-extrabold bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Confirmar saída
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLeaveWaitlistForm(false);
                        setLeaveWaitlistPhone('');
                      }}
                      className="px-4 py-3 rounded-xl font-extrabold bg-white/10 text-white hover:bg-white/15 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : showJoinWaitlistForm ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="text-sm font-extrabold text-white">Entrar na fila</div>

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Nome</label>
                    <input
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                      placeholder="Seu nome"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Telefone / WhatsApp</label>
                    <input
                      value={waitlistPhone}
                      onChange={(e) => setWaitlistPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                      placeholder="(DD) 9xxxx-xxxx"
                      inputMode="tel"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Serviço</label>
                    <select
                      value={waitlistServiceId}
                      onChange={(e) => setWaitlistServiceId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                    >
                      <option value="">Selecione um serviço</option>
                      {((establishment as any)?.services_with_prices || []).map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {labelServicoFila(s)}
                        </option>
                      ))}
                    </select>
                    {waitlistServiceId && (
                      <div className="text-[11px] text-white/70">
                        Você escolheu:{' '}
                        <span className="font-semibold text-white/85">
                          {labelServicoFila(
                            ((establishment as any)?.services_with_prices || []).find((s: any) => String(s.id) === String(waitlistServiceId))
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleEntrarNaFila}
                      className="flex-1 px-4 py-3 rounded-xl font-extrabold bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJoinWaitlistForm(false)}
                      className="px-4 py-3 rounded-xl font-extrabold bg-white/10 text-white hover:bg-white/15 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinWaitlistForm(true);
                      setShowLeaveWaitlistForm(false);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl font-extrabold bg-white text-black hover:bg-gray-100 transition-colors"
                  >
                    Entrar na fila
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveWaitlistForm(true);
                      setShowJoinWaitlistForm(false);
                    }}
                    className="px-4 py-3 rounded-xl font-extrabold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Sair da fila
                  </button>
                  <button
                    type="button"
                    onClick={fetchWaitlist}
                    className="px-4 py-3 rounded-xl font-extrabold bg-white/10 text-white hover:bg-white/15 transition-colors"
                  >
                    Atualizar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Modal de Agendamento Rápido */}
      <QuickBookingModal
        isOpen={showQuickBookingModal}
        onClose={() => {
          setShowQuickBookingModal(false);
          // Se o usuário fechou, não manter o fluxo preso em "modal"
          safeSessionRemove(QUICK_BOOKING_FLOW_KEY);
        }}
        onContinue={handleContinueQuickBooking}
        establishmentName={establishment?.name || 'este estabelecimento'}
        establishmentWhatsapp={establishment?.whatsapp}
      />

      {/* Modal de Pagamento (Pagar.me) - Booking público */}
      {showPaymentModal && pendingAppointmentId && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            // Se fechar sem pagar:
            // - obrigatório: cancela
            // - opcional: mantém agendamento
            if (!paymentIsOptional && pendingAppointmentId) {
              supabase
                .from('appointments')
                .update({ status: 'cancelled', payment_status: 'failed' })
                .eq('id', pendingAppointmentId);
              toast.error('Pagamento não concluído. Agendamento cancelado.');
            } else {
              toast('Pagamento não concluído. Agendamento mantido.', 'warning');
            }
          }}
          appointmentId={pendingAppointmentId}
          amount={pendingPaymentAmount}
          establishmentId={String(establishment?.id || '')}
          recipientId={(window as any).__paymentGateway === 'pagarme' 
            ? String((establishment as any)?.pagarme_recipient_id || '') 
            : undefined}
          onPaymentSuccess={(clientPhone) => {
            setShowPaymentModal(false);
            setPendingAppointmentId(null);

            // Se tiver telefone, redirecionar para view-appointments
            if (clientPhone) {
              const cleanPhone = clientPhone.replace(/\D/g, '');
              localStorage.setItem('last_booking_phone', cleanPhone);
              // ✅ Proteção contra múltiplos redirects
              if (isReloadingRef.current) return;
              isReloadingRef.current = true;
              window.location.href = `/view-appointments?phone=${encodeURIComponent(cleanPhone)}`;
              return;
            }
            setPendingCustomerData(null);
            // Redirecionar para a página de agendamentos
            toast.success('Pagamento confirmado! Redirecionando para seus agendamentos...');
            setTimeout(() => {
              // ✅ Proteção contra múltiplos redirects
              if (isReloadingRef.current) return;
              isReloadingRef.current = true;
              window.location.href = '/view-appointments';
            }, 800);
          }}
          onPaymentFailure={() => {
            setShowPaymentModal(false);
            setPendingAppointmentId(null);
            setPendingCustomerData(null);
            if (!paymentIsOptional) {
              toast.error('Pagamento não concluído. Agendamento cancelado.');
            } else {
              toast('Pagamento não concluído. Agendamento mantido.', 'warning');
            }
          }}
          cancelAppointmentOnFailure={!paymentIsOptional}
          customerData={{
            name: pendingCustomerData?.name || guestClientData?.name || 'Cliente',
            phone: pendingCustomerData?.phone || guestClientData?.phone,
            email: pendingCustomerData?.email || user?.email || undefined
          }}
        />
      )}

      {/* Modal: Assinatura via PIX (Pagar.me) */}
      {showSubscriptionPixModal && selectedSubscriptionForPix && (
        <SubscriptionPixModal
          isOpen={showSubscriptionPixModal}
          onClose={() => {
            setShowSubscriptionPixModal(false);
            setSelectedSubscriptionForPix(null);
          }}
          establishmentId={String(establishment?.id || '')}
          recipientId={String((establishment as any)?.pagarme_recipient_id || '')}
          establishmentName={String(establishment?.name || 'este estabelecimento')}
          establishmentWhatsapp={String(establishment?.whatsapp || '')}
          subscription={{
            id: String(selectedSubscriptionForPix.id),
            name: String(selectedSubscriptionForPix.name || 'Assinatura'),
            value: Number(selectedSubscriptionForPix.value || 0),
            duration_months: selectedSubscriptionForPix.duration_months ?? null,
          }}
          paymentProvider={
            (() => {
              try {
                return Boolean((establishment as any)?.use_mercadopago_subscription_pix === true);
              } catch {
                return false;
              }
            })() &&
            !!String((establishment as any)?.mercadopago_access_token || '').trim()
              ? 'mercadopago'
              : 'pagarme'
          }
        />
      )}

      {/* Prompt: Pagamento opcional após agendar */}
      {showOptionalPayPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1a1b1c] rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-700">
            <h2 className="text-xl font-extrabold text-white mb-2">Parabéns! Agendamento feito ✅</h2>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Quer <span className="font-semibold text-white">pagar agora</span> e já
              <span className="ml-2 inline-block px-2 py-1 rounded-md bg-green-600/20 border border-green-500/40 text-green-300 font-extrabold">
                deixar seu barbeiro feliz
              </span>
              ?
              <span className="block mt-2 text-xs text-gray-400">
                Se você preferir, pode só confirmar e pagar depois.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowOptionalPayPrompt(false);
                  setShowPaymentModal(true);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Sim, pagar agora
              </button>
              <button
                onClick={() => {
                  setShowOptionalPayPrompt(false);
                  // Seguir fluxo normal (sem pagamento)
                  toast.success('Agendamento confirmado! Redirecionando...');
                  setTimeout(() => {
                    const phone =
                      (pendingCustomerData?.phone || guestClientData?.phone || localStorage.getItem('last_booking_phone') || '').toString();
                    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
                    // ✅ Proteção contra múltiplos redirects
        if (isReloadingRef.current) return;
        isReloadingRef.current = true;
        window.location.href = cleanPhone ? `/view-appointments?phone=${encodeURIComponent(cleanPhone)}` : '/view-appointments';
                  }, 800);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Não, só confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
} 