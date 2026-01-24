import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addMonths } from 'date-fns';
import type { Database } from '../types/supabase';

// These environment variables need to be set after connecting to Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Verificar se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ CRÍTICO: Variáveis de ambiente do Supabase não estão definidas!');
  console.error('Por favor, crie um arquivo .env na raiz do projeto com:');
  console.error('VITE_SUPABASE_URL=sua_url_do_supabase');
  console.error('VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase');

  // Fallback temporário para desenvolvimento
  if (import.meta.env.DEV) {
    console.warn('⚠️ Usando configuração de fallback para desenvolvimento...');
  }
}

// Initialize the Supabase client
export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder_key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'agendafacil_auth_token',
      flowType: 'pkce',
      // Configurações otimizadas para PWA
      debug: false,
      // Permitir múltiplas sessões simultâneas (PC + Celular)
      // multiTabPersistence: true, // Removido - não é uma propriedade válida
      // Configurações específicas para PWA
      storage: {
        getItem: (key: string) => {
          try {
            const value = localStorage.getItem(key);
            console.log(`📱 PWA - Lendo ${key}:`, value ? 'encontrado' : 'não encontrado');
            return value;
          } catch (error) {
            console.warn('❌ Erro ao acessar localStorage:', error);
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            localStorage.setItem(key, value);
            console.log(`💾 PWA - Salvando ${key}:`, 'sucesso');
          } catch (error) {
            console.warn('❌ Erro ao salvar no localStorage:', error);
          }
        },
        removeItem: (key: string) => {
          try {
            localStorage.removeItem(key);
            console.log(`🗑️ PWA - Removendo ${key}:`, 'sucesso');
          } catch (error) {
            console.warn('❌ Erro ao remover do localStorage:', error);
          }
        }
      }
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
          full_name: meta.full_name || email.split('@')[0],
          first_name: meta.first_name,
          last_name: meta.last_name,
          whatsapp: meta.whatsapp,
          is_new_client: meta.is_new_client
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

// Função para criar conta de cliente convidado (sem email/senha, apenas telefone)
export const createGuestClientAndLogin = async (name: string, phone: string) => {
  console.log('🔍 createGuestClientAndLogin - Criando conta de cliente convidado:', { name, phone });

  // Limpar telefone para usar como email único
  const cleanPhone = phone.replace(/\D/g, '');

  // Criar email fictício baseado no telefone
  const fakeEmail = `guest_${cleanPhone}@agendafacil.local`;

  // Gerar senha aleatória
  const randomPassword = Math.random().toString(36).slice(-12) + '!@#';

  try {
    // Criar conta
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password: randomPassword,
      options: {
        data: {
          role: 'client',
          full_name: name,
          whatsapp: phone,
          is_guest: true, // Marca como conta convidada
        }
      }
    });

    if (signUpError) {
      console.error('❌ Erro ao criar conta:', signUpError);

      // Se o email já existe, tentar fazer login
      if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
        console.log('🔄 Conta já existe, fazendo login...');

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: randomPassword // Tentar com a senha gerada
        });

        if (signInError) {
          // Se falhar login, o usuário já existe mas com outra senha - precisamos resetar
          console.log('⚠️ Usuário existe mas senha é diferente. Criando nova conta com timestamp...');
          const uniqueEmail = `guest_${cleanPhone}_${Date.now()}@agendafacil.local`;
          const uniquePassword = Math.random().toString(36).slice(-12) + '!@#';

          const { data: newSignUpData, error: newSignUpError } = await supabase.auth.signUp({
            email: uniqueEmail,
            password: uniquePassword,
            options: {
              data: {
                role: 'client',
                full_name: name,
                whatsapp: phone,
                is_guest: true,
              }
            }
          });

          if (newSignUpError) throw newSignUpError;

          // Garantir que uma sessão exista (alguns projetos retornam user sem session no signUp)
          try {
            await supabase.auth.signInWithPassword({ email: uniqueEmail, password: uniquePassword });
          } catch (e) {
            console.warn('⚠️ Não foi possível fazer login imediato após signUp (email único):', e);
          }

          // Atualizar perfil
          if (newSignUpData.user) {
            await supabase.from('profiles').insert([{
              id: newSignUpData.user.id,
              name: name,
              phone: phone,
            }]);
          }

          return { user: newSignUpData.user, error: null };
        }

        // Login bem-sucedido
        return { user: signInData.user, error: null };
      }

      throw signUpError;
    }

    // Conta criada com sucesso
    if (signUpData.user) {
      // Garantir sessão (alguns projetos retornam user sem session no signUp)
      try {
        await supabase.auth.signInWithPassword({ email: fakeEmail, password: randomPassword });
      } catch (e) {
        console.warn('⚠️ Não foi possível fazer login imediato após signUp:', e);
      }

      // Criar perfil
      try {
        await supabase.from('profiles').insert([{
          id: signUpData.user.id,
          name: name,
          phone: phone,
        }]);
      } catch (err: any) {
        console.log('Perfil já existe ou erro:', err);
      }

      return { user: signUpData.user, error: null };
    }

    throw new Error('Falha ao criar conta');
  } catch (error: any) {
    console.error('❌ Erro ao criar/fazer login:', error);
    return { user: null, error };
  }
};

