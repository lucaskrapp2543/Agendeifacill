import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { addMonths } from 'date-fns';

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
  let customPhoto1Url = null;
  let customPhoto2Url = null;
  let customPhoto3Url = null;

  // Upload profile image if exists
  if (establishmentData.profile_image) {
    const file = establishmentData.profile_image;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `establishments/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    profileImageUrl = publicUrl;
  }

  // Upload custom photos if they exist
  if (establishmentData.custom_photo_1) {
    const file = establishmentData.custom_photo_1;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `establishments/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('custom-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('custom-photos')
      .getPublicUrl(filePath);

    customPhoto1Url = publicUrl;
  }

  if (establishmentData.custom_photo_2) {
    const file = establishmentData.custom_photo_2;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `establishments/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('custom-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('custom-photos')
      .getPublicUrl(filePath);

    customPhoto2Url = publicUrl;
  }

  if (establishmentData.custom_photo_3) {
    const file = establishmentData.custom_photo_3;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `establishments/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('custom-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('custom-photos')
      .getPublicUrl(filePath);

    customPhoto3Url = publicUrl;
  }

  // Remove the file objects and add the URLs
  delete establishmentData.profile_image;
  delete establishmentData.custom_photo_1;
  delete establishmentData.custom_photo_2;
  delete establishmentData.custom_photo_3;
  
  establishmentData.profile_image_url = profileImageUrl;
  establishmentData.custom_photo_1_url = customPhoto1Url;
  establishmentData.custom_photo_2_url = customPhoto2Url;
  establishmentData.custom_photo_3_url = customPhoto3Url;

  // Configurações padrão para novos estabelecimentos
  const defaultBusinessHours = {
    monday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    tuesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    wednesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    thursday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    friday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    saturday: { enabled: false, open1: '09:00', close1: '18:00', open2: null, close2: null },
    sunday: { enabled: false, open1: '09:00', close1: '18:00', open2: null, close2: null }
  };

  const defaultServices = [
    {
      id: '1',
      name: 'Corte',
      price: 25.00,
      duration: 30
    },
    {
      id: '2',
      name: 'Barba',
      price: 15.00,
      duration: 20
    }
  ];

  const defaultProfessionals = [
    {
      id: '1',
      name: 'Profissional 1',
      specialties: ['Corte', 'Barba']
    }
  ];

  // Garantir que os campos obrigatórios existam, mesmo que vazios
  const dataToInsert = {
    name: establishmentData.name?.trim() || 'Estabelecimento',
    description: establishmentData.description?.trim() || 'Descrição não disponível',
    code: establishmentData.code?.trim() || '',
    owner_id: establishmentData.owner_id,
    business_hours: establishmentData.business_hours || defaultBusinessHours,
    professionals: establishmentData.professionals?.length > 0 ? establishmentData.professionals : defaultProfessionals,
    services_with_prices: establishmentData.services_with_prices?.length > 0 ? establishmentData.services_with_prices : defaultServices,
    profile_image_url: profileImageUrl,
    affiliate_link: establishmentData.affiliate_link || null,
    custom_photo_1_url: customPhoto1Url,
    custom_photo_2_url: customPhoto2Url,
    custom_photo_3_url: customPhoto3Url,
    has_wifi: establishmentData.has_wifi ?? false,
    has_parking: establishmentData.has_parking ?? false,
    has_accessibility: establishmentData.has_accessibility ?? false,
    wifi_password: establishmentData.wifi_password || null
  };

  console.log('Dados a serem criados:', dataToInsert);

  const { data, error } = await supabase
    .from('establishments')
    .insert([dataToInsert])
    .select();

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
      wifi_password,
      profile_image_url,
      affiliate_link,
      custom_photo_1_url,
      custom_photo_2_url,
      custom_photo_3_url,
      created_at,
      updated_at
    `)
    .eq('code', code)
    .single();

  console.log('Estabelecimento encontrado:', data);
  
  return { data, error };
};

// Função para upload de foto personalizada
const uploadCustomPhoto = async (file: File, establishmentId: string, photoNumber: number) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `custom_photo_${photoNumber}_${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `establishments/${establishmentId}/custom_photos/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('profile-images')
    .getPublicUrl(filePath);

  return publicUrl;
};

export const updateEstablishment = async (id: string, data: any) => {
  const { 
    profile_image, 
    custom_photo_1, 
    custom_photo_2, 
    custom_photo_3, 
    ...establishmentData 
  } = data;
  
  try {
    // Se houver uma nova imagem de perfil, faz o upload
    if (profile_image instanceof File) {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(`establishment/${id}/${profile_image.name}`, profile_image, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(uploadData.path);

      establishmentData.profile_image_url = publicUrl;
    }

    // Upload das fotos personalizadas
    if (custom_photo_1 instanceof File) {
      establishmentData.custom_photo_1_url = await uploadCustomPhoto(custom_photo_1, id, 1);
    }
    
    if (custom_photo_2 instanceof File) {
      establishmentData.custom_photo_2_url = await uploadCustomPhoto(custom_photo_2, id, 2);
    }
    
    if (custom_photo_3 instanceof File) {
      establishmentData.custom_photo_3_url = await uploadCustomPhoto(custom_photo_3, id, 3);
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
    // VALIDAÇÃO DUPLA: Verificar conflitos antes de criar
    console.log('🔍 Verificando conflitos antes de criar agendamento...');
    
    // Buscar agendamentos existentes no mesmo dia e profissional
    const { data: existingAppointments, error: fetchError } = await supabase
      .from('appointments')
      .select('appointment_time, duration, status')
      .eq('appointment_date', appointmentData.appointment_date)
      .eq('professional', appointmentData.professional)
      .eq('establishment_id', appointmentData.establishment_id)
      .neq('status', 'cancelled');

    if (fetchError) {
      console.error('❌ Erro ao buscar agendamentos existentes:', fetchError);
      throw fetchError;
    }

    console.log('📋 Agendamentos existentes encontrados:', existingAppointments);

    // Verificar conflitos
    const newStartMinutes = timeToMinutes(appointmentData.appointment_time);
    const newEndMinutes = newStartMinutes + appointmentData.duration;

    for (const existing of existingAppointments || []) {
      const existingStartMinutes = timeToMinutes(existing.appointment_time);
      const existingEndMinutes = existingStartMinutes + existing.duration;

      // Verificar sobreposição
      const hasConflict = !(newEndMinutes <= existingStartMinutes || newStartMinutes >= existingEndMinutes);
      
      if (hasConflict) {
        const conflictMessage = `Conflito de horário detectado! O horário ${appointmentData.appointment_time}-${minutesToTime(newEndMinutes)} conflita com agendamento existente ${existing.appointment_time}-${minutesToTime(existingEndMinutes)}`;
        console.error('🔴 CONFLITO DETECTADO:', conflictMessage);
        throw new Error(conflictMessage);
      }
    }

    console.log('✅ Nenhum conflito detectado, prosseguindo com criação...');

    const { data, error } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select(`
        id,
        client_id,
        client_name,
        client_whatsapp,
        establishment_id,
        service,
        professional,
        appointment_date,
        appointment_time,
        status,
        created_at,
        is_premium,
        duration,
        price,
        payment_method,
        pix_payment_status,
        pix_proof_url
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

// Funções auxiliares para conversão de tempo
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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
    let combinedData: Array<Database['public']['Tables']['appointments']['Row']> = [];
    
    if (supabaseData && supabaseData.length > 0) {
      combinedData = [...supabaseData];
    }
    
    // Adicionar dados locais que não estão no Supabase
    if (localData && localData.length > 0) {
      const supabaseIds = new Set(supabaseData?.map(item => item.id) || []);
      const uniqueLocalData = localData.filter((item: any) => !supabaseIds.has(item.id));
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
  try {
    const { data, error } = await supabase
      .from('premium_subscribers')
      .select('*')
      .eq('establishment_id', establishmentId);

    // Se der erro 42P01 (relation does not exist) ou qualquer outro erro, retorna lista vazia
    if (error) {
      console.log('Info: Premium subscribers table not available');
      return [];
    }

    return data || [];
  } catch (error) {
    console.log('Info: Error fetching premium subscribers');
    return [];
  }
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
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  return await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
    .select()
    .single();
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

export const loadEstablishmentDirect = async (code: string) => {
  console.log('🔍 Buscando estabelecimento:', code);
  
  const { data, error } = await supabase
    .from('establishments')
    .select(`
      id,
      name,
      description,
      code,
      owner_id,
      business_hours,
      professionals,
      services_with_prices,
      profile_image_url,
      affiliate_link,
      custom_photo_1_url,
      custom_photo_2_url,
      custom_photo_3_url,
      created_at,
      updated_at
    `)
    .eq('code', code)
    .single();

  if (error) {
    console.error('❌ Erro ao buscar estabelecimento:', error);
  } else {
    console.log('✅ Estabelecimento encontrado:', data);
  }

  return { data, error };
};

// Subscription functions
export const createSubscription = async (establishmentId: string, name: string, value: number, durationMonths: number) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([
      { establishment_id: establishmentId, name, value, duration_months: durationMonths }
    ])
    .select()
    .single();
  return { data, error };
};

export const getSubscriptions = async (establishmentId: string) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('name', { ascending: true });
  return { data, error };
};

export const deleteSubscription = async (subscriptionId: string) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', subscriptionId)
    .select()
    .single();
  return { data, error };
};

// Client Subscription functions
export const addClientSubscription = async (clientId: string, subscriptionId: string, establishmentId: string, startDate: Date) => {
  const { data: subscriptionData, error: subscriptionError } = await getSubscriptionById(subscriptionId);

  if (subscriptionError || !subscriptionData) {
    throw new Error('Assinatura não encontrada ou erro ao buscar.');
  }

  const endDate = addMonths(startDate, subscriptionData.duration_months);

  const { data, error } = await supabase
    .from('client_subscriptions')
    .insert([
      {
        client_id: clientId,
        subscription_id: subscriptionId,
        establishment_id: establishmentId,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        payment_status: 'unpaid', // Inicia como não pago
        last_payment_date: null
      }
    ])
    .select()
    .single();
  return { data, error };
};

export const getClientSubscriptions = async (establishmentId: string) => {
  const { data: clientSubs, error } = await supabase
    .from('client_subscriptions')
    .select(
      `*,
      subscriptions (name, value, duration_months)
      `
    )
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  if (!clientSubs || clientSubs.length === 0) {
    return { data: [], error: null };
  }

  // Coletar todos os client_ids únicos
  const uniqueClientIds = [...new Set(clientSubs.map(cs => cs.client_id))];
  console.log('🔍 Client IDs para buscar perfis:', uniqueClientIds);

  // Buscar os perfis (name e is_subscriber) para esses client_ids
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, is_subscriber')
    .in('id', uniqueClientIds);

  console.log('👤 Perfis encontrados:', profiles);

  // Buscar nomes dos agendamentos como fallback
  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('client_id, client_name')
    .eq('establishment_id', establishmentId)
    .in('client_id', uniqueClientIds)
    .order('created_at', { ascending: false });

  console.log('📅 Agendamentos encontrados para nomes:', appointments);

  const profilesMap = new Map();
  profiles?.forEach(profile => {
    profilesMap.set(profile.id, profile);
  });

  // Criar mapa de nomes dos agendamentos (client_id -> nome mais recente)
  const appointmentNamesMap = new Map();
  appointments?.forEach(apt => {
    if (apt.client_name && !appointmentNamesMap.has(apt.client_id)) {
      appointmentNamesMap.set(apt.client_id, apt.client_name);
    }
  });

  console.log('🗺️ Mapa de perfis:', profilesMap);
  console.log('📋 Mapa de nomes dos agendamentos:', appointmentNamesMap);

  // Combinar os dados das assinaturas de clientes com os nomes
  const combinedData = clientSubs.map(cs => {
    const profile = profilesMap.get(cs.client_id);
    const appointmentName = appointmentNamesMap.get(cs.client_id);
    
    // Prioridade: nome do perfil > nome do agendamento > Cliente Desconhecido
    const clientName = profile?.name || appointmentName || 'Cliente Desconhecido';
    
    console.log(`📋 Cliente ${cs.client_id}:`, {
      profile,
      appointmentName,
      clientName,
      finalName: clientName
    });

    return {
      ...cs,
      profiles: {
        full_name: clientName,
        is_subscriber: profile?.is_subscriber || false
      }
    };
  });

  console.log('✅ Dados combinados finais:', combinedData);

  return { data: combinedData, error: null };
};

// Nova função auxiliar para buscar perfis por IDs
export const getProfilesByIds = async (userIds: string[]) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, is_subscriber')
    .in('id', userIds);
  return { data, error };
};

export const updateClientSubscriptionPaymentStatus = async (clientSubscriptionId: string, status: 'paid' | 'unpaid') => {
  const { data, error } = await supabase
    .from('client_subscriptions')
    .update({ payment_status: status, last_payment_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null })
    .eq('id', clientSubscriptionId)
    .select()
    .single();
  return { data, error };
};

export const deleteClientSubscription = async (clientSubscriptionId: string) => {
  const { data, error } = await supabase
    .from('client_subscriptions')
    .delete()
    .eq('id', clientSubscriptionId)
    .select()
    .single();
  return { data, error };
};

// Auxiliary function to get a single subscription by ID
const getSubscriptionById = async (subscriptionId: string) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();
  return { data, error };
};