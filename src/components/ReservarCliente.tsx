import { CheckCircle, Clock, Scissors, Search, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { checkWhatsAppSubscriber, supabase } from '../lib/supabase';
import { getScheduleIntervalMinutes } from '../utils/scheduleGrid';
import { PaymentModal } from './PaymentModal';

interface Professional {
  id: string;
  name: string;
  photo?: string;
  blocked_hours?: Record<string, string[]>;
  specific_services?: Array<{ id: string; name: string; price: number; duration: number }>;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  /** Pontos de fidelidade ao concluir (não assinante); padrão 0 */
  loyalty_points?: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  establishment_id: string;
  is_active: boolean;
  display_order: number;
  excluded_professional_ids?: string[] | null;
}

interface ServiceSubcategory {
  id: string;
  name: string;
  price: number;
  duration: number;
  loyalty_points?: number;
  category_id: string;
  is_active: boolean;
  display_order: number;
}

/** Serviço incluído no plano (mesma estrutura que `divided_services` nas assinaturas). */
interface PlanOfferedService {
  id: string;
  name: string;
  duration: number;
  limit: number;
}

interface Subscription {
  id: string;
  name: string;
  service_name?: string | null;
  service_duration?: number | null;
  price?: number;
  value?: number;
  divided_services?: unknown;
  divide_services_enabled?: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
  isAvulso?: boolean;
  reason?: string;
  appointmentId?: string; // ID do agendamento para cancelamento
  appointmentStartTime?: string; // Horário de início do agendamento
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
  appointmentCount?: number;
}

interface ReservarClienteProps {
  establishmentId: string;
  initialProfessionalId?: string;
  /** Pré-preenche data/hora e limita duração total (fluxo a partir da grade Meus agendamentos). */
  slotPrefill?: { date: string; time: string; maxDurationMinutes: number } | null;
  use15MinuteInterval?: boolean;
  use20MinuteScheduleProp?: boolean;
  use60MinuteScheduleProp?: boolean;
  closedTimeEnabledProp?: boolean;
  onClose: () => void;
  onAppointmentCreated?: (payload: { isAvulso: boolean; createdCount: number }) => void;
}

export default function ReservarCliente({
  establishmentId,
  initialProfessionalId,
  slotPrefill = null,
  use15MinuteInterval = false,
  use20MinuteScheduleProp = false,
  use60MinuteScheduleProp = false,
  closedTimeEnabledProp = false,
  onClose,
  onAppointmentCreated,
}: ReservarClienteProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'initial' | 'client' | 'professional' | 'service' | 'time' | 'confirm'>('initial');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [breakRange, setBreakRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Estado para configuração de horários
  const [use20MinuteSchedule, setUse20MinuteSchedule] = useState(false);

  // Estados para categorias de serviços
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [serviceSubcategories, setServiceSubcategories] = useState<ServiceSubcategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<ServiceSubcategory | null>(null);
  const [showCategoryServices, setShowCategoryServices] = useState(false);

  // Estados para assinantes
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  /** Metadados do serviço escolhido dentro do plano (limites / relatórios de assinante). */
  const [selectedSubscriberPlanMeta, setSelectedSubscriberPlanMeta] = useState<{
    serviceId: string | null;
    serviceName: string;
    serviceLimit: number;
  } | null>(null);
  const [selectedClientActiveSubscriptionId, setSelectedClientActiveSubscriptionId] = useState<string | null>(null);

  // Estados para seleção de cliente conhecido
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [showAddClientInline, setShowAddClientInline] = useState(false);
  const [newKnownClientName, setNewKnownClientName] = useState('');
  const [newKnownClientWhatsapp, setNewKnownClientWhatsapp] = useState('');
  const [newKnownClientCpf, setNewKnownClientCpf] = useState('');
  const [newKnownClientStreet, setNewKnownClientStreet] = useState('');
  const [newKnownClientBirthday, setNewKnownClientBirthday] = useState('');
  const [isCreatingKnownClient, setIsCreatingKnownClient] = useState(false);
  const [hasAppliedInitialProfessional, setHasAppliedInitialProfessional] = useState(false);

  /** Fidelidade (não assinante): meta e progresso vindos do Supabase */
  const [loyaltyRow, setLoyaltyRow] = useState<{ cycle_goal: number; cycle_progress: number } | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyRedeemApplied, setLoyaltyRedeemApplied] = useState(false);

  // Estados para pagamento antecipado
  const [exigirPagamentoAntecipado, setExigirPagamentoAntecipado] = useState(false);
  const [pagarmeRecipientId, setPagarmeRecipientId] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string>('');

  // ✅ Normalização para DEDUPLICAR clientes por WhatsApp (BR)
  // - Agrupa "55 + DDD + número" e "DDD + número" como o MESMO cliente
  const normalizeWhatsappKey = (raw: any) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) {
      const after = digits.slice(2);
      if (after.length === 10 || after.length === 11) return after;
    }
    return digits;
  };

  const normalizeWhatsappForStorage = (raw: any) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
    return digits;
  };

  const getLoyaltyLookupStorageKeys = (raw: string): string[] => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return [];
    const variants = new Set<string>();
    if (digits.startsWith('55') && digits.length > 2) {
      variants.add(digits);
      variants.add(digits.slice(2));
    } else if (digits.length >= 10 && digits.length <= 11) {
      variants.add(digits);
      variants.add(`55${digits}`);
    } else {
      variants.add(digits);
    }
    return Array.from(variants)
      .map((v) => normalizeWhatsappForStorage(v))
      .filter(Boolean);
  };

  const normalizeText = (raw: any) => {
    return String(raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const normalizeTimeHHmm = (rawTime: any): string => {
    const value = String(rawTime || '').trim();
    if (!value) return '00:00';
    const [h = '00', m = '00'] = value.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  };

  const parseDurationMinutes = (rawDuration: any): number => {
    if (rawDuration === null || rawDuration === undefined) return 30;
    if (typeof rawDuration === 'number') {
      return Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : 30;
    }

    const rawText = String(rawDuration).trim().toLowerCase();
    if (!rawText) return 30;

    const hhmmMatch = rawText.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmmMatch) {
      const h = Number(hhmmMatch[1]);
      const m = Number(hhmmMatch[2]);
      const total = h * 60 + m;
      return Number.isFinite(total) && total > 0 ? total : 30;
    }

    const direct = Number(rawText);
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

    const hourMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\b/);
    if (hourMatch) {
      const hours = Number(String(hourMatch[1]).replace(',', '.'));
      const total = Math.round(hours * 60);
      return Number.isFinite(total) && total > 0 ? total : 30;
    }

    const minuteMatch = rawText.match(/(\d+)\s*(m|min|mins|minuto|minutos)\b/);
    if (minuteMatch) {
      const mins = Number(minuteMatch[1]);
      return Number.isFinite(mins) && mins > 0 ? mins : 30;
    }

    const numberMatch = rawText.match(/(\d+)/);
    if (!numberMatch) return 30;
    const parsed = Number(numberMatch[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  };

  const getAdditionalProductsDuration = (rawAdditionalProducts: any): number => {
    if (!Array.isArray(rawAdditionalProducts)) return 0;
    return rawAdditionalProducts.reduce((sum: number, item: any) => {
      const duration = parseDurationMinutes(item?.duration);
      return sum + (Number.isFinite(duration) ? duration : 0);
    }, 0);
  };

  const getAppointmentDurationMinutes = (appointment: any): number => {
    const base = parseDurationMinutes(appointment?.duration);
    const extra = getAdditionalProductsDuration(appointment?.additional_products);
    return Math.max(1, base + extra);
  };

  const normalizePlanOfferedServices = (services: PlanOfferedService[]): PlanOfferedService[] => {
    return services
      .map((service) => ({
        id: String(service.id || '').trim(),
        name: String(service.name || '').trim(),
        duration: Number(service.duration || 0),
        limit: Number(service.limit || 0),
      }))
      .filter(
        (service) =>
          service.name &&
          Number.isFinite(service.duration) &&
          service.duration > 0 &&
          Number.isFinite(service.limit) &&
          service.limit > 0
      );
  };

  const parseDividedServicesFromRaw = (raw: unknown): PlanOfferedService[] => {
    if (!Array.isArray(raw)) return [];
    return normalizePlanOfferedServices(
      raw.map((service: any) => ({
        id: String(service?.id || ''),
        name: String(service?.name || ''),
        duration: Number(service?.duration || 0),
        limit: Number(service?.limit || 0),
      }))
    );
  };

  /** Serviços oferecidos pelo plano: `divided_services` ou legado service_name + service_duration. */
  const getOfferedServicesFromSubscription = (subscription: any): PlanOfferedService[] => {
    const divided = parseDividedServicesFromRaw(subscription?.divided_services);
    if (divided.length > 0) return divided;

    const legacyName = String(subscription?.service_name || '').trim();
    const legacyDur = parseDurationMinutes(subscription?.service_duration);
    if (legacyName && legacyDur > 0) {
      return [{ id: '', name: legacyName, duration: legacyDur, limit: 1 }];
    }

    const fallbackDur = parseDurationMinutes(subscription?.service_duration);
    const planName = String(subscription?.name || '').trim();
    if (planName && fallbackDur > 0) {
      return [{ id: '', name: planName, duration: fallbackDur, limit: 1 }];
    }

    return [];
  };

  const parseExcludedProfessionalIds = (raw: any): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((id: any) => String(id || '').trim())
      .filter(Boolean);
  };

  const normalizeSpecificService = (raw: any, fallbackKey: string): Service | null => {
    const name = String(raw?.name || raw?.service_name || '').trim();
    const price = Number(raw?.price ?? raw?.service_price ?? 0);
    const duration = parseDurationMinutes(raw?.duration ?? raw?.service_duration_minutes ?? 0);
    const rawId = String(raw?.id || raw?.service_id || '').trim();

    if (!name || !Number.isFinite(price) || price <= 0) return null;

    return {
      id: rawId ? `specific-${rawId}` : `specific-generated-${fallbackKey}`,
      name,
      price,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 30,
      loyalty_points: Math.max(0, Math.floor(Number(raw?.loyalty_points ?? 0))),
    };
  };

  const isCategoryBlockedForProfessional = (category: any, professionalId?: string | null): boolean => {
    const pid = String(professionalId || '').trim();
    if (!pid) return false;
    const excludedIds = parseExcludedProfessionalIds((category as any)?.excluded_professional_ids);
    return excludedIds.includes(pid);
  };

  // Reserva recorrente mensal (mesmo dia da semana/horário, até o fim do mês)
  const [reservarMensal, setReservarMensal] = useState(false);
  const [showReservarMensalModal, setShowReservarMensalModal] = useState(false);
  const [datasSelecionadasMensal, setDatasSelecionadasMensal] = useState<string[]>([]);
  const [mesCalendario, setMesCalendario] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    if (!slotPrefill) return;
    setSelectedDate(slotPrefill.date);
    setSelectedTime(slotPrefill.time);
    setReservarMensal(false);
    setDatasSelecionadasMensal([]);
    setShowReservarMensalModal(false);
  }, [slotPrefill?.date, slotPrefill?.time, slotPrefill?.maxDurationMinutes]);

  // ✅ Evita bug de timezone: new Date('YYYY-MM-DD') pode mostrar dia anterior no Brasil
  const formatarDataPtBr = (yyyyMmDd: string): string => {
    const [y, m, d] = (yyyyMmDd || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('pt-BR');
  };

  const getWeekdayLabelPtBr = (dayIndex: number): string => {
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return labels[dayIndex] || '';
  };

  const parseYyyyMmDdToDateNoon = (yyyyMmDd: string): Date => {
    const [y, m, d] = (yyyyMmDd || '').split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0);
  };

  const toYyyyMmDd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const addMonths = (d: Date, months: number): Date => {
    const next = new Date(d);
    next.setMonth(next.getMonth() + months);
    return next;
  };

  const buildMonthGrid = (year: number, month: number): Array<Array<Date | null>> => {
    const first = new Date(year, month, 1, 12, 0, 0);
    const last = new Date(year, month + 1, 0, 12, 0, 0);
    const weeks: Array<Array<Date | null>> = [];
    let currentWeek: Array<Date | null> = [];

    // preencher vazios antes do 1º dia
    for (let i = 0; i < first.getDay(); i++) currentWeek.push(null);

    for (let day = 1; day <= last.getDate(); day++) {
      const dt = new Date(year, month, day, 12, 0, 0);
      currentWeek.push(dt);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // preencher vazios no fim
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const sugerirDatasPorDiaSemana = (baseYyyyMmDd: string, mesesFuturos: number): string[] => {
    const base = parseYyyyMmDdToDateNoon(baseYyyyMmDd);
    const weekday = base.getDay();
    const start = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0);
    const end = new Date(addMonths(start, mesesFuturos + 1).getFullYear(), addMonths(start, mesesFuturos + 1).getMonth(), 0, 12, 0, 0);

    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);

    const out: string[] = [];
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const dayNoon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
      if (dayNoon < todayNoon) continue; // evita datas passadas
      if (dayNoon.getDay() === weekday) out.push(toYyyyMmDd(dayNoon));
    }

    // garantir que inclui a data base (se não for passada)
    const baseStr = toYyyyMmDd(base);
    if (!out.includes(baseStr)) out.push(baseStr);
    out.sort();
    return out;
  };

  const mesesAteFimDoAno = (baseYyyyMmDd: string): number => {
    const base = parseYyyyMmDdToDateNoon(baseYyyyMmDd);
    return Math.max(0, 11 - base.getMonth());
  };

  // Função para carregar clientes do estabelecimento
  const loadClients = async () => {
    if (!establishmentId) return;

    setLoadingClients(true);
    try {

      // Buscar todos os agendamentos do estabelecimento com paginação
      // (Não filtrar is_avulso aqui, senão a lista pode ficar vazia mesmo tendo clientes no "Meus Clientes")
      const appointmentPageSize = 1000;
      let appointmentFrom = 0;
      const appointments: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('appointments')
          .select('client_id, client_name, client_whatsapp, is_avulso')
          .eq('establishment_id', establishmentId)
          .not('client_name', 'is', null)
          .not('client_whatsapp', 'is', null)
          .order('created_at', { ascending: false })
          .range(appointmentFrom, appointmentFrom + appointmentPageSize - 1);

        if (error) {
          console.error('❌ Erro ao buscar clientes:', error);
          throw error;
        }

        const rows = Array.isArray(data) ? data : [];
        appointments.push(...rows);
        if (rows.length < appointmentPageSize) break;
        appointmentFrom += appointmentPageSize;
      }

      // Agrupar por WhatsApp (chave única para identificar cliente)
      const clientsMap = new Map<string, Client>();

      if (appointments && appointments.length > 0) {
        appointments.forEach((appointment) => {
          const rawWhatsapp = (appointment as any)?.client_whatsapp;
          const keyWhatsapp = normalizeWhatsappKey(rawWhatsapp);
          if (!keyWhatsapp) return; // Pular se não tiver WhatsApp

          // Usar client_id se existir e for UUID válido, senão usar manual_whatsapp
          const clientId =
            (appointment as any)?.client_id && !String((appointment as any)?.client_id || '').startsWith('manual_')
              ? String((appointment as any)?.client_id)
              : `manual_${keyWhatsapp}`;

          // Usar WhatsApp normalizado como chave do Map para garantir dedupe
          if (!clientsMap.has(keyWhatsapp)) {
            clientsMap.set(keyWhatsapp, {
              id: clientId, // Manter o ID original para uso no banco
              name: (appointment as any)?.client_name || 'Cliente sem nome',
              whatsapp: String(rawWhatsapp || '').replace(/\D/g, '') || keyWhatsapp,
              appointmentCount: 0
            });
          }

          // Incrementar contagem de agendamentos
          const client = clientsMap.get(keyWhatsapp)!;
          client.appointmentCount = (client.appointmentCount || 0) + 1;
        });
      }

      // Carregar clientes manuais do localStorage
      const loadManualClientsFromStorage = () => {
        if (!establishmentId) return {};
        const storageKey = `manual_clients_${establishmentId}`;
        return JSON.parse(localStorage.getItem(storageKey) || '{}');
      };

      const manualClients = loadManualClientsFromStorage();

      // Adicionar clientes manuais que ainda não estão na lista
      Object.values(manualClients).forEach((manualClient: any) => {
        const cleanWhatsapp = normalizeWhatsappKey(manualClient?.whatsapp);
        const nome = String(manualClient?.name || '').trim();
        const whatsappOriginal = String(manualClient?.whatsapp || '').trim();
        if (!cleanWhatsapp || !nome || !whatsappOriginal) return;

        const clientId = `manual_${cleanWhatsapp}`;

        // Verificar se já existe um cliente com esse WhatsApp (usando WhatsApp como chave)
        if (!clientsMap.has(cleanWhatsapp)) {
          clientsMap.set(cleanWhatsapp, {
            id: clientId, // Manter o ID original para uso no banco
            name: nome,
            whatsapp: whatsappOriginal,
            appointmentCount: 0 // Clientes manuais começam com 0 agendamentos
          });
        } else {
          // ✅ Prioridade TOTAL do nome salvo manualmente
          const existing = clientsMap.get(cleanWhatsapp)!;
          existing.name = nome;
          existing.whatsapp = whatsappOriginal;
        }
      });

      // ✅ NOVO: Buscar clientes manuais salvos no BANCO (mesma fonte da tela "Meus Clientes")
      try {
        const manualPageSize = 1000;
        let manualFrom = 0;
        const manualDb: any[] = [];
        while (true) {
          const { data, error: manualDbError } = await supabase
            .from('manual_clients')
            .select('id,name,whatsapp')
            .eq('establishment_id', establishmentId)
            .order('name', { ascending: true })
            .range(manualFrom, manualFrom + manualPageSize - 1);

          if (manualDbError) {
            console.warn('⚠️ Erro ao carregar clientes manuais do banco:', manualDbError);
            break;
          }

          const rows = Array.isArray(data) ? data : [];
          manualDb.push(...rows);
          if (rows.length < manualPageSize) break;
          manualFrom += manualPageSize;
        }

        if (Array.isArray(manualDb) && manualDb.length > 0) {
          manualDb.forEach((mc: any) => {
            const cleanWhatsapp = normalizeWhatsappKey(mc?.whatsapp);
            const nome = String(mc?.name || '').trim();
            const whatsappOriginal = String(mc?.whatsapp || '').trim();
            if (!cleanWhatsapp || !nome || !whatsappOriginal) return;

            // ✅ Se já existe pelo WhatsApp, SEMPRE priorizar o nome/whatsapp salvo manualmente
            if (clientsMap.has(cleanWhatsapp)) {
              const existing = clientsMap.get(cleanWhatsapp)!;
              existing.name = nome;
              existing.whatsapp = whatsappOriginal;
              return;
            }

            clientsMap.set(cleanWhatsapp, {
              // Preferir id do banco se existir
              id: String(mc?.id || `manual_${cleanWhatsapp}`),
              name: nome,
              whatsapp: whatsappOriginal,
              appointmentCount: 0,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Falha inesperada ao buscar manual_clients:', e);
      }

      const clientsArray = Array.from(clientsMap.values());

      // Ordenar por nome
      clientsArray.sort((a, b) => a.name.localeCompare(b.name));

      setClients(clientsArray);
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      alert('Erro ao carregar clientes. Verifique o console para mais detalhes.');
    } finally {
      setLoadingClients(false);
    }
  };

  // Carregar clientes quando entrar no modo de seleção
  useEffect(() => {
    if (step === 'client' && clients.length === 0) {
      loadClients();
    }
  }, [step]);

  // Pré-carregar clientes ao abrir o modal para decidir se "Reservar conhecido" fica habilitado
  useEffect(() => {
    if (clients.length === 0 && !loadingClients) {
      loadClients();
    }
  }, [establishmentId]);

  // Carregar profissionais e configuração de horários
  useEffect(() => {
    const loadProfessionals = async () => {
      try {
        const { data, error } = await supabase
          .from('establishments')
          .select('professionals, use_20_minute_schedule, exigir_pagamento_antecipado, pagarme_recipient_id')
          .eq('id', establishmentId)
          .single();

        if (error) {
          console.error('❌ Erro ao buscar establishment:', error);
          throw error;
        }


        // Carregar configuração de horários de 20 em 20 minutos
        setUse20MinuteSchedule(data?.use_20_minute_schedule ?? false);

        // Carregar configuração de pagamento antecipado
        setExigirPagamentoAntecipado((data as any)?.exigir_pagamento_antecipado ?? false);
        setPagarmeRecipientId((data as any)?.pagarme_recipient_id || '');

        // Converter profissionais do formato JSON para o formato esperado
        // NÃO filtrar profissionais ocultos aqui - "Reservar Cliente" é funcionalidade interna
        // Profissionais ocultos devem aparecer na reserva interna, apenas não no booking público
        const establishmentProfessionals = data?.professionals || [];
        const formattedProfessionals = establishmentProfessionals.map((prof: any) => ({
          id: prof.id,
          name: prof.name,
          photo: prof.photo_url || prof.photo,
          blocked_hours:
            prof?.blocked_hours && typeof prof.blocked_hours === 'object' && !Array.isArray(prof.blocked_hours)
              ? prof.blocked_hours
              : {},
          // ✅ PRESERVAR serviços específicos do profissional
          specific_services: Array.isArray(prof?.specific_services) ? prof.specific_services : [],
        }));

        setProfessionals(formattedProfessionals);
      } catch (error) {
        console.error('❌ Erro ao carregar profissionais:', error);
        alert('Erro ao carregar profissionais. Verifique o console para mais detalhes.');
      }
    };

    if (establishmentId) {
      loadProfessionals();
    } else {
      console.error('❌ establishmentId não fornecido');
    }
  }, [establishmentId]);

  useEffect(() => {
    setHasAppliedInitialProfessional(false);
  }, [initialProfessionalId, establishmentId]);

  useEffect(() => {
    const preferredProfessionalId = String(initialProfessionalId || '').trim();
    if (!preferredProfessionalId || hasAppliedInitialProfessional || professionals.length === 0) return;

    const preferredProfessional =
      professionals.find((prof) => String(prof?.id || '').trim() === preferredProfessionalId) || null;
    if (!preferredProfessional) return;

    setSelectedProfessional((prev) => {
      if (prev && String(prev.id || '').trim() === preferredProfessionalId) return prev;
      return preferredProfessional;
    });
    setHasAppliedInitialProfessional(true);
    setStep((prev) => (prev === 'professional' ? 'service' : prev));
  }, [initialProfessionalId, hasAppliedInitialProfessional, professionals]);

  // Carregar clubes de assinatura
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!establishmentId) {
        return;
      }

      try {

        // Usar a mesma função do Booking/Painel (já respeita sort_order quando existir)
        const { getSubscriptions } = await import('../lib/supabase');
        const { data: allSubs, error: subsError } = await getSubscriptions(establishmentId);

        if (subsError) {
          console.error('❌ Erro ao carregar assinaturas:', subsError);
          throw subsError;
        }

        // Filtrar assinaturas NÃO OCULTAS (is_hidden = false ou null)
        const visible = (allSubs || []).filter((s: any) => !s?.is_hidden);


        setSubscriptions(visible);
      } catch (error) {
        console.error('❌ Erro ao carregar assinaturas:', error);
      }
    };

    loadSubscriptions();
  }, [establishmentId]);

  // Carregar categorias de serviços
  useEffect(() => {
    const loadServiceCategories = async () => {
      if (!establishmentId) return;

      try {
        const { data: categories, error: categoriesError } = await supabase
          .from('service_categories')
          .select('*')
          .eq('establishment_id', establishmentId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (categoriesError) throw categoriesError;

        setServiceCategories(categories || []);
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);
      }
    };

    loadServiceCategories();
  }, [establishmentId]);

  // Carregar subcategorias quando categoria for selecionada
  useEffect(() => {
    const loadServiceSubcategories = async () => {
      if (!selectedCategory?.id) {
        setServiceSubcategories([]);
        return;
      }
      if (isCategoryBlockedForProfessional(selectedCategory, selectedProfessional?.id)) {
        setServiceSubcategories([]);
        return;
      }

      try {
        const { data: subcategories, error: subcategoriesError } = await supabase
          .from('service_subcategories')
          .select('*')
          .eq('category_id', selectedCategory.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (subcategoriesError) throw subcategoriesError;

        setServiceSubcategories(subcategories || []);
      } catch (error) {
        console.error('Erro ao carregar subcategorias:', error);
      }
    };

    loadServiceSubcategories();
  }, [selectedCategory, selectedProfessional?.id]);

  // Carregar serviços do profissional selecionado
  useEffect(() => {
    const loadServices = async () => {
      if (!selectedProfessional) return;

      try {

        // ✅ Serviços específicos do profissional (configurado em "Profissionais")
        const specificRaw = Array.isArray((selectedProfessional as any)?.specific_services)
          ? (selectedProfessional as any).specific_services
          : [];
        const formattedSpecific: Service[] = specificRaw
          .map((s: any, index: number) =>
            normalizeSpecificService(
              s,
              `${String(selectedProfessional?.id || 'prof')}-${index}-${String(s?.name || s?.service_name || '')}`
            )
          )
          .filter(Boolean) as Service[];

        const normalizeNameKey = (name: any) =>
          String(name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        const mergeSpecific = (base: Service[]) => {
          if (!formattedSpecific.length) return base;
          const existingNames = new Set(base.map((s) => normalizeNameKey(s.name)));
          const toAdd = formattedSpecific.filter((s) => !existingNames.has(normalizeNameKey(s.name)));
          return [...base, ...toAdd];
        };

        // 1) Preferir o sistema novo (categorias/subcategorias)
        const { data: subcats, error: subErr } = await supabase
          .from('service_subcategories')
          .select(
            `
              id,
              name,
              price,
              duration,
              is_active,
              category_id,
              service_categories!inner (
                id,
                establishment_id,
                is_active,
                display_order,
                excluded_professional_ids
              )
            `
          )
          .eq('is_active', true)
          // @ts-expect-error - filtro em tabela relacionada (PostgREST)
          .eq('service_categories.establishment_id', establishmentId)
          // @ts-expect-error - filtro em tabela relacionada (PostgREST)
          .eq('service_categories.is_active', true)
          // Ordenar primeiro por categoria e depois por serviço
          // @ts-expect-error - order em tabela relacionada (PostgREST)
          .order('service_categories(display_order)', { ascending: true })
          .order('display_order', { ascending: true });

        if (!subErr && Array.isArray(subcats) && subcats.length > 0) {
          const selectedProfessionalId = String(selectedProfessional?.id || '').trim();
          const formatted = subcats
            .filter((s: any) => !isCategoryBlockedForProfessional((s as any)?.service_categories, selectedProfessionalId))
            .map((s: any) => ({
              id: String(s.id),
              name: String(s.name || '').trim(),
              price: Number(s.price || 0),
              duration: parseDurationMinutes(s.duration || 30),
              loyalty_points: Math.max(0, Math.floor(Number(s.loyalty_points ?? 0))),
            })).filter((s: any) => s.name && s.price > 0);

          const combined = mergeSpecific(formatted);
          setServices(combined);
          return;
        }

        if (subErr) {
          console.warn('⚠️ Falha ao buscar serviços por categorias, tentando fallback legado:', subErr);
        } else {
        }

        // 2) Fallback: sistema antigo (services_with_prices)
        const { data: estData, error: estErr } = await supabase
          .from('establishments')
          .select('services_with_prices')
          .eq('id', establishmentId)
          .single();

        if (estErr) {
          console.error('❌ Erro ao buscar serviços (fallback legado):', estErr);
          throw estErr;
        }

        const legacy = (estData as any)?.services_with_prices || [];
        const formattedLegacy = legacy
          .map((service: any) => ({
            id: String(service.id || Math.random().toString(36).substring(2)),
            name: String(service.name || '').trim(),
            price: Number(service.price || 0),
            duration: parseDurationMinutes(service.duration || 30),
            loyalty_points: Math.max(0, Math.floor(Number(service.loyalty_points ?? 0))),
          }))
          .filter((s: any) => s.name && s.price > 0);

        const combinedLegacy = mergeSpecific(formattedLegacy);
        // Se não há serviços gerais mas há específicos, mostrar os específicos
        const finalList = combinedLegacy.length > 0 ? combinedLegacy : formattedSpecific;
        setServices(finalList);
      } catch (error) {
        console.error('❌ Erro ao carregar serviços:', error);
        alert('Erro ao carregar serviços');
      }
    };

    loadServices();
  }, [selectedProfessional, establishmentId]);

  // Carregar horários disponíveis
  useEffect(() => {
    const loadTimeSlots = async () => {
      if ((!selectedService && selectedServices.length === 0) || !selectedDate) return;

      setLoading(true);
      try {
        // Buscar agendamentos existentes para a data - CORRIGIDO
        const { data: appointments, error } = await supabase
          .from('appointments')
          .select('id, appointment_time, duration, additional_products, is_avulso, professional, status')
          .eq('establishment_id', establishmentId)
          .eq('appointment_date', selectedDate)
          .neq('status', 'cancelled'); // Incluir todos exceto cancelados

        if (error) throw error;


        // Log detalhado de cada agendamento
        if (!appointments || appointments.length === 0) {
          // Sem agendamentos para o dia/profissional selecionado.
        }

        // Calcular duração total dos serviços selecionados
        const totalDurationRaw = selectedServices.length > 0
          ? calculateTotalDuration(selectedServices)
          : selectedService?.duration || 30;
        const totalDuration = getSelectedReservationDurationMinutes();

        // Buscar horários do estabelecimento e do profissional
        const establishmentHours = await supabase
          .from('establishments')
          .select('business_hours')
          .eq('id', establishmentId)
          .single();

        const professionalHours = await supabase
          .from('establishments')
          .select('professionals')
          .eq('id', establishmentId)
          .single();

        // Determinar horários de trabalho para o dia da semana
        const selectedDateObj = new Date(selectedDate + 'T00:00:00'); // Forçar timezone local
        const dayOfWeek = selectedDateObj.getDay(); // 0 = domingo, 1 = segunda, etc.
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];


        let workHours = null;

        // Primeiro, verificar se o profissional tem horários específicos para este dia
        let hasProfessionalHours = false;

        if (professionalHours.data?.professionals) {
          const professional = professionalHours.data.professionals.find(p => p.id === selectedProfessional?.id);
          if (professional?.work_hours?.[dayName]) {
            const profHours = professional.work_hours[dayName];

            // Só usar horários do profissional se estiver habilitado
            if (profHours.enabled) {
              // Converter formato do profissional para formato padrão
              if (profHours.entry_time && profHours.exit_time) {
                workHours = {
                  enabled: profHours.enabled,
                  open1: profHours.entry_time,
                  close1: profHours.exit_time,
                  open2: null,
                  close2: null
                };

                // Se tem intervalo, ajustar
                if (profHours.break_start && profHours.break_end) {
                  workHours.close1 = profHours.break_start;
                  workHours.open2 = profHours.break_end;
                  workHours.close2 = profHours.exit_time;
                }

                hasProfessionalHours = true;
              } else {
                workHours = profHours;
                hasProfessionalHours = true;
              }
            } else {
            }
          } else {
          }
        }

        // Se não tem horário específico do profissional, usar horário do estabelecimento
        if (!hasProfessionalHours && establishmentHours.data?.business_hours?.[dayName]) {
          workHours = establishmentHours.data.business_hours[dayName];
        }

        // Se não tem nenhum horário definido, usar padrão 8h-18h
        if (!workHours) {
          workHours = { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null };
        }


        // Verificar se o dia está habilitado
        if (!workHours.enabled) {
          setTimeSlots([]);
          setBreakRange(null);
          return;
        }

        if (workHours.open2 && workHours.close2 && workHours.close1) {
          setBreakRange({ start: workHours.close1, end: workHours.open2 });
        } else {
          setBreakRange(null);
        }

        // Gerar slots baseados nos horários de trabalho
        const slots: TimeSlot[] = [];

        // Função para converter horário para minutos
        const timeToMinutes = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };

        // Função para converter minutos para horário
        const minutesToTime = (minutes: number) => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        };

        // Determinar o intervalo baseado na configuração
        let interval = 30; // Padrão: 30 em 30 minutos
        if (use60MinuteScheduleProp) {
          interval = 60; // Horários de 1 em 1 hora
        } else if (use20MinuteScheduleProp) {
          interval = 20; // Horários de 20 em 20 minutos
        } else if (!use15MinuteInterval) {
          interval = 15; // Horários de 15 em 15 minutos (quando DESMARCADO)
        }

        // Agendamentos do profissional para incluir horário de término como slot (ex: 14:50)
        const selectedProfessionalIdNorm = normalizeText(selectedProfessional?.id);
        const selectedProfessionalNameNorm = normalizeText(selectedProfessional?.name);
        const professionalAppointments = (appointments || []).filter((a: any) => {
          const appointmentProfessionalNorm = normalizeText(a?.professional);
          if (!appointmentProfessionalNorm) return false;
          const matchById = selectedProfessionalIdNorm.length > 0 && appointmentProfessionalNorm === selectedProfessionalIdNorm;
          const matchByName = selectedProfessionalNameNorm.length > 0 && appointmentProfessionalNorm === selectedProfessionalNameNorm;
          return matchById || matchByName;
        });

        const buildPeriodSlotMinutes = (periodStart: number, periodEnd: number) => {
          const candidate = new Set<number>();
          for (let m = periodStart; m < periodEnd; m += interval) candidate.add(m);
          // Quando "Tempo fechado" está DESMARCADO, libera slot no término do atendimento
          // (ex.: 09:00 + 30min => abre 09:30), inclusive em grade de 1h.
          if (!closedTimeEnabledProp) {
            professionalAppointments.forEach((apt) => {
              const aptStartTime = normalizeTimeHHmm(apt?.appointment_time);
              const aptDurationMins = getAppointmentDurationMinutes(apt);
              const aptEndMins = timeToMinutes(aptStartTime) + aptDurationMins;
              if (aptEndMins >= periodStart && aptEndMins < periodEnd) candidate.add(aptEndMins);
            });
          }
          return Array.from(candidate).sort((a, b) => a - b);
        };

        // Gerar slots para o primeiro período
        if (workHours.open1 && workHours.close1) {
          const startMinutes = timeToMinutes(workHours.open1);
          const endMinutes = timeToMinutes(workHours.close1);


          const periodMinutes = buildPeriodSlotMinutes(startMinutes, endMinutes);
          for (const minutes of periodMinutes) {
            const time = minutesToTime(minutes);
            const slotStart = new Date(`${selectedDate}T${time}:00`);
            const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

            // Verificar conflitos
            let available = true;
            let isAvulso = false;
            let reason = '';
            let appointmentId: string | undefined;
            let appointmentStartTime: string | undefined;

            if (appointments) {
              for (const appointment of professionalAppointments) {
                const normalizedAppointmentStartTime = normalizeTimeHHmm(appointment?.appointment_time);
                const appointmentDuration = getAppointmentDurationMinutes(appointment);
                const apptStart = new Date(`${selectedDate}T${normalizedAppointmentStartTime}:00`);
                const apptEnd = new Date(apptStart.getTime() + appointmentDuration * 60000);

                // Verificar sobreposição
                const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);

                if (hasOverlap) {
                  available = false;
                  isAvulso = appointment.is_avulso || false;
                  reason = isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado';

                  if (time === normalizedAppointmentStartTime) {
                    appointmentId = appointment.id;
                    appointmentStartTime = normalizedAppointmentStartTime;
                  }
                }
              }
            }

            // Não permitir horário que invada o intervalo: serviço terminando depois do fim do período 1
            if (available && minutes + totalDuration > endMinutes) {
              available = false;
              reason = 'Intervalo';
            }

            slots.push({
              time,
              available,
              isAvulso,
              reason,
              appointmentId,
              appointmentStartTime
            });
          }
        }

        // Gerar slots para o segundo período (se existir)
        if (workHours.open2 && workHours.close2) {
          const startMinutes = timeToMinutes(workHours.open2);
          const endMinutes = timeToMinutes(workHours.close2);

          const periodMinutes = buildPeriodSlotMinutes(startMinutes, endMinutes);
          for (const minutes of periodMinutes) {
            const time = minutesToTime(minutes);
            const slotStart = new Date(`${selectedDate}T${time}:00`);
            const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

            // Verificar conflitos
            let available = true;
            let isAvulso = false;
            let reason = '';
            let appointmentId: string | undefined;
            let appointmentStartTime: string | undefined;

            if (appointments) {
              for (const appointment of professionalAppointments) {
                const normalizedAppointmentStartTime = normalizeTimeHHmm(appointment?.appointment_time);
                const appointmentDuration = getAppointmentDurationMinutes(appointment);
                const apptStart = new Date(`${selectedDate}T${normalizedAppointmentStartTime}:00`);
                const apptEnd = new Date(apptStart.getTime() + appointmentDuration * 60000);

                const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);

                if (hasOverlap) {
                  available = false;
                  isAvulso = appointment.is_avulso || false;
                  reason = isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado';

                  if (time === normalizedAppointmentStartTime) {
                    appointmentId = appointment.id;
                    appointmentStartTime = normalizedAppointmentStartTime;
                  }
                }
              }
            }

            if (available && minutes + totalDuration > endMinutes) {
              available = false;
              reason = 'Fim do expediente';
            }

            slots.push({
              time,
              available,
              isAvulso,
              reason,
              appointmentId,
              appointmentStartTime
            });
          }
        }

        setTimeSlots(slots);
      } catch (error) {
        console.error('Erro ao carregar horários:', error);
        alert('Erro ao carregar horários');
      } finally {
        setLoading(false);
      }
    };

    loadTimeSlots();
  }, [
    selectedService,
    selectedServices,
    selectedDate,
    selectedProfessional,
    selectedSubscription,
    use15MinuteInterval,
    use20MinuteScheduleProp,
    use60MinuteScheduleProp,
    closedTimeEnabledProp
  ]);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    // Ao trocar cliente, limpamos seleção de assinatura anterior para evitar cruzamento de planos.
    setSelectedSubscription(null);
    setSelectedSubscriberPlanMeta(null);
    if (selectedProfessional && String(selectedProfessional.id || '').trim().length > 0) {
      setStep('service');
      return;
    }
    setStep('professional');
  };

  const handleCreateKnownClient = async () => {
    const trimmedName = String(newKnownClientName || '').trim();
    const normalizedWhatsapp = normalizeWhatsappForStorage(newKnownClientWhatsapp);
    const normalizedCpf = String(newKnownClientCpf || '').replace(/\D/g, '');
    const normalizedStreet = String(newKnownClientStreet || '').trim();
    const birthday = String(newKnownClientBirthday || '').trim();

    if (!trimmedName) {
      alert('Informe o nome do cliente.');
      return;
    }

    const normalizedKey = normalizeWhatsappKey(normalizedWhatsapp);
    if (!normalizedKey || normalizedKey.length < 10) {
      alert('Informe um telefone válido com DDD.');
      return;
    }

    if (normalizedCpf && normalizedCpf.length !== 11) {
      alert('CPF inválido. Informe 11 dígitos ou deixe em branco.');
      return;
    }

    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      alert('Data de aniversário inválida.');
      return;
    }

    setIsCreatingKnownClient(true);
    try {
      const payloadBase: any = {
        establishment_id: establishmentId,
        name: trimmedName.slice(0, 120),
        whatsapp: normalizedWhatsapp,
        updated_at: new Date().toISOString(),
      };

      let upsertError: any = null;
      if (birthday) {
        const { error } = await supabase
          .from('manual_clients')
          .upsert(
            {
              ...payloadBase,
              birthday,
              cpf: normalizedCpf || null,
              street: normalizedStreet || null,
            },
            { onConflict: 'establishment_id,whatsapp' }
          );
        upsertError = error;
      } else {
        const { error } = await supabase
          .from('manual_clients')
          .upsert(
            {
              ...payloadBase,
              cpf: normalizedCpf || null,
              street: normalizedStreet || null,
            },
            { onConflict: 'establishment_id,whatsapp' }
          );
        upsertError = error;
      }

      if (upsertError) {
        const errorMessage = String(upsertError?.message || '').toLowerCase();
        const missingColumn =
          errorMessage.includes('column') &&
          (errorMessage.includes('cpf') || errorMessage.includes('street'));
        if (missingColumn) {
          const fallbackPayload = birthday ? { ...payloadBase, birthday } : payloadBase;
          const fallback = await supabase
            .from('manual_clients')
            .upsert(fallbackPayload, { onConflict: 'establishment_id,whatsapp' });
          upsertError = fallback.error;
        }
      }

      if (upsertError) throw upsertError;

      const storageKey = `manual_clients_${establishmentId}`;
      const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');
      manualClients[normalizedWhatsapp] = {
        ...(manualClients[normalizedWhatsapp] || {}),
        name: trimmedName,
        whatsapp: normalizedWhatsapp,
        cpf: normalizedCpf || undefined,
        street: normalizedStreet || undefined,
        birthday: birthday || manualClients[normalizedWhatsapp]?.birthday || null,
        forceAdvancePayment: manualClients[normalizedWhatsapp]?.forceAdvancePayment === true,
        addedAt: manualClients[normalizedWhatsapp]?.addedAt || new Date().toISOString(),
        appointmentCount: Number(manualClients[normalizedWhatsapp]?.appointmentCount || 0),
      };
      localStorage.setItem(storageKey, JSON.stringify(manualClients));

      const newClient: Client = {
        id: `manual_${normalizedKey}`,
        name: trimmedName,
        whatsapp: normalizedWhatsapp,
        appointmentCount: 0,
      };

      setClients((prev) => {
        const next = [...prev];
        const existingIndex = next.findIndex((c) => {
          const key = normalizeWhatsappKey(c.whatsapp);
          return key && key === normalizedKey;
        });
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            name: trimmedName,
            whatsapp: normalizedWhatsapp,
          };
        } else {
          next.unshift(newClient);
        }
        return next.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }));
      });

      const selected = {
        ...newClient,
      };
      setSelectedClient(selected);
      setClientSearchQuery('');
      setShowAddClientInline(false);
      setNewKnownClientName('');
      setNewKnownClientWhatsapp('');
      setNewKnownClientCpf('');
      setNewKnownClientStreet('');
      setNewKnownClientBirthday('');

      if (selectedProfessional && String(selectedProfessional.id || '').trim().length > 0) {
        setStep('service');
      } else {
        setStep('professional');
      }
    } catch (error: any) {
      console.error('❌ Erro ao adicionar cliente conhecido:', error);
      alert(String(error?.message || 'Erro ao adicionar cliente.'));
    } finally {
      setIsCreatingKnownClient(false);
    }
  };

  const handleProfessionalSelect = (professional: Professional) => {
    setSelectedProfessional(professional);
    setSelectedSubscription(null);
    setSelectedSubscriberPlanMeta(null);
    setStep('service');
  };

  // Filtrar clientes por busca
  const filteredClients = clients.filter((client) => {
    const q = String(clientSearchQuery || '').trim();
    if (!q) return true;
    const qName = normalizeText(q);
    const qDigits = q.replace(/\D/g, '');
    const name = normalizeText(client?.name);
    const wpp = String(client?.whatsapp || '').replace(/\D/g, '');
    return (qName && name.includes(qName)) || (qDigits && wpp.includes(qDigits));
  });
  const hasKnownClients = clients.length > 0;
  const disableKnownClientOption = loadingClients || !hasKnownClients;
  const filteredSubscriptions = (() => {
    if (selectedClient && selectedClientActiveSubscriptionId) {
      const onlyActivePlan = subscriptions.filter(
        (sub) => String(sub.id) === String(selectedClientActiveSubscriptionId)
      );
      // Compatibilidade: se o filtro não encontrar plano ativo, mantém lista completa
      // para o profissional decidir manualmente.
      return onlyActivePlan.length > 0 ? onlyActivePlan : subscriptions;
    }
    return subscriptions;
  })();

  const normalizedServiceSearch = normalizeText(serviceSearchQuery);
  const serviceMatchesSearch = (value: any): boolean => {
    if (!normalizedServiceSearch) return true;
    return normalizeText(value).includes(normalizedServiceSearch);
  };

  const visibleServiceCategories = serviceCategories.filter(
    (category) => !isCategoryBlockedForProfessional(category, selectedProfessional?.id)
  );

  const filteredDirectServices = services.filter((service) => serviceMatchesSearch(service?.name));
  const filteredServiceCategories = visibleServiceCategories.filter((category) => serviceMatchesSearch(category?.name));
  const filteredServiceSubcategories = serviceSubcategories.filter((subcategory) => serviceMatchesSearch(subcategory?.name));
  const filteredSubscriptionsBySearch = filteredSubscriptions.filter((subscription) => {
    if (serviceMatchesSearch(subscription?.name)) return true;
    if (serviceMatchesSearch(subscription?.service_name)) return true;
    return getOfferedServicesFromSubscription(subscription).some((s) => serviceMatchesSearch(s.name));
  });

  const validateSlotDurationMinutes = (totalMinutes: number): boolean => {
    const max = slotPrefill?.maxDurationMinutes;
    if (max == null) return true;
    if (totalMinutes <= max) return true;
    toast.error(
      `Soma dos serviços (${totalMinutes} min) não cabe no intervalo livre (${max} min até o próximo horário ocupado ou fim do expediente). Escolha serviços mais curtos ou use "Agendar cliente" para escolher outro horário.`
    );
    return false;
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedSubscription(null);
    setSelectedSubscriberPlanMeta(null);
    const total = parseDurationMinutes(service.duration);
    if (!validateSlotDurationMinutes(total)) return;
    setSelectedService(service);
    setStep(slotPrefill ? 'confirm' : 'time');
  };

  const handleMultipleServiceToggle = (service: Service) => {
    setSelectedSubscription(null);
    setSelectedSubscriberPlanMeta(null);
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const handleMultipleServicesConfirm = () => {
    if (selectedServices.length > 0) {
      setSelectedSubscription(null);
      setSelectedSubscriberPlanMeta(null);
      const total = calculateTotalDuration(selectedServices);
      if (!validateSlotDurationMinutes(total)) return;
      setStep(slotPrefill ? 'confirm' : 'time');
    }
  };

  // Calcular total de tempo e valor dos serviços selecionados
  const calculateTotalDuration = (services: Service[]) => {
    return services.reduce((total, service) => total + service.duration, 0);
  };

  const calculateTotalPrice = (services: Service[]) => {
    return services.reduce((total, service) => total + service.price, 0);
  };

  const formatDuration = (minutes: number) => {
    const m = Number(minutes);
    const safe = Number.isFinite(m) && m > 0 ? Math.round(m) : 0;
    if (safe === 0) return '—';
    if (safe >= 60) {
      const hours = Math.floor(safe / 60);
      const remainingMinutes = safe % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    }
    return `${safe}min`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleCategorySelect = (category: ServiceCategory) => {
    setSelectedSubscription(null);
    setSelectedSubscriberPlanMeta(null);
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setShowCategoryServices(true);
  };

  useEffect(() => {
    if (selectedCategory && isCategoryBlockedForProfessional(selectedCategory, selectedProfessional?.id)) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setShowCategoryServices(false);
      setServiceSubcategories([]);
    }
  }, [selectedProfessional?.id, selectedCategory]);

  const handleSubcategorySelect = (subcategory: ServiceSubcategory) => {
    setSelectedSubcategory(subcategory);
    setSelectedSubscription(null);
    setSelectedSubscriberPlanMeta(null);
    // Converter subcategoria para formato de serviço
    const serviceFromSubcategory: Service = {
      id: subcategory.id,
      name: subcategory.name,
      price: subcategory.price,
      duration: subcategory.duration,
      loyalty_points: Math.max(0, Math.floor(Number((subcategory as any).loyalty_points ?? 0))),
    };
    const total = parseDurationMinutes(serviceFromSubcategory.duration);
    if (!validateSlotDurationMinutes(total)) return;
    setSelectedService(serviceFromSubcategory);
    setStep(slotPrefill ? 'confirm' : 'time');
  };

  const handleSubscriptionSelect = (subscription: Subscription, offered: PlanOfferedService) => {
    setSelectedServices([]);
    setSelectedSubscription(subscription);
    setSelectedSubscriberPlanMeta({
      serviceId: offered.id ? String(offered.id) : null,
      serviceName: offered.name,
      serviceLimit: Number.isFinite(offered.limit) && offered.limit > 0 ? offered.limit : 0,
    });
    const serviceFromSubscription: Service = {
      id: subscription.id,
      name: `${subscription.name} (${offered.name})`,
      price: 0,
      duration: offered.duration,
    };
    const total = parseDurationMinutes(offered.duration);
    if (!validateSlotDurationMinutes(total)) return;
    setSelectedService(serviceFromSubscription);
    setStep(slotPrefill ? 'confirm' : 'time');
  };

  const handleCancelAppointment = async (appointmentId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevenir que o clique no botão selecione o horário

    if (!confirm('Quer mesmo cancelar esse agendamento?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      // Disparar evento para recarregar agendamentos no dashboard
      window.dispatchEvent(new CustomEvent('clientAppointmentCreated'));

      // Forçar recarregamento dos slots alterando temporariamente a data e voltando
      // Isso vai disparar o useEffect que recarrega os slots
      const currentDate = selectedDate;
      setSelectedDate('');
      setTimeout(() => {
        setSelectedDate(currentDate);
      }, 100);

      alert('Agendamento cancelado com sucesso!');
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      alert('Erro ao cancelar agendamento');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  const getSelectedReservationDurationMinutes = (): number => {
    const totalDurationRaw =
      selectedServices.length > 0
        ? calculateTotalDuration(selectedServices)
        : selectedService?.duration || 30;
    const selectedDuration = parseDurationMinutes(totalDurationRaw);

    // Quando o barbeiro escolhe um serviço específico dentro da assinatura
    // (divided_services), a duração desse serviço é a regra principal.
    if (selectedSubscription && selectedSubscriberPlanMeta?.serviceName) {
      return selectedDuration;
    }

    const minSubscriberDuration = selectedSubscription
      ? parseDurationMinutes(selectedSubscription?.service_duration ?? selectedSubscription?.duration)
      : 0;
    return minSubscriberDuration > 0 ? Math.max(selectedDuration, minSubscriberDuration) : selectedDuration;
  };

  const handleConfirmReservation = async () => {
    if (!selectedProfessional || (!selectedService && selectedServices.length === 0) || !selectedTime) return;

    if (slotPrefill?.maxDurationMinutes != null) {
      const totalDur = getSelectedReservationDurationMinutes();
      if (!validateSlotDurationMinutes(totalDur)) return;
    }

    setLoading(true);
    try {
      // Atualizar sessão antes de criar a reserva (evita FK 23503 quando a página fica aberta muito tempo)
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const currentUser = refreshData?.session?.user ?? refreshData?.user ?? null;
      if (refreshError || !currentUser?.id) {
        setLoading(false);
        alert(
          'Sessão expirada ou inválida. Recarregue a página ou faça login novamente para criar a reserva.'
        );
        return;
      }
      const currentUserId = currentUser.id;
      // Determinar serviços a serem inseridos
      const servicesToInsert = selectedServices.length > 0 ? selectedServices : [selectedService!];
      const baseTotalPrice = selectedServices.length > 0
        ? calculateTotalPrice(selectedServices)
        : selectedService!.price;
      const totalDuration = getSelectedReservationDurationMinutes();

      // Criar nome dos serviços
      const serviceNames = servicesToInsert.map(s => s.name).join(', ');

      // Verificar se é um agendamento de assinante ou cliente conhecido
      const isSubscriber = selectedSubscription !== null; // serviço/condição de assinante (não substitui o cliente)
      const isKnownClient = selectedClient !== null;

      // Compatibilidade: permitir reservar mesmo sem assinatura ativa.
      // A decisão operacional fica com o profissional no fluxo de atendimento.

      // Função para gerar UUID consistente a partir de uma string (para clientes manuais)
      const generateUUIDFromString = (str: string): string => {
        // Hash simples baseado na string para gerar valores determinísticos
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }

        // Gerar UUID v4-like format (mas determinístico baseado no hash)
        // Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        const hash2 = Math.abs((hash * 31) + str.length).toString(16).padStart(8, '0');
        const hash3 = Math.abs((hash * 17) + str.charCodeAt(0)).toString(16).padStart(8, '0');

        // Construir UUID no formato correto: 8-4-4-4-12
        const part1 = hex.slice(0, 8).padEnd(8, '0');
        const part2 = hex.slice(0, 4).padEnd(4, '0');
        const part3 = `4${hex.slice(4, 7)}`.padEnd(4, '0');
        const part4 = `${((hash & 0x3) | 0x8).toString(16)}${hash2.slice(0, 3)}`.padEnd(4, '0');
        const part5 = `${hash2}${hash3}`.slice(0, 12).padEnd(12, '0');

        return `${part1}-${part2}-${part3}-${part4}-${part5}`;
      };

      const normalizeWhatsappForStorage = (input?: string | null): string | null => {
        const digits = String(input || '').replace(/\D/g, '');
        if (!digits) return null;
        // Se já tem código de país conhecido, mantém
        const known = [
          { code: '55', minLength: 12 }, // BR
          { code: '351', minLength: 11 }, // PT
          { code: '34', minLength: 11 }, // ES
          { code: '1', minLength: 11 }, // US/CA
        ];
        const hasCountryCode = known.some(({ code, minLength }) => digits.startsWith(code) && digits.length >= minLength);
        if (hasCountryCode) return digits;
        // Senão, assume BR (10/11 dígitos) e adiciona 55
        if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
        return digits;
      };

      // Determinar client_id e client_name
      let clientId: string;
      let clientName: string;
      let clientWhatsapp: string | null;
      let isAvulso: boolean;

      // ✅ Prioridade: se escolheu um cliente conhecido, SEMPRE manter o nome/WhatsApp dele,
      // mesmo que o serviço selecionado seja de "assinante".
      if (isKnownClient) {
        // Se o cliente é manual (id começa com "manual_"), usar o user_id do estabelecimento
        // O banco exige client_id NOT NULL e tem foreign key para users
        // Como cliente manual não tem user_id, usamos o ID do estabelecimento como fallback
        // O importante é ter client_name e client_whatsapp corretos para identificar o cliente
        if (selectedClient.id.startsWith('manual_')) {
          // Usar o user_id do estabelecimento como client_id (passa a foreign key check)
          // Mas o cliente será identificado pelo client_name e client_whatsapp
          clientId = currentUserId;
        } else {
          clientId = selectedClient.id; // Cliente com UUID válido (deve existir em users)
        }
        clientName = selectedClient.name;
        clientWhatsapp = normalizeWhatsappForStorage(selectedClient.whatsapp);
        isAvulso = false; // Cliente conhecido não é avulso
      } else if (isSubscriber) {
        clientId = currentUserId;
        clientName = 'ASSINANTE';
        clientWhatsapp = null;
        isAvulso = false;
      } else {
        clientId = currentUserId;
        clientName = 'CLIENTE AVULSO';
        clientWhatsapp = null;
        isAvulso = true;
      }

      const useLoyaltyFree =
        isKnownClient &&
        !isSubscriber &&
        !selectedClientActiveSubscriptionId &&
        loyaltyRedeemApplied &&
        loyaltyRow != null &&
        loyaltyRow.cycle_goal >= 2 &&
        loyaltyRow.cycle_progress >= loyaltyRow.cycle_goal &&
        !reservarMensal;

      if (loyaltyRedeemApplied && !useLoyaltyFree) {
        setLoading(false);
        toast.error(
          'Não foi possível aplicar o benefício de fidelidade. Verifique se o cliente não é assinante, se a meta foi atingida e se não está em reserva mensal.'
        );
        return;
      }

      const effectiveTotalPrice = useLoyaltyFree ? 0 : baseTotalPrice;

      // ⚠️ IMPORTANTE:
      // "Quero receber adiantado os serviços" (pagamento via Pagar.me) é uma regra do BOOKING PÚBLICO (cliente agendando no site).
      // Reservas criadas pelo profissional dentro do DASHBOARD (Reservar Cliente) NÃO devem exigir PIX/CPF.
      const requiresPayment = false;

      // Helpers para reserva mensal
      const addDays = (d: Date, days: number): Date => {
        const next = new Date(d);
        next.setDate(next.getDate() + days);
        return next;
      };

      const parseTimeToMinutes = (hhmm: string): number => {
        const [h, m] = String(hhmm || '').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
        return h * 60 + m;
      };

      const hasOverlap = (startA: number, durA: number, startB: number, durB: number): boolean => {
        const endA = startA + durA;
        const endB = startB + durB;
        return startA < endB && startB < endA;
      };

      const scheduleIntervalMinutes = getScheduleIntervalMinutes({
        use60MinuteSchedule: use60MinuteScheduleProp,
        use20MinuteSchedule: use20MinuteScheduleProp || use20MinuteSchedule,
        use15MinuteInterval,
      });

      // Construir lista de datas (inclui a selecionada e vai semanalmente até o fim do mês)
      const selectedDateObj = (() => {
        const [y, m, d] = (selectedDate || '').split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0); // meio-dia p/ evitar bug de timezone
      })();

      const datasMensais: string[] = [];
      if (reservarMensal) {
        // ✅ Novo: usa dias escolhidos no calendário (pode incluir mês que vem)
        const unique = Array.from(new Set(datasSelecionadasMensal.filter(Boolean)));
        if (unique.length === 0) {
          alert('Selecione ao menos um dia para a reserva mensal.');
          return;
        }
        datasMensais.push(...unique);
      } else {
        datasMensais.push(selectedDate);
      }

      // Verificar conflitos antes de criar (evita sobreposição e double-booking)
      const { data: existingAppointments, error: existingError } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, duration, additional_products, status, professional')
        .eq('establishment_id', establishmentId)
        .in('appointment_date', datasMensais)
        .neq('status', 'cancelled');

      if (existingError) throw existingError;

      const novoInicioMin = parseTimeToMinutes(selectedTime);
      const selectedProfessionalIdNorm = normalizeText(selectedProfessional?.id);
      const selectedProfessionalNameNorm = normalizeText(selectedProfessional?.name);

      const datasSemConflito = datasMensais.filter((dateStr) => {
        const doDia = (existingAppointments || []).filter((a: any) => {
          if (a.appointment_date !== dateStr) return false;
          const existingProfessionalNorm = normalizeText(a?.professional);
          if (!existingProfessionalNorm) return false;
          return (
            (selectedProfessionalIdNorm.length > 0 && existingProfessionalNorm === selectedProfessionalIdNorm) ||
            (selectedProfessionalNameNorm.length > 0 && existingProfessionalNorm === selectedProfessionalNameNorm)
          );
        });
        for (const a of doDia) {
          const inicio = parseTimeToMinutes(a.appointment_time);
          const dur = getAppointmentDurationMinutes(a);
          if (hasOverlap(novoInicioMin, totalDuration, inicio, dur)) return false;
        }
        return true;
      });

      const isBlockedConflictForDate = (dateStr: string) => {
        const blockedByDate = ((selectedProfessional as any)?.blocked_hours || {})[dateStr] || [];
        const blockedTimes = Array.isArray(blockedByDate) ? blockedByDate : [];
        return blockedTimes.some((blocked: string) => {
          const blockedStart = parseTimeToMinutes(String(blocked || ''));
          const blockedDuration = scheduleIntervalMinutes; // mesmo alcance usado pelo trigger no banco
          return hasOverlap(novoInicioMin, totalDuration, blockedStart, blockedDuration);
        });
      };

      // ReservarCliente não recebe objeto `establishment`; manter override desativado por segurança.
      const allowInternalBlockOverride = false;
      const datesWithBlockedConflict = datasSemConflito.filter((dateStr) => isBlockedConflictForDate(dateStr));
      const askUnlockBlockedConfirmation = (dates: string[]) =>
        window.confirm(
          'Esse horário está bloqueado para uma ou mais datas selecionadas.\n' +
          'Deseja DESBLOQUEAR esse horário nessas datas e agendar?\n\n' +
          `Horário: ${selectedTime}\n` +
          `Datas com bloqueio: ${dates.slice(0, 8).join(', ')}${dates.length > 8 ? ` (+${dates.length - 8})` : ''}`
        );

      const unlockBlockedHoursForDates = async (datesToUnlock: string[]): Promise<boolean> => {
        const uniqueDates = Array.from(new Set((datesToUnlock || []).filter(Boolean)));
        if (uniqueDates.length === 0) return true;

        const { data: establishmentRow, error: establishmentError } = await supabase
          .from('establishments')
          .select('professionals')
          .eq('id', establishmentId)
          .single();
        if (establishmentError) {
          alert('Erro ao carregar profissionais para desbloquear horário.');
          return false;
        }

        const dbProfessionals = Array.isArray((establishmentRow as any)?.professionals)
          ? ([...(establishmentRow as any).professionals] as any[])
          : [];
        if (dbProfessionals.length === 0) return true;

        const selectedProfessionalIdNormDb = normalizeText(selectedProfessional?.id);
        const selectedProfessionalNameNormDb = normalizeText(selectedProfessional?.name);
        const targetIdx = dbProfessionals.findIndex((p: any) => {
          const pid = normalizeText(p?.id);
          const pname = normalizeText(p?.name);
          return (
            (selectedProfessionalIdNormDb.length > 0 && pid === selectedProfessionalIdNormDb) ||
            (selectedProfessionalNameNormDb.length > 0 && pname === selectedProfessionalNameNormDb)
          );
        });
        if (targetIdx < 0) return true;

        const targetProfessional = { ...(dbProfessionals[targetIdx] || {}) } as any;
        const blockedMapRaw = targetProfessional?.blocked_hours;
        const blockedMap: Record<string, string[]> =
          blockedMapRaw && typeof blockedMapRaw === 'object' && !Array.isArray(blockedMapRaw)
            ? { ...blockedMapRaw }
            : {};

        let changed = false;
        uniqueDates.forEach((dateKey) => {
          const dayBlockedRaw = blockedMap[dateKey];
          const dayBlocked = Array.isArray(dayBlockedRaw) ? dayBlockedRaw : [];
          if (dayBlocked.length === 0) return;

          const remaining = dayBlocked.filter((blocked: string) => {
            const blockedStart = parseTimeToMinutes(normalizeTimeHHmm(String(blocked || '')));
            const blockedDuration = scheduleIntervalMinutes;
            const isConflict = hasOverlap(novoInicioMin, totalDuration, blockedStart, blockedDuration);
            return !isConflict;
          });

          if (remaining.length !== dayBlocked.length) {
            changed = true;
            if (remaining.length > 0) blockedMap[dateKey] = remaining;
            else delete blockedMap[dateKey];
          }
        });

        if (!changed) return true;

        targetProfessional.blocked_hours = blockedMap;
        const nextProfessionals = [...dbProfessionals];
        nextProfessionals[targetIdx] = targetProfessional;

        const { error: updateError } = await supabase
          .from('establishments')
          .update({ professionals: nextProfessionals })
          .eq('id', establishmentId);
        if (updateError) {
          alert('Erro ao salvar desbloqueio de horário.');
          return false;
        }

        setProfessionals(nextProfessionals as any);
        setSelectedProfessional((prev) => {
          if (!prev) return prev;
          const updated = nextProfessionals[targetIdx];
          return updated ? ({ ...prev, ...updated } as any) : prev;
        });
        return true;
      };

      // Segurança: por padrão NÃO desbloqueia bloqueio automaticamente no Reservar Cliente.
      let didUnlockBlockedHours = false;
      let datasParaInserir = [...datasSemConflito];
      if (datesWithBlockedConflict.length > 0) {
        if (!allowInternalBlockOverride) {
          const blockedSet = new Set(datesWithBlockedConflict);
          datasParaInserir = datasSemConflito.filter((dateStr) => !blockedSet.has(dateStr));
          if (datasParaInserir.length === 0) {
            setLoading(false);
            alert(
              'Este horário está bloqueado nas datas selecionadas.\n\n' +
              `Horário: ${selectedTime}\n` +
              `Datas com bloqueio: ${datesWithBlockedConflict.slice(0, 8).join(', ')}${datesWithBlockedConflict.length > 8 ? ` (+${datesWithBlockedConflict.length - 8})` : ''}\n\n` +
              'Para manter a proteção da agenda, o sistema não desbloqueia automaticamente.\n' +
              'Se precisar, desbloqueie manualmente em "Bloquear horários".'
            );
            return;
          }
        } else {
          const shouldUnlock = askUnlockBlockedConfirmation(datesWithBlockedConflict);
          if (!shouldUnlock) {
            setLoading(false);
            return;
          }
          const unlocked = await unlockBlockedHoursForDates(datesWithBlockedConflict);
          if (!unlocked) {
            setLoading(false);
            return;
          }
          didUnlockBlockedHours = true;
        }
      }

      // Barbeiro cria a reserva: client_id tem que ser um id que existe em auth.users (NOT NULL + FK).
      // Sempre usamos o user do dono logado (currentUserId da sessão atualizada); cliente identificado por client_name e client_whatsapp.
      const payloads = datasParaInserir.map((dateStr) => {
        const loyaltyPointsSum = servicesToInsert.reduce(
          (sum, s) => sum + Math.max(0, Number((s as any).loyalty_points ?? 0)),
          0
        );
        const payload: any = {
          client_id: currentUserId,
          establishment_id: establishmentId,
          professional: selectedProfessional.id,
          service: serviceNames,
          client_name: clientName,
          client_whatsapp: clientWhatsapp,
          appointment_date: dateStr,
          appointment_time: selectedTime,
          status: 'confirmed',
          price: effectiveTotalPrice,
          total_price: effectiveTotalPrice,
          duration: totalDuration,
          payment_method: isSubscriber ? 'assinante' : 'dinheiro',
          is_avulso: isAvulso,
          is_subscriber: isSubscriber,
          is_loyalty_reward: useLoyaltyFree,
          ...(isSubscriber
            ? {}
            : { loyalty_points_awarded: useLoyaltyFree ? 0 : loyaltyPointsSum }),
        };
        if (isSubscriber && selectedSubscription) {
          payload.subscription_id = String(selectedSubscription.id || '').trim() || null;
          if (selectedSubscriberPlanMeta?.serviceName) {
            payload.subscriber_service_id = selectedSubscriberPlanMeta.serviceId || null;
            payload.subscriber_service_name = selectedSubscriberPlanMeta.serviceName;
            if (selectedSubscriberPlanMeta.serviceLimit > 0) {
              payload.subscriber_service_limit = selectedSubscriberPlanMeta.serviceLimit;
            }
          }
        }
        // Segurança adicional: quando o dono confirmou desbloqueio no fluxo interno,
        // também envia override para não falhar por divergência de bloqueio legado.
        if (allowInternalBlockOverride && didUnlockBlockedHours) {
          payload.allow_blocked_override = true;
        }
        return payload;
      });

      if (payloads.length === 0) {
        alert('Não foi possível criar as reservas: todos os horários do mês já estão ocupados nesse horário.');
        return;
      }
      if (!allowInternalBlockOverride && datasParaInserir.length < datasSemConflito.length) {
        const skippedByBlock = datasSemConflito.length - datasParaInserir.length;
        toast(
          `${skippedByBlock} data(s) foram ignoradas porque estavam bloqueadas. Nenhum bloqueio foi removido automaticamente.`,
          { duration: 5500 }
        );
      }

      const { data: insertedData, error: initialInsertError } = await supabase
        .from('appointments')
        .insert(payloads)
        .select('id');

      const isBlockedByTriggerError = (err: any) => {
        const errorCode = String(err?.code ?? '').trim();
        const errorMessage = String(err?.message ?? '').toLowerCase();
        return errorCode === 'P0001' && errorMessage.includes('bloqueado para este profissional');
      };

      const isOverlapByTriggerError = (err: any) => {
        const errorCode = String(err?.code ?? '').trim();
        const errorMessage = String(err?.message ?? '').toLowerCase();
        return (
          errorCode === 'P0001' &&
          (
            errorMessage.includes('conflito de horário') ||
            errorMessage.includes('conflito de horario') ||
            errorMessage.includes('já está reservado') ||
            errorMessage.includes('ja esta reservado') ||
            errorMessage.includes('já existe agendamento') ||
            errorMessage.includes('ja existe agendamento')
          )
        );
      };

      let inserted = insertedData;
      let insertError = initialInsertError;
      let skippedByDbConflict = 0;

      const removeSubscriberExtraFieldsFromPayload = (payload: any) => {
        const clean: any = { ...(payload || {}) };
        delete clean.subscription_id;
        delete clean.subscriber_service_id;
        delete clean.subscriber_service_name;
        delete clean.subscriber_service_limit;
        return clean;
      };

      const shouldRetryWithoutSubscriberSchemaFields = (err: any) => {
        const msg = String(err?.message || '').toLowerCase();
        const code = String(err?.code || '').toLowerCase();
        return (
          code === 'pgrst204' ||
          msg.includes('schema cache') ||
          msg.includes('could not find the') ||
          msg.includes('subscription_id') ||
          msg.includes('subscriber_service_')
        );
      };

      // Mesma ideia do BookingPage: DB antigo sem colunas de assinatura no appointments → grava sem elas.
      if (insertError && shouldRetryWithoutSubscriberSchemaFields(insertError)) {
        const legacyPayloads = payloads.map(removeSubscriberExtraFieldsFromPayload);
        const { data: legacyInserted, error: legacyError } = await supabase
          .from('appointments')
          .insert(legacyPayloads)
          .select('id');
        if (!legacyError) {
          inserted = legacyInserted;
          insertError = null;
        } else {
          insertError = legacyError;
        }
      }

      if (insertError) {
        const msgIns = String((insertError as any)?.message || '').toLowerCase();
        if (msgIns.includes('is_loyalty_reward')) {
          const strippedLoyalty = payloads.map((p: any) => {
            const x = { ...p };
            delete x.is_loyalty_reward;
            return x;
          });
          const { data: loyaltyRetryData, error: loyaltyRetryErr } = await supabase
            .from('appointments')
            .insert(strippedLoyalty)
            .select('id');
          if (!loyaltyRetryErr) {
            inserted = loyaltyRetryData;
            insertError = null;
            toast('Reserva criada. Aplique a migration de fidelidade no Supabase para gravar o flag "Fidelidade" no agendamento.', {
              duration: 6000,
            });
          }
        }
      }
      if (insertError) {
        const msgPts = String((insertError as any)?.message || '').toLowerCase();
        if (msgPts.includes('loyalty_points_awarded') && (msgPts.includes('column') || msgPts.includes('schema'))) {
          const strippedPts = payloads.map((p: any) => {
            const x = { ...p };
            delete x.loyalty_points_awarded;
            return x;
          });
          const { data: ptsRetryData, error: ptsRetryErr } = await supabase.from('appointments').insert(strippedPts).select('id');
          if (!ptsRetryErr) {
            inserted = ptsRetryData;
            insertError = null;
            toast(
              'Reserva criada. Rode a migration no Supabase para pontos de fidelidade por serviço (coluna loyalty_points_awarded).',
              { duration: 6000 }
            );
          }
        }
      }

      // Fallback de compatibilidade:
      // Se o banco bloquear (P0001), sempre faz uma segunda tentativa com override forçado.
      if (allowInternalBlockOverride && insertError && isBlockedByTriggerError(insertError)) {
        let unlockedAfterDbError = true;
        if (!didUnlockBlockedHours) {
          const shouldUnlockAfterDbError = askUnlockBlockedConfirmation(datasParaInserir);
          if (!shouldUnlockAfterDbError) {
            unlockedAfterDbError = false;
          } else {
            unlockedAfterDbError = await unlockBlockedHoursForDates(datasParaInserir);
          }
        }

        if (unlockedAfterDbError) {
          const retryPayloads = payloads.map((payload) => ({
            ...payload,
            allow_blocked_override: true,
          }));
          const { data: retryInserted, error: retryError } = await supabase
            .from('appointments')
            .insert(retryPayloads)
            .select('id');
          inserted = retryInserted;
          insertError = retryError;
        }
      }

      // Fallback robusto para lote anual:
      // se 1 data conflitar, não perde o lote inteiro; grava as demais.
      if (insertError && payloads.length > 1 && isOverlapByTriggerError(insertError)) {
        const insertedRows: Array<{ id: string }> = [];
        let fatalError: any = null;

        for (const payload of payloads) {
          const { data: rowInserted, error: rowError } = await supabase
            .from('appointments')
            .insert(payload)
            .select('id');

          if (!rowError) {
            if (Array.isArray(rowInserted)) {
              insertedRows.push(...(rowInserted as Array<{ id: string }>));
            }
            continue;
          }

          if (isOverlapByTriggerError(rowError)) {
            skippedByDbConflict += 1;
            continue;
          }

          fatalError = rowError;
          break;
        }

        if (!fatalError) {
          inserted = insertedRows;
          insertError = null;
        } else {
          insertError = fatalError;
        }
      }

      if (insertError) throw insertError;

      // Reservas internas não abrem modal de pagamento (ver comentário acima)

      // ✅ SEMPRE disparar evento para recarregar agendamentos no dashboard
      // (Independente de ser cliente conhecido, avulso ou assinante)
      window.dispatchEvent(new CustomEvent('clientAppointmentCreated', {
        detail: {
          clientId: isKnownClient && selectedClient ? selectedClient.id : clientId,
          clientWhatsapp: clientWhatsapp || '',
          isKnownClient,
          isSubscriber,
          isAvulso,
          createdCount: Array.isArray(inserted) ? inserted.length : 1,
          skippedCount: datasMensais.length - datasSemConflito.length,
          reservarMensal
        }
      }));

      const createdCount = Array.isArray(inserted) ? inserted.length : 1;
      const skippedCount = (datasMensais.length - datasSemConflito.length) + skippedByDbConflict;
      onAppointmentCreated?.({
        isAvulso: Boolean(isAvulso),
        createdCount,
      });
      const msg = reservarMensal
        ? `Reservas criadas: ${createdCount}.\n${skippedCount > 0 ? `Ignoradas por conflito (já havia cliente agendado): ${skippedCount}.` : ''}`
        : 'Reserva criada com sucesso!';
      alert(msg);
      onClose();
    } catch (error) {
      console.error('Erro ao criar reserva:', error);

      const err: any = error || {};
      const code = String(err?.code ?? '').trim();
      const msg =
        String(err?.message || err?.error || 'Erro ao criar reserva').trim() ||
        'Erro ao criar reserva';
      const details = String(err?.details || '').trim();
      const hint = String(err?.hint || '').trim();
      const isBlockedByTriggerNow =
        code === 'P0001' && msg.toLowerCase().includes('bloqueado para este profissional');
      const isOverlapByTriggerNow =
        code === 'P0001' &&
        (
          msg.toLowerCase().includes('conflito de horário') ||
          msg.toLowerCase().includes('conflito de horario') ||
          msg.toLowerCase().includes('já está reservado') ||
          msg.toLowerCase().includes('ja esta reservado') ||
          msg.toLowerCase().includes('já existe agendamento') ||
          msg.toLowerCase().includes('ja existe agendamento')
        );

      // 23503 = foreign_key_violation (client_id não existe em users) — geralmente sessão expirada
      if (code === '23503' || (details && details.toLowerCase().includes('key is not present in table'))) {
        setLoading(false);
        alert(
          'Sessão expirada ou inválida. Recarregue a página ou faça login novamente e tente criar a reserva de novo.'
        );
        return;
      }

      // Coluna nova ainda não aplicada no banco (migração pendente).
      const missingOverrideColumn =
        msg.toLowerCase().includes('allow_blocked_override') &&
        (msg.toLowerCase().includes('column') || msg.toLowerCase().includes('schema cache'));
      if (missingOverrideColumn) {
        setLoading(false);
        alert(
          'Seu banco ainda não recebeu a atualização para permitir "agendar por cima do bloqueio" no Reservar Cliente.\n\n' +
          'Aplique a migration do projeto e tente novamente.'
        );
        return;
      }

      // Se ainda vier P0001 após confirmação de override, avisar sem acusar
      // "regra antiga" de forma incorreta.
      if (isBlockedByTriggerNow) {
        setLoading(false);
        alert(
          'O banco ainda bloqueou este horário.\n\n' +
          'Se você já aplicou a migration de override interno, recarregue a página e tente de novo.\n' +
          'Se persistir, pode haver outra regra/trilha de validação ativa no banco.'
        );
        return;
      }

      if (isOverlapByTriggerNow) {
        setLoading(false);
        alert(
          reservarMensal
            ? 'Conflito de horário: em uma ou mais datas selecionadas já existe cliente agendado para este profissional nesse horário.\n\n' +
            'Escolha outro horário ou mantenha este horário e aceite que algumas datas sejam ignoradas.'
            : 'Conflito de horário: já existe cliente agendado para este profissional nesse horário.\n\nEscolha outro horário.'
        );
        return;
      }

      const extraParts = [
        code ? `Código: ${code}` : '',
        details ? `Detalhes: ${details}` : '',
        hint ? `Dica: ${hint}` : '',
      ].filter(Boolean);

      // Mensagem mais clara (inclui erro real do Supabase/Postgres)
      alert(
        `Erro ao criar reserva:\n${msg}` +
        (extraParts.length ? `\n\n${extraParts.join('\n')}` : '') +
        (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy')
          ? '\n\n⚠️ Parece ser permissão (RLS) no Supabase. Avise o suporte para aplicar a policy de INSERT na tabela appointments.'
          : '')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadSelectedClientActiveSubscription = async () => {
      if (!selectedClient || !establishmentId) {
        setSelectedClientActiveSubscriptionId(null);
        return;
      }

      try {
        const { data: subscriberData, error } = await checkWhatsAppSubscriber(selectedClient.whatsapp, establishmentId);
        if (cancelled || error || !subscriberData) {
          setSelectedClientActiveSubscriptionId(null);
          return;
        }

        const paymentStatus = String((subscriberData as any)?.payment_status || '').toLowerCase().trim();
        const isExpired = Boolean((subscriberData as any)?.is_expired) ||
          (String((subscriberData as any)?.end_date || '').trim() !== '' &&
            new Date((subscriberData as any).end_date) < new Date());

        if (paymentStatus !== 'paid' || isExpired) {
          setSelectedClientActiveSubscriptionId(null);
          return;
        }

        const activeSubscriptionId = String(
          (subscriberData as any)?.subscription_id ||
          (subscriberData as any)?.subscriptions?.id ||
          ''
        ).trim();

        setSelectedClientActiveSubscriptionId(activeSubscriptionId || null);
      } catch {
        if (!cancelled) setSelectedClientActiveSubscriptionId(null);
      }
    };

    loadSelectedClientActiveSubscription();
    return () => {
      cancelled = true;
    };
  }, [establishmentId, selectedClient]);

  useEffect(() => {
    let cancelled = false;
    const loadLoyaltyForConfirm = async () => {
      if (
        step !== 'confirm' ||
        !establishmentId ||
        !selectedClient ||
        selectedSubscription ||
        selectedClientActiveSubscriptionId
      ) {
        if (!cancelled) {
          setLoyaltyRow(null);
          setLoyaltyRedeemApplied(false);
          setLoyaltyLoading(false);
        }
        return;
      }
      if (!cancelled) setLoyaltyLoading(true);
      try {
        const keys = getLoyaltyLookupStorageKeys(selectedClient.whatsapp);
        if (keys.length === 0) {
          if (!cancelled) {
            setLoyaltyRow(null);
            setLoyaltyRedeemApplied(false);
          }
          return;
        }
        const { data, error } = await supabase
          .from('establishment_client_loyalty')
          .select('cycle_goal,cycle_progress')
          .eq('establishment_id', establishmentId)
          .in('client_whatsapp', keys)
          .limit(5);
        if (cancelled) return;
        if (error) {
          const m = String(error.message || '').toLowerCase();
          if (!m.includes('does not exist') && !m.includes('schema cache') && !m.includes('relation')) {
            console.warn('Fidelidade (Reservar Cliente):', error);
          }
          setLoyaltyRow(null);
          setLoyaltyRedeemApplied(false);
          return;
        }
        const row = (data || [])[0] as any;
        if (!row || row.cycle_goal == null) {
          setLoyaltyRow(null);
          setLoyaltyRedeemApplied(false);
          return;
        }
        const goal = Number(row.cycle_goal);
        const prog = Number(row.cycle_progress ?? 0);
        if (!Number.isFinite(goal) || goal < 2) {
          setLoyaltyRow(null);
          setLoyaltyRedeemApplied(false);
          return;
        }
        setLoyaltyRow({ cycle_goal: goal, cycle_progress: prog });
        if (prog < goal) {
          setLoyaltyRedeemApplied(false);
        }
      } finally {
        if (!cancelled) setLoyaltyLoading(false);
      }
    };
    void loadLoyaltyForConfirm();
    return () => {
      cancelled = true;
    };
  }, [
    step,
    establishmentId,
    selectedClient,
    selectedSubscription,
    selectedClientActiveSubscriptionId,
  ]);

  useEffect(() => {
    if (reservarMensal) setLoyaltyRedeemApplied(false);
  }, [reservarMensal]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10020] p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full h-[92vh] sm:h-auto max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-black text-white p-4 sm:p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6" />
              <h2 className="text-xl font-bold">Reservar Cliente</h2>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Step 0: Escolher tipo de reserva */}
          {step === 'initial' && (
            <div>
              <h3 className="text-lg font-semibold mb-6 flex items-center text-gray-800">
                <User className="h-5 w-5 mr-2 text-gray-600" />
                Como deseja reservar?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    if (!disableKnownClientOption) setStep('client');
                  }}
                  disabled={disableKnownClientOption}
                  className={`p-6 border-2 rounded-lg transition-all text-left ${disableKnownClientOption
                      ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 hover:border-black hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${disableKnownClientOption ? 'bg-gray-200' : 'bg-gray-200'}`}>
                      <User className={`h-6 w-6 ${disableKnownClientOption ? 'text-gray-400' : 'text-gray-700'}`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${disableKnownClientOption ? 'text-gray-500' : 'text-gray-800'}`}>Reservar conhecido</h4>
                      <p className={`text-sm ${disableKnownClientOption ? 'text-gray-500' : 'text-gray-600'}`}>
                        {loadingClients
                          ? 'Carregando clientes...'
                          : hasKnownClients
                            ? 'Selecione um cliente da sua lista'
                            : 'Disponivel quando houver ao menos 1 cliente salvo'}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (selectedProfessional && String(selectedProfessional.id || '').trim().length > 0) {
                      setStep('service');
                      return;
                    }
                    setStep('professional');
                  }}
                  className="p-6 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-700" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Reserva avulsa</h4>
                      <p className="text-sm text-gray-600">Criar reserva para cliente avulso</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Selecionar Cliente Conhecido */}
          {step === 'client' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                  <User className="h-5 w-5 mr-2 text-gray-600" />
                  Selecione o Cliente
                </h3>
                <button
                  onClick={() => setStep('initial')}
                  className="text-gray-700 hover:text-black text-sm"
                >
                  ← Voltar
                </button>
              </div>

              {/* Campo de busca */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nome ou WhatsApp..."
                    value={clientSearchQuery}
                    onChange={(e) => {
                      setClientSearchQuery(e.target.value);
                      setShowAddClientInline(false);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Sempre visível nesta etapa: cadastrar cliente sem precisar “forçar” busca vazia */}
              <div className="mb-4">
                {!showAddClientInline ? (
                  <button
                    type="button"
                    onClick={() => {
                      const suggestedName = String(clientSearchQuery || '').trim();
                      setShowAddClientInline(true);
                      if (suggestedName) {
                        setNewKnownClientName(suggestedName);
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Adicionar cliente novo
                  </button>
                ) : (
                  <div className="text-left border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Novo cliente</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Nome *"
                        value={newKnownClientName}
                        onChange={(e) => setNewKnownClientName(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Telefone *"
                        value={newKnownClientWhatsapp}
                        onChange={(e) => setNewKnownClientWhatsapp(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="CPF (opcional)"
                        value={newKnownClientCpf}
                        onChange={(e) => setNewKnownClientCpf(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Rua (opcional)"
                        value={newKnownClientStreet}
                        onChange={(e) => setNewKnownClientStreet(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      />
                      <input
                        type="date"
                        value={newKnownClientBirthday}
                        onChange={(e) => setNewKnownClientBirthday(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddClientInline(false);
                          setNewKnownClientName('');
                          setNewKnownClientWhatsapp('');
                          setNewKnownClientCpf('');
                          setNewKnownClientStreet('');
                          setNewKnownClientBirthday('');
                        }}
                        className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                        disabled={isCreatingKnownClient}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateKnownClient}
                        disabled={isCreatingKnownClient}
                        className={`px-4 py-2 text-sm rounded-lg text-white font-medium ${isCreatingKnownClient ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
                          }`}
                      >
                        {isCreatingKnownClient ? 'Adicionando...' : 'Salvar e continuar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {loadingClients ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                  <p className="mt-2 text-gray-700">Carregando clientes...</p>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Nenhum cliente encontrado</p>
                  {!clientSearchQuery && (
                    <p className="text-sm text-gray-500">
                      Clientes aparecem aqui após fazerem agendamentos no sistema.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[45vh] sm:max-h-[400px] overflow-y-auto">
                  {filteredClients.map((client, index) => (
                    <button
                      key={client.whatsapp || `${client.id}_${index}`}
                      onClick={() => handleClientSelect(client)}
                      className="p-4 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{client.name}</h4>
                          <p className="text-sm text-gray-600">{client.whatsapp}</p>
                          {client.appointmentCount !== undefined && (
                            <p className="text-xs text-gray-700 mt-1">
                              {client.appointmentCount} agendamento{client.appointmentCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Selecionar Profissional */}
          {step === 'professional' && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <User className="h-5 w-5 mr-2 text-gray-600" />
                Selecione o Profissional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {professionals.length === 0 ? (
                  <div className="col-span-2 text-center py-8">
                    <p className="text-gray-600 mb-4">Nenhum profissional encontrado</p>
                    <p className="text-sm text-gray-500">
                      Verifique se existem profissionais cadastrados e ativos no sistema.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                    >
                      Recarregar
                    </button>
                  </div>
                ) : (
                  professionals.map((professional) => (
                    <button
                      key={professional.id}
                      onClick={() => handleProfessionalSelect(professional)}
                      className="p-4 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                    >
                      <div className="flex items-center space-x-3">
                        {professional.photo ? (
                          <img
                            src={professional.photo}
                            alt={professional.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-gray-800">{professional.name}</h4>
                          <p className="text-sm text-gray-600">Profissional</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Mostrar cliente selecionado se houver */}
              {selectedClient && (
                <div className="mt-4 p-3 bg-gray-100 border border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-800">
                    <strong>Cliente selecionado:</strong> {selectedClient.name} ({selectedClient.whatsapp})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Selecionar Serviço */}
          {step === 'service' && selectedProfessional && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center text-gray-800">
                  <Scissors className="h-5 w-5 mr-2 text-gray-600" />
                  Serviços de {selectedProfessional.name}
                </h3>
                <button
                  onClick={() => {
                    if (selectedClient) {
                      setStep('client');
                    } else {
                      setStep('initial');
                    }
                  }}
                  className="text-gray-700 hover:text-black text-sm"
                >
                  ← Voltar
                </button>
              </div>

              {/* Campo de busca de serviços */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar serviços, categorias e assinaturas..."
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Serviços Normais */}
              {services.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Serviços Diretos</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {filteredDirectServices.map((service) => {
                      const isSelected = selectedServices.some(s => s.id === service.id);
                      return (
                        <button
                          key={service.id}
                          onClick={() => handleMultipleServiceToggle(service)}
                          className={`p-4 border-2 rounded-lg transition-all text-left ${isSelected
                            ? 'border-black bg-gray-100'
                            : 'border-gray-300 hover:border-black hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${isSelected
                                ? 'border-black bg-black'
                                : 'border-gray-300'
                                }`}>
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-800">{service.name}</h4>
                                <p className="text-sm text-gray-600">
                                  {formatDuration(service.duration)} • {formatPrice(service.price)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {filteredDirectServices.length === 0 && (
                    <p className="text-sm text-gray-600">Nenhum serviço direto encontrado para essa busca.</p>
                  )}

                  {/* Resumo dos serviços selecionados */}
                  {selectedServices.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                      <h5 className="font-medium text-gray-900 mb-2">Serviços Selecionados:</h5>
                      <div className="space-y-1">
                        {selectedServices.map((service) => (
                          <div key={service.id} className="flex justify-between text-sm text-gray-800">
                            <span>{service.name}</span>
                            <span>{formatDuration(service.duration)} • {formatPrice(service.price)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-300">
                        <div className="flex justify-between font-semibold text-gray-900">
                          <span>Total:</span>
                          <span>
                            {formatDuration(calculateTotalDuration(selectedServices))} • {formatPrice(calculateTotalPrice(selectedServices))}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleMultipleServicesConfirm}
                        className="mt-3 w-full bg-black hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Continuar com {selectedServices.length} serviço{selectedServices.length > 1 ? 's' : ''}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Serviços por Categoria */}
              {serviceCategories.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-700">Serviços por Categoria</h4>

                  {!showCategoryServices ? (
                    // Mostrar lista de categorias
                    <div className="grid grid-cols-1 gap-4">
                      {filteredServiceCategories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleCategorySelect(category)}
                          className="p-4 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold text-gray-800">{category.name}</h4>
                              <p className="text-sm text-gray-600">Clique para ver opções</p>
                            </div>
                            <div className="text-gray-700">→</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    // Mostrar subcategorias da categoria selecionada
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-lg font-medium text-gray-800">
                          {selectedCategory?.name}
                        </h5>
                        <button
                          onClick={() => {
                            setShowCategoryServices(false);
                            setSelectedCategory(null);
                            setSelectedSubcategory(null);
                          }}
                          className="text-gray-700 hover:text-black text-sm"
                        >
                          ← Voltar às Categorias
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {filteredServiceSubcategories.map((subcategory) => (
                          <button
                            key={subcategory.id}
                            onClick={() => handleSubcategorySelect(subcategory)}
                            className="p-4 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-semibold text-gray-800">{subcategory.name}</h4>
                                <p className="text-sm text-gray-600">
                                  {formatDuration(subcategory.duration)} • {formatPrice(subcategory.price)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {filteredServiceSubcategories.length === 0 && (
                        <p className="text-sm text-gray-600">Nenhum serviço dessa categoria encontrado para essa busca.</p>
                      )}
                    </div>
                  )}
                  {!showCategoryServices && filteredServiceCategories.length === 0 && (
                    <p className="text-sm text-gray-600">Nenhuma categoria encontrada para essa busca.</p>
                  )}
                </div>
              )}

              {/* Clubes de Assinatura */}
              {filteredSubscriptionsBySearch.length > 0 ? (
                <div className="space-y-4 mt-6">
                  <h4 className="text-md font-medium text-gray-700">Assinantes</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {filteredSubscriptionsBySearch.map((subscription) => {
                      const offered = getOfferedServicesFromSubscription(subscription);
                      return (
                        <div
                          key={subscription.id}
                          className="border-2 border-gray-300 rounded-lg p-3 bg-white space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 px-1">
                            <h4 className="font-semibold text-gray-800">{subscription.name}</h4>
                            <span className="text-gray-700 shrink-0" aria-hidden>
                              👑
                            </span>
                          </div>
                          {offered.length === 0 ? (
                            <p className="text-sm text-amber-800 px-1">
                              Nenhum serviço configurado neste plano. Edite a assinatura e defina os serviços oferecidos.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {offered.map((svc) => (
                                <button
                                  key={`${subscription.id}-${svc.id || 'noid'}-${svc.name}`}
                                  type="button"
                                  onClick={() => handleSubscriptionSelect(subscription, svc)}
                                  className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                                >
                                  <div className="flex justify-between items-center gap-2">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-gray-800 truncate">{svc.name}</p>
                                      <p className="text-sm text-gray-600 mt-0.5">
                                        {formatDuration(svc.duration)} •{' '}
                                        <span className="text-gray-700 font-semibold">GRATUITO</span>
                                        {svc.limit > 0 ? (
                                          <span className="text-gray-500"> • até {svc.limit} uso(s) no ciclo</span>
                                        ) : null}
                                      </p>
                                    </div>
                                    <span className="text-gray-500 text-sm shrink-0">→</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : filteredSubscriptions.length > 0 && normalizedServiceSearch ? (
                <div className="mt-6">
                  <p className="text-sm text-gray-600">Nenhuma assinatura encontrada para essa busca.</p>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 4: Selecionar Horário */}
          {step === 'time' && (selectedService || selectedServices.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center text-gray-800">
                  <Clock className="h-5 w-5 mr-2 text-gray-600" />
                  Horários Disponíveis
                </h3>
                <button
                  onClick={() => setStep('service')}
                  className="text-gray-700 hover:text-black text-sm"
                >
                  ← Voltar
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 bg-white"
                />
              </div>

              {breakRange && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">
                    ⏸️ <strong>Seu intervalo:</strong> {breakRange.start} às {breakRange.end}. Nenhum horário é oferecido nesse período, e horários que invadiriam o intervalo aparecem bloqueados.
                  </p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                  <p className="mt-2 text-gray-700">Carregando horários...</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {timeSlots.map((slot) => (
                    <div
                      key={slot.time}
                      className="relative"
                    >
                      <button
                        onClick={() => slot.available && handleTimeSelect(slot.time)}
                        disabled={!slot.available}
                        className={`w-full p-2 sm:p-3 text-xs sm:text-sm rounded-lg transition-all relative ${slot.available
                          ? 'bg-green-100 hover:bg-green-200 text-green-900 border border-green-400 font-semibold'
                          : slot.reason === 'Intervalo' || slot.reason === 'Fim do expediente'
                            ? 'bg-amber-100 text-amber-900 border border-amber-400 cursor-not-allowed'
                            : slot.isAvulso
                              ? 'bg-blue-100 text-blue-900 border border-blue-400 cursor-not-allowed'
                              : 'bg-red-100 text-red-900 border border-red-400 cursor-not-allowed'
                          }`}
                      >
                        <div className="text-center">
                          <div className="font-semibold">{slot.time}</div>
                          {slot.isAvulso && (
                            <div className="text-xs text-blue-700 mt-1 font-medium">
                              RESERVA AVULSA
                            </div>
                          )}
                          {!slot.available && !slot.isAvulso && (
                            <div className={`text-xs mt-1 font-medium ${slot.reason === 'Intervalo' || slot.reason === 'Fim do expediente' ? 'text-amber-700' : 'text-red-700'}`}>
                              {slot.reason === 'Intervalo' ? 'INTERVALO' : slot.reason === 'Fim do expediente' ? 'FIM EXP.' : 'BLOQUEADO'}
                            </div>
                          )}
                        </div>
                      </button>
                      {/* Botão X para cancelar - só aparece no horário de início */}
                      {slot.appointmentId && slot.appointmentStartTime === slot.time && (
                        <button
                          onClick={(e) => handleCancelAppointment(slot.appointmentId!, e)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-black hover:bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg z-10 transition-colors"
                          title="Cancelar agendamento"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Confirmar Reserva */}
          {step === 'confirm' && selectedProfessional && (selectedService || selectedServices.length > 0) && selectedTime && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <CheckCircle className="h-5 w-5 mr-2 text-gray-600" />
                Confirmar Reserva
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold mb-2 text-gray-800">Detalhes da Reserva:</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Profissional:</strong> {selectedProfessional.name}</p>

                  {selectedServices.length > 0 ? (
                    <>
                      <p><strong>Serviços:</strong></p>
                      <ul className="ml-4 space-y-1">
                        {selectedServices.map((service) => (
                          <li key={service.id} className="flex justify-between">
                            <span>{service.name}</span>
                            <span>{formatDuration(service.duration)} • {formatPrice(service.price)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t pt-2 mt-2">
                        <p>
                          <strong>Total:</strong> {formatDuration(calculateTotalDuration(selectedServices))} •{' '}
                          {formatPrice(
                            loyaltyRedeemApplied &&
                              selectedClient &&
                              !selectedSubscription &&
                              !selectedClientActiveSubscriptionId &&
                              loyaltyRow &&
                              loyaltyRow.cycle_progress >= loyaltyRow.cycle_goal &&
                              !reservarMensal
                              ? 0
                              : calculateTotalPrice(selectedServices)
                          )}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p><strong>Serviço:</strong> {selectedService?.name}</p>
                      <p><strong>Duração:</strong> {formatDuration(selectedService?.duration || 0)}</p>
                      <p>
                        <strong>Preço:</strong>{' '}
                        {selectedSubscription ? (
                          <span className="text-gray-700 font-semibold">GRATUITO</span>
                        ) : (
                          formatPrice(
                            loyaltyRedeemApplied &&
                              selectedClient &&
                              !selectedSubscription &&
                              !selectedClientActiveSubscriptionId &&
                              loyaltyRow &&
                              loyaltyRow.cycle_progress >= loyaltyRow.cycle_goal &&
                              !reservarMensal
                              ? 0
                              : selectedService?.price || 0
                          )
                        )}
                      </p>
                    </>
                  )}

                  <p><strong>Data:</strong> {formatarDataPtBr(selectedDate)}</p>
                  <p><strong>Horário:</strong> {selectedTime}</p>
                  <p><strong>Cliente:</strong> {
                    selectedClient ? (
                      <span className="text-gray-800 font-semibold">
                        {selectedClient.name}
                        {selectedSubscription ? <span className="text-gray-700 font-semibold"> {' '}• ASSINANTE 👑</span> : null}
                      </span>
                    ) : selectedSubscription ? (
                      <span className="text-gray-800 font-semibold">ASSINANTE 👑</span>
                    ) : (
                      'CLIENTE AVULSO'
                    )
                  }</p>

                  {selectedClient && !selectedSubscription && !selectedClientActiveSubscriptionId ? (
                    <div className="mt-2 pt-2 border-t border-gray-300 space-y-2">
                      <p className="font-semibold text-gray-900 text-sm">Programa de fidelidade</p>
                      {loyaltyLoading ? (
                        <p className="text-xs text-gray-600">Carregando informações...</p>
                      ) : !loyaltyRow ? (
                        <p className="text-xs text-gray-600">
                          Sem meta configurada para este cliente. Em <strong>Meus Clientes</strong>, abra{' '}
                          <strong>Agendamentos feitos</strong> e use <strong>Pontos Fidelidade</strong> para definir o ciclo (ex.: 10).
                        </p>
                      ) : loyaltyRow.cycle_progress >= loyaltyRow.cycle_goal ? (
                        <>
                          <p className="text-sm text-emerald-900 font-bold">Status: Pontos concluídos</p>
                          <p className="text-xs text-gray-700">
                            O cliente atingiu a meta de {loyaltyRow.cycle_goal} ponto(s) no ciclo. Você pode zerar o valor desta reserva para registrar como benefício de fidelidade.
                          </p>
                          {!reservarMensal ? (
                            <button
                              type="button"
                              onClick={() => setLoyaltyRedeemApplied((v) => !v)}
                              className="px-3 py-2 rounded-lg bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors"
                            >
                              {loyaltyRedeemApplied ? 'Desfazer zerar valor' : 'Zerar valor'}
                            </button>
                          ) : (
                            <p className="text-xs text-amber-800">
                              Com <strong>reserva mensal</strong> ativa, o benefício de fidelidade não pode ser aplicado em lote. Desative a reserva mensal ou faça uma reserva em data única.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-800">
                          Pontos neste ciclo: <strong>{loyaltyRow.cycle_progress}</strong> de <strong>{loyaltyRow.cycle_goal}</strong>
                          {' — '}
                          faltam <strong>{loyaltyRow.cycle_goal - loyaltyRow.cycle_progress}</strong> ponto(s) para liberar o benefício.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Reservar mensal — incompatível com pré-preenchimento vindo da grade (1 slot fixo) */}
              {!slotPrefill ? (
              <div className="mb-4 rounded-lg border border-gray-300 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">Reservar mensal</p>
                    <p className="mt-1 text-sm text-gray-700">
                      Ao ativar, você escolhe no calendário quais dias deseja agendar (mantém o mesmo <strong>horário</strong> e <strong>serviço</strong>).
                    </p>
                    {reservarMensal && datasSelecionadasMensal.length > 0 && (
                      <p className="mt-2 text-xs text-gray-700">
                        <strong>Dias selecionados:</strong> {datasSelecionadasMensal.length}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${reservarMensal ? 'bg-black text-white' : 'bg-gray-200 text-gray-900'}`}
                    >
                      {reservarMensal ? 'Ativado' : 'Desativado'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReservarMensal((v) => {
                          const next = !v;
                          if (next) {
                            setShowReservarMensalModal(true);
                            // calendário começa no mês da data selecionada
                            const base = parseYyyyMmDdToDateNoon(selectedDate);
                            setMesCalendario({ year: base.getFullYear(), month: base.getMonth() });
                            // sugestão automática: mesmo dia da semana por 2 meses (mês atual + mês que vem)
                            setDatasSelecionadasMensal(sugerirDatasPorDiaSemana(selectedDate, 1));
                          } else {
                            setDatasSelecionadasMensal([]);
                            setShowReservarMensalModal(false);
                          }
                          return next;
                        });
                      }}
                      className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-black/30 ${reservarMensal ? 'bg-black border-black' : 'bg-gray-300 border-gray-400'}`}
                      aria-pressed={reservarMensal}
                      aria-label="Alternar reservar mensal"
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${reservarMensal ? 'translate-x-7' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>
              </div>
              ) : null}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(slotPrefill ? 'service' : 'time')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleConfirmReservation}
                  disabled={
                    loading ||
                    (!slotPrefill && reservarMensal && datasSelecionadasMensal.length === 0)
                  }
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Criando...' : 'Confirmar Reserva'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Selecionar dias da reserva mensal */}
      {showReservarMensalModal && (
        <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Selecionar dias</h4>
                <p className="text-xs text-gray-700">
                  Escolha os dias que serão agendados. O horário e serviço serão os mesmos ({selectedTime}).
                </p>
              </div>
              <button
                onClick={() => {
                  setShowReservarMensalModal(false);
                  if (datasSelecionadasMensal.length === 0) setReservarMensal(false);
                }}
                className="rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto pb-24">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const base = parseYyyyMmDdToDateNoon(selectedDate);
                    const min = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0);
                    const current = new Date(mesCalendario.year, mesCalendario.month, 1, 12, 0, 0);
                    const prev = addMonths(current, -1);
                    if (prev < min) return;
                    setMesCalendario({ year: prev.getFullYear(), month: prev.getMonth() });
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  ←
                </button>
                <div className="text-sm font-semibold text-gray-900">
                  {new Date(mesCalendario.year, mesCalendario.month, 1, 12, 0, 0).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const base = parseYyyyMmDdToDateNoon(selectedDate);
                    const max = new Date(base.getFullYear(), 11, 1, 12, 0, 0); // até dezembro do ano da data base
                    const current = new Date(mesCalendario.year, mesCalendario.month, 1, 12, 0, 0);
                    const next = addMonths(current, 1);
                    if (next > max) return;
                    setMesCalendario({ year: next.getFullYear(), month: next.getMonth() });
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  →
                </button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-700">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {buildMonthGrid(mesCalendario.year, mesCalendario.month).map((week, wi) => (
                  <React.Fragment key={`w_${wi}`}>
                    {week.map((dt, di) => {
                      if (!dt) return <div key={`e_${wi}_${di}`} />;
                      const yyyyMmDd = toYyyyMmDd(dt);
                      const isSelected = datasSelecionadasMensal.includes(yyyyMmDd);
                      const todayNoon = new Date();
                      todayNoon.setHours(12, 0, 0, 0);
                      const isPast = dt < todayNoon;
                      return (
                        <button
                          key={yyyyMmDd}
                          type="button"
                          disabled={isPast}
                          onClick={() => {
                            setDatasSelecionadasMensal((prev) => {
                              const set = new Set(prev);
                              if (set.has(yyyyMmDd)) set.delete(yyyyMmDd);
                              else set.add(yyyyMmDd);
                              return Array.from(set).sort();
                            });
                          }}
                          className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${isPast
                            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                            : isSelected
                              ? 'border-black bg-black text-white'
                              : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                            }`}
                          title={`${getWeekdayLabelPtBr(dt.getDay())} ${dt.toLocaleDateString('pt-BR')}`}
                        >
                          {dt.getDate()}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDatasSelecionadasMensal(sugerirDatasPorDiaSemana(selectedDate, 1))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  Selecionar todas as {getWeekdayLabelPtBr(parseYyyyMmDdToDateNoon(selectedDate).getDay())} (mês atual + próximo)
                </button>
                <button
                  type="button"
                  onClick={() => setDatasSelecionadasMensal(sugerirDatasPorDiaSemana(selectedDate, mesesAteFimDoAno(selectedDate)))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  Selecionar todas as {getWeekdayLabelPtBr(parseYyyyMmDdToDateNoon(selectedDate).getDay())} (até dezembro)
                </button>
                <button
                  type="button"
                  onClick={() => setDatasSelecionadasMensal([])}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  Limpar
                </button>
              </div>

              {datasSelecionadasMensal.length > 0 && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-800">
                    Selecionados ({datasSelecionadasMensal.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {datasSelecionadasMensal.map((d) => {
                      const dt = parseYyyyMmDdToDateNoon(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDatasSelecionadasMensal((prev) => prev.filter((x) => x !== d))}
                          className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-100"
                          title="Remover"
                        >
                          {getWeekdayLabelPtBr(dt.getDay())} {dt.toLocaleDateString('pt-BR')}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-700">
                    Dica: clique em um chip para remover.
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setShowReservarMensalModal(false);
                  if (datasSelecionadasMensal.length === 0) {
                    setReservarMensal(false);
                  }
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (datasSelecionadasMensal.length === 0) {
                    alert('Selecione ao menos um dia.');
                    return;
                  }
                  setShowReservarMensalModal(false);
                }}
                className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPaymentModal && pendingAppointmentId && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            // Se fechar sem pagar, cancelar agendamento
            if (pendingAppointmentId) {
              supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', pendingAppointmentId);
            }
          }}
          appointmentId={pendingAppointmentId}
          amount={selectedServices.length > 0
            ? selectedServices.reduce((sum, s) => sum + s.price, 0)
            : (selectedService?.price || 0)}
          establishmentId={establishmentId}
          recipientId={pagarmeRecipientId}
          onPaymentSuccess={(clientPhoneFromPayment) => {
            setShowPaymentModal(false);
            setPendingAppointmentId('');

            // Usar telefone do callback ou do cliente selecionado
            const clientPhone = clientPhoneFromPayment || selectedClient?.whatsapp || '';

            // Redirecionar para view-appointments com o telefone do cliente
            if (clientPhone) {
              const cleanPhone = clientPhone.replace(/\D/g, '');
              // Salvar telefone no localStorage para login automático
              localStorage.setItem('last_booking_phone', cleanPhone);
              // Redirecionar para view-appointments
              window.location.href = `/view-appointments?phone=${encodeURIComponent(cleanPhone)}`;
            } else {
              // Fallback: apenas fechar e recarregar
              window.dispatchEvent(new CustomEvent('clientAppointmentCreated'));
              onClose();
            }
          }}
          onPaymentFailure={() => {
            setShowPaymentModal(false);
            setPendingAppointmentId('');
            // Agendamento já foi cancelado no PaymentModal
          }}
          customerData={{
            name: selectedClient?.name || 'CLIENTE AVULSO',
            phone: selectedClient?.whatsapp,
            email: user?.email
          }}
        />
      )}
    </div>
  );
}