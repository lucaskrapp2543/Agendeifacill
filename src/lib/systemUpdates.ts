/**
 * "🆕 Atualizações e novidades" (tela Fazer pedidos) — o que mudou no sistema, para todos os
 * estabelecimentos. A mais nova fica no TOPO. Para publicar uma nova: acrescentar no começo
 * da lista com um id novo (texto simples, para o barbeiro entender).
 */
export type SystemUpdateKind = 'novidade' | 'melhoria' | 'correcao';

export interface SystemUpdate {
  /** Único e crescente (usado para marcar "NOVO" para quem ainda não viu). */
  id: number;
  /** dd/mm/aaaa */
  date: string;
  kind: SystemUpdateKind;
  title: string;
  /** Uma ou duas linhas que aparecem sem abrir. */
  summary: string;
  /** Veio de um pedido feito em "Fazer pedidos". */
  fromClientRequest?: boolean;
  /** "Veja como funciona": blocos com título opcional. */
  details: Array<{ title?: string; text: string }>;
}

export const SYSTEM_UPDATE_KIND_LABEL: Record<SystemUpdateKind, string> = {
  novidade: '✨ Novidade',
  melhoria: '⚡ Melhoria',
  correcao: '🛠️ Correção de bug',
};

export const SYSTEM_UPDATES: SystemUpdate[] = [
  {
    id: 15,
    date: '16/10/2026',
    kind: 'novidade',
    fromClientRequest: true,
    title: '👀 Ver vagas: seu cliente vê os horários livres antes de agendar',
    summary: 'O cliente vê na hora as vagas livres de hoje (e dos próximos dias) e agenda em poucos toques, sem escolher serviço e profissional antes.',
    details: [
      { title: 'Como ativar', text: 'Configurações → Preferências e Aplicações → 👀 Ver vagas → marque "Mostrar botão Ver vagas". Salva na hora.' },
      {
        title: 'Como fica para o cliente',
        text: 'Aparece o botão "👀 Ver vagas" em todas as suas páginas de agendamento (a página normal, o chat e a página simples). Ele toca e já vê os horários livres de hoje em verde. Se quiser outro dia, é só tocar em "Ver amanhã", e vai abrindo dia por dia.',
      },
      {
        text: 'Ele toca no horário, escolhe o serviço e o profissional (só aparecem os que estão livres naquele horário), coloca nome e WhatsApp e confirma. Rapidinho!',
      },
      {
        title: 'E se o serviço não couber?',
        text: 'Se o serviço for mais demorado que a vaga (ex.: corte e barba de 1h numa vaga de 30 min), o sistema avisa e mostra os horários do dia em que ele cabe. Nunca marca um horário em cima do outro.',
      },
    ],
  },
  {
    id: 14,
    date: '16/10/2026',
    kind: 'novidade',
    title: '💵 Pagar no dinheiro com troco',
    summary: 'Na hora de agendar, o cliente pode escolher "Pagar no dinheiro (papel)" e dizer para quanto precisa de troco.',
    details: [
      {
        title: 'Como funciona',
        text: 'Junto com PIX e cartão aparece "💵 Pagar no dinheiro (papel)". O cliente escolhe, diz "troco pra quanto" (R$ 20, 50, 100… ou outro valor) e confirma. No final aparece: "Você vai pagar R$ X no local. Seu troco será R$ Y".',
      },
      { title: 'Para você', text: 'O agendamento entra como "pagar no local" e o troco aparece em "Obs. Cliente" no atendimento, para você já separar o troco.' },
      { title: 'Quando aparece', text: 'Nas páginas de agendamento, quando o pagamento online é opcional (o cliente pode escolher pagar online ou no local).' },
    ],
  },
  {
    id: 13,
    date: '16/10/2026',
    kind: 'novidade',
    fromClientRequest: true,
    title: '💬 Mensagem de confirmação também quando VOCÊ agenda o cliente',
    summary: 'Agora dá para o cliente receber no WhatsApp a mensagem com o resumo do agendamento quando você marca por ele no "Reservar Cliente".',
    details: [
      {
        title: 'Como ativar',
        text: 'Menu Admin → Lembretes para Clientes → confira se o WhatsApp está conectado e a "mensagem de saudação" ligada → marque "Mandar também quando EU agendo o cliente (Reservar Cliente)". Salva na hora.',
      },
      { text: 'Encaixe e venda avulsa não mandam mensagem. Na reserva recorrente do mês vai uma mensagem só (não uma por semana).' },
    ],
  },
  {
    id: 12,
    date: '16/10/2026',
    kind: 'novidade',
    fromClientRequest: true,
    title: '📅 Vencimento do assinante na agenda + "Próximos a vencer"',
    summary: 'No agendamento de assinante aparece a data de vencimento do plano, e em Meus Assinantes você ordena pelos que vencem primeiro.',
    details: [
      { title: 'Na agenda', text: 'No cartão do cliente assinante aparece "📅 Vence dd/mm/aaaa" (vermelho com "Venceu" quando já passou). Assim você vê na hora quem precisa renovar.' },
      { title: 'Em Meus Assinantes', text: 'Embaixo da busca tem os botões "📋 Ordem normal" e "⏰ Próximos a vencer". A escolha fica lembrada no aparelho.' },
    ],
  },
  {
    id: 11,
    date: '16/10/2026',
    kind: 'correcao',
    title: '🛠️ Horários bloqueados que sumiam ao salvar as Configurações',
    summary: 'Corrigido um erro em que salvar as Configurações apagava os horários bloqueados da agenda.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Em alguns casos, ao apertar "Salvar" nas Configurações, os horários que você tinha bloqueado na agenda eram apagados sem aviso, e um cliente conseguia marcar num horário que estava bloqueado.',
      },
      { title: 'O que foi feito', text: 'Salvar as Configurações não mexe mais nos bloqueios, nas ausências nem nos horários dos profissionais. Bloquear e adicionar profissional também ficaram protegidos.' },
      { title: 'Dica', text: 'Dê uma olhada nos bloqueios dos próximos dias; se algum sumiu antes da correção, é só bloquear de novo.' },
    ],
  },
  {
    id: 10,
    date: '16/10/2026',
    kind: 'correcao',
    title: '🛠️ Mensagem "dia lotado" repetida no agendamento por chat',
    summary: 'No agendamento por chat, quando o dia não tinha horário, a mensagem "esse dia já está lotado" podia aparecer duas vezes.',
    details: [
      { title: 'O que foi feito', text: 'Agora a mensagem aparece uma vez só e o chat já mostra os outros dias para escolher.' },
    ],
  },
  {
    id: 9,
    date: '16/10/2026',
    kind: 'correcao',
    title: '🛠️ Trocar o tempo do lembrete mudava a resposta automática',
    summary: 'Em Lembretes para Clientes, mudar o tempo do lembrete voltava a resposta automática (mensagem de apresentação com o link) para o padrão.',
    details: [
      { title: 'O que foi feito', text: 'Agora você muda o tempo do lembrete e todas as outras escolhas da tela continuam do jeito que você deixou.' },
    ],
  },
  {
    id: 8,
    date: '16/10/2026',
    kind: 'novidade',
    title: '💡 Pedidos, correções e bugs: fale direto com o suporte',
    summary: 'Nesta tela você manda pedidos de melhoria, avisa de erros e tira dúvidas, com até 4 fotos ou prints. A resposta chega aqui mesmo.',
    details: [
      { title: 'Como usar', text: 'Escreva o que precisa, se quiser adicione fotos ou prints e toque em "Enviar pedido". Em "Meus pedidos e respostas" você acompanha a resposta.' },
      { title: 'Aviso de resposta', text: 'Quando o suporte responde, aparece um balão vermelho no botão "Fazer pedidos" do menu.' },
    ],
  },
  {
    id: 7,
    date: '12/10/2026',
    kind: 'novidade',
    title: '🚫 Bloquear cliente',
    summary: 'Você pode bloquear um cliente: para ele, a agenda aparece sempre lotada em todas as páginas de agendamento.',
    details: [
      { title: 'Como usar', text: 'Meus Clientes → toque em "Ver mais" no cliente → Controles → 🚫 Bloquear cliente.' },
      { text: 'O cliente não recebe nenhum aviso de bloqueio. Você desbloqueia quando quiser no mesmo botão.' },
    ],
  },
  {
    id: 6,
    date: '12/10/2026',
    kind: 'novidade',
    title: '🔒 Esconder o número dos clientes dos profissionais',
    summary: 'Com essa opção ligada, em Meus Agendamentos o WhatsApp do cliente aparece como ******** para os profissionais.',
    details: [
      { title: 'Como ativar', text: 'Configurações → Preferências e Aplicações → 🔒 Privacidade → "Não mostrar número dos clientes para profissionais".' },
      { text: 'Quem entra como dono pelo acesso com PIN continua vendo os números. Os lembretes automáticos continuam funcionando normal.' },
    ],
  },
  {
    id: 5,
    date: '12/10/2026',
    kind: 'novidade',
    title: '🛍️ Venda de produto com forma de pagamento e cliente',
    summary: 'Ao vender um produto pela agenda, agora você marca a forma de pagamento e o cliente que comprou.',
    details: [
      { title: 'Como usar', text: 'Meus Agendamentos → Vender produto → escolha o produto → escolha o cliente (da lista Meus Clientes, um cliente novo ou sem cliente) e a forma de pagamento.' },
      { text: 'Em Meus produtos, cada venda mostra o cliente e a forma de pagamento.' },
    ],
  },
  {
    id: 4,
    date: '12/10/2026',
    kind: 'melhoria',
    title: '✨ Novo visual: Meus Clientes e Meus Assinantes',
    summary: 'As telas de clientes e assinantes ficaram mais organizadas e fáceis de entender, sem tirar nenhuma função.',
    details: [
      { title: 'Meus Clientes', text: 'Cartões com etiquetas (Assinante, Bloqueado, Aniversário…), e o "Ver mais" separado em Resumo, Dados do cliente, Controles e Ações.' },
      { title: 'Meus Assinantes', text: 'Tudo separado em abas: Assinantes, Planos, Resumo do mês e Configurações.' },
    ],
  },
  {
    id: 3,
    date: '06/10/2026',
    kind: 'correcao',
    title: '🛠️ Mercado Pago desconectado cancelava agendamentos',
    summary: 'Quando o Mercado Pago do estabelecimento desconectava, alguns agendamentos com pagamento opcional eram cancelados sozinhos.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Com o Mercado Pago caído, o cliente pagava ou escolhia pagar depois e mesmo assim o agendamento era cancelado como se o pagamento fosse obrigatório.',
      },
      {
        title: 'O que foi feito',
        text: 'Agora, se o Mercado Pago cair, o pagamento online passa pela conta da plataforma e o valor fica no seu saldo para saque. Agendamentos com pagamento opcional nunca são cancelados por falta de pagamento: viram "pagar no local".',
      },
    ],
  },
  {
    id: 2,
    date: '06/10/2026',
    kind: 'correcao',
    title: '🛠️ TOP 5 mostrava todo mundo em 1º lugar',
    summary: 'O ranking TOP 5 mostrava cada estabelecimento como se fosse o primeiro colocado.',
    details: [
      { title: 'O que foi feito', text: 'O ranking agora é calculado com os agendamentos de todos os estabelecimentos, e cada um vê a posição certa.' },
    ],
  },
  {
    id: 1,
    date: '06/10/2026',
    kind: 'melhoria',
    title: '⚡ Agendamento por chat sempre ligado',
    summary: 'O agendamento em formato de conversa (estilo WhatsApp) agora fica sempre disponível para os seus clientes.',
    details: [
      { text: 'Você escolhe qual link vai para o cliente (página normal, chat ou simples) em Menu Admin → Lembretes para Clientes.' },
    ],
  },
];

const SEEN_KEY = 'agendeifacil:system-updates-seen';

/** Maior id que este aparelho já viu (0 = nunca abriu). */
export function readSeenSystemUpdateId(): number {
  try {
    const value = Number(localStorage.getItem(SEEN_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function markSystemUpdatesSeen(): void {
  try {
    const newest = SYSTEM_UPDATES.reduce((max, update) => Math.max(max, update.id), 0);
    localStorage.setItem(SEEN_KEY, String(newest));
  } catch {
    // sem localStorage: o "NOVO" só não fica lembrado
  }
}
