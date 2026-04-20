import {
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  DollarSign,
  Gift,
  Layers,
  Link,
  ListOrdered,
  Lock,
  LogOut,
  MessageCircle,
  MessageSquare,
  Package,
  Receipt,
  Rocket,
  Settings,
  UserCheck,
  Users
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

type TabType =
  | 'appointments'
  | 'services'
  | 'settings'
  | 'financial-dashboard'
  | 'expenses'
  | 'clients'
  | 'subscribers'
  | 'products'
  | 'professionals'
  | 'service-categories'
  | 'taxes'
  | 'reserve-client'
  | 'ranking'
  | 'missing-clients'
  | 'draw'
  | 'top10-clientes'
  | 'passo-a-passo'
  | 'fila-espera'
  | 'placa-barbearia'
  | 'reviews'
  | 'client-page'
  | 'indication'
  | 'whatsapp-reminders'
  | 'support';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onSignOut: () => void;
  unreadNotifications?: number;
  onNotificationsClick?: () => void;
  isNotificationsUnlocked?: boolean;
  isDashboardUnlocked?: boolean;
  isSettingsUnlocked?: boolean;
  onDashboardPinModal?: () => void;
  onSettingsPinModal?: () => void;
  establishment?: any;
  onboardingStep?: number; // Controla o progresso do onboarding
  onBlockedItemClick?: () => void; // Callback quando clicar em item bloqueado
  useLightLayout?: boolean; // controla se o layout claro está ativo
  onToggleLayoutTheme?: () => void; // alterna layout claro/escuro
  onReceberAdiantadoClick?: () => void; // Atalho para Mercado Pago
  isReceberAdiantadoOpen?: boolean; // destaca o botão quando modal estiver aberto
  isAppointmentsTutorialRunning?: boolean; // controla destaques e evita auto-open no PWA durante tutorial
  pendingReviewsCount?: number; // quantidade de avaliações pendentes para badge em Avaliações
  pendingSubscribersCount?: number; // quantidade de assinantes não pagos para badge em Meus Assinantes
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onSignOut,
  unreadNotifications = 0,
  onNotificationsClick,
  isNotificationsUnlocked = true,
  isDashboardUnlocked = false,
  isSettingsUnlocked = false,
  onDashboardPinModal,
  onSettingsPinModal,
  establishment,
  onboardingStep = 4,
  onBlockedItemClick,
  useLightLayout = false,
  onToggleLayoutTheme,
  onReceberAdiantadoClick,
  isReceberAdiantadoOpen = false,
  isAppointmentsTutorialRunning = false,
  pendingReviewsCount = 0,
  pendingSubscribersCount = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPlanUpgradeModal, setShowPlanUpgradeModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMenuScrollHint, setShowMenuScrollHint] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const isLight = useLightLayout;

  const updateMenuScrollHint = () => {
    const navEl = navRef.current;
    if (!navEl || !isMobile || !isExpanded) {
      setShowMenuScrollHint(false);
      return;
    }
    const hasOverflow = navEl.scrollHeight - navEl.clientHeight > 8;
    const isAtBottom = navEl.scrollTop + navEl.clientHeight >= navEl.scrollHeight - 8;
    setShowMenuScrollHint(hasOverflow && !isAtBottom);
  };

  // ✅ Evitar scroll do fundo quando o modal estiver aberto
  useEffect(() => {
    if (!showPlanUpgradeModal) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // Evita "pular" layout por causa da scrollbar (desktop)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [showPlanUpgradeModal]);

  // ✅ Plano Prata: ativado SOMENTE pelo botão "PRATA" no Admin
  const isPlanoPrataAtivo = Boolean(establishment?.plan_prata_active);

  useEffect(() => {
    const timer = window.setTimeout(updateMenuScrollHint, 120);
    window.addEventListener('resize', updateMenuScrollHint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateMenuScrollHint);
    };
  }, [isMobile, isExpanded, activeTab, pendingReviewsCount, pendingSubscribersCount, unreadNotifications]);

  const openUpgradeModal = () => setShowPlanUpgradeModal(true);
  const closeUpgradeModal = () => setShowPlanUpgradeModal(false);
  const openUpgradeModalMobileSafe = () => {
    setShowPlanUpgradeModal(true);
  };

  const redirectUpgradeToWhatsapp = () => {
    const phone = '5548991265320';
    const message =
      'Olá, quero subir meu plano para o OURO (R$ 47,90).\n' +
      'Desejo liberar o sistema de assinantes e o controle de estoque\n' +
      'para vendas de produtos no meu estabelecimento.';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const redirectUpgradeToDiamanteWhatsapp = () => {
    const phone = '5548991265320';
    const message =
      'Olá, quero subir meu plano para o DIAMANTE.\n' +
      'Desejo liberar tudo sem limites, incluindo:\n' +
      '- Lembretes automáticos no WhatsApp (1h antes)\n' +
      '- Mensagens ilimitadas para clientes que sumiram\n' +
      '- Mensagens ilimitadas para clientes aniversariantes\n\n' +
      'Quero adicionar +R$ 49,99 na minha fatura mensal.';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Função para verificar se um item deve estar bloqueado
  const isItemLocked = (itemId: string): boolean => {
    // Se onboarding completo (step >= 4), nada está bloqueado
    if (onboardingStep >= 4) return false;

    // Step 1: Apenas "settings" (Config) e "passo-a-passo" liberados
    if (onboardingStep === 1) {
      return itemId !== 'config' && itemId !== 'passo-a-passo' && itemId !== 'logout';
    }

    // Step 2: "professionals" também liberado
    if (onboardingStep === 2) {
      return itemId !== 'config' && itemId !== 'passo-a-passo' && itemId !== 'professionals' && itemId !== 'logout';
    }

    // Step 3: "service-categories" também liberado
    if (onboardingStep === 3) {
      return itemId !== 'config' && itemId !== 'passo-a-passo' && itemId !== 'professionals' && itemId !== 'service-categories' && itemId !== 'logout';
    }

    return false;
  };

  // Bloqueio APENAS do onboarding (primeiro acesso). Não mistura com Plano Prata.
  // Usado para mostrar a mensagem de "Função bloqueada por configuração".
  const isItemLockedByOnboarding = (itemId: string): boolean => {
    // Se onboarding completo (step >= 4), nada está bloqueado
    if (onboardingStep >= 4) return false;

    // Step 1: Apenas "settings" (Config) e "passo-a-passo" liberados
    if (onboardingStep === 1) {
      return itemId !== 'config' && itemId !== 'passo-a-passo' && itemId !== 'logout';
    }

    // Step 2: "professionals" também liberado
    if (onboardingStep === 2) {
      return itemId !== 'config' && itemId !== 'passo-a-passo' && itemId !== 'professionals' && itemId !== 'logout';
    }

    // Step 3: "service-categories" também liberado
    if (onboardingStep === 3) {
      return itemId !== 'config' && itemId !== 'passo-a-passo' && itemId !== 'professionals' && itemId !== 'service-categories' && itemId !== 'logout';
    }

    return false;
  };

  const isPlanLockedItem = (itemId: string) =>
    isPlanoPrataAtivo && (itemId === 'subscribers' || itemId === 'products' || itemId === 'fila-espera');

  // Detectar mudanças no tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsExpanded(true);
      }
      // Em mobile, mantém o estado atual (não força fechar)
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detectar se está em mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Recolher o sidebar quando clicar em um item
  const handleItemClick = (onClick: () => void) => {
    onClick();
    setIsExpanded(false);
  };

  const menuItems = [
    {
      id: 'notifications',
      label: 'Notificações',
      icon: Bell,
      onClick: () => {
        if (isItemLocked('notifications')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(onNotificationsClick || (() => { }));
        }
      },
      isActive: false, // Notificações não é um tab, é um modal
      showBadge: unreadNotifications > 0,
      badgeCount: unreadNotifications,
      disabled: !isNotificationsUnlocked || isItemLocked('notifications')
    },
    {
      id: 'appointments',
      label: 'Meus Agendamentos',
      icon: Calendar,
      onClick: () => {
        if (isItemLocked('appointments')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('appointments'));
        }
      },
      isActive: activeTab === 'appointments',
      disabled: isItemLocked('appointments')
    },
    {
      id: 'client-page',
      label: 'Página de Agendamentos',
      icon: Link,
      onClick: () => {
        if (isItemLocked('client-page')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('client-page'));
        }
      },
      isActive: activeTab === 'client-page',
      disabled: isItemLocked('client-page')
    },
    {
      id: 'subscribers',
      label: 'Meus Assinantes',
      icon: Crown,
      onClick: () => {
        if (isPlanLockedItem('subscribers')) {
          openUpgradeModalMobileSafe();
          return;
        }
        if (isItemLocked('subscribers')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('subscribers'));
        }
      },
      isActive: activeTab === 'subscribers',
      disabled: !isPlanLockedItem('subscribers') && isItemLocked('subscribers'),
      lockedByPlan: isPlanLockedItem('subscribers'),
      showBadge: pendingSubscribersCount > 0,
      badgeCount: pendingSubscribersCount > 99 ? '99+' : pendingSubscribersCount,
    },
    {
      id: 'whatsapp-reminders',
      label: 'Lembretes para Clientes',
      icon: MessageCircle,
      onClick: () => {
        if (isItemLocked('whatsapp-reminders')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('whatsapp-reminders'));
        }
      },
      isActive: activeTab === 'whatsapp-reminders',
      disabled: isItemLocked('whatsapp-reminders')
    },
    {
      id: 'indication',
      label: 'Quero 1 mês grátis',
      icon: Gift,
      onClick: () => {
        if (isItemLocked('indication')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('indication'));
        }
      },
      isActive: activeTab === 'indication',
      disabled: isItemLocked('indication')
    },
    {
      id: 'clients',
      label: 'Meus Clientes',
      icon: Users,
      onClick: () => {
        if (isItemLocked('clients')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('clients'));
        }
      },
      isActive: activeTab === 'clients',
      disabled: isItemLocked('clients')
    },
    {
      id: 'service-categories',
      label: 'Meus serviços',
      icon: Layers,
      onClick: () => {
        if (isItemLocked('service-categories')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('service-categories'));
        }
      },
      isActive: activeTab === 'service-categories',
      disabled: isItemLocked('service-categories')
    },
    {
      id: 'products',
      label: 'Meus Produtos',
      icon: Package,
      onClick: () => {
        if (isPlanLockedItem('products')) {
          openUpgradeModalMobileSafe();
          return;
        }
        if (isItemLocked('products')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('products'));
        }
      },
      isActive: activeTab === 'products',
      disabled: !isPlanLockedItem('products') && isItemLocked('products'),
      lockedByPlan: isPlanLockedItem('products'),
    },
    {
      id: 'professionals',
      label: 'Profissionais',
      icon: UserCheck,
      onClick: () => {
        if (isItemLocked('professionals')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('professionals'));
        }
      },
      isActive: activeTab === 'professionals',
      disabled: isItemLocked('professionals')
    },
    {
      id: 'dashboard',
      label: 'Financeiro',
      icon: BarChart3,
      onClick: () => {
        if (isItemLocked('dashboard')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => {
            if (establishment?.pin_password && establishment.pin_password.length > 0 && !isDashboardUnlocked) {
              onDashboardPinModal?.();
            } else {
              onTabChange('financial-dashboard');
            }
          });
        }
      },
      isActive: activeTab === 'financial-dashboard',
      disabled: isItemLocked('dashboard')
    },
    {
      id: 'expenses',
      label: 'Despesas',
      icon: DollarSign,
      onClick: () => {
        if (isItemLocked('expenses')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('expenses'));
        }
      },
      isActive: activeTab === 'expenses',
      disabled: isItemLocked('expenses')
    },
    {
      id: 'taxes',
      label: 'Minhas Taxas',
      icon: Receipt,
      onClick: () => {
        if (isItemLocked('taxes')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('taxes'));
        }
      },
      isActive: activeTab === 'taxes',
      disabled: isItemLocked('taxes')
    },
    {
      id: 'support',
      label: 'Falar com Suporte',
      icon: MessageSquare,
      onClick: () => {
        if (isItemLocked('support')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('support'));
        }
      },
      isActive: activeTab === 'support',
      disabled: isItemLocked('support')
    },
    {
      id: 'config',
      label: 'Configurações\\Pagina',
      icon: Settings,
      onClick: () => {
        if (isItemLocked('config')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => {
            if (establishment?.pin_password && establishment.pin_password.length > 0 && !isSettingsUnlocked) {
              onSettingsPinModal?.();
            } else {
              onTabChange('settings');
            }
          });
        }
      },
      isActive: activeTab === 'settings',
      disabled: isItemLocked('config')
    },
    {
      id: 'logout',
      label: 'Sair',
      icon: LogOut,
      onClick: () => handleItemClick(onSignOut),
      isActive: false
    },
    {
      id: 'hours',
      label: 'Horários',
      icon: Clock,
      onClick: () => handleItemClick(() => { }),
      isActive: false,
      disabled: true,
      tooltip: 'Em breve',
      isWhite: true // Flag para aplicar estilo branco
    }
  ];

  // Textos auxiliares (mobile fullscreen) — estilo CNH Digital
  const mobileDescriptions: Record<string, string> = {
    notifications: 'Veja avisos de agendamentos, cancelamentos e compras de assinaturas.',
    appointments: 'Veja seus agendamentos, crie reservas e acompanhe o dia.',
    'whatsapp-reminders': 'Ative lembretes automáticos: seu cliente recebe mensagem 1 hora antes do horário.',
    indication: 'Ganhe 1 mês grátis compartilhando seu link de indicação.',
    clients: 'Cadastre clientes, veja histórico e anotações importantes.',
    subscribers: 'Gerencie assinantes e planos mensais do seu estabelecimento.',
    'service-categories': 'Crie e organize seus serviços e preços (cupons de descontos e etc).',
    products: 'Cadastre produtos e controle vendas/estoque/comissões.',
    professionals: 'Gerencie profissionais: horários, ausências e bloqueios.',
    dashboard: 'Acompanhe faturamento, pagamentos e repasses.',
    expenses: 'Registre despesas para saber seu lucro real.',
    taxes: 'Configure taxas e veja relatórios por bandeira.',
    'client-page': 'Veja o link da sua página e revise as configurações antes de divulgar.',
    'placa-barbearia': 'Divulgue seus links em um QR Code bonito para expor no balcão.',
    reviews: 'Modere avaliações dos clientes e publique somente as aprovadas no booking.',
    support: 'Fale com o suporte para ajuda rápida.',
    config: 'Configurações do sistema e do seu estabelecimento.',
    logout: 'Sair da sua conta neste dispositivo.',
    hours: 'Em breve.',
  };

  type MobileVariant = 'neutral' | 'brandAmber' | 'brandGreen' | 'brandBlue' | 'brandPurple';

  const getMobileVariant = (id: string): MobileVariant => {
    if (id === 'whatsapp-reminders') return 'brandAmber';
    if (id === 'indication') return 'brandGreen';
    if (id === 'receber-adiantado') return 'brandBlue';
    if (id === 'fila-espera') return 'brandPurple';
    if (id === 'placa-barbearia') return 'brandBlue';
    return 'neutral';
  };

  const getMobileCardStyles = (variant: MobileVariant, isActiveCard: boolean, isDisabledCard: boolean) => {
    // Menos arredondado que antes, mas ainda moderno
    const shape = 'rounded-2xl';

    if (isActiveCard) {
      // Ativo: card claro (estilo CNH), com texto legível e borda forte
      return {
        card: `bg-white border-white ${shape}`,
        title: 'text-black',
        desc: 'text-black/60',
        icon: 'text-black',
        chevron: 'text-black',
      };
    }

    if (isDisabledCard) {
      return {
        card: `${isLight ? `bg-gray-100 border-gray-200` : `bg-black border-white/15`} ${shape} opacity-80`,
        title: isLight ? 'text-gray-500' : 'text-white/50',
        desc: isLight ? 'text-gray-400' : 'text-white/35',
        icon: isLight ? 'text-gray-500' : 'text-white/50',
        chevron: isLight ? 'text-gray-400' : 'text-white/35',
      };
    }

    // Base neutra: bem sóbria
    const neutral = {
      // No tema escuro, evitar "preto chapado" e usar um card mais premium (tom grafite)
      card: `${isLight
        ? 'bg-white border-gray-200 hover:bg-gray-50'
        : 'bg-gradient-to-r from-[#121318] to-[#0B0B0C] border-white/10 hover:from-[#161922] hover:to-[#0F1115]'
        } ${shape}`,
      title: isLight ? 'text-gray-900' : 'text-white',
      desc: isLight ? 'text-gray-600' : 'text-white/70',
      icon: isLight ? 'text-gray-900' : 'text-white',
      chevron: isLight ? 'text-gray-900' : 'text-white',
    };

    // Variantes com cores “que fazem sentido” no fundo (sem virar carnaval)
    const variants: Record<MobileVariant, typeof neutral> = {
      neutral,
      brandAmber: {
        card: `bg-gradient-to-r from-amber-300 to-yellow-400 border-amber-200 ${shape} hover:from-amber-400 hover:to-yellow-500`,
        title: 'text-black',
        desc: 'text-black/70',
        icon: 'text-black',
        chevron: 'text-black',
      },
      brandGreen: {
        card: `bg-gradient-to-r from-green-500 to-emerald-600 border-emerald-400/40 ${shape} hover:from-green-600 hover:to-emerald-700`,
        title: 'text-white',
        desc: 'text-white/80',
        icon: 'text-white',
        chevron: 'text-white',
      },
      brandBlue: {
        card: `bg-gradient-to-r from-[#009EE3] to-[#0077B6] border-white/10 ${shape} hover:from-[#0088C7] hover:to-[#006AA3]`,
        title: 'text-white',
        desc: 'text-white/80',
        icon: 'text-white',
        chevron: 'text-white',
      },
      brandPurple: {
        card: `bg-gradient-to-r from-purple-600 to-fuchsia-700 border-white/10 ${shape} hover:from-purple-700 hover:to-fuchsia-800`,
        title: 'text-white',
        desc: 'text-white/80',
        icon: 'text-white',
        chevron: 'text-white',
      },
    };

    return variants[variant] || neutral;
  };

  return (
    <>
      {/* ✅ Modal de upgrade do Plano (Prata → Ouro) */}
      {showPlanUpgradeModal && (
        <div
          className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center bg-black/70 p-3 sm:p-4 pt-6 sm:pt-4"
          onClick={closeUpgradeModal}
        >
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-[#0B0B0B] border-gray-800'} max-h-[85vh] overflow-y-auto overscroll-contain`}
            style={{ WebkitOverflowScrolling: 'touch' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isLight ? 'border-gray-200' : 'border-gray-800'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <div className={`text-sm font-extrabold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Recurso exclusivo
                </div>
              </div>
              <button
                type="button"
                onClick={closeUpgradeModal}
                className={`p-2 rounded-lg ${isLight ? 'hover:bg-gray-100' : 'hover:bg-white/5'}`}
                aria-label="Fechar"
                title="Fechar"
              >
                <span className={isLight ? 'text-gray-700' : 'text-gray-200'}>✕</span>
              </button>
            </div>

            <div className="px-4 py-4 space-y-3">
              <div className={`${isLight ? 'text-gray-900' : 'text-white'} font-semibold`}>
                ✨ Recurso exclusivo dos planos Ouro e Diamante
              </div>
              <div className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-sm leading-relaxed`}>
                Deseja fazer upgrade do seu plano?
                <br />
                Por apenas <strong>R$ 20,00</strong> a mais na sua fatura mensal, você libera esse recurso.
              </div>

              <div className={`mt-2 rounded-xl p-3 border ${isLight ? 'bg-amber-50 border-amber-200' : 'bg-white/5 border-amber-300/30'}`}>
                <div className={`${isLight ? 'text-gray-900' : 'text-gray-100'} text-sm font-extrabold`}>
                  🥇 No Plano OURO você libera:
                </div>
                <div className={`${isLight ? 'text-gray-800' : 'text-gray-300'} text-sm leading-relaxed mt-2`}>
                  <div className="space-y-1">
                    <div>✅ Sistema de estoque de produtos</div>
                    <div>✅ Sistema de assinaturas mensais</div>
                    <div>✅ Profissionais ilimitados</div>
                    <div>✅ Controle de comissões por profissionais</div>
                    <div>✅ E muito mais recursos para crescer seu estabelecimento</div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={redirectUpgradeToWhatsapp}
                className="w-full mt-2 px-4 py-3 rounded-xl font-extrabold text-black bg-gradient-to-r from-amber-300 to-yellow-400 hover:from-amber-400 hover:to-yellow-500 transition-all shadow-lg"
              >
                🔼 Mudar para Plano Ouro
              </button>

              <div className={`mt-2 rounded-xl p-3 border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-gray-800'}`}>
                <div className={`${isLight ? 'text-gray-900' : 'text-gray-100'} text-sm font-extrabold`}>
                  👉 Ou você pode escolher o Plano DIAMANTE 💎
                </div>
                <div className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-sm leading-relaxed mt-2`}>
                  No Plano DIAMANTE, você tem tudo do Plano OURO e algo incrível a mais: <strong>lembretes automáticos</strong>,
                  evitando muito as faltas e esquecimentos.
                  <div className="mt-2 space-y-1">
                    <div>✅ Lembretes automáticos no WhatsApp ILIMITADO</div>
                    <div>✅ O sistema avisa seu cliente 1 hora antes do horário agendado</div>
                    <div>✅ Mensagens ilimitadas para:</div>
                    <div className="pl-4">- Clientes que sumiram</div>
                    <div className="pl-4">- Clientes aniversariantes</div>
                  </div>
                  <div className="mt-2">
                    📲 Seu cliente agenda normalmente e o sistema faz tudo sozinho, sem você precisar lembrar ninguém.
                  </div>
                  <div className="mt-2 font-semibold">
                    Valor do diamante: <strong>R$ 49,99</strong> a mais na sua fatura.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={redirectUpgradeToDiamanteWhatsapp}
                  className="w-full mt-3 px-4 py-3 rounded-xl font-extrabold text-white bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-700 hover:to-purple-800 transition-all shadow-lg"
                >
                  💎 Ser Diamante
                </button>
              </div>

              <button
                type="button"
                onClick={closeUpgradeModal}
                className={`w-full px-4 py-2 rounded-xl font-semibold border transition-all ${isLight
                  ? 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                  : 'bg-transparent border-gray-700 text-gray-200 hover:bg-white/5'
                  }`}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay do sidebar antigo (somente desktop). Em mobile isso causava camada escura presa. */}
      {!isMobile && isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div
        className={`flex fixed left-0 top-0 bottom-0 border-r transition-all duration-300 z-40 flex-col ${isExpanded ? 'w-64' : 'w-16'
          } md:relative md:z-auto md:flex-shrink-0 ${isLight ? 'bg-white border-gray-200' : 'bg-gradient-to-b from-gray-900 via-black to-black border-gray-800'
          }`}
        style={{ minHeight: '100vh' }}
      >
        {/* Botão de toggle */}
        <div
          className={`flex justify-between items-center p-2 border-b flex-shrink-0 ${isLight ? 'bg-white border-gray-200' : 'bg-gradient-to-r from-gray-900 to-black border-gray-800'
            }`}
        >
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className={`text-sm font-medium transition-colors cursor-pointer ${isLight ? 'text-gray-700 hover:text-black' : 'text-white hover:text-gray-300'
                }`}
              title="Recolher menu"
            >
              CLIQUE PARA RECOLHER
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              data-sidebar-toggle
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2.5 rounded-lg hover:bg-gray-800 transition-all relative border-2 ${!isExpanded
                ? isLight
                  ? 'border-gray-400 bg-white shadow-md hover:shadow-lg hover:scale-105 hover:bg-gray-50'
                  : 'border-white bg-gray-900 shadow-md hover:shadow-lg hover:scale-105'
                : 'border-transparent hover:bg-transparent'
                }`}
              title={isExpanded ? 'Recolher menu' : 'Clique para abrir o menu'}
            >
              {isExpanded ? (
                <ChevronLeft className={`h-5 w-5 ${isLight ? 'text-gray-800' : 'text-white'}`} />
              ) : (
                <div className="relative">
                  <ChevronRight className={`h-5 w-5 ${isLight ? 'text-gray-800' : 'text-white'}`} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full animate-ping ${isLight ? 'bg-gray-800' : 'bg-white'}`}></div>
                  </div>
                </div>
              )}
            </button>
            {!isExpanded && (
              <div
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap flex items-center gap-1.5 ${isLight ? 'bg-white text-gray-900 border border-gray-200' : 'bg-black text-white'
                  }`}
              >
                <span>☰</span>
                <span>MENU</span>
              </div>
            )}
          </div>
        </div>

        {/* Lista de itens do menu */}
        <nav
          ref={navRef}
          onScroll={updateMenuScrollHint}
          className={`p-2 space-y-1 overflow-y-auto flex-1 scrollbar-hide ${isLight ? 'bg-white' : 'bg-gradient-to-b from-gray-900 via-black to-black'
            }`}
          style={{ minHeight: 0 }}
        >
          {/* Controle simples de cor do sistema (acima do Passo a passo) */}
          {onToggleLayoutTheme && (
            <div className="mb-3">
              {isExpanded ? (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 ${isLight
                    ? 'bg-gray-100 border-gray-300 text-gray-900'
                    : 'bg-black/80 border-gray-700 text-gray-100'
                    }`}
                >
                  <span className="font-semibold">Cor do Sistema</span>
                  <button
                    type="button"
                    onClick={onToggleLayoutTheme}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all shadow-sm bg-white text-gray-900 hover:bg-gray-100"
                  >
                    {useLightLayout ? 'Preto' : 'Claro'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onToggleLayoutTheme}
                  className={`w-full flex items-center justify-center px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${isLight
                    ? 'text-gray-900 hover:bg-gray-100'
                    : 'text-white hover:bg-gray-800'
                    }`}
                  title="Cor do Sistema"
                >
                  Cor
                </button>
              )}
            </div>
          )}

          {/* Botão Passo a Passo */}
          <div className="relative">
            <button
              onClick={() => handleItemClick(() => onTabChange('top10-clientes'))}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${activeTab === 'top10-clientes'
                ? isLight
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white text-black shadow-md'
                : isLight
                  ? 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-200'
                  : 'bg-transparent text-white'
                }`}
              title={isExpanded ? '' : 'TOP 5 clientes'}
            >
              <Crown
                className={`h-5 w-5 flex-shrink-0 ${activeTab === 'top10-clientes'
                  ? isLight
                    ? 'text-white'
                    : 'text-black'
                  : isLight
                    ? 'text-gray-700'
                    : 'text-yellow-300'
                  }`}
              />
              {isExpanded && (
                <span className="text-sm font-medium whitespace-nowrap">
                  👑 TOP 5 clientes
                </span>
              )}
            </button>

            {!isExpanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                👑 TOP 5 clientes
              </div>
            )}
          </div>

          {/* Botão Passo a Passo */}
          <div className="relative">
            <button
              onClick={() => handleItemClick(() => onTabChange('passo-a-passo'))}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${activeTab === 'passo-a-passo'
                ? isLight
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white text-black shadow-md'
                : isLight
                  ? 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-200'
                  : 'bg-transparent text-white'
                }`}
              title={isExpanded ? '' : 'Passo a passo'}
            >
              <Rocket
                className={`h-5 w-5 flex-shrink-0 ${activeTab === 'passo-a-passo'
                  ? isLight
                    ? 'text-white'
                    : 'text-black'
                  : isLight
                    ? 'text-gray-700'
                    : 'text-white'
                  }`}
              />
              {isExpanded && (
                <span className="text-sm font-medium whitespace-nowrap">
                  Como funciona o Sistema
                </span>
              )}
            </button>

            {/* Tooltip para menu recolhido */}
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                Como funciona o Sistema
              </div>
            )}
          </div>

          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isIndicationItem = item.id === 'indication';
            const isWhatsappPremiumItem = item.id === 'whatsapp-reminders';
            const isSubscribersItem = item.id === 'subscribers';
            const isAppointmentsItem = item.id === 'appointments';
            const isBookingPageItem = item.id === 'client-page';
            const isLastItem = index === menuItems.length - 1;
            const isPlanLocked = Boolean((item as any).lockedByPlan);
            const isOnboardingLocked = !isPlanLocked && isItemLockedByOnboarding(item.id);
            const shouldHighlightAppointmentsShortcut =
              isAppointmentsTutorialRunning && item.id === 'appointments' && activeTab !== 'appointments';

            return (
              <React.Fragment key={item.id}>
                <div className="relative">
                  <button
                    onClick={item.onClick}
                    data-tutorial-id={`menu-${item.id}`}
                    // ⚠️ Não desabilitar itens bloqueados pelo onboarding:
                    // queremos permitir o clique para mostrar a mensagem de "siga o passo a passo".
                    // Só desabilitamos itens realmente "Em breve" (sem ação).
                    disabled={item.id === 'hours'}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${isIndicationItem
                      ? item.isActive
                        ? 'bg-white text-black shadow-md'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-md'
                      : isAppointmentsItem
                        ? item.isActive
                          ? 'bg-gradient-to-r from-[#ff7a18] to-[#ff4d6d] text-white shadow-md border border-[#ffb38a]/40'
                          : 'bg-gradient-to-r from-[#ff9a3d] to-[#ff6b8a] text-white hover:from-[#ff8a24] hover:to-[#ff5c7d] shadow-md border border-[#ffc299]/30'
                      : isBookingPageItem
                        ? item.isActive
                          ? 'bg-gradient-to-r from-[#00b4d8] to-[#4361ee] text-white shadow-md border border-[#90e0ef]/40'
                          : 'bg-gradient-to-r from-[#22c1e8] to-[#5a74f5] text-white hover:from-[#0db7df] hover:to-[#4c67f0] shadow-md border border-[#ade8f4]/30'
                      : isSubscribersItem && !isPlanLocked && !item.disabled
                        ? item.isActive
                          ? 'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-md border border-fuchsia-300/40'
                          : 'bg-gradient-to-r from-fuchsia-500/95 to-violet-600/95 text-white hover:from-fuchsia-600 hover:to-violet-700 shadow-md border border-fuchsia-300/30'
                      : isWhatsappPremiumItem
                        ? item.disabled
                          ? isLight
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                            : 'bg-transparent text-gray-500 cursor-not-allowed opacity-50'
                          : item.isActive
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md border border-amber-200'
                            : 'bg-gradient-to-r from-amber-300 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-500 shadow-md border border-amber-200'
                        : isPlanLocked
                          ? isLight
                            ? 'bg-gray-100 text-gray-500 border border-gray-200 opacity-75 hover:bg-gray-100'
                            : 'bg-transparent text-gray-500 opacity-60 hover:bg-white/5'
                          : item.isActive
                            ? isLight
                              ? 'bg-gray-900 text-white shadow-md'
                              : 'bg-white text-black shadow-md'
                            : item.disabled
                              ? item.id === 'hours'
                                ? isLight
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-transparent text-gray-500 cursor-not-allowed opacity-50'
                                : isLight
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                                  : 'bg-transparent text-gray-500 cursor-not-allowed opacity-50'
                              : isLight
                                ? 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-200'
                                : 'bg-transparent text-white'
                      } ${shouldHighlightAppointmentsShortcut
                        ? 'ring-2 ring-yellow-300 shadow-[0_0_0_2px_rgba(253,224,71,0.35)] animate-pulse'
                        : ''
                      }`}
                    title={item.tooltip || (isExpanded ? '' : item.label)}
                  >
                    <div className="relative">
                      <Icon
                        className={`h-5 w-5 flex-shrink-0 ${isIndicationItem
                          ? item.isActive
                            ? 'text-black'
                            : 'text-white'
                          : isAppointmentsItem || isBookingPageItem
                            ? 'text-white'
                          : isSubscribersItem && !isPlanLocked && !item.disabled
                            ? 'text-white'
                          : isWhatsappPremiumItem
                            ? item.disabled
                              ? 'text-gray-500'
                              : 'text-black'
                            : isPlanLocked
                              ? 'text-gray-500'
                              : item.disabled
                                ? item.id === 'hours'
                                  ? isLight ? 'text-gray-400' : 'text-black'
                                  : 'text-gray-500'
                                : item.isActive
                                  ? isLight
                                    ? 'text-white'
                                    : 'text-black'
                                  : isLight
                                    ? 'text-gray-700'
                                    : 'text-white'
                          }`}
                      />
                      {(isPlanLocked || isOnboardingLocked) && (
                        <span className="absolute -bottom-1 -right-1">
                          <Lock className="h-3 w-3 text-gray-500" />
                        </span>
                      )}
                      {item.showBadge && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {item.badgeCount}
                        </span>
                      )}
                      {shouldHighlightAppointmentsShortcut && !isExpanded && (
                        <span className="absolute -bottom-2 -right-2 bg-yellow-300 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          aqui
                        </span>
                      )}
                    </div>

                    {isExpanded && (
                      <>
                        <span
                          className={`text-sm font-medium whitespace-nowrap ${isIndicationItem
                            ? item.isActive
                              ? 'text-black'
                              : 'text-white'
                            : isAppointmentsItem || isBookingPageItem
                              ? 'text-white font-semibold'
                            : isSubscribersItem && !isPlanLocked && !item.disabled
                              ? 'text-white font-extrabold tracking-wide'
                            : isWhatsappPremiumItem
                              ? item.disabled
                                ? 'text-gray-400'
                                : 'text-black'
                              : isPlanLocked
                                ? isLight ? 'text-gray-600' : 'text-gray-300'
                                : item.disabled && item.id === 'hours'
                                  ? isLight
                                    ? 'text-gray-500'
                                    : 'text-black'
                                  : item.isActive
                                    ? isLight
                                      ? 'text-white'
                                      : 'text-black'
                                    : isLight
                                      ? 'text-gray-800'
                                      : 'text-white'
                            }`}
                        >
                          {isOnboardingLocked ? `🔒 ${item.label}` : item.label}
                        </span>
                        {shouldHighlightAppointmentsShortcut && (
                          <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-yellow-300 text-black ml-2">
                            👉 Clique aqui
                          </span>
                        )}
                        {item.id !== 'config' && (
                          <ChevronRight
                            className={`h-4 w-4 flex-shrink-0 opacity-50 ml-auto ${isIndicationItem
                              ? item.isActive
                                ? 'text-black'
                                : 'text-white'
                              : isAppointmentsItem || isBookingPageItem
                                ? 'text-white'
                              : isSubscribersItem && !isPlanLocked && !item.disabled
                                ? 'text-white'
                              : isWhatsappPremiumItem
                                ? item.disabled
                                  ? 'text-gray-400'
                                  : 'text-black'
                                : item.disabled && item.id === 'hours'
                                  ? isLight
                                    ? 'text-gray-500'
                                    : 'text-black'
                                  : item.isActive
                                    ? isLight
                                      ? 'text-white'
                                      : 'text-black'
                                    : isLight
                                      ? 'text-gray-700'
                                      : 'text-white'
                              }`}
                          />
                        )}
                      </>
                    )}
                  </button>

                  {/* Tooltip para menu recolhido */}
                  {!isExpanded && !item.disabled && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                      {item.label}
                      {item.tooltip && (
                        <div className="text-gray-300 text-xs mt-1">
                          {item.tooltip}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ✅ Atalho destacado abaixo do "Quero 1 mês grátis" */}
                {item.id === 'indication' && (
                  <div className="relative mt-2">
                    <button
                      onClick={() => {
                        if (onboardingStep < 4) {
                          onBlockedItemClick?.();
                          return;
                        }
                        if (!onReceberAdiantadoClick) return;
                        handleItemClick(onReceberAdiantadoClick);
                      }}
                      disabled={!onReceberAdiantadoClick}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${isReceberAdiantadoOpen
                          ? 'bg-white text-black shadow-md'
                          : 'bg-gradient-to-r from-[#009EE3] to-[#0077B6] text-white hover:from-[#0088C7] hover:to-[#006AA3] shadow-md'
                        } ${!onReceberAdiantadoClick ? 'opacity-60 cursor-not-allowed' : ''}`}
                      title={isExpanded ? '' : 'Receber adiantado'}
                      aria-label="Receber adiantado"
                    >
                      <CreditCard
                        className={`h-5 w-5 flex-shrink-0 ${isReceberAdiantadoOpen ? 'text-black' : 'text-white'
                          }`}
                      />
                      {isExpanded && (
                        <>
                          <span className={`text-sm font-medium whitespace-nowrap ${isReceberAdiantadoOpen ? 'text-black' : 'text-white'}`}>
                            Receber adiantado
                          </span>
                          <ChevronRight className={`h-4 w-4 flex-shrink-0 opacity-60 ml-auto ${isReceberAdiantadoOpen ? 'text-black' : 'text-white'}`} />
                        </>
                      )}
                    </button>

                    {/* Tooltip para menu recolhido */}
                    {!isExpanded && onReceberAdiantadoClick && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                        Receber adiantado
                      </div>
                    )}

                    {/* ✅ Botão "FILA DE ESPERA" (aba lateral/painel) abaixo de "Receber adiantado" */}
                    <div className="relative mt-2">
                      {/*
                        Regras de bloqueio:
                        - Plano Prata: bloqueado (upgrade)
                        - Onboarding incompleto: bloqueado (mostrar passo a passo)
                      */}
                      <button
                        onClick={() => {
                          if (isItemLocked('fila-espera')) {
                            onBlockedItemClick?.();
                            return;
                          }
                          if (isPlanLockedItem('fila-espera')) {
                            openUpgradeModal();
                            return;
                          }
                          handleItemClick(() => onTabChange('fila-espera'));
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${activeTab === 'fila-espera'
                            ? 'bg-white text-black shadow-md'
                            : isPlanLockedItem('fila-espera') || isItemLocked('fila-espera')
                              ? 'bg-white/5 text-gray-400 opacity-60 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-600 to-fuchsia-700 text-white hover:from-purple-700 hover:to-fuchsia-800 shadow-md'
                          }`}
                        title={isExpanded ? '' : 'Fila de espera'}
                        aria-label="Fila de espera"
                      >
                        <div className="relative">
                          <ListOrdered
                            className={`h-5 w-5 flex-shrink-0 ${activeTab === 'fila-espera'
                                ? 'text-black'
                                : isPlanLockedItem('fila-espera') || isItemLocked('fila-espera')
                                  ? 'text-gray-500'
                                  : 'text-white'
                              }`}
                          />
                          {(isPlanLockedItem('fila-espera') || isItemLocked('fila-espera')) && (
                            <span className="absolute -bottom-1 -right-1">
                              <Lock className="h-3 w-3 text-gray-500" />
                            </span>
                          )}
                        </div>
                        {isExpanded && (
                          <>
                            <span
                              className={`text-sm font-extrabold whitespace-nowrap ${activeTab === 'fila-espera' ? 'text-black' : isPlanLockedItem('fila-espera') ? 'text-gray-300' : 'text-white'
                                }`}
                            >
                              FILA DE ESPERA
                            </span>
                            <ChevronRight
                              className={`h-4 w-4 flex-shrink-0 opacity-60 ml-auto ${activeTab === 'fila-espera' ? 'text-black' : isPlanLockedItem('fila-espera') ? 'text-gray-400' : 'text-white'
                                }`}
                            />
                          </>
                        )}
                      </button>

                      {!isExpanded && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                          Fila de espera
                        </div>
                      )}
                    </div>

                    {/* ✅ Botão "PLACA BARBEARIA" abaixo de "FILA DE ESPERA" */}
                    <div className="relative mt-2">
                      <button
                        onClick={() => {
                          if (isItemLocked('placa-barbearia')) {
                            onBlockedItemClick?.();
                            return;
                          }
                          handleItemClick(() => onTabChange('placa-barbearia'));
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${activeTab === 'placa-barbearia'
                          ? 'bg-white text-black shadow-md'
                          : isItemLocked('placa-barbearia')
                            ? 'bg-white/5 text-gray-400 opacity-60 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-700 text-white hover:from-cyan-600 hover:to-blue-800 shadow-md'
                          }`}
                        title={isExpanded ? '' : 'Placa Barbearia'}
                        aria-label="Placa Barbearia"
                      >
                        <CreditCard
                          className={`h-5 w-5 flex-shrink-0 ${activeTab === 'placa-barbearia'
                            ? 'text-black'
                            : isItemLocked('placa-barbearia')
                              ? 'text-gray-500'
                              : 'text-white'
                            }`}
                        />
                        {isExpanded && (
                          <>
                            <span
                              className={`text-sm font-extrabold whitespace-nowrap ${activeTab === 'placa-barbearia' ? 'text-black' : 'text-white'}`}
                            >
                              PLACA BARBEARIA
                            </span>
                            <ChevronRight
                              className={`h-4 w-4 flex-shrink-0 opacity-60 ml-auto ${activeTab === 'placa-barbearia' ? 'text-black' : 'text-white'}`}
                            />
                          </>
                        )}
                      </button>

                      {!isExpanded && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                          Placa Barbearia
                        </div>
                      )}
                    </div>

                    {/* ✅ Botão "AVALIAÇÕES" abaixo de "PLACA BARBEARIA" */}
                    <div className="relative mt-2">
                      <button
                        onClick={() => {
                          if (isItemLocked('reviews')) {
                            onBlockedItemClick?.();
                            return;
                          }
                          handleItemClick(() => onTabChange('reviews'));
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                          activeTab === 'reviews'
                            ? 'bg-white text-black shadow-md'
                            : isItemLocked('reviews')
                              ? 'bg-white/5 text-gray-400 opacity-60 cursor-not-allowed'
                              : 'bg-gradient-to-r from-gray-700 to-gray-900 text-white hover:from-gray-800 hover:to-black shadow-md'
                        }`}
                        title={isExpanded ? '' : 'Avaliações'}
                        aria-label="Avaliações"
                      >
                        <div className="relative">
                          <Bell
                            className={`h-5 w-5 flex-shrink-0 ${
                              activeTab === 'reviews'
                                ? 'text-black'
                                : isItemLocked('reviews')
                                  ? 'text-gray-500'
                                  : 'text-white'
                            }`}
                          />
                          {pendingReviewsCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold leading-none">
                              {pendingReviewsCount > 99 ? '99+' : pendingReviewsCount}
                            </span>
                          )}
                        </div>
                        {isExpanded && (
                          <>
                            <span
                              className={`text-sm font-extrabold whitespace-nowrap ${
                                activeTab === 'reviews' ? 'text-black' : 'text-white'
                              }`}
                            >
                              AVALIAÇÕES
                            </span>
                            <ChevronRight
                              className={`h-4 w-4 flex-shrink-0 opacity-60 ml-auto ${
                                activeTab === 'reviews' ? 'text-black' : 'text-white'
                              }`}
                            />
                          </>
                        )}
                      </button>

                      {!isExpanded && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                          Avaliações
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Divisória entre botões */}
                {!isLastItem && (
                  <div className={`h-px w-full ${item.isActive ? 'bg-black opacity-20' : 'bg-white opacity-50'}`}></div>
                )}
              </React.Fragment>
            );
          })}
          {isMobile && isExpanded && showMenuScrollHint && (
            <div className="sticky bottom-0 pt-2 pointer-events-none">
              <div
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold text-center ${
                  isLight
                    ? 'bg-white/95 border-gray-300 text-gray-700'
                    : 'bg-black/80 border-gray-700 text-gray-200'
                }`}
              >
                ⬇ Arraste para ver mais opcoes
              </div>
            </div>
          )}
        </nav>

      </div>
    </>
  );
};

export default Sidebar;
