import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// These environment variables need to be set after connecting to Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize the Supabase client
export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: 'agendafacil_auth_token',
      flowType: 'pkce'
    },
    global: {
      headers: { 'x-application-name': 'agendafacil' },
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 2
      }
    }
  }
);

// Auth functions
export const signUp = async (email: string, password: string, userRole: string, meta: Record<string, any> = {}) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: userRole,
          full_name: meta.full_name || email.split('@')[0]
        }
      }
    });

    if (error) throw error;
    return { data, error: null };

  } catch (error: any) {
    console.error('Signup error:', error);
    return { data: null, error };
  }
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

// Database functions for Establishments
export const createEstablishment = async (establishmentData: any) => {
  let profileImageUrl = null;

  // Upload profile image if exists
  if (establishmentData.profile_image) {
    const file = establishmentData.profile_image;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `establishments/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    profileImageUrl = publicUrl;
  }

  // Remove the file object and add the URL
  delete establishmentData.profile_image;
  establishmentData.profile_image_url = profileImageUrl;

  // Garantir que os arrays não sejam undefined
  const professionals = establishmentData.professionals || [];
  const services_with_prices = establishmentData.services_with_prices || [];

  console.log('Dados a serem criados:', {
    ...establishmentData,
    professionals,
    services_with_prices
  });

  const { data, error } = await supabase
    .from('establishments')
    .insert([{
      ...establishmentData,
      professionals,
      services_with_prices
    }])
    .select(`
      *,
      services_with_prices,
      professionals
    `);

  if (error) {
    console.error('Erro ao criar estabelecimento:', error);
  } else {
    console.log('Estabelecimento criado:', data);
  }
    
  return { data, error };
};

export const getEstablishmentByCode = async (code: string) => {
  console.log('Buscando estabelecimento pelo código:', code);
  
  const { data, error } = await supabase
    .from('establishments')
    .select(`
      id,
      name,
      description,
      code,
      owner_id,
      services_with_prices,
      professionals,
      business_hours,
      profile_image_url,
      created_at,
      updated_at
    `)
    .eq('code', code)
    .single();

  console.log('Estabelecimento encontrado:', data);
  
  return { data, error };
};

export const updateEstablishment = async (id: string, data: any) => {
  const { profile_image, ...establishmentData } = data;
  
  try {
    // Se houver uma nova imagem de perfil, faz o upload
    if (profile_image instanceof File) {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(`establishment/${id}/${profile_image.name}`, profile_image);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(uploadData.path);

      establishmentData.profile_image_url = publicUrl;
    }

    // Garantir que os arrays não sejam undefined
    const professionals = establishmentData.professionals || [];
    const services_with_prices = establishmentData.services_with_prices || [];

    console.log('Dados a serem atualizados:', {
      ...establishmentData,
      professionals,
      services_with_prices
    });

    // Atualiza os dados do estabelecimento
    const { data, error } = await supabase
      .from('establishments')
      .update({
        ...establishmentData,
        professionals,
        services_with_prices
      })
      .eq('id', id)
      .select(`
        *,
        services_with_prices,
        professionals
      `);

    if (error) throw error;

    console.log('Dados atualizados:', data);
    
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao atualizar estabelecimento:', error);
    return { data: null, error };
  }
};

// Appointment functions
export const createAppointment = async (appointmentData: any) => {
  console.log('🚀 Criando agendamento:', appointmentData);
  
  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select(`
        id,
        client_id,
        client_name,
        establishment_id,
        service,
        professional,
        appointment_date,
        appointment_time,
        status,
        created_at,
        is_premium,
        duration,
        price
      `);

    console.log('✅ Agendamento criado - resultado:', data);
    console.log('❌ Erro (se houver):', error);
    
    // BACKUP LOCAL - salvar também no localStorage
    if (data && data[0]) {
      try {
        const userId = appointmentData.client_id;
        const existing = localStorage.getItem(`appointments_${userId}`);
        const localAppointments = existing ? JSON.parse(existing) : [];
        
        const localAppointment = {
          ...data[0],
          saved_locally: true,
          local_save_date: new Date().toISOString()
        };
        
        localAppointments.push(localAppointment);
        localStorage.setItem(`appointments_${userId}`, JSON.stringify(localAppointments));
        
        console.log('💾 BACKUP: Agendamento salvo localmente:', localAppointment);
      } catch (localError) {
        console.error('❌ Erro ao salvar backup local:', localError);
      }
    }
    
    if (error) {
      console.error('❌ Erro detalhado na criação:', error);
    }
    
    return { data, error };
  } catch (err) {
    console.error('❌ Erro catch createAppointment:', err);
    return { data: null, error: err };
  }
};

// Função de teste para verificar RLS
export const testClientAppointmentsAccess = async (clientId: string) => {
  console.log('🧪 Testando acesso aos agendamentos...');
  
  try {
    // Teste 1: Buscar todos os agendamentos (sem filtro)
    const { data: allData, error: allError } = await supabase
      .from('appointments')
      .select('*')
      .limit(5);
    
    console.log('🧪 Teste 1 - Todos agendamentos:', { count: allData?.length, error: allError });
    
    // Teste 2: Buscar com filtro de client_id
    const { data: filteredData, error: filteredError } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', clientId);
    
    console.log('🧪 Teste 2 - Filtrado por client_id:', { count: filteredData?.length, error: filteredError });
    
    // Teste 3: Verificar user atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('🧪 Teste 3 - User atual:', { id: user?.id, email: user?.email, error: userError });
    
    return {
      allCount: allData?.length || 0,
      filteredCount: filteredData?.length || 0,
      currentUserId: user?.id,
      targetClientId: clientId,
      match: user?.id === clientId
    };
  } catch (err) {
    console.error('❌ Erro no teste:', err);
    return null;
  }
};

export const getClientAppointments = async (clientId: string) => {
  console.log('🔍 getClientAppointments chamada para clientId:', clientId);
  
  try {
    // Tentar buscar no Supabase
    const { data: supabaseData, error } = await supabase
      .from('appointments')
      .select(`
        *,
        establishments (*)
      `)
      .eq('client_id', clientId)
      .order('appointment_date', { ascending: true });
    
    console.log('📊 getClientAppointments - Resultado Supabase:');
    console.log('  - Dados encontrados:', supabaseData?.length || 0);
    console.log('  - Erro:', error);
    console.log('  - Dados completos:', supabaseData);
    
    // Buscar também no localStorage (backup)
    const localData = getAppointmentsLocal(clientId);
    console.log('💾 Dados locais encontrados:', localData?.length || 0);
    
    // Combinar dados do Supabase com dados locais
    let combinedData = [];
    
    if (supabaseData && supabaseData.length > 0) {
      combinedData = [...supabaseData];
    }
    
    // Adicionar dados locais que não estão no Supabase
    if (localData && localData.length > 0) {
      const supabaseIds = new Set(supabaseData?.map(item => item.id) || []);
      const uniqueLocalData = localData.filter(item => !supabaseIds.has(item.id));
      combinedData = [...combinedData, ...uniqueLocalData];
    }
    
    // Se não há dados no Supabase mas há locais, usar locais
    if ((!supabaseData || supabaseData.length === 0) && localData && localData.length > 0) {
      console.log('⚠️ Usando apenas dados locais (problema de RLS detectado)');
      combinedData = localData;
    }
    
    console.log('🔄 Dados combinados final:', combinedData?.length || 0);
    
    return { data: combinedData, error };
  } catch (err) {
    console.error('❌ Erro catch getClientAppointments:', err);
    
    // Em caso de erro total, tentar usar apenas dados locais
    const localData = getAppointmentsLocal(clientId);
    console.log('🆘 Fallback para dados locais:', localData?.length || 0);
    
    return { data: localData, error: err };
  }
};

export const getEstablishmentAppointments = async (establishmentId: string) => {
  console.log('Buscando agendamentos do estabelecimento:', establishmentId);
  
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      client_id,
      client_name,
      establishment_id,
      service,
      professional,
      appointment_date,
      appointment_time,
      status,
      created_at,
      is_premium,
      duration,
      price
    `)
    .eq('establishment_id', establishmentId)
    .neq('status', 'cancelled')
    .order('appointment_date', { ascending: true });

  console.log('Agendamentos encontrados:', data);
  
  return { data, error };
};

