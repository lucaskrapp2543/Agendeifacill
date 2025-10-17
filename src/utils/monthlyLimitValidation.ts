import { supabase } from '../lib/supabase';

/**
 * Verifica se um cliente assinante excedeu o limite mensal de agendamentos
 * @param clientWhatsapp - WhatsApp do cliente (com ou sem formatação)
 * @param establishmentId - ID do estabelecimento
 * @returns Objeto com informações sobre o limite
 */
export const checkMonthlyLimit = async (clientWhatsapp: string, establishmentId: string): Promise<{
  canBook: boolean;
  currentUsage: number;
  monthlyLimit: number | null;
  subscriptionName: string;
  errorMessage?: string;
}> => {
  try {
    console.log('🔍 Verificando limite mensal:', { clientWhatsapp, establishmentId });

    // Limpar o WhatsApp (remover formatação)
    const cleanWhatsapp = clientWhatsapp.replace(/\D/g, '');

    // Buscar assinatura do cliente pelo WhatsApp
    const { data: clientSubscription, error: subscriptionError } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions!inner(*)
      `)
      .eq('establishment_id', establishmentId)
      .eq('client_whatsapp', cleanWhatsapp)
      .gte('end_date', new Date().toISOString().split('T')[0])
      .lte('start_date', new Date().toISOString().split('T')[0])
      .single();

    if (subscriptionError || !clientSubscription) {
      console.log('❌ Assinante não encontrado no sistema novo, tentando sistema antigo...');

      // Tentar buscar no SISTEMA ANTIGO (premium_subscriptions)
      try {
        const { data: oldSubscription, error: oldError } = await supabase
          .from('premium_subscriptions')
          .select('*')
          .eq('establishment_id', establishmentId)
          .eq('whatsapp', cleanWhatsapp)
          .gte('end_date', new Date().toISOString().split('T')[0])
          .single();

        if (oldSubscription && !oldError) {
          console.log('✅ Encontrado no sistema antigo, mas SEM limite mensal');

          // Contar agendamentos do cliente neste mês (MESMO NO SISTEMA ANTIGO)
          const currentDate = new Date();
          const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

          const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, appointment_date')
            .eq('establishment_id', establishmentId)
            .eq('client_whatsapp', cleanWhatsapp)
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

          // Sistema antigo não tem limite mensal, mas vamos mostrar o contador
          return {
            canBook: true,
            currentUsage: currentUsage,
            monthlyLimit: null,
            subscriptionName: 'Assinatura Premium'
          };
        }
      } catch (err) {
        console.log('⚠️ Erro ao buscar no sistema antigo:', err);
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
    const isExpired = (new Date(clientSubscription.end_date) < new Date()) ||
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

    // Contar agendamentos do cliente neste mês
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date')
      .eq('establishment_id', establishmentId)
      .eq('client_whatsapp', cleanWhatsapp)
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

    // Se não tem limite definido (NULL ou 0), pode agendar
    if (monthlyLimit === null || monthlyLimit === 0) {
      console.log('✅ Sem limite definido (NULL ou 0), pode agendar');
      return {
        canBook: true,
        currentUsage,
        monthlyLimit: null,
        subscriptionName: clientSubscription.subscriptions?.name || ''
      };
    }

    // Verificar se excedeu o limite
    const canBook = currentUsage < monthlyLimit;

    console.log('📊 Limite mensal verificado:', {
      currentUsage,
      monthlyLimit,
      canBook,
      subscriptionName: clientSubscription.subscriptions?.name
    });

    if (!canBook) {
      return {
        canBook: false,
        currentUsage,
        monthlyLimit,
        subscriptionName: clientSubscription.subscriptions?.name || '',
        errorMessage: `Atenção: você já atingiu o limite dos seus serviços como assinante neste mês. (${currentUsage}/${monthlyLimit} agendamentos utilizados)`
      };
    }

    return {
      canBook: true,
      currentUsage,
      monthlyLimit,
      subscriptionName: clientSubscription.subscriptions?.name || ''
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
