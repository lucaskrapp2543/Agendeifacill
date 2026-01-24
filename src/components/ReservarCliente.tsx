import { CheckCircle, Clock, Scissors, Search, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PaymentModal } from './PaymentModal';

interface Professional {
  id: string;
  name: string;
  photo?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  establishment_id: string;
  is_active: boolean;
  display_order: number;
}

interface ServiceSubcategory {
  id: string;
  name: string;
  price: number;
  duration: number;
  category_id: string;
  is_active: boolean;
  display_order: number;
}

interface Subscription {
  id: string;
  name: string;
  service_name: string;
  service_duration: number;
  price: number;
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
  use15MinuteInterval?: boolean;
  use20MinuteScheduleProp?: boolean;
  onClose: () => void;
}

export default function ReservarCliente({ establishmentId, use15MinuteInterval = false, use20MinuteScheduleProp = false, onClose }: ReservarClienteProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'initial' | 'client' | 'professional' | 'service' | 'time' | 'confirm'>('initial');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
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

  // Estados para seleção de cliente conhecido
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [loadingClients, setLoadingClients] = useState(false);

  // Estados para pagamento antecipado
  const [exigirPagamentoAntecipado, setExigirPagamentoAntecipado] = useState(false);
  const [pagarmeRecipientId, setPagarmeRecipientId] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string>('');

  // ✅ Evita bug de timezone: new Date('YYYY-MM-DD') pode mostrar dia anterior no Brasil
  const formatarDataPtBr = (yyyyMmDd: string): string => {
    const [y, m, d] = (yyyyMmDd || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('pt-BR');
  };

  // Função para carregar clientes do estabelecimento
  const loadClients = async () => {
    if (!establishmentId) return;

    setLoadingClients(true);
    try {
      console.log('🔍 Carregando clientes para establishment:', establishmentId);

      // Buscar todos os agendamentos do estabelecimento que não são avulsos
      // Incluir clientes que têm client_id e client_whatsapp, excluindo apenas os explicitamente avulsos
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('client_id, client_name, client_whatsapp, is_avulso')
        .eq('establishment_id', establishmentId)
        .not('client_name', 'is', null)
        .not('client_whatsapp', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar clientes:', error);
        throw error;
      }

      // Agrupar por client_whatsapp (chave única para identificar cliente)
      // Filtrar apenas clientes que não são avulsos (is_avulso !== true)
      const clientsMap = new Map<string, Client>();

      if (appointments && appointments.length > 0) {
        appointments.forEach((appointment) => {
          // Pular agendamentos explicitamente avulsos
          if (appointment.is_avulso === true) {
            return;
          }

          // Usar WhatsApp como chave única para identificar o cliente
          // Isso evita problemas quando múltiplos clientes manuais usam o mesmo user?.id como fallback
          const clientWhatsapp = appointment.client_whatsapp?.replace(/\D/g, '') || '';
          if (!clientWhatsapp) return; // Pular se não tiver WhatsApp

          // Usar client_id se existir e for UUID válido, senão usar manual_whatsapp
          const clientId = appointment.client_id && !appointment.client_id.startsWith('manual_')
            ? appointment.client_id
            : `manual_${clientWhatsapp}`;

          // Usar WhatsApp como chave do Map para garantir agrupamento correto
          if (!clientsMap.has(clientWhatsapp)) {
            clientsMap.set(clientWhatsapp, {
              id: clientId, // Manter o ID original para uso no banco
              name: appointment.client_name || 'Cliente sem nome',
              whatsapp: appointment.client_whatsapp || '',
              appointmentCount: 0
            });
          }

          // Incrementar contagem de agendamentos
          const client = clientsMap.get(clientWhatsapp)!;
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
      console.log('📋 Clientes manuais encontrados:', Object.keys(manualClients).length);

      // Adicionar clientes manuais que ainda não estão na lista
      Object.values(manualClients).forEach((manualClient: any) => {
        const cleanWhatsapp = manualClient.whatsapp?.replace(/\D/g, '') || '';
        if (!cleanWhatsapp || !manualClient.name || !manualClient.whatsapp) return;

        const clientId = `manual_${cleanWhatsapp}`;

        // Verificar se já existe um cliente com esse WhatsApp (usando WhatsApp como chave)
        if (!clientsMap.has(cleanWhatsapp)) {
          clientsMap.set(cleanWhatsapp, {
            id: clientId, // Manter o ID original para uso no banco
            name: manualClient.name,
            whatsapp: manualClient.whatsapp,
            appointmentCount: 0 // Clientes manuais começam com 0 agendamentos
          });
        }
      });

      // ✅ NOVO: Buscar clientes manuais salvos no BANCO (mesma fonte da tela "Meus Clientes")
      try {
        const { data: manualDb, error: manualDbError } = await supabase
          .from('manual_clients')
          .select('id,name,whatsapp')
          .eq('establishment_id', establishmentId)
          .order('name', { ascending: true });

        if (manualDbError) {
          console.warn('⚠️ Erro ao carregar clientes manuais do banco:', manualDbError);
        } else if (Array.isArray(manualDb) && manualDb.length > 0) {
          console.log('📋 Clientes manuais (banco) encontrados:', manualDb.length);
          manualDb.forEach((mc: any) => {
            const cleanWhatsapp = String(mc?.whatsapp || '').replace(/\D/g, '');
            const nome = String(mc?.name || '').trim();
            const whatsappOriginal = String(mc?.whatsapp || '').trim();
            if (!cleanWhatsapp || !nome || !whatsappOriginal) return;

            // Se já existe pelo WhatsApp, apenas garante nome/whatsapp (não pisa contagem de agendamentos)
            if (clientsMap.has(cleanWhatsapp)) {
              const existing = clientsMap.get(cleanWhatsapp)!;
              if (!existing.name || existing.name === 'Cliente sem nome') existing.name = nome;
              if (!existing.whatsapp) existing.whatsapp = whatsappOriginal;
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

      console.log('✅ Clientes carregados:', clientsArray.length);
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

  // Carregar profissionais e configuração de horários
  useEffect(() => {
    const loadProfessionals = async () => {
      try {
        console.log('🔍 Carregando profissionais para establishment:', establishmentId);
        const { data, error } = await supabase
          .from('establishments')
          .select('professionals, use_20_minute_schedule, exigir_pagamento_antecipado, pagarme_recipient_id')
          .eq('id', establishmentId)
          .single();

        if (error) {
          console.error('❌ Erro ao buscar establishment:', error);
          throw error;
        }

        console.log('✅ Establishment carregado:', data);

        // Carregar configuração de horários de 20 em 20 minutos
        setUse20MinuteSchedule(data?.use_20_minute_schedule ?? false);
        console.log('✅ Configuração de horários 20min:', data?.use_20_minute_schedule);

        // Carregar configuração de pagamento antecipado
        setExigirPagamentoAntecipado((data as any)?.exigir_pagamento_antecipado ?? false);
        setPagarmeRecipientId((data as any)?.pagarme_recipient_id || '');
        console.log('✅ Pagamento antecipado:', (data as any)?.exigir_pagamento_antecipado);

        // Converter profissionais do formato JSON para o formato esperado
        // NÃO filtrar profissionais ocultos aqui - "Reservar Cliente" é funcionalidade interna
        // Profissionais ocultos devem aparecer na reserva interna, apenas não no booking público
        const establishmentProfessionals = data?.professionals || [];
        const formattedProfessionals = establishmentProfessionals.map((prof: any) => ({
          id: prof.id,
          name: prof.name,
          photo: prof.photo_url || prof.photo
        }));

        console.log('✅ Profissionais formatados:', formattedProfessionals);
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

  // Carregar clubes de assinatura
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!establishmentId) {
        console.log('⚠️ establishmentId não fornecido para carregar assinaturas');
        return;
      }

      try {
        console.log('🔍 Carregando assinaturas para establishment:', establishmentId);

        // Buscar assinaturas NÃO OCULTAS (is_hidden = false ou null)
        const { data: subs, error: subsError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('establishment_id', establishmentId)
          .or('is_hidden.is.null,is_hidden.eq.false');

        if (subsError) {
          console.error('❌ Erro ao carregar assinaturas:', subsError);
          throw subsError;
        }

        console.log('✅ Assinaturas encontradas (apenas visíveis):', subs);
        console.log('✅ Total de assinaturas visíveis:', subs?.length || 0);
        console.log('✅ Detalhes:', subs);

        setSubscriptions(subs || []);
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
        console.log('🔍 Carregando categorias de serviços para establishment:', establishmentId);
        const { data: categories, error: categoriesError } = await supabase
          .from('service_categories')
          .select('*')
          .eq('establishment_id', establishmentId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (categoriesError) throw categoriesError;

        console.log('🔍 Categorias encontradas:', categories);
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

      try {
        console.log('🔍 Carregando subcategorias para categoria:', selectedCategory.name);
        const { data: subcategories, error: subcategoriesError } = await supabase
          .from('service_subcategories')
          .select('*')
          .eq('category_id', selectedCategory.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (subcategoriesError) throw subcategoriesError;

        console.log('🔍 Subcategorias encontradas:', subcategories);
        setServiceSubcategories(subcategories || []);
      } catch (error) {
        console.error('Erro ao carregar subcategorias:', error);
      }
    };

    loadServiceSubcategories();
  }, [selectedCategory]);

  // Carregar serviços do profissional selecionado
  useEffect(() => {
    const loadServices = async () => {
      if (!selectedProfessional) return;

      try {
        console.log('🔍 Carregando serviços (mesma fonte do "Meus serviços") para establishment:', establishmentId);

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
                display_order
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
          const formatted = subcats.map((s: any) => ({
            id: String(s.id),
            name: String(s.name || '').trim(),
            price: Number(s.price || 0),
            duration: Number(s.duration || 30),
          })).filter((s: any) => s.name && s.price > 0);

          console.log('✅ Serviços (categorias) carregados:', formatted);
          setServices(formatted);
          return;
        }

        if (subErr) {
          console.warn('⚠️ Falha ao buscar serviços por categorias, tentando fallback legado:', subErr);
        } else {
          console.log('ℹ️ Nenhum serviço por categorias encontrado; usando fallback legado (services_with_prices).');
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
            duration: Number(service.duration || 30),
          }))
          .filter((s: any) => s.name && s.price > 0);

        console.log('✅ Serviços (fallback legado) carregados:', formattedLegacy);
        setServices(formattedLegacy);
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
          .select('id, appointment_time, duration, is_avulso, professional, status')
          .eq('establishment_id', establishmentId)
          .eq('appointment_date', selectedDate)
          .neq('status', 'cancelled'); // Incluir todos exceto cancelados

        if (error) throw error;

        console.log('🔍 Agendamentos encontrados:', appointments);
        console.log('🔍 Profissional selecionado:', selectedProfessional?.name);
        console.log('🔍 ID do profissional selecionado:', selectedProfessional?.id);
        console.log('🔍 Data selecionada:', selectedDate);
        console.log('🔍 Establishment ID:', establishmentId);

        // Log detalhado de cada agendamento
        if (appointments && appointments.length > 0) {
          console.log('🔍 Detalhes dos agendamentos:');
          appointments.forEach((apt, index) => {
            console.log(`  Agendamento ${index + 1}:`, {
              professional: apt.professional,
              appointment_time: apt.appointment_time,
              duration: apt.duration,
              is_avulso: apt.is_avulso,
              status: apt.status
            });
          });
        } else {
          console.log('⚠️ NENHUM AGENDAMENTO ENCONTRADO para a data:', selectedDate);
        }

        // Calcular duração total dos serviços selecionados
        const totalDuration = selectedServices.length > 0
          ? calculateTotalDuration(selectedServices)
          : selectedService?.duration || 30;

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

        console.log('🔍 DEBUG - Data selecionada:', selectedDate);
        console.log('🔍 DEBUG - Data objeto:', selectedDateObj);
        console.log('🔍 DEBUG - Dia da semana:', dayOfWeek, dayName);
        console.log('🔍 DEBUG - Data formatada:', selectedDateObj.toLocaleDateString('pt-BR'));
        console.log('🔍 DEBUG - Establishment hours:', establishmentHours.data);
        console.log('🔍 DEBUG - Professional hours:', professionalHours.data);

        let workHours = null;

        // Primeiro, verificar se o profissional tem horários específicos para este dia
        let hasProfessionalHours = false;

        if (professionalHours.data?.professionals) {
          const professional = professionalHours.data.professionals.find(p => p.id === selectedProfessional?.id);
          if (professional?.work_hours?.[dayName]) {
            const profHours = professional.work_hours[dayName];
            console.log('🔍 Horários brutos do profissional para', dayName, ':', profHours);

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
                console.log('🔍 Usando horários específicos do profissional para', dayName, ':', workHours);
              } else {
                workHours = profHours;
                hasProfessionalHours = true;
              }
            } else {
              console.log('🔍 Profissional tem horário para', dayName, 'mas está DESABILITADO - usando horário do estabelecimento');
            }
          } else {
            console.log('🔍 Profissional não tem horário específico para', dayName, '- usando horário do estabelecimento');
          }
        }

        // Se não tem horário específico do profissional, usar horário do estabelecimento
        if (!hasProfessionalHours && establishmentHours.data?.business_hours?.[dayName]) {
          workHours = establishmentHours.data.business_hours[dayName];
          console.log('🔍 Usando horários do estabelecimento para', dayName, ':', workHours);
        }

        // Se não tem nenhum horário definido, usar padrão 8h-18h
        if (!workHours) {
          workHours = { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null };
          console.log('🔍 Usando horário padrão:', workHours);
        }

        console.log('🔍 DEBUG - Work hours final:', workHours);

        // Verificar se o dia está habilitado
        if (!workHours.enabled) {
          console.log('⚠️ Dia não habilitado para trabalho');
          setTimeSlots([]);
          return;
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
        if (use20MinuteScheduleProp) {
          interval = 20; // Horários de 20 em 20 minutos
        } else if (!use15MinuteInterval) {
          interval = 15; // Horários de 15 em 15 minutos (quando DESMARCADO)
        }
        console.log('🔍 DEBUG - Intervalo de horários:', interval, 'minutos');

        // Gerar slots para o primeiro período
        if (workHours.open1 && workHours.close1) {
          const startMinutes = timeToMinutes(workHours.open1);
          const endMinutes = timeToMinutes(workHours.close1);

          console.log('🔍 DEBUG - Gerando slots período 1:', {
            open1: workHours.open1,
            close1: workHours.close1,
            startMinutes,
            endMinutes,
            interval
          });

          for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
            const time = minutesToTime(minutes);
            const slotStart = new Date(`${selectedDate}T${time}:00`);
            const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

            // Verificar conflitos
            let available = true;
            let isAvulso = false;
            let reason = '';
            let appointmentId: string | undefined;
            let appointmentStartTime: string | undefined;
            let slotAdded = false;

            if (appointments) {
              // Filtrar apenas agendamentos do profissional selecionado (por ID)
              const professionalAppointments = appointments.filter(
                appointment => {
                  const matchesId = appointment.professional === selectedProfessional?.id;
                  return matchesId;
                }
              );

              for (const appointment of professionalAppointments) {
                const apptStart = new Date(`${selectedDate}T${appointment.appointment_time}:00`);
                const apptEnd = new Date(apptStart.getTime() + (appointment.duration || 30) * 60000);

                // Verificar sobreposição
                const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);

                if (hasOverlap) {
                  available = false;
                  isAvulso = appointment.is_avulso || false;
                  reason = isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado';

                  // Se este slot é exatamente o horário de início do agendamento, marcar para mostrar o X
                  if (time === appointment.appointment_time) {
                    appointmentId = appointment.id;
                    appointmentStartTime = appointment.appointment_time;
                  }
                }
              }
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

          for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
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
              const professionalAppointments = appointments.filter(
                appointment => appointment.professional === selectedProfessional?.id
              );

              for (const appointment of professionalAppointments) {
                const apptStart = new Date(`${selectedDate}T${appointment.appointment_time}:00`);
                const apptEnd = new Date(apptStart.getTime() + (appointment.duration || 30) * 60000);

                const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);

                if (hasOverlap) {
                  available = false;
                  isAvulso = appointment.is_avulso || false;
                  reason = isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado';

                  // Se este slot é exatamente o horário de início do agendamento, marcar para mostrar o X
                  if (time === appointment.appointment_time) {
                    appointmentId = appointment.id;
                    appointmentStartTime = appointment.appointment_time;
                  }
                }
              }
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

        console.log('✅ Slots gerados:', slots.length);
        console.log('✅ Slots disponíveis:', slots.filter(s => s.available).length);
        console.log('✅ Slots bloqueados:', slots.filter(s => !s.available).length);
        console.log('🔍 DEBUG - Todos os slots:', slots);

        setTimeSlots(slots);
      } catch (error) {
        console.error('Erro ao carregar horários:', error);
        alert('Erro ao carregar horários');
      } finally {
        setLoading(false);
      }
    };

    loadTimeSlots();
  }, [selectedService, selectedServices, selectedDate, selectedProfessional]);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setStep('professional');
  };

  const handleProfessionalSelect = (professional: Professional) => {
    setSelectedProfessional(professional);
    setStep('service');
  };

  // Filtrar clientes por busca
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.whatsapp.includes(clientSearchQuery)
  );

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep('time');
  };

  const handleMultipleServiceToggle = (service: Service) => {
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
      setStep('time');
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
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    }
    return `${minutes}min`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleCategorySelect = (category: ServiceCategory) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setShowCategoryServices(true);
  };

  const handleSubcategorySelect = (subcategory: ServiceSubcategory) => {
    setSelectedSubcategory(subcategory);
    // Converter subcategoria para formato de serviço
    const serviceFromSubcategory: Service = {
      id: subcategory.id,
      name: subcategory.name,
      price: subcategory.price,
      duration: subcategory.duration
    };
    setSelectedService(serviceFromSubcategory);
    setStep('time');
  };

  const handleSubscriptionSelect = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    // Converter assinatura para formato de serviço (com preço R$ 0,00)
    // Usar o NOME DO CLUBE + serviço para identificação
    const serviceFromSubscription: Service = {
      id: subscription.id,
      name: `${subscription.name} (${subscription.service_name})`, // Ex: "Club Mensal (Cabelo e Barba)"
      price: 0, // Assinantes não pagam
      duration: subscription.service_duration
    };
    setSelectedService(serviceFromSubscription);
    setStep('time');
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

  const handleConfirmReservation = async () => {
    if (!selectedProfessional || (!selectedService && selectedServices.length === 0) || !selectedTime) return;

    setLoading(true);
    try {
      // Determinar serviços a serem inseridos
      const servicesToInsert = selectedServices.length > 0 ? selectedServices : [selectedService!];
      const totalPrice = selectedServices.length > 0
        ? calculateTotalPrice(selectedServices)
        : selectedService!.price;
      const totalDuration = selectedServices.length > 0
        ? calculateTotalDuration(selectedServices)
        : selectedService!.duration;

      // Criar nome dos serviços
      const serviceNames = servicesToInsert.map(s => s.name).join(', ');

      // Verificar se é um agendamento de assinante ou cliente conhecido
      const isSubscriber = selectedSubscription !== null;
      const isKnownClient = selectedClient !== null;

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

      if (isSubscriber) {
        clientId = user?.id || '';
        clientName = 'ASSINANTE';
        clientWhatsapp = null;
        isAvulso = false;
      } else if (isKnownClient) {
        // Se o cliente é manual (id começa com "manual_"), usar o user_id do estabelecimento
        // O banco exige client_id NOT NULL e tem foreign key para users
        // Como cliente manual não tem user_id, usamos o ID do estabelecimento como fallback
        // O importante é ter client_name e client_whatsapp corretos para identificar o cliente
        if (selectedClient.id.startsWith('manual_')) {
          // Usar o user_id do estabelecimento como client_id (passa a foreign key check)
          // Mas o cliente será identificado pelo client_name e client_whatsapp
          clientId = user?.id || '';
        } else {
          clientId = selectedClient.id; // Cliente com UUID válido (deve existir em users)
        }
        clientName = selectedClient.name;
        clientWhatsapp = normalizeWhatsappForStorage(selectedClient.whatsapp);
        isAvulso = false; // Cliente conhecido não é avulso
      } else {
        clientId = user?.id || '';
        clientName = 'CLIENTE AVULSO';
        clientWhatsapp = null;
        isAvulso = true;
      }

      // ⚠️ IMPORTANTE:
      // "Quero receber adiantado os serviços" (pagamento via Pagar.me) é uma regra do BOOKING PÚBLICO (cliente agendando no site).
      // Reservas criadas pelo profissional dentro do DASHBOARD (Reservar Cliente) NÃO devem exigir PIX/CPF.
      const requiresPayment = false;

      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .insert({
          client_id: clientId,
          establishment_id: establishmentId,
          professional: selectedProfessional.id, // Usar ID do profissional
          service: serviceNames,
          client_name: clientName,
          client_whatsapp: clientWhatsapp,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          status: 'confirmed', // Reservas internas sempre confirmadas (sem pagamento antecipado)
          price: totalPrice,
          total_price: totalPrice,
          duration: totalDuration,
          // ✅ Reserva interna: deixar um padrão (para não ficar "Forma de Pagamento")
          payment_method: isSubscriber ? 'assinante' : 'dinheiro',
          is_avulso: isAvulso,
          is_subscriber: isSubscriber // Salvar se é assinante
        })
        .select('id')
        .single();

      if (error) throw error;

      // Reservas internas não abrem modal de pagamento (ver comentário acima)

      // ✅ SEMPRE disparar evento para recarregar agendamentos no dashboard
      // (Independente de ser cliente conhecido, avulso ou assinante)
      console.log('✅ Agendamento criado com sucesso, disparando evento para recarregar agendamentos');
      window.dispatchEvent(new CustomEvent('clientAppointmentCreated', {
        detail: {
          clientId: isKnownClient && selectedClient ? selectedClient.id : clientId,
          clientWhatsapp: clientWhatsapp || '',
          isKnownClient,
          isSubscriber,
          isAvulso
        }
      }));

      alert('Reserva criada com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao criar reserva:', error);
      alert('Erro ao criar reserva');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-black text-white p-6 rounded-t-lg">
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
        <div className="p-6">
          {/* Step 0: Escolher tipo de reserva */}
          {step === 'initial' && (
            <div>
              <h3 className="text-lg font-semibold mb-6 flex items-center text-gray-800">
                <User className="h-5 w-5 mr-2 text-gray-600" />
                Como deseja reservar?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setStep('client')}
                  className="p-6 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-700" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Reservar conhecido</h4>
                      <p className="text-sm text-gray-600">Selecione um cliente da sua lista</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setStep('professional')}
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
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 bg-white"
                  />
                </div>
              </div>

              {loadingClients ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                  <p className="mt-2 text-gray-700">Carregando clientes...</p>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    {clientSearchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente encontrado'}
                  </p>
                  {!clientSearchQuery && (
                    <p className="text-sm text-gray-500">
                      Clientes aparecem aqui após fazerem agendamentos no sistema.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
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

              {/* Serviços Normais */}
              {services.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Serviços Diretos</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {services.map((service) => {
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
                      {serviceCategories.map((category) => (
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
                        {serviceSubcategories.map((subcategory) => (
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
                    </div>
                  )}
                </div>
              )}

              {/* DEBUG: Mostrar quantidade de assinaturas carregadas */}
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                <p className="text-sm text-yellow-800">
                  🔍 <strong>DEBUG:</strong> {subscriptions.length} assinaturas carregadas
                </p>
                {subscriptions.length === 0 && (
                  <p className="text-xs text-yellow-700 mt-1">
                    Se você tem clubes de assinatura cadastrados, verifique o console do navegador (F12)
                  </p>
                )}
              </div>

              {/* Clubes de Assinatura */}
              {subscriptions.length > 0 ? (
                <div className="space-y-4 mt-6">
                  <h4 className="text-md font-medium text-gray-700">Assinantes</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {subscriptions.map((subscription) => (
                      <button
                        key={subscription.id}
                        onClick={() => handleSubscriptionSelect(subscription)}
                        className="p-4 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-gray-800">{subscription.name}</h4>
                            <p className="text-sm text-gray-600">
                              {subscription.service_name} • {formatDuration(subscription.service_duration)} • <span className="text-gray-700 font-semibold">GRATUITO</span>
                            </p>
                          </div>
                          <div className="text-gray-700">👑</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-700">
                    ℹ️ <strong>Nenhum clube de assinatura encontrado.</strong>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Cadastre clubes de assinatura na aba "Assinantes" do dashboard para que eles apareçam aqui.
                  </p>
                </div>
              )}
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
                        className={`w-full p-3 text-sm rounded-lg transition-all relative ${slot.available
                          ? 'bg-green-100 hover:bg-green-200 text-green-900 border border-green-400 font-semibold'
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
                            <div className="text-xs text-red-700 mt-1 font-medium">
                              BLOQUEADO
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
                        <p><strong>Total:</strong> {formatDuration(calculateTotalDuration(selectedServices))} • {formatPrice(calculateTotalPrice(selectedServices))}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p><strong>Serviço:</strong> {selectedService?.name}</p>
                      <p><strong>Duração:</strong> {formatDuration(selectedService?.duration || 0)}</p>
                      <p><strong>Preço:</strong> {selectedSubscription ? <span className="text-gray-700 font-semibold">GRATUITO</span> : formatPrice(selectedService?.price || 0)}</p>
                    </>
                  )}

                  <p><strong>Data:</strong> {formatarDataPtBr(selectedDate)}</p>
                  <p><strong>Horário:</strong> {selectedTime}</p>
                  <p><strong>Cliente:</strong> {
                    selectedSubscription ? (
                      <span className="text-gray-800 font-semibold">ASSINANTE 👑</span>
                    ) : selectedClient ? (
                      <span className="text-gray-800 font-semibold">{selectedClient.name}</span>
                    ) : (
                      'CLIENTE AVULSO'
                    )
                  }</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('time')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleConfirmReservation}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Criando...' : 'Confirmar Reserva'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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