// Premium subscription functions
export const subscribeToPremium = async (establishmentId: string, displayName: string, whatsapp: string) => {
  const { user } = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('premium_subscriptions')
    .insert([{
      user_id: user.id,
      establishment_id: establishmentId,
      display_name: displayName,
      whatsapp: whatsapp,
      is_winner: false,
      winner_position: null,
      last_draw_date: null
    }])
    .select()
    .single();

  return { data, error };
};

export const getUserPremiumSubscriptions = async () => {
  const { user } = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('premium_subscriptions')
    .select(`
      *,
      establishments (
        id,
        name,
        description,
        profile_image_url
      )
    `)
    .eq('user_id', user.id);

  return { data, error };
};

export const getEstablishmentPremiumSubscribers = async (establishmentId: string) => {
  const { data, error } = await supabase
    .from('premium_subscriptions')
    .select(`
      id,
      display_name,
      whatsapp,
      created_at,
      user_id,
      is_winner,
      winner_position,
      last_draw_date
    `)
    .eq('establishment_id', establishmentId)
    .order('is_winner', { ascending: false })
    .order('winner_position', { ascending: true })
    .order('created_at', { ascending: false });

  return { data, error };
};

export const getBusinesses = async () => {
  const { data, error } = await supabase
    .from('establishments')
    .select('*')
    .order('name', { ascending: true });

  return { data, error };
};

