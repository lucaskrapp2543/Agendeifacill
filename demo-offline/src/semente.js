// ════════════════════════════════════════════════════════════════════════
// APRESENTAÇÃO OFFLINE — dados de mentira da "Barbearia Teste 2027".
// Tudo aqui é inventado e mora só dentro do aparelho. Nada vem do banco real
// e nada é enviado para ele. Telefones usam DDD 20, que não existe.
// ════════════════════════════════════════════════════════════════════════

export const EST_ID = '9174629e-42ff-4366-9320-102b9c7d861b'; // mesmo id da conta real: liga o "dia fixo"
export const OWNER_ID = 'acec0efa-58e8-43e5-8ef2-494c3cbe8016';
export const EST_CODE = '8549';
export const DIA_FIXO = '2027-12-17';

const pad = (n) => String(n).padStart(2, '0');
const uid = (grupo, n) => `d0000000-${String(grupo).padStart(4, '0')}-4000-8000-${Number(n).toString(16).padStart(12, '0')}`;
const foto = (nome) => `/demo-fotos/${nome}.webp`;

export const PROFS = [
  ['b1a7c0de-0001-4a11-8a01-2027000000a1', 'Rafael Costa', 50],
  ['b1a7c0de-0002-4a11-8a02-2027000000a2', 'Thiago Santos', 50],
  ['b1a7c0de-0003-4a11-8a03-2027000000a3', 'Bruno Almeida', 45],
  ['b1a7c0de-0004-4a11-8a04-2027000000a4', 'Diego Ferreira', 40],
];

const NOMES = ['João Pedro Silva', 'Gabriel Oliveira', 'Matheus Souza', 'Pedro Henrique Lima', 'Gustavo Pereira', 'Felipe Rodrigues', 'Leonardo Alves', 'Vinícius Gomes', 'Guilherme Ribeiro', 'Rodrigo Martins', 'André Carvalho', 'Eduardo Rocha', 'Marcelo Dias', 'Fernando Barbosa', 'Ricardo Nunes', 'Caio Mendes', 'Daniel Teixeira', 'Igor Moreira', 'Renato Cardoso', 'Samuel Correia', 'Henrique Araújo', 'Vitor Castro', 'Alexandre Pinto', 'Murilo Freitas', 'Otávio Ramos', 'Fábio Monteiro', 'Júlio César Moura', 'Leandro Batista', 'Marcos Vieira', 'Paulo Azevedo', 'Renan Cavalcanti', 'Wesley Farias', 'Yuri Campos', 'Arthur Melo', 'Bernardo Duarte', 'Enzo Nogueira', 'Heitor Santana', 'Davi Borges', 'Miguel Andrade', 'Nicolas Rezende', 'Thales Brito', 'Cauã Mendonça', 'Emanuel Reis', 'Bryan Figueiredo', 'Kaique Antunes', 'Raul Siqueira', 'Luan Peixoto', 'Jonas Tavares', 'Erick Bastos', 'Tiago Lacerda', 'Vicente Prado', 'Alan Queiroz'];
const fone = (i) => '55209' + String(88001001 + i * 137);

// chave: [nome, preço, duração]
const S = {
  A: ['Corte Degradê', 45, 30], B: ['Barba', 35, 30], C: ['Corte + Barba', 75, 60], D: ['Corte na Tesoura', 50, 30],
  E: ['Corte Infantil', 35, 30], F: ['Barba na Navalha', 45, 30], G: ['Corte + Barba + Sobrancelha', 85, 60],
  H: ['Luzes / Platinado', 120, 90], I: ['Hidratação + Escova', 40, 30],
};

