import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;

  // Para bases pequenas/médias, listUsers resolve. Limita para não ficar infinito.
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u) => String(u.email || '').trim().toLowerCase() === target);
    if (found?.id) return found.id;
    if (users.length < perPage) break;
  }
  return null;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, { error: 'Supabase admin não configurado' });
    }

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = String(authHeader).toLowerCase().startsWith('bearer ')
      ? String(authHeader).slice(7).trim()
      : '';

    if (!token) {
      return json(401, { error: 'Token ausente' });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return json(401, { error: 'Token inválido' });
    }

    const requesterEmail = String(authData.user.email || '').toLowerCase();
    if (requesterEmail !== 'suporteagendeifacil@gmail.com') {
      return json(403, { error: 'Not allowed' });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const registrationId = String(body?.registrationId || '').trim();
    const mode = String(body?.mode || 'create').trim().toLowerCase(); // create | repair
    if (!registrationId) {
      return json(400, { error: 'registrationId é obrigatório' });
    }
    if (mode !== 'create' && mode !== 'repair') {
      return json(400, { error: 'mode inválido (use create|repair)' });
    }

    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registration_forms')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regErr || !reg) {
      return json(404, { error: 'Inscrição não encontrada' });
    }

    const email = String((reg as any)?.email || '').trim().toLowerCase();
    const password = String((reg as any)?.password || '').trim();
    const clientName = String((reg as any)?.client_name || '').trim();
    const establishmentName = String((reg as any)?.establishment_name || '').trim();
    const clientWhatsapp = String((reg as any)?.client_whatsapp || '').trim();

    if (!email || !password || !establishmentName) {
      return json(400, { error: 'Dados incompletos na inscrição (email/senha/estabelecimento)' });
    }

    // 1) Criar (ou recuperar) usuário no Auth
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'establishment',
        full_name: clientName,
        establishment_name: establishmentName,
      },
    });

    if (createErr) {
      // Se já existe, tentar achar e atualizar senha/confirm
      userId = await findUserIdByEmail(email);
      if (!userId) {
        return json(400, { error: 'Erro ao criar usuário', details: String((createErr as any)?.message || createErr) });
      }
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          role: 'establishment',
          full_name: clientName,
          establishment_name: establishmentName,
        },
      });
      if (updErr) {
        return json(400, { error: 'Erro ao atualizar usuário existente', details: String((updErr as any)?.message || updErr) });
      }
    } else {
      userId = created?.user?.id || null;
    }

    if (!userId) {
      return json(500, { error: 'Falha ao obter userId' });
    }

    // 2) Garantir estabelecimento (NÃO duplicar).
    // - Se já existir algum establishment para este owner_id: reaproveitar (não cria outro, não muda código).
    // - Se mode=repair e não existir: NÃO cria (retorna erro explicando).
    const { data: existingEsts, error: existingErr } = await supabaseAdmin
      .from('establishments')
      .select('id, code, is_deleted')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (existingErr) {
      console.error('Erro ao checar estabelecimentos existentes:', existingErr);
      return json(500, { error: 'Erro ao checar estabelecimentos existentes' });
    }

    const activeExisting = (existingEsts || []).find((e: any) => e?.code && !e?.is_deleted) as any;
    if (activeExisting?.code) {
      const establishmentCode = String(activeExisting.code || '').trim();

      await supabaseAdmin
        .from('registration_forms')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: authData.user.id,
          notes:
            mode === 'repair'
              ? `Login reparado (senha redefinida/confirmado). Código existente: ${establishmentCode}. Email: ${email}.`
              : `Conta criada automaticamente. Código existente: ${establishmentCode}. Email: ${email}. O usuário pode fazer login imediatamente.`,
        })
        .eq('id', registrationId);

      return json(200, { ok: true, userId, establishmentCode, reused: true, mode });
    }

    if (mode === 'repair') {
      // Segurança: reparar login não cria estabelecimento. Só reseta senha/confirma.
      return json(400, {
        error:
          'Não encontrei nenhum estabelecimento existente para este e-mail. REPARAR LOGIN só redefine senha/confirma e-mail (não cria outro). Use CRIAR CONTA se precisar criar.',
      });
    }

    // 2b) Criar estabelecimento (não existe nenhum ainda para esse owner_id)
    let establishmentCode = '';
    let lastInsertError: any = null;

    for (let attempt = 1; attempt <= 10; attempt++) {
      establishmentCode = Math.floor(1000 + Math.random() * 9000).toString();
      const { error: establishmentError } = await supabaseAdmin.from('establishments').insert({
        name: establishmentName,
        code: establishmentCode,
        description: `Estabelecimento criado automaticamente para ${clientName}`,
        owner_id: userId,
        business_hours: {
          monday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
          tuesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
          wednesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
          thursday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
          friday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
          saturday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
          sunday: { enabled: false, open1: null, close1: null, open2: null, close2: null },
        },
        services_with_prices: [],
        professionals: [],
        profile_image_url: null,
        affiliate_link: null,
        custom_photo_1_url: null,
        custom_photo_2_url: null,
        custom_photo_3_url: null,
        custom_photo_4_url: null,
        custom_photo_5_url: null,
        custom_photo_6_url: null,
        custom_photo_7_url: null,
        carousel_position: 'below',
        has_wifi: false,
        has_parking: false,
        has_accessibility: false,
        wifi_password: null,
        pin_password: null,
        professionals_pins: [],
        whatsapp: clientWhatsapp || null,
        payment_status: 'unpaid',
        plan_type: 'monthly',
        payment_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_deleted: false,
        is_blocked: false,
        onboarding_step: 1,
      } as any);

      if (!establishmentError) {
        lastInsertError = null;
        break;
      }

      lastInsertError = establishmentError;
      // 23505 geralmente é unique violation (ex: code duplicado)
      const code = String((establishmentError as any)?.code || '');
      if (code !== '23505') break;
    }

    if (lastInsertError) {
      return json(400, { error: 'Erro ao criar estabelecimento', details: String((lastInsertError as any)?.message || lastInsertError) });
    }

    // 3) Marcar inscrição como aprovada
    await supabaseAdmin
      .from('registration_forms')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: authData.user.id,
        notes:
          mode === 'repair'
            ? `Login reparado (senha redefinida/confirmado). Código: ${establishmentCode}. Email: ${email}.`
            : `Conta criada automaticamente. Código: ${establishmentCode}. Email: ${email}. O usuário pode fazer login imediatamente.`,
      })
      .eq('id', registrationId);

    return json(200, { ok: true, userId, establishmentCode, reused: false, mode });
  } catch (e: any) {
    console.error('admin-create-establishment error:', e);
    return json(500, { error: 'Erro interno', details: String(e?.message || e) });
  }
};