export const addIsPremiumColumn = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .limit(1)
    .then(async () => {
      return await supabase
        .from('appointments')
        .select('id')
        .limit(1)
        .then(async () => {
          return await supabase
            .from('appointments')
            .select('id')
            .eq('id', 'dummy')
            .maybeSingle();
        });
    });

  return { data, error };
};

export const createAddIsPremiumFunction = async () => {
  const { error } = await supabase
    .rpc('create_add_is_premium_function', {
      query: `
        CREATE OR REPLACE FUNCTION add_is_premium_column()
        RETURNS void AS $$
        BEGIN
          ALTER TABLE appointments
          ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
  
  return { error };
};

export const removePremiumSubscriber = async (subscriptionId: string) => {
  const { data, error } = await supabase
    .from('premium_subscriptions')
    .delete()
    .eq('id', subscriptionId)
    .select();

  return { data, error };
};

export const addPremiumDrawColumns = async () => {
  try {
    // Adicionar colunas para o sorteio
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: `
        DO $$
        BEGIN
          BEGIN
            ALTER TABLE premium_subscriptions
            ADD COLUMN IF NOT EXISTS is_winner boolean DEFAULT false;
            UPDATE premium_subscriptions SET is_winner = false WHERE is_winner IS NULL;
          EXCEPTION
            WHEN duplicate_column THEN
              UPDATE premium_subscriptions SET is_winner = false WHERE is_winner IS NULL;
          END;

          BEGIN
            ALTER TABLE premium_subscriptions
            ADD COLUMN IF NOT EXISTS winner_position smallint DEFAULT NULL;
            UPDATE premium_subscriptions SET winner_position = NULL WHERE winner_position IS NULL;
          EXCEPTION
            WHEN duplicate_column THEN
              UPDATE premium_subscriptions SET winner_position = NULL WHERE winner_position IS NULL;
          END;

          BEGIN
            ALTER TABLE premium_subscriptions
            ADD COLUMN IF NOT EXISTS last_draw_date timestamp with time zone DEFAULT NULL;
            UPDATE premium_subscriptions SET last_draw_date = NULL WHERE last_draw_date IS NULL;
          EXCEPTION
            WHEN duplicate_column THEN
              UPDATE premium_subscriptions SET last_draw_date = NULL WHERE last_draw_date IS NULL;
          END;

          -- Atualizar as políticas de RLS
          DROP POLICY IF EXISTS "Estabelecimentos podem ver seus assinantes" ON premium_subscriptions;
          CREATE POLICY "Estabelecimentos podem ver seus assinantes"
            ON premium_subscriptions
            FOR ALL
            USING (
              EXISTS (
                SELECT 1
                FROM establishments
                WHERE id = establishment_id
                AND owner_id = auth.uid()
              )
            );

          -- Criar índices para melhorar a performance das consultas
          CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_establishment_id ON premium_subscriptions(establishment_id);
          CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_is_winner ON premium_subscriptions(is_winner);
          CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_winner_position ON premium_subscriptions(winner_position);

          -- Verificar e corrigir inconsistências nos dados
          UPDATE premium_subscriptions
          SET winner_position = NULL, last_draw_date = NULL
          WHERE is_winner = false;

          UPDATE premium_subscriptions
          SET is_winner = false
          WHERE is_winner IS NULL;

          -- Garantir que não existam vencedores duplicados
          WITH ranked_winners AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY establishment_id ORDER BY winner_position) as rn
            FROM premium_subscriptions
            WHERE is_winner = true
          )
          UPDATE premium_subscriptions
          SET is_winner = false, winner_position = NULL, last_draw_date = NULL
          WHERE id IN (
            SELECT id FROM ranked_winners WHERE rn > 2
          );

          -- Garantir que os vencedores tenham winner_position e last_draw_date
          UPDATE premium_subscriptions
          SET winner_position = 1, last_draw_date = COALESCE(last_draw_date, now())
          WHERE is_winner = true AND winner_position IS NULL;

          -- Garantir que os vencedores tenham posições consecutivas
          WITH ranked_winners AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY establishment_id ORDER BY winner_position) as rn
            FROM premium_subscriptions
            WHERE is_winner = true
          )
          UPDATE premium_subscriptions
          SET winner_position = rn
          FROM ranked_winners
          WHERE premium_subscriptions.id = ranked_winners.id;

          -- Garantir que não existam posições duplicadas
          WITH duplicate_positions AS (
            SELECT establishment_id, winner_position, COUNT(*) as count
            FROM premium_subscriptions
            WHERE is_winner = true AND winner_position IS NOT NULL
            GROUP BY establishment_id, winner_position
            HAVING COUNT(*) > 1
          )
          UPDATE premium_subscriptions
          SET is_winner = false, winner_position = NULL, last_draw_date = NULL
          WHERE establishment_id IN (SELECT establishment_id FROM duplicate_positions);
        END $$;
      `
    });

    if (error) {
      console.error('Error adding premium draw columns:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Error adding premium draw columns:', error);
    return { error };
  }
};

// Cancel appointment function
export const cancelAppointment = async (appointmentId: string) => {
  console.log('🚫 Cancelando agendamento:', appointmentId);
  
  try {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .select();

    console.log('✅ Agendamento cancelado:', data);
    console.log('❌ Erro (se houver):', error);
    
    if (error) {
      console.error('❌ Erro ao cancelar:', error);
    }
    
    return { data, error };
  } catch (err) {
    console.error('❌ Erro catch cancelAppointment:', err);
    return { data: null, error: err };
  }
};

// Backup usando localStorage (solução temporária para problemas de RLS)
export const saveAppointmentLocal = (appointment: any) => {
  try {
    const userId = appointment.client_id;
    const existing = localStorage.getItem(`appointments_${userId}`);
    const appointments = existing ? JSON.parse(existing) : [];
    
    // Adicionar ID único se não tiver
    const newAppointment = {
      ...appointment,
      id: appointment.id || Date.now().toString(),
      created_at: appointment.created_at || new Date().toISOString()
    };
    
    appointments.push(newAppointment);
    localStorage.setItem(`appointments_${userId}`, JSON.stringify(appointments));
    
    console.log('💾 Agendamento salvo localmente:', newAppointment);
    return newAppointment;
  } catch (error) {
    console.error('❌ Erro ao salvar localmente:', error);
    return null;
  }
};

export const getAppointmentsLocal = (userId: string) => {
  try {
    const existing = localStorage.getItem(`appointments_${userId}`);
    const appointments = existing ? JSON.parse(existing) : [];
    console.log('💾 Agendamentos locais carregados:', appointments);
    return appointments;
  } catch (error) {
    console.error('❌ Erro ao buscar localmente:', error);
    return [];
  }
};

export const cancelAppointmentLocal = (appointmentId: string, userId: string) => {
  try {
    const existing = localStorage.getItem(`appointments_${userId}`);
    if (!existing) return false;
    
    const appointments = JSON.parse(existing);
    const updatedAppointments = appointments.map((apt: any) => 
      apt.id === appointmentId ? { ...apt, status: 'cancelled' } : apt
    );
    
    localStorage.setItem(`appointments_${userId}`, JSON.stringify(updatedAppointments));
    console.log('💾 Agendamento cancelado localmente:', appointmentId);
    return true;
  } catch (error) {
    console.error('❌ Erro ao cancelar localmente:', error);
    return false;
  }
};

// Favorite establishments functions
export const addFavoriteEstablishment = async (establishmentId: string, establishmentName: string, establishmentCode: string) => {
  const { user } = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('favorite_establishments')
    .insert([{
      user_id: user.id,
      establishment_id: establishmentId,
      establishment_name: establishmentName,
      establishment_code: establishmentCode
    }])
    .select()
    .single();

  return { data, error };
};

export const getUserFavoriteEstablishments = async () => {
  const { user } = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('favorite_establishments')
    .select(`
      *,
      establishments (
        id,
        name,
        description,
        code,
        profile_image_url,
        services_with_prices,
        professionals,
        business_hours
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return { data, error };
};

export const removeFavoriteEstablishment = async (favoriteId: string) => {
  const { data, error } = await supabase
    .from('favorite_establishments')
    .delete()
    .eq('id', favoriteId)
    .select();

  return { data, error };
};

export const checkIfEstablishmentIsFavorite = async (establishmentId: string) => {
  const { user } = await getCurrentUser();
  if (!user) return { data: false, error: null };

  const { data, error } = await supabase
    .from('favorite_establishments')
    .select('id')
    .eq('user_id', user.id)
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  return { data: !!data, error };
};