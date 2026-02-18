import { supabase } from '../lib/supabase';

const toDateOnlyString = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeText = (raw: unknown): string =>
  String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const buildWhatsappCandidates = (rawWhatsapp: string): string[] => {
  const digits = String(rawWhatsapp || '').replace(/\D/g, '');
  if (!digits) return [];
  const set = new Set<string>([digits]);
  if (digits.startsWith('55') && digits.length > 11) {
    set.add(digits.slice(2));
  } else if (digits.length >= 10 && digits.length <= 11) {
    set.add(`55${digits}`);
  }
  return Array.from(set).filter(Boolean);
};

type DividedServiceConfig = {
  id: string;
  name: string;
  duration: number;
  limit: number;
};

const parseDividedServices = (raw: unknown): DividedServiceConfig[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      id: String(item?.id || '').trim(),
      name: String(item?.name || '').trim(),
      duration: Number(item?.duration || 0),
      limit: Number(item?.limit || 0),
    }))
    .filter((item) => item.id && item.name && Number.isFinite(item.duration) && item.duration > 0 && Number.isFinite(item.limit) && item.limit > 0);
};

/**
 * Verifica se um cliente assinante excedeu o limite mensal de agendamentos
 * @param clientWhatsapp - WhatsApp do cliente (com ou sem formatação)
 * @param establishmentId - ID do estabelecimento
 * @param targetDate - Data do agendamento (usa esta data para validar vencimento e mês do limite)
 * @returns Objeto com informações sobre o limite
 */
