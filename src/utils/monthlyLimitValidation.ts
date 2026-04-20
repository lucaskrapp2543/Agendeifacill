import { supabase } from '../lib/supabase';
import {
  buildCarryoverMonthlyLimit,
  clampDateRangeToSubscription,
  getCalendarMonthDateRange,
  getPreviousCalendarMonthDateRange,
  getSubscriptionUsageDateRange,
  isIsoDateWithinRange,
  type IsoDateRange,
} from './subscriptionUsagePeriod';

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

const filterAppointmentsByRequestedService = (
  appointments: any[],
  requestedServiceId: string,
  requestedServiceName: string
): any[] => {
  return (appointments || []).filter((appointment: any) => {
    const apptServiceId = String(appointment?.subscriber_service_id || '').trim();
    if (requestedServiceId && apptServiceId && apptServiceId === requestedServiceId) return true;
    if (!requestedServiceName) return false;
    const apptServiceName = String(appointment?.subscriber_service_name || appointment?.service || '').trim();
    const apptNorm = normalizeText(apptServiceName);
    const reqNorm = normalizeText(requestedServiceName);
    return apptNorm === reqNorm || apptNorm.includes(reqNorm) || reqNorm.includes(apptNorm);
  });
};

const countAppointmentsInRange = (appointments: any[], range: IsoDateRange | null | undefined): number => {
  if (!range) return 0;
  return (appointments || []).filter((appointment: any) =>
    isIsoDateWithinRange(String(appointment?.appointment_date || ''), range)
  ).length;
};

