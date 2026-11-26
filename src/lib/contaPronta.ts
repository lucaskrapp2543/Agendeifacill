/**
 * CONTA PRONTA — pedido do Lucas em 25/11/2026.
 *
 * Toda conta NOVA (criada pelo cliente depois de pagar, ou pelo admin) já nasce
 * preenchida, sem passo a passo obrigatório: serviços com preço, 2 profissionais,
 * horário com intervalo de almoço, logo e fotos de capa de exemplo. Sem senha de
 * 4 dígitos (o dono cria depois, se quiser). Sem assinaturas cadastradas.
 *
 * O dono troca tudo depois, do jeito dele. Nada aqui mexe em conta que já existe:
 * estas funções só são chamadas na HORA de criar a barbearia.
 *
 * Usado por: cadastro pago do site (Mercado Pago), cadastro da Cakto (/cadastrar)
 * e criação de conta pelo admin (NewRegistrations).
 *
 * Imagens em public/conta-pronta/:
 *  - logo-padrao.webp: desenhada por nós (sem direito autoral de terceiros).
 *  - capa-1..3.webp: fotos da Unsplash com licença livre para uso comercial
 *    (ids 1792523227995-9ac04cf1d94d, 1792735207211-a96ca7e6ea77, 1781455793310-8427c96454c7).
 */

const SITE = 'https://agendeifacil.com';

export const CONTA_PRONTA_IMAGENS = {
  logo: `${SITE}/conta-pronta/logo-padrao.webp`,
  capas: [`${SITE}/conta-pronta/capa-1.webp`, `${SITE}/conta-pronta/capa-2.webp`, `${SITE}/conta-pronta/capa-3.webp`],
} as const;

const DIAS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/** Horário padrão: segunda a sábado, 09:00–12:00 e 13:00–19:00 (almoço ao meio-dia). Domingo fechado. */
const ABRE = '09:00';
const ALMOCO_INICIO = '12:00';
const ALMOCO_FIM = '13:00';
const FECHA = '19:00';

/** Serviços padrão, por categoria. Preços de referência: o dono ajusta em "Serviços e preços". */
const CATEGORIAS_PADRAO: Array<{ name: string; servicos: Array<{ name: string; price: number; duration: number }> }> = [
  {
    name: 'CABELO',
    servicos: [
      { name: 'Corte de cabelo', price: 40, duration: 30 },
      { name: 'Corte infantil', price: 35, duration: 30 },
    ],
  },
  {
    name: 'BARBA',
    servicos: [{ name: 'Barba', price: 30, duration: 30 }],
  },
  {
    name: 'COMBOS',
    servicos: [{ name: 'Corte + Barba', price: 65, duration: 60 }],
  },
  {
    name: 'ACABAMENTO',
    servicos: [
      { name: 'Sobrancelha', price: 15, duration: 15 },
      { name: 'Pezinho', price: 15, duration: 15 },
    ],
  },
];