export const checkMonthlyLimit = async (
  clientWhatsapp: string,
  establishmentId: string,
  targetDate: Date = new Date(),
  selectedSubscriberService?: { id?: string | null; name?: string | null; limit?: number | null }
): Promise<{
  canBook: boolean;
  currentUsage: number;
  monthlyLimit: number | null;
  subscriptionName: string;
  errorMessage?: string;
}> => {
  try {
    console.log('🔍 Verificando limite mensal:', { clientWhatsapp, establishmentId });

    // Limpar o WhatsApp (remover formatação) + candidatos com/sem DDI para compatibilidade
    const cleanWhatsapp = clientWhatsapp.replace(/\D/g, '');
    const whatsappCandidates = buildWhatsappCandidates(cleanWhatsapp);
    if (whatsappCandidates.length === 0) {
      return {
        canBook: true,
        currentUsage: 0,
        monthlyLimit: null,
        subscriptionName: ''
      };
    }
    const targetDateStr = toDateOnlyString(targetDate);
    const requestedServiceId = String(selectedSubscriberService?.id || '').trim();
    const requestedServiceName = String(selectedSubscriberService?.name || '').trim();
    const requestedServiceLimit = Number(selectedSubscriberService?.limit || 0);

    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    const countUsageByRequestedService = (appointments: any[]): number => {
      return (appointments || []).filter((appointment: any) => {
        const apptServiceId = String(appointment?.subscriber_service_id || '').trim();
        if (requestedServiceId && apptServiceId && apptServiceId === requestedServiceId) return true;
        if (!requestedServiceName) return false;
        const apptServiceName = String(appointment?.subscriber_service_name || appointment?.service || '').trim();
        const apptNorm = normalizeText(apptServiceName);
        const reqNorm = normalizeText(requestedServiceName);
        return apptNorm === reqNorm || apptNorm.includes(reqNorm) || reqNorm.includes(apptNorm);
      }).length;
    };

    // Buscar assinatura do cliente pelo WhatsApp
    let { data: clientSubscription, error: subscriptionError } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions!inner(*)
      `)
      .eq('establishment_id', establishmentId)
      .in('client_whatsapp', whatsappCandidates)
      // ✅ Validar assinatura na DATA do agendamento (não só hoje)
      .gte('end_date', targetDateStr)
      .lte('start_date', targetDateStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Compatibilidade: alguns projetos usam subscriber_whatsapp em vez de client_whatsapp
    if (!clientSubscription && !subscriptionError) {
      const subscriberWhatsappTry = await supabase
        .from('client_subscriptions')
        .select(`
          *,
          subscriptions!inner(*)
        `)
        .eq('establishment_id', establishmentId)
        .in('subscriber_whatsapp', whatsappCandidates)
        .gte('end_date', targetDateStr)
        .lte('start_date', targetDateStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      clientSubscription = subscriberWhatsappTry.data as any;
      subscriptionError = subscriberWhatsappTry.error as any;
    }

    if (subscriptionError || !clientSubscription) {
      console.log('❌ Assinante não encontrado no sistema novo, tentando sistema antigo...');

      // Tentar buscar no SISTEMA ANTIGO (premium_subscriptions)
      try {
        const { data: oldSubscription, error: oldError } = await supabase
          .from('premium_subscriptions')
          .select('*')
          .eq('establishment_id', establishmentId)
          .in('whatsapp', whatsappCandidates)
          .gte('end_date', targetDateStr)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (oldSubscription && !oldError) {
          console.log('✅ Encontrado no sistema antigo, mas SEM limite mensal');

          const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, appointment_date, subscriber_service_id, subscriber_service_name, service')
            .eq('establishment_id', establishmentId)
            .in('client_whatsapp', whatsappCandidates)
            .eq('is_subscriber', true)
            .gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0])
            .lte('appointment_date', lastDayOfMonth.toISOString().split('T')[0])
            .in('status', ['confirmed', 'completed', 'pending']);

          console.log('🔍 DEBUG - Busca de agendamentos no sistema antigo:', {
            establishmentId,
            cleanWhatsapp,
            firstDayOfMonth: firstDayOfMonth.toISOString().split('T')[0],
            lastDayOfMonth: lastDayOfMonth.toISOString().split('T')[0],
            appointments,
            appointmentsError,
            appointmentsCount: appointments?.length || 0
          });

          const currentUsage = appointments?.length || 0;
          const serviceUsage = countUsageByRequestedService(appointments || []);
          if (Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0 && serviceUsage >= requestedServiceLimit) {
            return {
              canBook: false,
              currentUsage: serviceUsage,
              monthlyLimit: requestedServiceLimit,
              subscriptionName: 'Assinatura Premium',
              errorMessage: `Você já atingiu o limite do serviço "${requestedServiceName || 'da assinatura'}" nesta assinatura (${serviceUsage}/${requestedServiceLimit}). Selecione apenas serviços que ainda tenham saldo disponível.`,
            };
          }

          // Sistema antigo não tem limite mensal, mas vamos mostrar o contador
          return {
            canBook: true,
            currentUsage: Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0 ? serviceUsage : currentUsage,
            monthlyLimit: null,
            subscriptionName: 'Assinatura Premium'
          };
        }
      } catch (err) {
        console.log('⚠️ Erro ao buscar no sistema antigo:', err);
      }

      if (Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0) {
        const { data: fallbackAppointments, error: fallbackAppointmentsError } = await supabase
          .from('appointments')
          .select('id, appointment_date, subscriber_service_id, subscriber_service_name, service')
          .eq('establishment_id', establishmentId)
          .in('client_whatsapp', whatsappCandidates)
          .eq('is_subscriber', true)
          .gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0])
          .lte('appointment_date', lastDayOfMonth.toISOString().split('T')[0])
          .in('status', ['confirmed', 'completed', 'pending']);

        if (!fallbackAppointmentsError) {
          const serviceUsage = countUsageByRequestedService(fallbackAppointments || []);
          if (serviceUsage >= requestedServiceLimit) {
            return {
              canBook: false,
              currentUsage: serviceUsage,
              monthlyLimit: requestedServiceLimit,
              subscriptionName: '',
              errorMessage: `Você já atingiu o limite do serviço "${requestedServiceName || 'da assinatura'}" nesta assinatura (${serviceUsage}/${requestedServiceLimit}). Selecione apenas serviços que ainda tenham saldo disponível.`,
            };
          }
          return {
            canBook: true,
            currentUsage: serviceUsage,
            monthlyLimit: requestedServiceLimit,
            subscriptionName: '',
          };
        }
      }

      console.log('❌ Assinante não encontrado em nenhum sistema');
      return {
        canBook: true,
        currentUsage: 0,
        monthlyLimit: null,
        subscriptionName: ''
      };
    }

    // Verificar se o assinante está ativo (não vencido)
    const endDateStr = String((clientSubscription as any)?.end_date || '').slice(0, 10);
    const isExpired =
      (endDateStr ? endDateStr < targetDateStr : false) ||
      clientSubscription.payment_status === 'unpaid';

    if (isExpired) {
      console.log('❌ Assinante vencido, não aplicando limite');
      return {
        canBook: true,
        currentUsage: 0,
        monthlyLimit: null,
        subscriptionName: clientSubscription.subscriptions?.name || ''
      };
    }

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date, subscriber_service_id, subscriber_service_name, service')
      .eq('establishment_id', establishmentId)
      .in('client_whatsapp', whatsappCandidates)
      .eq('is_subscriber', true)
      .gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('appointment_date', lastDayOfMonth.toISOString().split('T')[0])
      .in('status', ['confirmed', 'completed', 'pending']);

    if (appointmentsError) {
      console.error('❌ Erro ao verificar agendamentos:', appointmentsError);
      return {
        canBook: true,
        currentUsage: 0,
        monthlyLimit: null,
        subscriptionName: clientSubscription.subscriptions?.name || ''
      };
    }

    const currentUsage = appointments?.length || 0;
    const monthlyLimit = (clientSubscription as any).monthly_limit;
    const subscriptionName = clientSubscription.subscriptions?.name || '';
    const subscriptionConfig = (clientSubscription as any)?.subscriptions || {};
    const divideServicesEnabled = Boolean((subscriptionConfig as any)?.divide_services_enabled) || Boolean(requestedServiceId || requestedServiceName);
    const dividedServices = parseDividedServices((subscriptionConfig as any)?.divided_services);

    // Novo fluxo: limite por serviço quando "Dividir serviços" estiver ativo
    if (divideServicesEnabled) {
      if (!requestedServiceId && !requestedServiceName) {
        return {
          canBook: true,
          currentUsage: 0,
          monthlyLimit: null,
          subscriptionName,
        };
      }

      const requestedService = dividedServices.find((service) => {
        if (requestedServiceId && service.id === requestedServiceId) return true;
        return requestedServiceName
          ? normalizeText(service.name) === normalizeText(requestedServiceName)
          : false;
      });

      const fallbackRequestedService =
        requestedServiceId || requestedServiceName
          ? {
            id: requestedServiceId || `service_${normalizeText(requestedServiceName)}`,
            name: requestedServiceName || 'Serviço da assinatura',
            duration: 0,
            limit: requestedServiceLimit > 0 ? requestedServiceLimit : 0,
          }
          : null;

      const finalRequestedService = requestedService || fallbackRequestedService;

      if (!finalRequestedService) {
        return {
          canBook: false,
          currentUsage: 0,
          monthlyLimit: null,
          subscriptionName,
          errorMessage: 'Esse serviço não faz parte da sua assinatura ativa. Selecione um serviço com saldo disponível.',
        };
      }

      const usageByService = (appointments || []).filter((appointment: any) => {
        const apptServiceId = String(appointment?.subscriber_service_id || '').trim();
        if (apptServiceId && apptServiceId === finalRequestedService.id) return true;

        const apptServiceName = String(appointment?.subscriber_service_name || appointment?.service || '').trim();
        const apptNorm = normalizeText(apptServiceName);
        const reqNorm = normalizeText(finalRequestedService.name);
        return apptNorm === reqNorm || apptNorm.includes(reqNorm) || reqNorm.includes(apptNorm);
      }).length;

      const serviceLimit = Number(finalRequestedService.limit || 0);
      const canBookService = serviceLimit > 0 && usageByService < serviceLimit;

      if (!canBookService) {
        return {
          canBook: false,
          currentUsage: usageByService,
          monthlyLimit: serviceLimit,
          subscriptionName,
          errorMessage: `Você já atingiu o limite do serviço "${finalRequestedService.name}" nesta assinatura (${usageByService}/${serviceLimit}). Selecione apenas serviços que ainda tenham saldo disponível.`,
        };
      }

      return {
        canBook: true,
        currentUsage: usageByService,
        monthlyLimit: serviceLimit,
        subscriptionName,
      };
    }

    // Se não tem limite definido (NULL ou 0), pode agendar
    if (monthlyLimit === null || monthlyLimit === 0) {
      console.log('✅ Sem limite definido (NULL ou 0), pode agendar');
      return {
        canBook: true,
        currentUsage,
        monthlyLimit: null,
        subscriptionName
      };
    }

    // Verificar se excedeu o limite
    const canBook = currentUsage < monthlyLimit;

    console.log('📊 Limite mensal verificado:', {
      currentUsage,
      monthlyLimit,
      canBook,
      subscriptionName
    });

    if (!canBook) {
      return {
        canBook: false,
        currentUsage,
        monthlyLimit,
        subscriptionName,
        errorMessage: `Atenção: você já atingiu o limite dos seus serviços como assinante neste mês. (${currentUsage}/${monthlyLimit} agendamentos utilizados)`
      };
    }

    return {
      canBook: true,
      currentUsage,
      monthlyLimit,
      subscriptionName
    };

  } catch (error) {
    console.error('❌ Erro ao verificar limite mensal:', error);
    return {
      canBook: true,
      currentUsage: 0,
      monthlyLimit: null,
      subscriptionName: ''
    };
  }
};