const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function montarBanco() {
  const db = {};
  const dias = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const wh = {}; const bh = {};
  dias.forEach((d) => {
    const on = d !== 'sunday';
    wh[d] = { enabled: on, entry_time: '09:00', break_start: '', break_end: '', exit_time: '20:00', no_break: true };
    bh[d] = on ? { enabled: true, open1: '09:00', close1: '20:00', open2: null, close2: null } : { enabled: false, open1: null, close1: null, open2: null, close2: null };
  });

  // ── Serviços ────────────────────────────────────────────────────────────
  const plano = [
    ['CABELO', [['Corte Degradê', 45, 30], ['Corte na Tesoura', 50, 30], ['Corte Infantil', 35, 30], ['Luzes / Platinado', 120, 90]]],
    ['BARBA', [['Barba', 35, 30], ['Barba na Navalha', 45, 30]]],
    ['COMBOS', [['Corte + Barba', 75, 60], ['Corte + Barba + Sobrancelha', 85, 60]]],
    ['ACABAMENTO', [['Sobrancelha', 15, 15], ['Pezinho', 20, 15], ['Hidratação + Escova', 40, 30]]],
  ];
  db.service_categories = []; db.service_subcategories = [];
  let ns = 0;
  plano.forEach(([nome, servs], c) => {
    const catId = uid(1, c + 1);
    db.service_categories.push({ id: catId, establishment_id: EST_ID, name: nome, is_active: true, display_order: c, show_for_subscriber_extra: false, excluded_professional_ids: null, created_at: '2026-11-18T17:20:00+00:00' });
    servs.forEach(([n, preco, dur], i) => {
      ns += 1;
      db.service_subcategories.push({ id: uid(2, ns), category_id: catId, name: n, price: preco, duration: dur, loyalty_points: 0, is_active: true, display_order: i, image_url: foto('servico_' + ns), booking_weekdays: null, created_at: '2026-11-18T17:20:00+00:00' });
    });
  });

  // ── Produtos ────────────────────────────────────────────────────────────
  db.establishment_products = [['Pomada Modeladora', 35, 15, 24], ['Óleo para Barba', 40, 18, 18], ['Kit Barba Completo', 89, 45, 10], ['Kit Barbear (Navalha + Pincel)', 120, 60, 6]]
    .map(([name, venda, custo, estoque], i) => ({ id: uid(3, i + 1), establishment_id: EST_ID, name, sale_price: venda, cost_price: custo, stock_quantity: estoque, sold_quantity: 0, image_url: foto('produto_' + (i + 1)), created_at: '2026-11-18T17:21:00+00:00' }));

  // ── Barbearia ───────────────────────────────────────────────────────────
  const professionals = PROFS.map(([id, name, percentage], i) => ({ id, name, specialties: [], percentage, whatsapp: '', specific_services: [], photo_url: foto('prof_' + (i + 1)), work_hours: JSON.parse(JSON.stringify(wh)) }));
  db.establishments = [{
    id: EST_ID, created_at: '2026-01-10T12:00:00+00:00', updated_at: '2026-11-18T17:28:51+00:00', name: 'Barbearia Teste 2027', code: EST_CODE, owner_id: OWNER_ID,
    description: 'Corte, barba e estilo. Agende seu horário em poucos cliques.', services: [],
    business_hours: bh, professionals, professionals_pins: PROFS.map(([id]) => ({ professional_id: id, pin: '0000' })),
    services_with_prices: db.service_subcategories.map((x) => ({ id: x.id, name: x.name, price: x.price, duration: x.duration })),
    logo_url: foto('logo'), profile_image_url: null, custom_photo_1_url: foto('loja_1'), custom_photo_2_url: foto('loja_2'), custom_photo_3_url: foto('loja_3'),
    custom_photo_4_url: null, custom_photo_5_url: null, custom_photo_6_url: null, custom_photo_7_url: null,
    whatsapp: '20988000000', pin_password: null, affiliate_link: null, review_link: null, social_media_link: null, pix_payment_link: null, location_link: null, wifi_password: null,
    is_test: false, has_wifi: true, has_parking: true, has_accessibility: false, has_air_conditioning: true, wifi_network_name: '',
    payment_status: 'paid', plan_type: 'monthly', payment_due_date: '2035-01-01T12:00:00+00:00', payment_paid_at: '2026-11-18T12:00:00+00:00', is_deleted: false, is_blocked: false,
    card_tax_percentage: 2.5, credit_card_tax_percentage: 3.5, debit_card_tax_percentage: 2.5,
    card_brand_taxes: { elo: 3, jcb: 3.5, visa: 3.5, outros: 3.5, discover: 3.5, hipercard: 3, mastercard: 3.5, american_express: 4 },
    use_15_minute_interval: false, use_20_minute_schedule: false, use_60_minute_schedule: false, show_best_of_brazil_image: true,
    limit_subscriber_bookings: false, colaboradores_enabled: false, colaboradores_percentage: 40, carousel_position: 'below', professional_metas: {},
    require_cancellation_request: false, limit_subscribers_one_week: false, prevent_same_day_reschedule: false,
    payment_methods_enabled: ['pix', 'credito', 'debito', 'dinheiro', 'pagar_local'],
    last_login_at: '2026-11-18T17:28:51+00:00', enable_whatsapp_notifications: false, payment_alert_enabled: false, promotion_enabled: false,
    onboarding_step: 4, quiz_completed: true, booking_blocked: false,
    exigir_pagamento_antecipado: false, pagamento_adiantado_liberado_admin: false, pagamento_adiantado_opcional: false, use_pagarme_subscription_pix: false,
    admin_profit_value: 0, tax_deducted_by_establishment: false, exigir_pagamento_antecipado_mercadopago: false, pagamento_adiantado_opcional_mercadopago: false,
    use_mercadopago_subscription_pix: false, plan_prata_active: false, fila_espera_ativa: false, fila_espera_fechada: false, show_subscriptions_fullpage: false,
    deleted_professionals: [], second_unit_booking_code: '', booking_min_advance_hours: 0, closed_time_enabled: false, hide_from_top10_ranking: true,
    limit_client_pending_booking: false, hide_booking_reviews: false, booking_min_advance_minutes: 0, booking_chat_enabled: true, custom_amenities: [],
    booking_simple_page_enabled: false, stripe_connect_details_submitted: false, stripe_charges_enabled: false, stripe_payouts_enabled: false, use_stripe_subscription: false,
    booking_min_cancel_minutes: 180, skip_client_whatsapp_booking_nudge: false, auto_complete_services_enabled: true, client_afcoins_enabled: false,
    daily_morning_message_enabled: false, cobrar_taxa_maquininha_cliente: false, advance_payment_percentage: 100, continuous_subscription_enabled: false,
    has_mercadopago: false, online_payment_blocked_by_admin: true, no_show_policy_enabled: false, no_show_policy: 'retain_50',
    hide_client_phone_for_professionals: false, booking_chat_show_slots: false,
  }];

  // ── Clientes, planos e assinantes ───────────────────────────────────────
  db.manual_clients = NOMES.map((name, i) => ({
    id: uid(4, i + 1), establishment_id: EST_ID, name, whatsapp: fone(i), cpf: null, street: null,
    birthday: i % 3 === 0 ? `${1985 + (i % 15)}-${pad(1 + (i % 12))}-${pad(3 + (i % 25))}` : null,
    created_at: '2026-11-18T17:22:00+00:00', updated_at: '2026-11-18T17:22:00+00:00',
  }));
  const diasPlano = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const PL1 = uid(5, 1); const PL2 = uid(5, 2);
  const mkPlano = (id, name, value, dur, comissao, desc, ordem) => ({ id, establishment_id: EST_ID, name, value, duration_months: 1, weekdays: diasPlano, service_duration: dur, fixed_commission_value: comissao, description: desc, divide_total_enabled: false, divide_total_attendances: null, divide_services_enabled: false, divided_services: null, label_color: null, payment_pix_enabled: true, payment_card_enabled: true, sort_order: ordem, is_active: true, created_at: '2026-11-18T17:23:00+00:00' });
  db.subscriptions = [mkPlano(PL1, 'Clube do Corte', 89.9, 30, 15, 'Cortes à vontade durante o mês.', 0), mkPlano(PL2, 'Clube Corte + Barba', 139.9, 60, 25, 'Corte e barba à vontade durante o mês.', 1)];
  const assin = [[0, PL1, 'paid', 0, 'pix'], [1, PL1, 'paid', 1, 'credito'], [2, PL2, 'paid', 2, 'pix'], [3, PL2, 'paid', 3, 'pix'], [4, PL1, 'paid', 0, 'dinheiro'], [5, PL1, 'unpaid', 1, 'pix'], [6, PL2, 'paid', 2, 'credito'], [7, PL1, 'unpaid', 3, 'pix']];
  db.client_subscriptions = assin.map(([i, pl, st, pi, forma], n) => ({
    id: uid(6, n + 1), client_id: uid(7, n + 1), subscription_id: pl, establishment_id: EST_ID, start_date: '2026-11-01', end_date: '2028-01-01',
    payment_status: st, last_payment_date: st === 'paid' ? '2026-11-01' : null, subscriber_name: NOMES[i], subscriber_whatsapp: fone(i).slice(2), subscriber_email: null,
    subscriber_payment_method: forma, subscriber_observation: null, subscriber_professional_id: PROFS[pi][0], subscriber_professional_name: PROFS[pi][1], subscriber_professional_ids: null,
    deactivated_at: null, archived_at: null, custom_subscription_value: null, created_at: '2026-11-01T12:00:00+00:00',
  }));
  const subPorIndice = {}; db.client_subscriptions.forEach((x, n) => { subPorIndice[assin[n][0]] = x; });

  // ── Agendamentos ────────────────────────────────────────────────────────
  db.appointments = []; db.subscriber_attendances = [];
  let na = 0;
  const novoAg = (o) => {
    na += 1;
    const row = {
      id: uid(8, na), client_id: OWNER_ID, establishment_id: EST_ID, is_avulso: false, is_establishment_booking: true, is_loyalty_reward: false, loyalty_points_awarded: 0,
      card_brand: null, subscription_id: null, is_subscriber: false, is_premium: false, is_squeeze: false, is_waitlist: false, is_child_service: false,
      additional_products: null, observation: null, establishment_observation: null, payment_status: null, pix_payment_status: null, payment_transaction_id: null,
      payment_split_details: null, professional_tip_amount: null, cancellation_source: null, cancellation_detail: null, coupon_code: null, client_cpf: null,
      subscriber_service_id: null, subscriber_service_name: null, subscriber_service_limit: null, booking_source: null, manual_status_override: null,
      ...o, total_price: o.price,
    };
    db.appointments.push(row);
    return row;
  };

  // Histórico concluído: novembro/2026 até 16/12/2027 (mesma receita usada na conta real).
  const pool = [['A', 30], ['C', 22], ['B', 12], ['D', 10], ['E', 6], ['F', 6], ['G', 6], ['I', 4], ['H', 4]];
  let nu = 0;
  for (let y = 2026, m = 11, i = 0; y < 2027 || (y === 2027 && m <= 12); i += 1) {
    const chave = `${y}-${pad(m)}`;
    const dez = y === 2027 && m === 12;
    const ultimo = dez ? 16 : new Date(y, m, 0).getDate();
    const rng = mulberry(y * 100 + m);
    const pBase = dez ? 0.36 : 0.14 + 0.10 * (i / 12);
    for (let d = 1; d <= ultimo; d += 1) {
      const wd = new Date(y, m - 1, d).getDay();
      if (wd === 0) continue;
      const data = `${chave}-${pad(d)}`;
      const usados = new Set();
      const criado = new Date(Date.UTC(y, m - 1, d, 12, 0, 0) - 2 * 86400000).toISOString();
      for (let pi = 0; pi < 4; pi += 1) {
        let t = 540;
        while (t < 1200) {
          let p = pBase + (wd === 6 ? 0.12 : 0);
          if (t >= 720 && t < 780) p *= 0.35;
          if (rng() >= p) { t += 30; continue; }
          let sub = null; let sk = null;
          if (rng() < 0.07) { const si = Math.floor(rng() * 8); if (!usados.has(si)) { const reg = subPorIndice[si]; sub = { i: si, reg }; sk = reg.subscription_id === PL2 ? 'C' : 'A'; } }
          if (!sk) {
            const cabem = pool.filter(([k]) => t + S[k][2] <= 1200);
            const tot = cabem.reduce((a, b) => a + b[1], 0);
            let r = rng() * tot;
            for (const [k, w] of cabem) { r -= w; if (r <= 0) { sk = k; break; } }
            if (!sk) sk = cabem[0][0];
          }
          const [serv, preco, dur] = S[sk];
          if (t + dur > 1200) { t += 30; continue; }
          let ci;
          if (sub) ci = sub.i;
          else { let tent = 0; do { ci = 8 + Math.floor(rng() * 44); tent += 1; } while (usados.has(ci) && tent < 8); if (usados.has(ci)) { t += 30; continue; } }
          usados.add(ci);
          let forma = 'assinante'; let bandeira = null;
          if (!sub) {
            const r = rng();
            if (r < 0.45) forma = 'pix';
            else if (r < 0.65) { forma = 'credito'; bandeira = ['visa', 'mastercard', 'elo'][Math.floor(rng() * 3)]; }
            else if (r < 0.80) { forma = 'debito'; bandeira = ['visa', 'mastercard', 'elo'][Math.floor(rng() * 3)]; }
            else forma = 'dinheiro';
          }
          const ag = novoAg({ professional: PROFS[pi][0], service: serv, client_name: NOMES[ci], client_whatsapp: fone(ci), appointment_date: data, appointment_time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, status: 'completed', price: preco, duration: dur, payment_method: forma, card_brand: bandeira, is_subscriber: !!sub, subscription_id: sub ? sub.reg.subscription_id : null, created_at: criado });
          if (sub) {
            nu += 1;
            db.subscriber_attendances.push({ id: uid(9, nu), establishment_id: EST_ID, client_subscription_id: sub.reg.id, professional_name: PROFS[pi][1], professional_id: PROFS[pi][0], attendance_date: data, repass_value: sub.reg.subscription_id === PL2 ? 25 : 15, appointment_id: ag.id, created_by: OWNER_ID, created_at: criado });
          }
          t += dur;
        }
      }
    }
    m += 1; if (m > 12) { m = 1; y += 1; }
  }

  // O dia fixo da apresentação: manhã já atendida, tarde marcada, com horários livres.
  const agenda = [
    [0, '09:00', 'A', 8], [0, '09:30', 'C', 9], [0, '10:30', 'D', 10], [0, '11:00', 'B', 11], [0, '13:00', 'G', 12], [0, '14:00', 'A', 13], [0, '14:30', 'A', 0, PL1], [0, '15:30', 'C', 14], [0, '16:30', 'F', 15], [0, '17:00', 'A', 16], [0, '18:00', 'C', 17], [0, '19:00', 'A', 18],
    [1, '09:30', 'A', 19], [1, '10:00', 'A', 20], [1, '10:30', 'C', 21], [1, '11:30', 'E', 22], [1, '13:00', 'A', 23], [1, '13:30', 'B', 24], [1, '14:00', 'H', 25], [1, '15:30', 'A', 1, PL1], [1, '16:30', 'D', 26], [1, '17:00', 'C', 27], [1, '18:00', 'A', 28], [1, '18:30', 'B', 29], [1, '19:30', 'A', 30],
    [2, '09:00', 'C', 31], [2, '10:00', 'A', 32], [2, '11:00', 'F', 33], [2, '11:30', 'A', 34], [2, '13:00', 'E', 35], [2, '13:30', 'C', 2, PL2], [2, '14:30', 'A', 36], [2, '15:00', 'I', 37], [2, '16:00', 'A', 38], [2, '16:30', 'G', 39], [2, '17:30', 'A', 40], [2, '18:30', 'C', 41],
    [3, '09:00', 'A', 42], [3, '10:00', 'D', 43], [3, '10:30', 'B', 44], [3, '11:00', 'C', 45], [3, '13:30', 'A', 46], [3, '14:00', 'A', 47], [3, '14:30', 'F', 48], [3, '15:00', 'C', 3, PL2], [3, '16:30', 'A', 49], [3, '17:00', 'E', 50], [3, '17:30', 'B', 51], [3, '18:00', 'A', 4, PL1], [3, '19:00', 'C', 6, PL2],
  ];
  const pagos = [['pix', null], ['dinheiro', null], ['credito', 'visa'], ['pix', null], ['debito', 'mastercard'], ['pix', null], ['dinheiro', null], ['credito', 'elo']];
  let k = 0;
  agenda.forEach(([pi, hora, sk, ci, pl], n) => {
    const [serv, preco, dur] = S[sk];
    const manha = hora < '12:00';
    let forma = 'dinheiro'; let bandeira = null; let status = 'confirmed';
    if (pl) forma = 'assinante';
    else if (manha) { status = 'completed'; [forma, bandeira] = pagos[k % pagos.length]; k += 1; }
    novoAg({ professional: PROFS[pi][0], service: serv, client_name: NOMES[ci], client_whatsapp: fone(ci), appointment_date: DIA_FIXO, appointment_time: hora, status, price: preco, duration: dur, payment_method: forma, card_brand: bandeira, is_subscriber: !!pl, subscription_id: pl || null, created_at: `2026-11-${pad(10 + (n % 7))}T1${n % 9}:${pad((n * 7) % 60)}:00+00:00` });
  });

  db.establishment_notifications = [];
  return db;
}