/**
 * Verifica se um cliente assinante excedeu o limite mensal de agendamentos.
 * Regra nova: o saldo que sobrou do mes imediatamente anterior entra no mes atual.
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
    console.log('?? Verificando limite mensal:', { clientWhatsapp, establishmentId });

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
    const currentCalendarRange = getCalendarMonthDateRange(targetDate);
    const previousCalendarRange = getPreviousCalendarMonthDateRange(targetDate);

    let { data: clientSubscription, error: subscriptionError } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions!inner(*)
      `)
      .eq('establishment_id', establishmentId)
      .in('client_whatsapp', whatsappCandidates)
      .gte('end_date', targetDateStr)
      .lte('start_date', targetDateStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
      console.log('? Assinante não encontrado no sistema novo, tentando sistema antigo...');

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
          console.log('? Encontrado no sistema antigo, mas SEM limite mensal total');

          const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, appointment_date, subscriber_service_id, subscriber_service_name, service')
            .eq('establishment_id', establishmentId)
            .in('client_whatsapp', whatsappCandidates)
            .eq('is_subscriber', true)
            .gte('appointment_date', previousCalendarRange.periodMin)
            .lte('appointment_date', currentCalendarRange.periodMax)
            .in('status', ['confirmed', 'completed', 'pending']);

          console.log('?? DEBUG - Busca de agendamentos no sistema antigo:', {
            establishmentId,
            cleanWhatsapp,
            periodMin: previousCalendarRange.periodMin,
            periodMax: currentCalendarRange.periodMax,
            appointments,
            appointmentsError,
            appointmentsCount: appointments?.length || 0
          });

          const currentUsage = countAppointmentsInRange(appointments || [], currentCalendarRange);
          const serviceAppointments = filterAppointmentsByRequestedService(appointments || [], requestedServiceId, requestedServiceName);
          const currentServiceUsage = countAppointmentsInRange(serviceAppointments, currentCalendarRange);
          const previousServiceUsage = countAppointmentsInRange(serviceAppointments, previousCalendarRange);
          const serviceAllowance = buildCarryoverMonthlyLimit(requestedServiceLimit, currentServiceUsage, previousServiceUsage);

          if (Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0 && !serviceAllowance.canBook) {
            return {
              canBook: false,
              currentUsage: serviceAllowance.currentMonthUsage,
              monthlyLimit: serviceAllowance.effectiveLimit,
              subscriptionName: 'Assinatura Premium',
              errorMessage: `Você já atingiu o limite do serviço "${requestedServiceName || 'da assinatura'}" neste mês (${serviceAllowance.currentMonthUsage}/${serviceAllowance.effectiveLimit}).`,
            };
          }

          return {
            canBook: true,
            currentUsage: Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0 ? serviceAllowance.currentMonthUsage : currentUsage,
            monthlyLimit: Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0 ? serviceAllowance.effectiveLimit : null,
            subscriptionName: 'Assinatura Premium'
          };
        }
      } catch (err) {
        console.log('?? Erro ao buscar no sistema antigo:', err);
      }

      if (Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0) {
        const { data: fallbackAppointments, error: fallbackAppointmentsError } = await supabase
          .from('appointments')
          .select('id, appointment_date, subscriber_service_id, subscriber_service_name, service')
          .eq('establishment_id', establishmentId)
          .in('client_whatsapp', whatsappCandidates)
          .eq('is_subscriber', true)
          .gte('appointment_date', previousCalendarRange.periodMin)
          .lte('appointment_date', currentCalendarRange.periodMax)
          .in('status', ['confirmed', 'completed', 'pending']);

        if (!fallbackAppointmentsError) {
          const fallbackServiceAppointments = filterAppointmentsByRequestedService(fallbackAppointments || [], requestedServiceId, requestedServiceName);
          const currentServiceUsage = countAppointmentsInRange(fallbackServiceAppointments, currentCalendarRange);
          const previousServiceUsage = countAppointmentsInRange(fallbackServiceAppointments, previousCalendarRange);
          const serviceAllowance = buildCarryoverMonthlyLimit(requestedServiceLimit, currentServiceUsage, previousServiceUsage);
          if (!serviceAllowance.canBook) {
            return {
              canBook: false,
              currentUsage: serviceAllowance.currentMonthUsage,
              monthlyLimit: serviceAllowance.effectiveLimit,
              subscriptionName: '',
              errorMessage: `Você já atingiu o limite do serviço "${requestedServiceName || 'da assinatura'}" neste mês (${serviceAllowance.currentMonthUsage}/${serviceAllowance.effectiveLimit}).`,
            };
          }
          return {
            canBook: true,
            currentUsage: serviceAllowance.currentMonthUsage,
            monthlyLimit: serviceAllowance.effectiveLimit,
            subscriptionName: '',
          };
        }
      }

      console.log('? Assinante não encontrado em nenhum sistema');
      return {
        canBook: true,
        currentUsage: 0,
        monthlyLimit: null,
        subscriptionName: ''
      };
    }

    const endDateStr = String((clientSubscription as any)?.end_date || '').slice(0, 10);
    const isExpired =
      (endDateStr ? endDateStr < targetDateStr : false) ||
      clientSubscription.payment_status === 'unpaid';

    if (isExpired) {
      console.log('? Assinante vencido, não aplicando limite');
      return {
        canBook: true,
        currentUsage: 0,
        monthlyLimit: null,
        subscriptionName: clientSubscription.subscriptions?.name || ''
      };
    }

    const currentRange = clampDateRangeToSubscription(currentCalendarRange, clientSubscription as any);
    const previousRange = clampDateRangeToSubscription(previousCalendarRange, clientSubscription as any);
    const usageRange = getSubscriptionUsageDateRange(clientSubscription as any, targetDate);
    const queryMin = previousRange?.periodMin || currentRange?.periodMin || usageRange.periodMin;
    const queryMax = currentRange?.periodMax || usageRange.periodMax;

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date, subscriber_service_id, subscriber_service_name, service')
      .eq('establishment_id', establishmentId)
      .in('client_whatsapp', whatsappCandidates)
      .eq('is_subscriber', true)
      .gte('appointment_date', queryMin)
      .lte('appointment_date', queryMax)
      .in('status', ['confirmed', 'completed', 'pending']);

    if (appointmentsError) {
      console.error('? Erro ao verificar agendamentos:', appointmentsError);
      return {
        canBook: true,
        currentUsage: 0,
        monthlyLimit: null,
        subscriptionName: clientSubscription.subscriptions?.name || ''
      };
    }

    const currentUsage = countAppointmentsInRange(appointments || [], currentRange);
    const previousUsage = countAppointmentsInRange(appointments || [], previousRange);
    const monthlyLimit = (clientSubscription as any).monthly_limit;
    const subscriptionName = clientSubscription.subscriptions?.name || '';
    const subscriptionConfig = (clientSubscription as any)?.subscriptions || {};
    const hasRequestedServiceLimit = Number.isFinite(requestedServiceLimit) && requestedServiceLimit > 0;
    const divideServicesEnabled =
      Boolean((subscriptionConfig as any)?.divide_services_enabled) ||
      (hasRequestedServiceLimit && Boolean(requestedServiceId || requestedServiceName));
    const dividedServices = parseDividedServices((subscriptionConfig as any)?.divided_services);

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
            name: requestedServiceName || 'Servico da assinatura',
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

      const serviceAppointments = filterAppointmentsByRequestedService(
        appointments || [],
        String(finalRequestedService.id || ''),
        String(finalRequestedService.name || '')
      );
      const currentServiceUsage = countAppointmentsInRange(serviceAppointments, currentRange);
      const previousServiceUsage = countAppointmentsInRange(serviceAppointments, previousRange);
      const serviceLimit = Number(finalRequestedService.limit || 0);
      const hasServiceLimit = Number.isFinite(serviceLimit) && serviceLimit > 0;
      const serviceAllowance = buildCarryoverMonthlyLimit(serviceLimit, currentServiceUsage, previousServiceUsage);
      const canBookService = !hasServiceLimit || serviceAllowance.canBook;

      if (!canBookService) {
        return {
          canBook: false,
          currentUsage: serviceAllowance.currentMonthUsage,
          monthlyLimit: serviceAllowance.effectiveLimit,
          subscriptionName,
          errorMessage: `Você já atingiu o limite do serviço "${finalRequestedService.name}" neste mês (${serviceAllowance.currentMonthUsage}/${serviceAllowance.effectiveLimit}).`,
        };
      }

      return {
        canBook: true,
        currentUsage: serviceAllowance.currentMonthUsage,
        monthlyLimit: hasServiceLimit ? serviceAllowance.effectiveLimit : null,
        subscriptionName,
      };
    }

    if (monthlyLimit === null || monthlyLimit === 0) {
      console.log('? Sem limite definido (NULL ou 0), pode agendar');
      return {
        canBook: true,
        currentUsage,
        monthlyLimit: null,
        subscriptionName
      };
    }

    const allowance = buildCarryoverMonthlyLimit(monthlyLimit, currentUsage, previousUsage);

    console.log('?? Limite mensal verificado:', {
      currentUsage: allowance.currentMonthUsage,
      previousUsage: allowance.previousMonthUsage,
      carryover: allowance.carryover,
      monthlyLimitBase: allowance.baseLimit,
      monthlyLimitEfetivo: allowance.effectiveLimit,
      canBook: allowance.canBook,
      subscriptionName
    });

    if (!allowance.canBook) {
      return {
        canBook: false,
        currentUsage: allowance.currentMonthUsage,
        monthlyLimit: allowance.effectiveLimit,
        subscriptionName,
        errorMessage: `Atenção: você já atingiu o limite dos seus serviços como assinante neste mês (${allowance.currentMonthUsage}/${allowance.effectiveLimit} agendamentos utilizados).`
      };
    }

    return {
      canBook: true,
      currentUsage: allowance.currentMonthUsage,
      monthlyLimit: allowance.effectiveLimit,
      subscriptionName
    };

  } catch (error) {
    console.error('? Erro ao verificar limite mensal:', error);
    return {
      canBook: true,
      currentUsage: 0,
      monthlyLimit: null,
      subscriptionName: ''
    };
  }
};
