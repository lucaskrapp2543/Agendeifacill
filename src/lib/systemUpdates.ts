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
    id: 41,
    date: '25/11/2026',
    kind: 'melhoria',
    title: '🧭 Menu mais fácil: "Ajustes da barbearia"',
    summary: 'O "Menu Admin" agora se chama "Ajustes da barbearia": tudo separado por assunto e com busca. Nenhuma função saiu do lugar.',
    details: [
      {
        title: 'O que mudou',
        text: 'O botão "Menu Admin" virou "Ajustes da barbearia". Dentro dele as opções estão em 4 grupos: Minha barbearia, Clientes, Dinheiro e Divulgar. No menu fechado, cada ícone agora tem o nome embaixo.',
      },
      {
        title: 'Busca',
        text: 'No topo dos ajustes tem um campo "O que você quer mudar?". Digite "horário", "preço" ou "foto" e ele mostra onde fica.',
      },
      {
        title: 'Atalhos novos',
        text: '"Horário de funcionamento" e "Logo e fotos" abrem direto na parte certa das configurações, sem precisar procurar.',
      },
      {
        title: 'O que não muda',
        text: 'Todas as opções continuam lá, funcionando igual. Quem tem senha de 4 dígitos continua precisando dela para entrar.',
      },
    ],
  },
  {
    id: 40,
    date: '25/11/2026',
    kind: 'novidade',
    title: '🎂 Mensagem de aniversário automática no WhatsApp',
    summary: 'O sistema manda sozinho uma mensagem de parabéns no dia do aniversário do cliente. Você liga e edita o texto em "Lembretes para clientes".',
    fromClientRequest: true,
    details: [
      {
        title: 'Como ativar',
        text: 'Vá em "Lembretes para clientes", marque "🎂 Mensagem de aniversário", ajuste o texto se quiser e toque em "Salvar". Vem desligado: só envia para quem ligar. Precisa estar com o WhatsApp conectado no sistema (Plano Diamante).',
      },
      {
        title: 'Como funciona',
        text: 'No dia do aniversário, entre 9h e 19h, o cliente recebe a sua mensagem pelo WhatsApp da barbearia. É uma mensagem por cliente por ano, no máximo 30 por dia. No texto dá para usar o nome do cliente, o nome da barbearia e o link de agendamento.',
      },
      {
        title: 'Quem recebe',
        text: 'Os clientes com a data de aniversário cadastrada em "Meus Clientes". Cliente sem data cadastrada não recebe, e cliente bloqueado também não.',
      },
    ],
  },
  {
    id: 39,
    date: '25/11/2026',
    kind: 'melhoria',
    title: '🚫 "Cliente Faltou": avise o cliente com um toque',
    summary: 'Depois de marcar "Cliente Faltou", o sistema oferece a mensagem pronta para você enviar pelo seu WhatsApp. Nada é enviado sozinho.',
    fromClientRequest: true,
    details: [
      {
        title: 'O que mudou',
        text: 'Ao clicar em "Cliente Faltou" (ou no atalho "Faltou" da agenda), aparece uma janela com a mensagem pronta: "Sentimos sua falta na [sua barbearia]. Seu horário passou e você não compareceu", com a data, o horário e o profissional. Toque em "Enviar no WhatsApp" e ela abre na conversa do cliente: é só enviar. Se não quiser avisar, toque em "Não enviar".',
      },
      {
        title: 'Por que mudou',
        text: 'Antes, quem tinha o WhatsApp conectado no sistema via o cliente receber sozinho a mensagem de "agendamento cancelado", como se a barbearia tivesse cancelado. Agora, na falta, nada é enviado sozinho: você decide se avisa.',
      },
      {
        title: 'O que não muda',
        text: 'A falta continua sendo somada no histórico do cliente e o horário continua saindo da agenda. O botão "Cancelar" continua igual.',
      },
    ],
  },
  {
    id: 38,
    date: '25/11/2026',
    kind: 'correcao',
    title: '👑 Regras de assinante valendo em todas as páginas de agendamento',
    summary: 'As opções "1 agendamento na semana" e "Limitar agendamentos de assinantes" não eram conferidas na página em formato de conversa. Agora são.',
    fromClientRequest: true,
    details: [
      {
        title: 'O que estava acontecendo',
        text: 'Mesmo com as opções ligadas em "Meus Assinantes", um assinante conseguia marcar vários horários na mesma semana quando agendava pela página em formato de conversa (chat) ou pela página simples. Era um defeito nosso.',
      },
      {
        title: 'Como ficou',
        text: 'Com "1 agendamento na semana" ligada, se o assinante já tem um horário marcado na semana, o sistema avisa e não deixa marcar outro até esse ser cancelado. Com "Limitar agendamentos de assinantes" ligada, o assinante só consegue escolher dias da semana atual. Vale nas três páginas de agendamento.',
      },
      {
        title: 'O que não muda',
        text: 'Quem não ligou essas opções continua igual. As regras valem só para agendamento feito pela assinatura; horário já atendido não conta, só o que está marcado e ainda não aconteceu. A semana é contada de domingo a sábado.',
      },
    ],
  },
  {
    id: 37,
    date: '25/11/2026',
    kind: 'correcao',
    title: '🚫 "Cancelar pelo WhatsApp" voltou a funcionar',
    summary: 'Quem marcou essa opção: o cliente não cancela mais sozinho. Ele toca num botão e pede o cancelamento no seu WhatsApp.',
    fromClientRequest: true,
    details: [
      {
        title: 'O que estava acontecendo',
        text: 'A opção "Cancelar pelo WhatsApp (pedido de cancelamento)", em Configurações, estava marcada em várias barbearias, mas o cliente continuava conseguindo cancelar sozinho pela página "Meus agendamentos". Era um defeito nosso.',
      },
      {
        title: 'Como ficou',
        text: 'Com a opção marcada, o botão "Cancelar Agendamento" do cliente vira "Pedir cancelamento pelo WhatsApp". Ele abre uma conversa com você já com a data, o horário, o serviço e o campo "Motivo". O horário só sai da agenda quando VOCÊ cancelar no painel.',
      },
      {
        title: 'Não quer assim?',
        text: 'É só desmarcar a opção em Configurações, na parte "No agendamento, você quer pedir". Com ela desmarcada, o cliente volta a cancelar sozinho, respeitando o prazo mínimo que você definiu. Quem nunca marcou a opção não muda nada.',
      },
    ],
  },
  {
    id: 36,
    date: '19/11/2026',
    kind: 'correcao',
    title: '💰 Saldo preso depois de reconectar o Mercado Pago',
    summary: 'Quem reconectou o Mercado Pago e tinha dinheiro para sacar ficou sem o botão de saque. Agora o saldo aparece sempre que existe.',
    fromClientRequest: true,
    details: [
      {
        title: 'O que estava acontecendo',
        text: 'Quando o Mercado Pago da barbearia saía do ar, o pagamento do cliente caía na conta do Agendei Fácil e virava saldo para você sacar. Só que, assim que você reconectava o Mercado Pago, a tela do saldo sumia — e o dinheiro ficava lá, sem botão para pedir o saque.',
      },
      {
        title: 'Como ficou',
        text: 'O saldo agora aparece sempre que existe, com Mercado Pago conectado ou não, junto com o botão de sacar e o histórico. Se a sua carteira está zerada, nada muda: a tela continua igual à de antes.',
      },
      {
        title: 'Também mudou o nome no menu',
        text: 'O item do menu agora se chama "💰 Saques / Pagamentos online" para todo mundo. Antes aparecia "Receba Antes" para quem já tinha o Mercado Pago conectado, o que escondia que ali também é o lugar de pedir saque.',
      },
    ],
  },
  {
    id: 35,
    date: '16/11/2026',
    kind: 'melhoria',
    title: '🪶 Agenda mais leve com a tela parada',
    summary: 'A agenda parou de se redesenhar inteira à toa enquanto fica aberta. Menos travadinhas no tablet e no celular.',
    details: [
      {
        title: 'O que mudou',
        text: 'A agenda continua se atualizando sozinha a cada 30 segundos, mas agora só redesenha a tela quando chega algo novo: agendamento, cancelamento, pagamento ou qualquer alteração. A troca automática do banner do topo também ficou mais leve.',
      },
      {
        title: 'O que continua igual',
        text: 'Os avisos de novo agendamento e de cancelamento, a baixa automática dos horários que passaram, o "Já passou" nos horários livres, os bloqueios e o financeiro funcionam exatamente como antes.',
      },
    ],
  },
  {
    id: 34,
    date: '16/11/2026',
    kind: 'melhoria',
    title: '⚡ Menu mais leve e rápido no tablet e no celular',
    summary: 'O menu lateral e o Menu Admin abrem na hora, sem travar, inclusive em tablet e celular mais simples.',
    details: [
      {
        title: 'O que mudou',
        text: 'O menu deixou de "crescer" com animação. No tablet ele abre por cima da agenda, e é só tocar fora dele para fechar. As cores ficaram sólidas e tiramos os brilhos que piscavam, que deixavam a tela pesada.',
      },
      {
        title: 'O que continua igual',
        text: 'Os mesmos botões, no mesmo lugar e com as mesmas cores de sempre: só ficaram mais leves.',
      },
    ],
  },
  {
    id: 33,
    date: '09/11/2026',
    kind: 'novidade',
    fromClientRequest: true,
    title: '♾️ Serviço ilimitado na assinatura',
    summary: 'Agora tem o botão "Deixar ilimitado" em cada serviço do plano. Não precisa mais colocar 999 no limite.',
    details: [
      {
        title: 'Como usar',
        text: 'Em Meus Assinantes, abra a aba Planos, crie ou edite um plano e toque em "♾️ Deixar ilimitado" no serviço que não tem limite de uso. Para voltar a ter limite, toque em "Colocar limite".',
      },
      {
        title: 'Como fica a comissão',
        text: 'Quando um serviço fica ilimitado, você escolhe como dividir a comissão: por atendimento (uma % do plano a cada visita), dividindo o valor total por uma quantidade de visitas que você escolhe, ou por pontos.',
      },
      {
        title: 'Quem já usava 999',
        text: 'Continua funcionando igual. Agora aparece "Ilimitado" no lugar do 999.',
      },
    ],
  },
  {
    id: 32,
    date: '04/11/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ O faturamento de assinaturas do mês não cai mais quando o cliente vence',
    summary: 'O pagamento agora fica no mês em que foi feito, mesmo que o plano do cliente vença ou seja renovado depois. O Financeiro e Meus Assinantes passam a mostrar o mesmo valor.',
    details: [
      {
        title: 'O que estava errado',
        text: 'Quando o plano de um cliente vencia, o pagamento dele saía do mês em que foi feito. Por isso o valor de um mês fechado mudava de um dia para o outro. Em Meus Assinantes, quem era cadastrado num dia e pagava em outro ainda contava duas vezes.',
      },
      {
        title: 'O que mudou',
        text: 'Cada pagamento conta uma vez, no mês em que foi feito. Vencer, renovar, arquivar ou apagar o assinante depois não muda mais o valor daquele mês. Se você marcou pago por engano e desfez no mesmo mês, esse pagamento não conta.',
      },
      {
        title: 'O número de um mês passado pode mudar agora',
        text: 'Ao abrir um mês passado, o valor pode aparecer diferente do que você viu antes, porque agora ele está certo. O registro detalhado começou em 24/09/2026. Antes dessa data, o sistema só consegue ler a última informação de cada assinante, então esses meses podem ficar incompletos.',
      },
    ],
  },
  {
    id: 31,
    date: '04/11/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ "Não mostrar número dos clientes" agora esconde mais coisas',
    summary: 'Com a opção ligada, o profissional não abre mais a conversa do cliente pelos botões Enviar lembrete e Enviar agradecimento, e o número também sumiu de outras telas da agenda.',
    details: [
      {
        title: 'O que mudou',
        text: 'Com a opção ligada, somem os botões Enviar lembrete e Enviar agradecimento. O número também deixa de aparecer ao reservar cliente, fazer encaixe, vender produto e na lista de clientes sumidos do profissional.',
      },
      {
        title: 'O que continua igual',
        text: 'Os lembretes automáticos continuam saindo normalmente. Quem entra como dono pelo acesso com PIN continua vendo o número e os botões. Quem não ligou a opção não percebe nenhuma mudança.',
      },
    ],
  },
  {
    id: 30,
    date: '03/11/2026',
    kind: 'melhoria',
    title: '⚡ "Fazer pedidos" agora se chama "Falar com suporte"',
    summary: 'O botão de pedidos mudou de nome e continua fazendo o mesmo. O botão antigo, de chamar no WhatsApp, agora se chama "Falar com representante".',
    details: [
      {
        title: 'Qual usar?',
        text: 'Pedido, correção, erro ou dúvida: use "Falar com suporte". Vai direto para o T.I, com resposta mais rápida e com melhor qualidade, e a resposta chega nessa mesma tela. Para conversar pelo WhatsApp, use "Falar com representante".',
      },
    ],
  },
  {
    id: 29,
    date: '03/11/2026',
    kind: 'novidade',
    fromClientRequest: true,
    title: '✨ Escolha os dias em que o cliente pode agendar cada serviço',
    summary: 'Agora dá para deixar um serviço só em alguns dias no link de agendamento. Exemplo: corte infantil só nos dias mais tranquilos. É opcional: quem não mexer continua igual.',
    details: [
      {
        title: 'Como usar',
        text: 'Abra o serviço em "Editar Serviço". Em "Dias em que o cliente pode agendar", toque nos dias em que não quer esse serviço. Os dias em verde são os liberados. Depois é só salvar.',
      },
      {
        title: 'O que o cliente vê',
        text: 'No link de agendamento, o serviço mostra os dias em que é feito, e o cliente só consegue marcar nesses dias. Os outros serviços continuam normais.',
      },
      {
        title: 'E no painel?',
        text: 'Pelo painel você continua marcando e fazendo encaixe em qualquer dia. A opção vale só para o que o cliente agenda sozinho.',
      },
    ],
  },
  {
    id: 28,
    date: '03/11/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ Assinante recebia "limite atingido" por engano no link de agendamento',
    summary: 'No link, a conta dos atendimentos do assinante podia contar o mês inteiro, sem olhar a renovação. O assinante era barrado mesmo com atendimentos sobrando. Agora o link conta igual ao painel.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Quem renovava no meio do mês podia aparecer com "limite atingido" no link, enquanto no seu painel ainda sobravam atendimentos. A opção do serviço ficava apagada e o cliente não conseguia marcar.',
      },
      {
        title: 'Como ficou',
        text: 'O link agora conta do mesmo jeito que o painel, respeitando a data da renovação, a assinatura contínua e os atendimentos extras. Se a sua barbearia usa assinatura contínua, quem já usou tudo desde a renovação é avisado que acabou.',
      },
    ],
  },
  {
    id: 27,
    date: '03/11/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ "Falta pagar" do profissional saía errado quando as datas não eram um mês inteiro',
    summary: 'Em "Ver atendimentos detalhado por profissional", escolher datas diferentes de um mês inteiro mudava o "Falta pagar" do acerto. Agora o acerto sempre conta os atendimentos e os pagamentos do mês dele.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Com um período como 01/10 a 30/11, o acerto de novembro somava também os atendimentos de outubro, mas descontava só os pagamentos de novembro. O "Falta pagar" aparecia maior do que o real. Com um período curto, como "Esta semana", podia aparecer menor.',
      },
      {
        title: 'Como ficou',
        text: 'O quadro de acerto sempre conta o mês inteiro. "Produziu no período" e "Parte dele" continuam seguindo as datas que você escolheu. Os pagamentos já registrados não mudaram.',
      },
      {
        title: 'Dica',
        text: 'Para ver o acerto e o histórico de um mês passado, toque nas setinhas do mês, no topo do Financeiro. A tela agora lembra disso logo acima do acerto.',
      },
    ],
  },
  {
    id: 26,
    date: '27/10/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ Renomear profissional zerava a comissão dele nos produtos',
    summary: 'O "% por colaborador" dos produtos ficava preso ao nome. Se você mudava o nome do profissional, as vendas novas dele saíam com 0% de comissão. Agora o % segue o profissional.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Em Meus Produtos → "% por colaborador", o percentual era guardado pelo nome do profissional. Ao renomear (ex.: "Paulo Referência" virou "Paulo Damasceno"), o sistema não achava mais o % e passava a calcular 0 nas vendas seguintes. Nos campos aparecia tudo vazio.',
      },
      {
        title: 'Como ficou',
        text: 'O % agora é gravado pelo cadastro do profissional, que não muda com o nome. Quem já tinha % no nome atual não precisa fazer nada: converte sozinho na próxima vez que salvar. Quem renomeou antes dessa correção precisa digitar o % de novo uma única vez.',
      },
    ],
  },
  {
    id: 25,
    date: '27/10/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ "Antecedência para cancelar" não valia na tela Meus Agendamentos do cliente',
    summary: 'Você configurava 30 min, 1h ou 2h, mas a tela onde o cliente cancela usava sempre 3 horas. Agora vale exatamente o que você escolheu.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Em Configurações → "Antecedência para cancelar" você escolhia o prazo (ex.: 1 hora). Só que a tela Meus Agendamentos do cliente não recebia esse valor e usava o padrão antigo de 3 horas: o cliente via o botão de cancelar apagado com o aviso "é necessário cancelar com pelo menos 3 horas de antecedência", mesmo com seu prazo menor.',
      },
      {
        title: 'Como ficou',
        text: 'Meus Agendamentos, a área do cliente e a área premium passam a usar o prazo que está nas suas Configurações. Quem deixou 3 horas não sente diferença. Quem desmarcou (sem prazo) deixa o cliente cancelar até a hora do atendimento.',
      },
    ],
  },
  {
    id: 24,
    date: '22/10/2026',
    kind: 'novidade',
    fromClientRequest: true,
    title: '🔁 Lembrete de retorno: o sistema chama de volta o cliente sumido',
    summary: 'Cliente fez o último atendimento há 15, 20 ou 30 dias (você escolhe) e não marcou de novo? O WhatsApp manda sozinho a mensagem que você escreveu: "e aí, bora cortar?".',
    details: [
      {
        title: 'Como ativar',
        text: 'Menu Admin → Lembretes para Clientes → "🔁 Lembrete de retorno (cliente sumido)". Marque "Ativar", escolha 15, 20 ou 30 dias, escreva a mensagem e clique em "Salvar automações de WhatsApp". Precisa do WhatsApp conectado.',
      },
      {
        title: 'A mensagem',
        text: 'Você escreve do seu jeito. Só não apague {{cliente_nome}}: é ali que o sistema coloca o nome salvo do cliente. Também dá pra usar {{barbearia_nome}}, {{dias_sem_vir}} e {{link_agendamento}}.',
      },
      {
        title: 'Regras pra não virar spam',
        text: 'Cada cliente recebe uma mensagem só por "último atendimento". Quem já marcou de novo (ou tem horário futuro) não recebe. Cliente bloqueado não recebe. Só sai entre 9h e 19h, no máximo 30 por dia.',
      },
    ],
  },
  {
    id: 23,
    date: '22/10/2026',
    kind: 'melhoria',
    fromClientRequest: true,
    title: '📅 Faturamento da semana já somado no Financeiro',
    summary: 'Em "Ver atendimentos detalhado por profissional" agora aparece o total do período (bruto e o que fica na barbearia) e botões Esta semana, Últimos 7 dias e Este mês.',
    details: [
      {
        title: 'Onde fica',
        text: 'Financeiro → "Ver atendimentos detalhado por profissional". Logo ao lado das datas De/Até aparece "Total do período" com o bruto somado de todos os profissionais e quanto fica na barbearia (bruto menos o repasse dos profissionais que não são donos).',
      },
      {
        title: 'Atalhos',
        text: 'Os botões "Esta semana" (segunda a domingo), "Últimos 7 dias" e "Este mês" preenchem as datas sozinhos. Você também pode digitar qualquer período, como antes.',
      },
    ],
  },
  {
    id: 22,
    date: '22/10/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ Reservar Cliente usava o tempo do serviço geral, não o do profissional',
    summary: 'Se um profissional tem um serviço específico com o mesmo nome de um serviço geral (ex.: "Corte e barba" em 30 min pra um e 1 hora pra outro), o balcão pegava o geral. Agora vale o do profissional.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Pelo link de agendamento já valia o serviço específico do profissional. Mas no Reservar Cliente, quando o nome era igual ao do serviço geral, o sistema usava o tempo e o preço do geral. Quem tem dois barbeiros com tempos diferentes pro mesmo serviço via a agenda marcar errado.',
      },
      {
        title: 'Como ficou',
        text: 'No Reservar Cliente, ao escolher o profissional, o serviço de mesmo nome passa a usar o tempo e o preço cadastrados em Profissionais → serviços específicos. Os AFCoins do serviço continuam os mesmos. Não precisa mais mudar o serviço geral pra "enganar" o sistema.',
      },
    ],
  },
  {
    id: 21,
    date: '20/10/2026',
    kind: 'novidade',
    title: '📸 Story pronto com os horários livres do dia',
    summary: 'Um toque e o sistema monta a imagem do story (com sua logo, os horários livres e o link de agendamento) pronta para postar no Instagram ou no status do WhatsApp.',
    details: [
      {
        title: 'Onde fica',
        text: 'Em Meus Agendamentos, logo acima da data, tem o botão "📸 Postar story com os horários livres". Ele pega os horários que ainda estão livres no dia que você está vendo.',
      },
      {
        title: 'Como usar',
        text: 'Escolha o modelo (Clássico, Dourado ou Neon), se vai todos os profissionais ou um só, e qual link vai na imagem (página completa ou chat). A prévia aparece na hora.',
      },
      {
        title: 'Para postar',
        text: 'No celular, toque em "Compartilhar" e, no menu que abre, escolha Instagram → Stories ou WhatsApp → Meu status. Depois cole o link no sticker de link do story (ou deixe na bio). No computador, o botão baixa a imagem.',
      },
      { text: 'Dia lotado? A imagem sai escrita "AGENDA CHEIA 🔥", boa para postar do mesmo jeito.' },
    ],
  },
  {
    id: 20,
    date: '20/10/2026',
    kind: 'novidade',
    title: '🎯 Probabilidade de falta em cada agendamento',
    summary: 'Cada agendamento pendente mostra um selo com a chance de o cliente faltar, calculada pelo histórico dele na sua barbearia. Só você vê; o cliente nunca vê.',
    details: [
      {
        title: 'Como funciona',
        text: 'O sistema olha quantas vezes aquele número de WhatsApp já veio e quantas vezes faltou na sua barbearia. Verde é risco baixo, amarelo é médio e vermelho é alto. Cliente novo usa a média da sua própria barbearia.',
      },
      {
        title: 'Para o selo ficar cada vez mais certeiro',
        text: 'Marque quem não veio: depois do horário passar, aparece o botão "🚫 Faltou" no agendamento (ou use "Cliente Faltou" dentro dele). É isso que alimenta o cálculo.',
      },
      { text: 'O selo só aparece em agendamento pendente ou confirmado. Quando o atendimento é concluído, ele some.' },
    ],
  },
  {
    id: 19,
    date: '20/10/2026',
    kind: 'novidade',
    title: '📲 Pedir confirmação pelo WhatsApp (quando o risco de falta é alto)',
    summary: 'Quando a chance de falta passa de 30%, aparece o botão "Pedir confirmação": abre o WhatsApp com a mensagem pronta pedindo um SIM do cliente.',
    details: [
      {
        title: 'Como funciona',
        text: 'Toque em "📲 Pedir confirmação" no agendamento (ou no botão dentro dele). O WhatsApp abre com a mensagem pronta, do tipo: "Fala João! 👋 Tá tudo certo pro seu horário amanhã às 10:00 com o Raul? Manda um SIM pra confirmar! 💈". Você só aperta enviar.',
      },
      { text: 'Nada é automático: você escolhe quando mandar, igual ao "Enviar lembrete". O cliente responde direto no seu WhatsApp.' },
    ],
  },
  {
    id: 18,
    date: '20/10/2026',
    kind: 'novidade',
    title: '🔥 Cupom de adiantamento: 15% de desconto pagando antes de vencer',
    summary: 'De 3 dias até 1 dia antes do vencimento do seu plano, aparece a faixa "Pague adiantado e ganhe 15% de desconto". Vale só no PIX.',
    details: [
      {
        title: 'Como funciona',
        text: 'Quando faltam 3, 2 ou 1 dia para vencer, a faixa aparece no topo do painel com o valor já com desconto. Toque em "Pagar agora com 15% OFF", pague no PIX e pronto: o cupom já vem aplicado.',
      },
      {
        title: 'Você não perde dias',
        text: 'Pagando adiantado, o próximo vencimento conta a partir do vencimento atual (não a partir do dia do pagamento). Pagou no dia 18 com vencimento no dia 21? O próximo vencimento vai para o dia 21 do mês seguinte.',
      },
      { text: 'No dia do vencimento o valor volta ao normal. Cartão não entra na promoção.' },
    ],
  },
  {
    id: 17,
    date: '20/10/2026',
    kind: 'melhoria',
    title: '✨ Agenda nova: Meus Agendamentos com cara de painel',
    summary: 'Saudação com os números do dia, barra de data, profissionais em chips, menu de cada coluna reorganizado e a janela do agendamento redesenhada. Nada foi tirado.',
    details: [
      {
        title: 'O que mudou',
        text: 'No topo: "Olá!" com total, realizados, pendentes e cancelados do dia. Abaixo, a data com setas e o botão Hoje. Cada profissional vira um chip com foto e quantidade; toque para mostrar ou esconder a coluna.',
      },
      {
        title: 'Menu da coluna',
        text: 'Agendar cliente e Encaixe em destaque, depois Bloquear horário, Bloqueio dia, Cadastrar assinante e Horários disponíveis. Financeiro, Vender produto, link exclusivo, contadores e meta continuam ali.',
      },
      {
        title: 'Agendamentos',
        text: 'Pendente fica amarelo com "⏳ Em espera", realizado fica verde com "✅ Realizado". Horário livre ficou claro, com o (+) para reservar, bloquear ou encaixar. Ao tocar no agendamento, a janela mostra cliente, horário, valor, pagamento e todos os botões de sempre.',
      },
    ],
  },
  {
    id: 16,
    date: '20/10/2026',
    kind: 'correcao',
    fromClientRequest: true,
    title: '🛠️ Mensagem de confirmação não chegava quando a barbearia agendava',
    summary: 'Com a opção "Mandar também quando EU agendo o cliente" ligada, a mensagem de saudação não estava saindo. Corrigido.',
    details: [
      {
        title: 'O que acontecia',
        text: 'Uma trava antiga do WhatsApp bloqueava toda mensagem de agendamento feito dentro da barbearia, mesmo com a opção ligada. O cliente não recebia o resumo do horário.',
      },
      {
        title: 'Como conferir',
        text: 'Menu Admin → Lembretes para Clientes → "Mandar também quando EU agendo o cliente (Reservar Cliente)" marcado. Faça um Reservar Cliente com o número de um cliente e a mensagem chega. Encaixe e venda avulsa continuam sem mensagem.',
      },
    ],
  },
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
      { title: 'Aviso de resposta', text: 'Quando o suporte responde, aparece um balão vermelho no botão "Falar com suporte" do menu.' },
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