// Database functions for Establishments
export const createEstablishment = async (establishmentData: any) => {
  let profileImageUrl = null;
  let customPhoto1Url = null;
  let customPhoto2Url = null;
  let customPhoto3Url = null;
  let customPhoto4Url = null;
  let customPhoto5Url = null;
  let customPhoto6Url = null;
  let customPhoto7Url = null;

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

  if (establishmentData.custom_photo_4) {
    const file = establishmentData.custom_photo_4;
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

    customPhoto4Url = publicUrl;
  }

  if (establishmentData.custom_photo_5) {
    const file = establishmentData.custom_photo_5;
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

    customPhoto5Url = publicUrl;
  }

  if (establishmentData.custom_photo_6) {
    const file = establishmentData.custom_photo_6;
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

    customPhoto6Url = publicUrl;
  }

  if (establishmentData.custom_photo_7) {
    const file = establishmentData.custom_photo_7;
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

    customPhoto7Url = publicUrl;
  }

  // Remove the file objects and add the URLs
  delete establishmentData.profile_image;
  delete establishmentData.custom_photo_1;
  delete establishmentData.custom_photo_2;
  delete establishmentData.custom_photo_3;
  delete establishmentData.custom_photo_4;
  delete establishmentData.custom_photo_5;
  delete establishmentData.custom_photo_6;
  delete establishmentData.custom_photo_7;

  establishmentData.profile_image_url = profileImageUrl;
  establishmentData.custom_photo_1_url = customPhoto1Url;
  establishmentData.custom_photo_2_url = customPhoto2Url;
  establishmentData.custom_photo_3_url = customPhoto3Url;
  establishmentData.custom_photo_4_url = customPhoto4Url;
  establishmentData.custom_photo_5_url = customPhoto5Url;
  establishmentData.custom_photo_6_url = customPhoto6Url;
  establishmentData.custom_photo_7_url = customPhoto7Url;

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
    custom_photo_4_url: customPhoto4Url,
    custom_photo_5_url: customPhoto5Url,
    custom_photo_6_url: customPhoto6Url,
    custom_photo_7_url: customPhoto7Url,
    carousel_position: 'below', // PADRÃO: Carrossel embaixo do perfil
    has_wifi: establishmentData.has_wifi ?? false,
    has_parking: establishmentData.has_parking ?? false,
    has_accessibility: establishmentData.has_accessibility ?? false,
    wifi_password: establishmentData.wifi_password || null,
    pin_password: establishmentData.pin_password || null, // Sem senha padrão
    professionals_pins: [], // Array vazio para pins dos profissionais
    onboarding_step: establishmentData.onboarding_step ?? 1 // Novas contas começam no onboarding
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
    custom_photo_4,
    custom_photo_5,
    custom_photo_6,
    custom_photo_7,
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

    if (custom_photo_4 instanceof File) {
      establishmentData.custom_photo_4_url = await uploadCustomPhoto(custom_photo_4, id, 4);
    }

    if (custom_photo_5 instanceof File) {
      establishmentData.custom_photo_5_url = await uploadCustomPhoto(custom_photo_5, id, 5);
    }

    if (custom_photo_6 instanceof File) {
      establishmentData.custom_photo_6_url = await uploadCustomPhoto(custom_photo_6, id, 6);
    }

    if (custom_photo_7 instanceof File) {
      establishmentData.custom_photo_7_url = await uploadCustomPhoto(custom_photo_7, id, 7);
    }

    // Garantir que os arrays não sejam undefined
    const professionals = establishmentData.professionals || [];
    const services_with_prices = establishmentData.services_with_prices || [];

    // Preservar as fotos dos profissionais existentes
    if (professionals.length > 0) {
      // Buscar dados atuais do estabelecimento para preservar as fotos
      const { data: currentData } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', id)
        .single();

      if (currentData?.professionals) {
        // Mesclar as fotos existentes com os novos dados
        const currentProfessionals = currentData.professionals;
        const updatedProfessionals = professionals.map((newProf: any) => {
          const existingProf = currentProfessionals.find((curr: any) => curr.id === newProf.id);
          return {
            ...newProf,
            // Preservar a photo_url se existir
            photo_url: existingProf?.photo_url || newProf.photo_url
          };
        });

        establishmentData.professionals = updatedProfessionals;
      }
    }

    console.log('Dados a serem atualizados:', {
      ...establishmentData,
      professionals: establishmentData.professionals,
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
// Função auxiliar para retry de requisições (otimizada para diferentes tipos de conexão)
const retryRequest = async (fn: () => Promise<any>) => {
  // Importar dinamicamente para evitar problemas de SSR
  const { getConnectionInfo } = await import('../utils/connectionDetector');
  const connectionInfo = getConnectionInfo();

  const maxRetries = connectionInfo.retries;
  const timeout = connectionInfo.timeout;
  const delay = connectionInfo.isSlow ? 3000 : 2000;

  console.log(`📱 Tipo de conexão detectado: ${connectionInfo.type} (timeout: ${timeout}ms, retries: ${maxRetries})`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Timeout baseado no tipo de conexão
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout - conexão muito lenta')), timeout);
      });

      return await Promise.race([fn(), timeoutPromise]);
    } catch (error: any) {
      console.log(`🔄 Tentativa ${i + 1}/${maxRetries} falhou (${connectionInfo.type}):`, error.message);

      // Se for erro de timeout ou conexão, tentar novamente
      if (error.message.includes('Timeout') || error.message.includes('Load failed') || error.message.includes('fetch') || error.message.includes('TypeError')) {
        if (i === maxRetries - 1) {
          const errorMessage = connectionInfo.isSlow
            ? 'Conexão muito lenta. Tente usar Wi-Fi ou aguarde alguns minutos.'
            : 'Conexão instável. Verifique sua internet e tente novamente.';
          throw new Error(errorMessage);
        }

        // Delay progressivo baseado no tipo de conexão
        const currentDelay = delay * (i + 1) * (connectionInfo.isSlow ? 2 : 1.5);
        console.log(`⏳ Aguardando ${currentDelay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
      } else {
        // Se não for erro de conexão, não tentar novamente
        throw error;
      }
    }
  }
};

export const createAppointment = async (appointmentData: any) => {
  console.log('🚀 Criando agendamento:', appointmentData);

  try {
    // VALIDAÇÃO DUPLA: Verificar conflitos antes de criar
    console.log('🔍 Verificando conflitos antes de criar agendamento...');

    // Buscar agendamentos existentes no mesmo dia e profissional (com retry)
    const { data: existingAppointments, error: fetchError } = await retryRequest(async () => {
      return await supabase
        .from('appointments')
        .select('appointment_time, duration, status')
        .eq('appointment_date', appointmentData.appointment_date)
        .eq('professional', appointmentData.professional)
        .eq('establishment_id', appointmentData.establishment_id)
        .neq('status', 'cancelled');
    });

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

    // VALIDAÇÃO DE LIMITE MENSAL PARA ASSINANTES
    if (appointmentData.is_subscriber && appointmentData.client_whatsapp) {
      console.log('🔍 Verificando limite mensal para assinante:', appointmentData.client_whatsapp);

      try {
        const limitCheck = await checkMonthlyServiceLimit(
          appointmentData.client_whatsapp,
          appointmentData.establishment_id
        );

        if (!limitCheck.canBook) {
          const errorMessage = `Atenção: você já atingiu o limite dos seus serviços como assinante neste mês. (${limitCheck.currentUsage}/${limitCheck.monthlyLimit} serviços utilizados)`;
          console.error('🚫 LIMITE MENSAL EXCEDIDO:', errorMessage);
          throw new Error(errorMessage);
        }

        console.log('✅ Limite mensal OK:', limitCheck);
      } catch (limitError: any) {
        // Se for erro de limite, re-throw para mostrar ao usuário
        if (limitError.message.includes('atingiu o limite')) {
          throw limitError;
        }
        // Se for erro de conexão, logar mas continuar (não bloquear agendamento)
        console.warn('⚠️ Erro ao verificar limite mensal, continuando agendamento:', limitError);
      }
    }

    const { data, error } = await retryRequest(async () => {
      return await supabase
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
    });

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

    // Debug específico para verificar campos importantes
    if (supabaseData && supabaseData.length > 0) {
      console.log('🔍 DEBUG - Campos do primeiro agendamento:');
      const firstAppointment = supabaseData[0];
      console.log('  - service_name:', firstAppointment.service_name);
      console.log('  - professional_name:', firstAppointment.professional_name);
      console.log('  - professional:', firstAppointment.professional);
      console.log('  - establishment_name:', firstAppointment.establishment_name);
      console.log('  - appointment_date:', firstAppointment.appointment_date);
      console.log('  - appointment_time:', firstAppointment.appointment_time);
    }

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

    // Resolver nomes dos profissionais se necessário
    if (combinedData && combinedData.length > 0) {
      for (let appointment of combinedData) {
        // Se professional é um ID e não um nome, tentar buscar o nome
        if (appointment.professional && appointment.professional.length > 10 && !appointment.professional_name) {
          try {
            // Buscar o nome do profissional no estabelecimento
            if (appointment.establishments && appointment.establishments.professionals) {
              const professionals = appointment.establishments.professionals;
              if (Array.isArray(professionals)) {
                const professional = professionals.find((p: any) => p.id === appointment.professional);
                if (professional && professional.name) {
                  appointment.professional_name = professional.name;
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Erro ao buscar nome do profissional:', error);
          }
        }
      }
    }

    return { data: combinedData, error };
  } catch (err) {
    console.error('❌ Erro catch getClientAppointments:', err);

    // Em caso de erro total, tentar usar apenas dados locais
    const localData = getAppointmentsLocal(clientId);
    console.log('🆘 Fallback para dados locais:', localData?.length || 0);

    return { data: localData, error: err };
  }
};

// Buscar agendamentos por telefone (sem precisar de login)
export const getAppointmentsByPhone = async (phone: string) => {
  console.log('🔍 getAppointmentsByPhone chamada para telefone:', phone);

  try {
    // Limpar o telefone para busca - remover todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    console.log('📱 Telefone limpo para busca:', cleanPhone);

    if (!cleanPhone || cleanPhone.length < 9) {
      console.log('⚠️ Telefone inválido ou muito curto');
      return { data: [], error: null };
    }

    // Normalizar o número: remover código de país se houver para buscar apenas o número local
    // Isso permite encontrar números salvos com ou sem código de país
    const countryCodes = [
      { code: '351', minLength: 12 },
      { code: '244', minLength: 12 },
      { code: '54', minLength: 12 },
      { code: '56', minLength: 11 },
      { code: '55', minLength: 12 },
      { code: '34', minLength: 11 },
      { code: '1', minLength: 11 }
    ];
    let localNumber = cleanPhone;
    let hasCountryCode = false;
    
    // Verificar se começa com código de país (do maior para o menor para evitar falsos positivos)
    for (const { code, minLength } of countryCodes) {
      if (cleanPhone.startsWith(code) && cleanPhone.length >= minLength) {
        localNumber = cleanPhone.slice(code.length);
        hasCountryCode = true;
        console.log('📱 Código de país detectado:', code, '- Número local:', localNumber);
        break;
      }
    }

    // Buscar agendamentos pelo telefone - usando múltiplas estratégias
    // 1. Buscar com o número completo (com código se houver)
    let data1: any[] = [];
    let error1: any = null;

    try {
      const result1 = await supabase
        .from('appointments')
        .select(`*, establishments (*)`)
        .ilike('client_whatsapp', `%${cleanPhone}%`)
        .neq('status', 'cancelled'); // ✅ Excluir agendamentos cancelados
      data1 = result1.data || [];
      error1 = result1.error;
      console.log('🔍 Primeira busca (número completo):', data1?.length || 0, 'resultados');
      if (error1) console.error('❌ Erro na primeira busca:', error1);
    } catch (e) {
      console.error('❌ Erro ao executar primeira busca:', e);
    }

    // 2. Buscar com número local (sem código de país) - importante para Portugal/Brasil
    let data2: any[] = [];
    let error2: any = null;

    if (localNumber !== cleanPhone && localNumber.length >= 9) {
      try {
        const result2 = await supabase
          .from('appointments')
          .select(`*, establishments (*)`)
          .ilike('client_whatsapp', `%${localNumber}%`)
          .neq('status', 'cancelled'); // ✅ Excluir agendamentos cancelados
        data2 = result2.data || [];
        error2 = result2.error;
        console.log('🔍 Segunda busca (número local):', data2?.length || 0, 'resultados');
        if (error2) console.error('❌ Erro na segunda busca:', error2);
      } catch (e) {
        console.error('❌ Erro ao executar segunda busca:', e);
      }
    }

    // 3. Buscar também com formato com caracteres (49 99951-6123 ou 333 333 333)
    let data3: any[] = [];
    let error3: any = null;

    try {
      // Formato brasileiro: (XX) XXXXX-XXXX
      let formattedPhone = '';
      if (cleanPhone.length >= 11) {
        formattedPhone = `${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
      } else if (cleanPhone.length === 9) {
        // Formato Portugal: XXX XXX XXX
        formattedPhone = `${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3, 6)} ${cleanPhone.slice(6)}`;
      } else {
        formattedPhone = cleanPhone;
      }

      const result3 = await supabase
        .from('appointments')
        .select(`*, establishments (*)`)
        .ilike('client_whatsapp', `%${formattedPhone}%`)
        .neq('status', 'cancelled'); // ✅ Excluir agendamentos cancelados
      data3 = result3.data || [];
      error3 = result3.error;
      console.log('🔍 Terceira busca (formato com caracteres):', data3?.length || 0, 'resultados');
      if (error3) console.error('❌ Erro na terceira busca:', error3);
    } catch (e) {
      console.error('❌ Erro ao executar terceira busca:', e);
    }

    // 4. Buscar por appointments recentes para debug
    try {
      const { data: recentAppointments } = await supabase
        .from('appointments')
        .select('client_whatsapp, client_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('🔍 Últimos 5 agendamentos salvos no banco:');
      recentAppointments?.forEach((apt, idx) => {
        console.log(`  ${idx + 1}. WhatsApp: "${apt.client_whatsapp}", Nome: "${apt.client_name}"`);
      });
    } catch (e) {
      console.error('❌ Erro ao buscar últimos agendamentos:', e);
    }

    // 5. Combinar resultados de todas as buscas
    const allAppointments = [...(data1 || []), ...(data2 || []), ...(data3 || [])];

    // Remover duplicatas E filtrar cancelados (segurança extra)
    const uniqueAppointments = Array.from(
      new Map(allAppointments.map(apt => [apt.id, apt])).values()
    );

    // ✅ DEBUG: Log dos status antes do filtro
    console.log('🔍 DEBUG - Status dos agendamentos ANTES do filtro:');
    uniqueAppointments.forEach((apt, idx) => {
      console.log(`  ${idx + 1}. ID: ${apt.id}, Status: "${apt.status}", Data: ${apt.appointment_date}, Hora: ${apt.appointment_time}`);
    });

    // ✅ Filtrar cancelados
    const filteredAppointments = uniqueAppointments.filter(apt => apt.status !== 'cancelled');

    console.log('📊 getAppointmentsByPhone - Resultado:');
    console.log('  - Resultados da busca número completo:', data1?.length || 0);
    console.log('  - Resultados da busca número local:', data2?.length || 0);
    console.log('  - Resultados da busca formato:', data3?.length || 0);
    console.log('  - Total único (antes do filtro):', uniqueAppointments.length);
    console.log('  - Total único (DEPOIS do filtro de cancelados):', filteredAppointments.length);

    if (error1 || error2 || error3) {
      console.error('⚠️ Erros na busca:', error1, error2, error3);
    }

    // Resolver nomes dos profissionais se necessário
    if (filteredAppointments && filteredAppointments.length > 0) {
      for (let appointment of filteredAppointments) {
        if (appointment.professional && appointment.professional.length > 10 && !appointment.professional_name) {
          try {
            if (appointment.establishments && appointment.establishments.professionals) {
              const professionals = appointment.establishments.professionals;
              if (Array.isArray(professionals)) {
                const professional = professionals.find((p: any) => p.id === appointment.professional);
                if (professional && professional.name) {
                  appointment.professional_name = professional.name;
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Erro ao buscar nome do profissional:', error);
          }
        }
      }
    }

    return { data: filteredAppointments || [], error: null };
  } catch (err) {
    console.error('❌ Erro ao buscar agendamentos por telefone:', err);
    return { data: [], error: err };
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
export const createSubscription = async (establishmentId: string, name: string, value: number, durationMonths: number, weekdays?: string[], serviceDuration?: number, fixedCommissionValue?: number, description?: string) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([
      {
        establishment_id: establishmentId,
        name,
        value,
        duration_months: durationMonths,
        weekdays: weekdays || [],
        service_duration: serviceDuration || 30, // Duração padrão de 30 minutos
        fixed_commission_value: fixedCommissionValue || 0, // Valor fixo de comissão por serviço diário
        description: description?.trim() || null // Descrição opcional
      }
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

// Função para verificar limite de serviços mensais de um assinante
export const checkMonthlyServiceLimit = async (clientWhatsapp: string, establishmentId: string) => {
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  try {
    // Limpar o WhatsApp (remover formatação)
    const cleanWhatsapp = clientWhatsapp.replace(/\D/g, '');

    // 1. Buscar assinatura ativa do cliente pelo WhatsApp
    const { data: clientSubscription, error: subscriptionError } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions!inner(*)
      `)
      .eq('establishment_id', establishmentId)
      .eq('client_whatsapp', cleanWhatsapp) // Buscar pelo WhatsApp limpo
      .gte('end_date', currentDate.toISOString().split('T')[0])
      .lte('start_date', currentDate.toISOString().split('T')[0])
      .single();

    if (subscriptionError || !clientSubscription) {
      return {
        hasActiveSubscription: false,
        canBook: true,
        currentUsage: 0,
        monthlyLimit: 0,
        subscriptionName: ''
      };
    }

    // 2. Contar agendamentos do cliente neste mês pelo WhatsApp
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date')
      .eq('establishment_id', establishmentId)
      .eq('client_whatsapp', cleanWhatsapp) // Buscar pelo WhatsApp limpo
      .eq('is_subscriber', true) // Apenas agendamentos como assinante
      .gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('appointment_date', lastDayOfMonth.toISOString().split('T')[0])
      .in('status', ['confirmed', 'completed', 'pending']); // Incluir pending também

    if (appointmentsError) {
      console.error('Erro ao verificar agendamentos:', appointmentsError);
      return {
        hasActiveSubscription: true,
        canBook: true, // Em caso de erro, permite agendar
        currentUsage: 0,
        monthlyLimit: (clientSubscription as any).monthly_service_limit || 999,
        subscriptionName: clientSubscription.subscriptions.name
      };
    }

    const currentUsage = appointments?.length || 0;
    // USAR o limite da client_subscriptions (definido manualmente pelo profissional)
    const monthlyLimit = (clientSubscription as any).monthly_service_limit || 999;

    // Se o limite é 999, significa sem limite
    const canBook = monthlyLimit === 999 || currentUsage < monthlyLimit;

    return {
      hasActiveSubscription: true,
      canBook,
      currentUsage,
      monthlyLimit: monthlyLimit === 999 ? 'Ilimitado' : monthlyLimit,
      subscriptionName: clientSubscription.subscriptions.name,
      subscriptionId: clientSubscription.subscription_id
    };

  } catch (error) {
    console.error('Erro ao verificar limite mensal:', error);
    return {
      hasActiveSubscription: false,
      canBook: true,
      currentUsage: 0,
      monthlyLimit: 0,
      subscriptionName: ''
    };
  }
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

// Função para normalizar número de telefone (remover formatação)
const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, ''); // Remove tudo que não é dígito
};

// Função para verificar se um WhatsApp é assinante ativo
export const checkWhatsAppSubscriber = async (whatsapp: string, establishmentId: string) => {
  try {
    // Normalizar o número de telefone (remover formatação)
    const normalizedWhatsapp = normalizePhoneNumber(whatsapp);
    console.log('🔍 MOBILE DEBUG - Verificando assinante (sistema antigo):', {
      original: whatsapp,
      normalized: normalizedWhatsapp,
      establishmentId,
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    });

    // CORREÇÃO: Verificar se o client_id existe em auth.users (evitar registros órfãos)
    // Buscar TODOS os assinantes (ativos e vencidos) para detectar vencidos
    const { data, error } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions (
          id,
          name,
          value,
          duration_months,
          weekdays,
          service_duration
        )
      `)
      .eq('establishment_id', establishmentId)
      .not('client_id', 'like', 'manual_%') // Excluir registros manuais órfãos
      .order('created_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(10000)); // Timeout de 10 segundos

    if (error) {
      console.error('Erro ao verificar assinante:', error);
      return { data: null, error };
    }

    // Buscar por número normalizado (verificar tanto client_whatsapp quanto subscriber_whatsapp)
    const subscriber = data?.find(sub => {
      const clientPhone = normalizePhoneNumber(sub.client_whatsapp || '');
      const subscriberPhone = normalizePhoneNumber(sub.subscriber_whatsapp || '');

      console.log('🔍 Comparando:', {
        clientPhone,
        subscriberPhone,
        normalizedWhatsapp,
        matchClient: clientPhone === normalizedWhatsapp,
        matchSubscriber: subscriberPhone === normalizedWhatsapp
      });

      return clientPhone === normalizedWhatsapp || subscriberPhone === normalizedWhatsapp;
    });

    if (subscriber) {
      // Verificar se o assinante está vencido
      const isExpired = (new Date(subscriber.end_date) < new Date()) ||
        subscriber.payment_status === 'unpaid';

      if (isExpired) {
        console.log('⚠️ Assinante vencido encontrado (sistema antigo):', subscriber);
        return {
          data: {
            ...subscriber,
            is_expired: true,
            expiration_message: `Seu plano venceu em ${new Date(subscriber.end_date).toLocaleDateString('pt-BR')}. Renove para continuar agendando.`
          },
          error: null
        };
      } else {
        console.log('✅ Assinante ativo encontrado (sistema antigo):', subscriber);
        return { data: subscriber, error: null };
      }
    }

    console.log('❌ Nenhum assinante encontrado para WhatsApp:', whatsapp);
    return { data: null, error: null };
  } catch (error) {
    console.error('Erro na verificação de assinante:', error);
    return { data: null, error };
  }
};

// Client Subscription functions
export const addClientSubscription = async (clientId: string, subscriptionId: string, establishmentId: string, startDate: Date, clientWhatsapp?: string) => {
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
        last_payment_date: null,
        client_whatsapp: clientWhatsapp // Salvar o WhatsApp para reconhecimento automático
      }
    ])
    .select()
    .single();
  return { data, error };
};

export const getClientSubscriptions = async (establishmentId: string, manualClients?: Record<string, any>) => {
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
  console.log('🔍 Client IDs para buscar nomes:', uniqueClientIds);

  // Filtrar apenas UUIDs válidos para a busca de agendamentos
  const validUuids = uniqueClientIds.filter(id =>
    id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  );

  console.log('🔍 UUIDs válidos para buscar:', validUuids);
  console.log('🔍 IDs manuais ignorados:', uniqueClientIds.filter(id => !validUuids.includes(id)));

  // Buscar agendamentos apenas para UUIDs válidos
  let appointments = null;
  let appointmentsError = null;
  if (validUuids.length > 0) {
    const { data: appointmentsData, error: error } = await supabase
      .from('appointments')
      .select('client_id, client_name, client_whatsapp')
      .eq('establishment_id', establishmentId)
      .in('client_id', validUuids)
      .order('created_at', { ascending: false });

    appointments = appointmentsData;
    appointmentsError = error;

    if (appointmentsError) {
      console.error('Erro ao buscar agendamentos:', appointmentsError);
    }
  }

  console.log('📅 Agendamentos encontrados:', appointments);

  if (appointmentsError) {
    console.error('Erro ao buscar agendamentos:', appointmentsError);
  }

  // Criar mapa de nomes dos agendamentos (client_id -> nome mais recente)
  const clientNamesMap = new Map();
  appointments?.forEach(apt => {
    if (apt.client_name && !clientNamesMap.has(apt.client_id)) {
      clientNamesMap.set(apt.client_id, {
        name: apt.client_name,
        whatsapp: apt.client_whatsapp
      });
    }
  });

  console.log('📋 Mapa de nomes dos clientes:', clientNamesMap);

  // Usar clientes manuais passados como parâmetro ou buscar do localStorage
  const manualClientsData = manualClients || JSON.parse(localStorage.getItem('manualClients') || '{}');
  console.log('📋 Clientes manuais disponíveis:', manualClientsData);

  // Combinar os dados das assinaturas de clientes com os nomes
  const combinedData = await Promise.all(clientSubs.map(async (cs) => {
    const clientData = clientNamesMap.get(cs.client_id);

    // Verificar se é um cliente manual
    let clientName = 'Cliente Desconhecido';
    let clientWhatsapp = 'N/A';
    let clientEmail = null;

    if (cs.client_id.startsWith('manual_')) {
      // É um cliente manual - buscar nos dados passados primeiro
      const whatsapp = cs.client_id.replace('manual_', '');
      const manualClient = manualClientsData[whatsapp];

      if (manualClient) {
        clientName = manualClient.name;
        clientWhatsapp = whatsapp;
        clientEmail = manualClient.email;
        console.log(`✅ Cliente manual encontrado no localStorage: ${clientName} (${whatsapp})`);
      } else {
        // Se não encontrou no localStorage, buscar no banco de dados
        console.log(`🔍 Cliente manual não encontrado no localStorage, buscando no banco: ${whatsapp}`);
        try {
          const { getClientNameFromDatabase, getClientWhatsappFromDatabase } = await import('../utils/databaseClientRecovery');
          const dbName = await getClientNameFromDatabase(establishmentId, cs.client_id);
          const dbWhatsapp = await getClientWhatsappFromDatabase(establishmentId, cs.client_id);

          if (dbName && dbName !== 'Cliente Desconhecido') {
            clientName = dbName;
            clientWhatsapp = dbWhatsapp || whatsapp;
            console.log(`✅ Cliente manual encontrado no banco: ${clientName} (${clientWhatsapp})`);
          } else {
            console.log(`❌ Cliente manual não encontrado no banco: ${whatsapp}`);
          }
        } catch (error) {
          console.error('Erro ao buscar cliente no banco:', error);
        }
      }
    } else {
      // É um UUID - usar dados do agendamento
      clientName = clientData?.name || 'Cliente Desconhecido';
      clientWhatsapp = clientData?.whatsapp || 'N/A';

      // Se não encontrou nome, tentar buscar no banco
      if (clientName === 'Cliente Desconhecido') {
        try {
          const { getClientNameFromDatabase, getClientWhatsappFromDatabase } = await import('../utils/databaseClientRecovery');
          const dbName = await getClientNameFromDatabase(establishmentId, cs.client_id);
          const dbWhatsapp = await getClientWhatsappFromDatabase(establishmentId, cs.client_id);

          if (dbName && dbName !== 'Cliente Desconhecido') {
            clientName = dbName;
            clientWhatsapp = dbWhatsapp || clientWhatsapp;
            console.log(`✅ Cliente UUID encontrado no banco: ${clientName} (${clientWhatsapp})`);
          }
        } catch (error) {
          console.error('Erro ao buscar cliente UUID no banco:', error);
        }
      }
    }

    console.log(`📋 Cliente ${cs.client_id}:`, {
      clientData,
      clientName,
      clientWhatsapp,
      finalName: clientName
    });

    return {
      ...cs,
      profiles: {
        full_name: clientName,
        email: clientEmail,
        is_subscriber: true // Se está na lista de assinantes, é assinante
      },
      client_whatsapp: clientWhatsapp
    };
  }));

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


// Função para verificar se um usuário é um novo cliente e buscar seus dados
export const getClientProfileData = async (userId: string) => {
  try {
    console.log('🔍 DEBUG - getClientProfileData chamada para userId:', userId);

    // Primeiro, verificar se o usuário existe na tabela profiles
    const { data: userExists, error: existsError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    console.log('🔍 DEBUG - Usuário existe?', { userExists, existsError });

    if (existsError) {
      console.error('Erro ao verificar se usuário existe:', existsError);
      return { data: null, error: existsError };
    }

    if (!userExists) {
      console.log('🔍 DEBUG - Usuário não encontrado na tabela profiles');
      return { data: null, error: { message: 'Usuário não encontrado na tabela profiles' } };
    }

    // Agora buscar os dados completos
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, whatsapp, is_new_client, name, type, is_premium')
      .eq('id', userId)
      .maybeSingle();

    console.log('🔍 DEBUG - getClientProfileData resultado:', { data, error });

    if (error) {
      console.error('Erro ao buscar dados do perfil:', error);
      return { data: null, error };
    }

    // Se não encontrou dados, retornar estrutura vazia
    if (!data) {
      console.log('🔍 DEBUG - Nenhum dado encontrado para o usuário');
      return {
        data: {
          first_name: null,
          last_name: null,
          whatsapp: null,
          is_new_client: false
        },
        error: null
      };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro ao buscar dados do perfil:', error);
    return { data: null, error };
  }
};

// Função para verificar se um usuário é um novo cliente
export const isNewClient = async (userId: string): Promise<boolean> => {
  try {
    console.log('🔍 DEBUG - isNewClient chamada para userId:', userId);

    // Primeiro, verificar se o usuário tem dados de autenticação que indicam que é novo cliente
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Erro ao buscar dados de autenticação:', authError);
    } else if (user) {
      console.log('🔍 DEBUG - Dados de autenticação do usuário:', {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
        app_metadata: user.app_metadata
      });

      // Verificar se o usuário foi criado com is_new_client = true
      if (user.user_metadata?.is_new_client === true) {
        console.log('🔍 DEBUG - Usuário identificado como novo cliente via metadata');
        return true;
      }
    }

    // Se não encontrou nos metadados, verificar na tabela profiles
    const { data, error } = await getClientProfileData(userId);
    console.log('🔍 DEBUG - isNewClient resultado:', { data, error });
    const isNew = data?.is_new_client === true;
    console.log('🔍 DEBUG - isNewClient retornando:', isNew);
    return isNew;
  } catch (error) {
    console.error('Erro ao verificar se é novo cliente:', error);
    return false;
  }
};

// Função para buscar dados do cliente dos metadados de autenticação
export const getClientDataFromAuth = async () => {
  try {
    console.log('🔍 DEBUG - Buscando dados do cliente via autenticação...');
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Erro ao buscar dados de autenticação:', error);
      return null;
    }

    if (!user) {
      console.log('🔍 DEBUG - Nenhum usuário logado');
      return null;
    }

    // Buscar dados atualizados da tabela profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', user.id)
      .single();

    if (!profileError && profileData) {
      console.log('🔍 DEBUG - Dados do perfil encontrados:', profileData);

      const clientData = {
        first_name: profileData.name || '',
        last_name: '', // Não separamos mais nome e sobrenome
        whatsapp: profileData.phone || '',
        is_new_client: false
      };

      console.log('🔍 DEBUG - Dados do cliente encontrados:', clientData);
      return clientData;
    }

    // Fallback: usar dados dos metadados de autenticação
    const clientData = {
      first_name: user.user_metadata?.name || user.email?.split('@')[0] || '',
      last_name: '',
      whatsapp: user.user_metadata?.whatsapp || '',
      is_new_client: false
    };

    console.log('🔍 DEBUG - Usando dados básicos do user_metadata:', clientData);
    return clientData;
  } catch (error) {
    console.error('Erro ao buscar dados do cliente via autenticação:', error);
    return null;
  }
};

// Função de teste para verificar se a migração foi executada
export const testMigration = async () => {
  try {
    console.log('🔍 DEBUG - Testando se a migração foi executada...');
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, whatsapp, is_new_client')
      .limit(1);

    console.log('🔍 DEBUG - Teste de migração:', { data, error });

    if (error) {
      console.log('❌ MIGRAÇÃO NÃO EXECUTADA - Erro:', error.message);
      return false;
    } else {
      console.log('✅ MIGRAÇÃO EXECUTADA - Colunas existem');
      return true;
    }
  } catch (error) {
    console.log('❌ MIGRAÇÃO NÃO EXECUTADA - Erro:', error);
    return false;
  }
};

// ========================================
// FUNÇÕES PARA GERENCIAR METAS DOS PROFISSIONAIS
// ========================================

/**
 * Define uma meta mensal para um profissional
 */
export const setProfessionalGoal = async (
  establishmentId: string,
  professionalId: string,
  goalAmount: number,
  year: number,
  month: number,
  selectedServices: string[] = []
) => {
  try {
    console.log('💾 setProfessionalGoal - Salvando meta:', {
      establishmentId,
      professionalId,
      goalAmount,
      year,
      month,
      selectedServices
    });

    const { data, error } = await supabase
      .from('professional_goals')
      .upsert({
        establishment_id: establishmentId,
        professional_id: professionalId,
        year,
        month,
        goal_amount: goalAmount,
        selected_services: selectedServices
      }, {
        onConflict: 'establishment_id,professional_id,year,month'
      })
      .select();

    if (error) {
      console.error('❌ Erro ao definir meta:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('✅ Meta definida com sucesso:', data);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Erro ao definir meta do profissional:', error);
    return { data: null, error };
  }
};

/**
 * Obtém a meta de um profissional para um mês específico
 */
export const getProfessionalGoal = async (
  establishmentId: string,
  professionalId: string,
  year: number,
  month: number
) => {
  try {
    console.log('🔍 getProfessionalGoal - Buscando meta:', { establishmentId, professionalId, year, month });

    const { data, error } = await supabase
      .from('professional_goals')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('professional_id', professionalId)
      .eq('year', year)
      .eq('month', month)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Erro ao buscar meta:', error);
      throw error;
    }

    if (error && error.code === 'PGRST116') {
      console.log('ℹ️ Nenhuma meta encontrada para este profissional');
      return { data: null, error: null };
    }

    console.log('✅ Meta encontrada:', data);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Erro ao buscar meta do profissional:', error);
    return { data: null, error };
  }
};

/**
 * Obtém os serviços selecionados para a meta de um profissional
 */
export const getProfessionalSelectedServices = async (
  establishmentId: string,
  professionalId: string,
  year: number,
  month: number
): Promise<string[]> => {
  try {
    const result = await getProfessionalGoal(establishmentId, professionalId, year, month);
    return result.data?.selected_services || [];
  } catch (error) {
    console.error('❌ Erro ao buscar serviços selecionados:', error);
    return [];
  }
};

/**
 * Obtém o progresso da meta de um profissional
 */
export const getProfessionalGoalProgress = async (
  establishmentId: string,
  professionalId: string,
  year: number,
  month: number
) => {
  try {
    console.log('🔍 getProfessionalGoalProgress chamado:', { establishmentId, professionalId, year, month });

    // Primeiro, obter o nome do profissional
    const { data: establishmentData, error: establishmentError } = await supabase
      .from('establishments')
      .select('professionals')
      .eq('id', establishmentId)
      .single();

    if (establishmentError) {
      console.error('❌ Erro ao buscar estabelecimento:', establishmentError);
      throw establishmentError;
    }

    console.log('✅ Estabelecimento encontrado:', establishmentData);

    const professional = establishmentData.professionals?.find((p: any) => p.id === professionalId);
    if (!professional) {
      console.error('❌ Profissional não encontrado:', professionalId);
      throw new Error('Profissional não encontrado');
    }

    const professionalName = professional.name;
    console.log('✅ Nome do profissional:', professionalName);

    // Buscar a meta mais recente (independente do mês)
    console.log('🔍 Buscando meta mais recente para profissional:', professionalId);

    const { data: goalData, error: goalError } = await supabase
      .from('professional_goals')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (goalError && goalError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Erro ao buscar meta:', goalError);
      throw goalError;
    }

    const goalAmount = goalData?.goal_amount || 0;
    console.log('✅ Meta encontrada (mais recente):', goalAmount, 'criada em:', goalData?.created_at);

    // Calcular serviços completados no mês
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    console.log('🔍 Buscando agendamentos entre:', startDate, 'e', endDate, 'para o mês:', month, 'ano:', year);

    // Buscar agendamentos sem filtrar por profissional primeiro
    console.log('🔍 Buscando agendamentos do estabelecimento...');

    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('status', 'completed')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate);

    if (appointmentsError) {
      console.error('❌ Erro ao buscar agendamentos:', appointmentsError);
      throw appointmentsError;
    }

    console.log('✅ Agendamentos encontrados:', appointmentsData);

    // Filtrar agendamentos do profissional específico
    let completedServices = 0;
    if (appointmentsData && appointmentsData.length > 0) {
      console.log('🔍 Estrutura do primeiro agendamento:', Object.keys(appointmentsData[0]));

      completedServices = appointmentsData.filter(appointment => {
        // Tentar diferentes campos possíveis para o nome do profissional
        const appointmentProfessional = appointment.professional ||
          appointment.professional_name ||
          appointment.service_name ||
          appointment.professional_id;

        console.log('🔍 Agendamento:', {
          id: appointment.id,
          professional: appointment.professional,
          professional_name: appointment.professional_name,
          service_name: appointment.service_name,
          professional_id: appointment.professional_id
        });

        console.log('🔍 Comparando:', {
          professionalName,
          professionalId,
          appointmentProfessional,
          appointmentProfessionalId: appointment.professional
        });

        // Comparar por UUID do profissional (que é o que está sendo usado)
        const matches = appointment.professional === professionalId;

        if (matches) {
          console.log('✅ Match encontrado!');
        }

        return matches;
      }).length;
    }

    const progressPercentage = goalAmount > 0 ? (completedServices / goalAmount) * 100 : 0;
    const remainingServices = Math.max(goalAmount - completedServices, 0);

    console.log('✅ Meta:', goalAmount, 'serviços | Completados em', year + '/' + month + ':', completedServices, '| Progresso:', progressPercentage + '%');

    return {
      data: {
        goalAmount,
        completedServices,
        progressPercentage,
        remainingServices,
        professionalName
      },
      error: null
    };
  } catch (error) {
    console.error('Erro ao calcular progresso da meta:', error);
    return {
      data: {
        goalAmount: 0,
        completedServices: 0,
        progressPercentage: 0,
        remainingServices: 0,
        professionalName: ''
      },
      error
    };
  }
};

/**
 * Remove a meta de um profissional
 */
export const removeProfessionalGoal = async (
  establishmentId: string,
  professionalId: string,
  year: number,
  month: number
) => {
  try {
    const { error } = await supabase
      .from('professional_goals')
      .delete()
      .eq('establishment_id', establishmentId)
      .eq('professional_id', professionalId)
      .eq('year', year)
      .eq('month', month);

    if (error) {
      console.error('Erro ao remover meta:', error);
      throw error;
    }

    return { error: null };
  } catch (error) {
    console.error('Erro ao remover meta do profissional:', error);
    return { error };
  }
};

/**
 * Obtém todas as metas de um estabelecimento para um mês específico
 */
export const getEstablishmentGoals = async (
  establishmentId: string,
  year: number,
  month: number
) => {
  try {
    const { data, error } = await supabase
      .from('professional_goals')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('year', year)
      .eq('month', month);

    if (error) {
      console.error('Erro ao buscar metas do estabelecimento:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro ao buscar metas do estabelecimento:', error);
    return { data: null, error };
  }
};

/**
 * Funções para gerenciar despesas do estabelecimento
 */

/**
 * Adiciona uma nova despesa
 */
export const addExpense = async (
  establishmentId: string,
  name: string,
  amount: number
) => {
  try {
    const { data, error } = await supabase
      .from('establishment_expenses')
      .insert({
        establishment_id: establishmentId,
        name: name,
        amount: amount
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar despesa:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro ao adicionar despesa:', error);
    return { data: null, error };
  }
};

/**
 * Obtém todas as despesas de um estabelecimento
 */
export const getExpenses = async (establishmentId: string) => {
  try {
    const { data, error } = await supabase
      .from('establishment_expenses')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar despesas:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar despesas:', error);
    return [];
  }
};

/**
 * Obtém despesas de um estabelecimento filtradas por mês
 */
export const getExpensesByMonth = async (establishmentId: string, startDate: string, endDate: string) => {
  try {
    const { data, error } = await supabase
      .from('establishment_expenses')
      .select('*')
      .eq('establishment_id', establishmentId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar despesas por mês:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar despesas por mês:', error);
    return [];
  }
};

/**
 * Obtém o total de despesas de um estabelecimento
 */
export const getExpensesTotal = async (establishmentId: string) => {
  try {
    const { data, error } = await supabase
      .from('establishment_expenses')
      .select('amount')
      .eq('establishment_id', establishmentId);

    if (error) {
      console.error('Erro ao calcular total de despesas:', error);
      throw error;
    }

    const total = (data || []).reduce((sum, expense) => sum + expense.amount, 0);
    return total;
  } catch (error) {
    console.error('Erro ao calcular total de despesas:', error);
    return 0;
  }
};

/**
 * Remove uma despesa
 */
export const deleteExpense = async (expenseId: string) => {
  try {
    const { error } = await supabase
      .from('establishment_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      console.error('Erro ao deletar despesa:', error);
      throw error;
    }

    return { error: null };
  } catch (error) {
    console.error('Erro ao deletar despesa:', error);
    return { error };
  }
};

// Função para atualizar o último acesso do cliente
export const updateClientLastAccess = async (clientWhatsapp: string): Promise<boolean> => {
  try {
    console.log('🕐 Atualizando último acesso para cliente:', clientWhatsapp);

    const { error } = await supabase
      .from('client_subscriptions')
      .update({ last_access_at: new Date().toISOString() })
      .eq('client_whatsapp', clientWhatsapp)
      .eq('is_active', true);

    if (error) {
      console.error('❌ Erro ao atualizar último acesso:', error);
      return false;
    }

    console.log('✅ Último acesso atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar último acesso:', error);
    return false;
  }
};

// Função para buscar o último acesso de um cliente
export const getClientLastAccess = async (clientWhatsapp: string): Promise<string | null> => {
  try {
    console.log('🕐 Buscando último acesso para cliente:', clientWhatsapp);

    const { data, error } = await supabase
      .from('client_subscriptions')
      .select('last_access_at')
      .eq('client_whatsapp', clientWhatsapp)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar último acesso:', error);
      return null;
    }

    console.log('✅ Último acesso encontrado:', data?.last_access_at);
    return data?.last_access_at || null;
  } catch (error) {
    console.error('❌ Erro ao buscar último acesso:', error);
    return null;
  }
};

// Função para buscar todos os clientes com seus últimos acessos
export const getClientsWithLastAccess = async (establishmentId: string) => {
  try {
    console.log('🕐 Buscando clientes com último acesso para estabelecimento:', establishmentId);

    const { data, error } = await supabase
      .from('client_subscriptions')
      .select(`
        id,
        client_name,
        client_whatsapp,
        last_access_at,
        created_at,
        is_active
      `)
      .eq('establishment_id', establishmentId)
      .order('last_access_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('❌ Erro ao buscar clientes com último acesso:', error);
      return [];
    }

    console.log('✅ Clientes com último acesso encontrados:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Erro ao buscar clientes com último acesso:', error);
    return [];
  }
};

// Função para atualizar o último login de um estabelecimento
export const updateEstablishmentLastLogin = async (establishmentId: string): Promise<boolean> => {
  try {
    console.log('🕐 Atualizando último login para estabelecimento:', establishmentId);

    const { error } = await supabase
      .from('establishments')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', establishmentId);

    if (error) {
      console.error('❌ Erro ao atualizar último login:', error);
      return false;
    }

    console.log('✅ Último login atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar último login:', error);
    return false;
  }
};