/** UUID v4. Usa o gerador do sistema quando existe; senão, um equivalente simples. */
export function novoIdContaPronta(): string {
  const c = (globalThis as any)?.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

function horarioDaBarbearia() {
  const horarios: Record<string, { enabled: boolean; open1: string | null; close1: string | null; open2: string | null; close2: string | null }> = {};
  for (const dia of DIAS) {
    horarios[dia] =
      dia === 'sunday'
        ? { enabled: false, open1: null, close1: null, open2: null, close2: null }
        : { enabled: true, open1: ABRE, close1: ALMOCO_INICIO, open2: ALMOCO_FIM, close2: FECHA };
  }
  return horarios;
}

/** Mesmo formato que o painel grava quando o horário do profissional segue o da barbearia. */
function horarioDoProfissional() {
  const horarios: Record<string, { enabled: boolean; entry_time: string; break_start: string; break_end: string; exit_time: string; no_break: boolean }> = {};
  for (const dia of DIAS) {
    horarios[dia] = {
      enabled: dia !== 'sunday',
      entry_time: ABRE,
      break_start: ALMOCO_INICIO,
      break_end: ALMOCO_FIM,
      exit_time: FECHA,
      no_break: false,
    };
  }
  return horarios;
}

export interface ContaPronta {
  /** Campos para espalhar no INSERT da tabela establishments. */
  camposDaBarbearia: Record<string, unknown>;
  /** Categorias e serviços para gravar DEPOIS que a barbearia existir (precisam do id dela). */
  categorias: Array<{
    name: string;
    display_order: number;
    servicos: Array<{ id: string; name: string; price: number; duration: number; display_order: number }>;
  }>;
}

/**
 * Monta a conta pronta. Plano Prata só permite 1 profissional (regra que já existe no painel).
 */
export function montarContaPronta(opcoes?: { planoPrata?: boolean }): ContaPronta {
  const quantosProfissionais = opcoes?.planoPrata ? 1 : 2;

  const profissionais = Array.from({ length: quantosProfissionais }, (_, i) => ({
    id: novoIdContaPronta(),
    name: `Profissional ${i + 1}`,
    specialties: [],
    // Mesmo padrão que o painel usa ao adicionar um profissional novo.
    percentage: 100,
    whatsapp: '',
    specific_services: [],
    work_hours: horarioDoProfissional(),
  }));

  const categorias = CATEGORIAS_PADRAO.map((categoria, ordemCategoria) => ({
    name: categoria.name,
    display_order: ordemCategoria,
    servicos: categoria.servicos.map((servico, ordemServico) => ({
      id: novoIdContaPronta(),
      name: servico.name,
      price: servico.price,
      duration: servico.duration,
      display_order: ordemServico,
    })),
  }));

  // Lista espelho que o sistema mantém na própria barbearia (mesmos ids dos serviços).
  const servicosEspelho = categorias.flatMap((c) =>
    c.servicos.map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration }))
  );

  return {
    camposDaBarbearia: {
      business_hours: horarioDaBarbearia(),
      services_with_prices: servicosEspelho,
      professionals: profissionais,
      // '0000' = sem senha (é assim que o painel cria cada profissional).
      professionals_pins: profissionais.map((p) => ({ professional_id: p.id, pin: '0000' })),
      logo_url: CONTA_PRONTA_IMAGENS.logo,
      custom_photo_1_url: CONTA_PRONTA_IMAGENS.capas[0],
      custom_photo_2_url: CONTA_PRONTA_IMAGENS.capas[1],
      custom_photo_3_url: CONTA_PRONTA_IMAGENS.capas[2],
      // Sem senha de 4 dígitos: o dono cria depois, se quiser.
      pin_password: null,
      // Conta pronta não passa pelo passo a passo nem pelo quiz de boas-vindas.
      onboarding_step: 4,
      quiz_completed: true,
    },
    categorias,
  };
}

/**
 * Grava as categorias e os serviços da conta pronta. NUNCA lança erro: se algo falhar,
 * a conta continua criada (os serviços ainda aparecem pela lista espelho) e o erro volta no retorno.
 */
export async function gravarServicosDaContaPronta(
  supabase: any,
  establishmentId: string,
  conta: ContaPronta
): Promise<{ ok: boolean; erro?: string }> {
  try {
    for (const categoria of conta.categorias) {
      const { data: criada, error: categoriaError } = await supabase
        .from('service_categories')
        .insert({
          establishment_id: establishmentId,
          name: categoria.name,
          is_active: true,
          display_order: categoria.display_order,
        })
        .select('id')
        .single();
      if (categoriaError || !criada?.id) {
        return { ok: false, erro: `categoria ${categoria.name}: ${categoriaError?.message || 'sem id'}` };
      }

      const { error: servicosError } = await supabase.from('service_subcategories').insert(
        categoria.servicos.map((servico) => ({
          id: servico.id,
          category_id: criada.id,
          name: servico.name,
          price: servico.price,
          duration: servico.duration,
          is_active: true,
          display_order: servico.display_order,
        }))
      );
      if (servicosError) {
        return { ok: false, erro: `serviços de ${categoria.name}: ${servicosError.message}` };
      }
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, erro: String(error?.message || error) };
  }
}
