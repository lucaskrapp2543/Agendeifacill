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
  Home,
  Layers,
  Link,
  ListOrdered,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Package,
  Receipt,
  Rocket,
  Settings,
  UserCheck,
  Users,
  X,
  type LucideIcon
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { TopMonthlyWinnerCard, type TopMonthlyWinnerCardData } from './TopMonthlyWinnerCard';

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
  onSettingsPinModal?: (targetTab?: TabType | null) => void;
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
  topMonthlyWinner?: TopMonthlyWinnerCardData | null;
  closeSignal?: number; // força fechar menu mobile quando o pai precisar
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
  pendingSubscribersCount = 0,
  topMonthlyWinner = null,
  closeSignal = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPlanUpgradeModal, setShowPlanUpgradeModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMenuScrollHint, setShowMenuScrollHint] = useState(false);
  const [dismissTopWinnerCard, setDismissTopWinnerCard] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [pendingAdminMenuAfterPin, setPendingAdminMenuAfterPin] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const isLight = useLightLayout;

  useEffect(() => {
    setDismissTopWinnerCard(false);
  }, [topMonthlyWinner?.establishmentId]);

  useEffect(() => {
    if (!pendingAdminMenuAfterPin || !isSettingsUnlocked) return;
    setPendingAdminMenuAfterPin(false);
    setShowAdminMenu(true);
  }, [pendingAdminMenuAfterPin, isSettingsUnlocked]);

  useEffect(() => {
    if (isExpanded) return;
    setShowAdminMenu(false);
  }, [isExpanded]);

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

  const redirectUpgradeToDiamanteWhatsapp = () => {
    const phone = '5548991265320';
    const message = 'quero subir meu plano para diamante';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Função para verificar se um item deve estar bloqueado
  const isItemLocked = (itemId: string): boolean => {
    // Suporte precisa ficar disponível mesmo no primeiro acesso.
    if (itemId === 'support') return false;

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
    // Suporte precisa ficar disponível mesmo no primeiro acesso.
    if (itemId === 'support') return false;

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

  // No celular, só abre o menu automaticamente na home inicial.
  // Em telas de conteúdo (ex.: Meus Serviços), nunca força abrir de novo.
  useEffect(() => {
    if (!isMobile) return;
    if (activeTab === 'appointments' && closeSignal === 0) {
      setIsExpanded(true);
      return;
    }
    setIsExpanded(false);
  }, [isMobile, activeTab, closeSignal]);

  useEffect(() => {
    const handleCloseSidebar = () => setIsExpanded(false);
    window.addEventListener('agendei:close-sidebar', handleCloseSidebar);
    return () => window.removeEventListener('agendei:close-sidebar', handleCloseSidebar);
  }, []);

  useEffect(() => {
    if (closeSignal > 0) {
      setIsExpanded(false);
    }
  }, [closeSignal]);

  // Recolher o sidebar quando clicar em um item
  const handleItemClick = (onClick: () => void) => {
    onClick();
    setIsExpanded(false);
  };

  const hasAdminPin =
    Boolean(establishment?.pin_password) &&
    String(establishment?.pin_password || '').trim().length > 0 &&
    String(establishment?.pin_password || '').trim() !== '0000';

  const openAdminMenu = () => {
    if (onboardingStep < 4) {
      onBlockedItemClick?.();
      return;
    }

    if (hasAdminPin && !isSettingsUnlocked) {
      setPendingAdminMenuAfterPin(true);
      onSettingsPinModal?.(activeTab);
      return;
    }

    setShowAdminMenu((current) => !current);
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
      id: 'top10-clientes',
      label: 'Top 5',
      icon: Crown,
      onClick: () => handleItemClick(() => onTabChange('top10-clientes')),
      isActive: activeTab === 'top10-clientes',
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
      id: 'admin-menu',
      label: 'Menu Admin',
      icon: Settings,
      onClick: openAdminMenu,
      isActive: false,
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
      id: 'passo-a-passo',
      label: 'Como funciona o Sistema',
      icon: Rocket,
      onClick: () => handleItemClick(() => onTabChange('passo-a-passo')),
      isActive: activeTab === 'passo-a-passo',
      disabled: false
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

  const adminMenuItemIds = new Set([
    'whatsapp-reminders',
    'indication',
    'subscribers',
    'clients',
    'service-categories',
    'products',
    'professionals',
    'dashboard',
    'expenses',
    'taxes',
    'config',
  ]);
  const adminMenuItems = menuItems.filter((item) => adminMenuItemIds.has(item.id));
  const mainSidebarItemOrder = new Map(
    ['notifications', 'top10-clientes', 'appointments', 'client-page', 'admin-menu', 'support', 'passo-a-passo', 'logout'].map((id, index) => [id, index])
  );
  const sidebarMenuItems = menuItems
    .filter((item) => !adminMenuItemIds.has(item.id) && mainSidebarItemOrder.has(item.id))
    .sort((a, b) => (mainSidebarItemOrder.get(a.id) ?? 999) - (mainSidebarItemOrder.get(b.id) ?? 999));
  const isAdminTabActive =
    activeTab === 'whatsapp-reminders' ||
    activeTab === 'indication' ||
    activeTab === 'subscribers' ||
    activeTab === 'clients' ||
    activeTab === 'service-categories' ||
    activeTab === 'products' ||
    activeTab === 'professionals' ||
    activeTab === 'financial-dashboard' ||
    activeTab === 'expenses' ||
    activeTab === 'taxes' ||
    activeTab === 'settings';

  const adminShortcutItems: Array<{
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    isActive?: boolean;
    lockedByPlan?: boolean;
    showBadge?: boolean;
    badgeCount?: number | string;
    onClick: () => void;
  }> = [
    {
      id: 'receber-adiantado',
      label: 'Receber adiantado',
      description: 'Atalho para configurar Mercado Pago e pagamentos antecipados.',
      icon: CreditCard,
      isActive: isReceberAdiantadoOpen,
      onClick: () => {
        if (onboardingStep < 4) {
          onBlockedItemClick?.();
          return;
        }
        if (!onReceberAdiantadoClick) return;
        handleItemClick(onReceberAdiantadoClick);
        setShowAdminMenu(false);
      },
    },
    {
      id: 'fila-espera',
      label: 'Fila de Espera',
      description: 'Controle a fila de atendimento do estabelecimento.',
      icon: ListOrdered,
      isActive: activeTab === 'fila-espera',
      lockedByPlan: isPlanLockedItem('fila-espera'),
      onClick: () => {
        if (isItemLocked('fila-espera')) {
          onBlockedItemClick?.();
          return;
        }
        if (isPlanLockedItem('fila-espera')) {
          openUpgradeModal();
          return;
        }
        handleItemClick(() => onTabChange('fila-espera'));
        setShowAdminMenu(false);
      },
    },
    {
      id: 'placa-barbearia',
      label: 'Placa Barbearia',
      description: 'Peça a placa com QR Code para divulgar a barbearia.',
      icon: CreditCard,
      isActive: activeTab === 'placa-barbearia',
      onClick: () => {
        if (isItemLocked('placa-barbearia')) {
          onBlockedItemClick?.();
          return;
        }
        handleItemClick(() => onTabChange('placa-barbearia'));
        setShowAdminMenu(false);
      },
    },
    {
      id: 'reviews',
      label: 'Avaliações',
      description: 'Modere avaliações dos clientes antes de publicar.',
      icon: Bell,
      isActive: activeTab === 'reviews',
      showBadge: pendingReviewsCount > 0,
      badgeCount: pendingReviewsCount > 99 ? '99+' : pendingReviewsCount,
      onClick: () => {
        if (isItemLocked('reviews')) {
          onBlockedItemClick?.();
          return;
        }
        handleItemClick(() => onTabChange('reviews'));
        setShowAdminMenu(false);
      },
    },
  ];

  // Textos auxiliares (mobile fullscreen) — estilo CNH Digital
  const mobileDescriptions: Record<string, string> = {
    notifications: 'Veja avisos de agendamentos, cancelamentos e compras de assinaturas.',
    appointments: 'Veja seus agendamentos, crie reservas e acompanhe o dia.',
    'whatsapp-reminders': 'Conecte o WhatsApp por QR ou código e ative lembretes automáticos para seus clientes.',
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

  if (isMobile) {
    const establishmentName = String(establishment?.name || 'Barbearia').trim() || 'Barbearia';
    const establishmentCode = String(establishment?.code || '').trim();
    const establishmentImage = String(establishment?.logo_url || establishment?.profile_image_url || '').trim();
    const todayLabel = new Date().toLocaleDateString('pt-BR');

    const executeMobileAction = (
      itemId: string,
      action: () => void,
      options?: { respectPlanLock?: boolean }
    ) => {
      if (isItemLocked(itemId)) {
        onBlockedItemClick?.();
        return;
      }
      if (options?.respectPlanLock && isPlanLockedItem(itemId)) {
        openUpgradeModalMobileSafe();
        return;
      }
      action();
      setIsExpanded(false);
    };

    const openFinancialDashboard = () => {
      executeMobileAction('dashboard', () => {
        if (establishment?.pin_password && establishment.pin_password.length > 0 && !isDashboardUnlocked) {
          onDashboardPinModal?.();
          return;
        }
        onTabChange('financial-dashboard');
      });
    };

    const openSettings = () => {
      executeMobileAction('config', () => {
        if (establishment?.pin_password && establishment.pin_password.length > 0 && !isSettingsUnlocked) {
          onSettingsPinModal?.();
          return;
        }
        onTabChange('settings');
      });
    };

    const primaryActions: Array<{
      id: string;
      label: string;
      labelLines?: string[];
      icon: LucideIcon;
      onClick: () => void;
      className: string;
      badge?: number;
    }> = [
      {
        id: 'notifications',
        label: 'Notificações',
        icon: Bell,
        onClick: () => executeMobileAction('notifications', onNotificationsClick || (() => { })),
        className: 'bg-[#111827]',
        badge: unreadNotifications > 0 ? unreadNotifications : undefined,
      },
      {
        id: 'top10-clientes',
        label: 'Top 5',
        icon: Crown,
        onClick: () => executeMobileAction('top10-clientes', () => onTabChange('top10-clientes')),
        className: 'bg-[#3a2a0a]',
      },
      {
        id: 'appointments',
        label: 'Meus Agendamentos',
        labelLines: ['Meus', 'Agendamentos'],
        icon: Calendar,
        onClick: () => executeMobileAction('appointments', () => onTabChange('appointments')),
        className: 'bg-[#3b2412]',
      },
      {
        id: 'client-page',
        label: 'Pagina de Agendamentos',
        icon: Link,
        onClick: () => executeMobileAction('client-page', () => onTabChange('client-page')),
        className: 'bg-[#102a43]',
      },
    ];

    const businessActions: Array<{ id: string; label: string; icon: LucideIcon; onClick: () => void; className: string; badge?: number }> = [
      {
        id: 'subscribers',
        label: 'Meus Assinantes',
        icon: Crown,
        onClick: () => executeMobileAction('subscribers', () => onTabChange('subscribers'), { respectPlanLock: true }),
        className: 'bg-[#2b1b3f]',
        badge: pendingSubscribersCount > 0 ? pendingSubscribersCount : undefined,
      },
      {
        id: 'whatsapp-reminders',
        label: 'Lembretes para Clientes',
        icon: MessageCircle,
        onClick: () => executeMobileAction('whatsapp-reminders', () => onTabChange('whatsapp-reminders')),
        className: 'bg-[#3a2a0a]',
      },
      {
        id: 'indication',
        label: 'Quero 1 mes gratis',
        icon: Gift,
        onClick: () => executeMobileAction('indication', () => onTabChange('indication')),
        className: 'bg-[#123524]',
      },
      {
        id: 'receber-adiantado',
        label: 'Receber adiantado',
        icon: CreditCard,
        onClick: () => {
          if (!onReceberAdiantadoClick) return;
          onReceberAdiantadoClick();
          setIsExpanded(false);
        },
        className: 'bg-[#102a43]',
      },
      {
        id: 'fila-espera',
        label: 'Fila de Espera',
        icon: ListOrdered,
        onClick: () => executeMobileAction('fila-espera', () => onTabChange('fila-espera'), { respectPlanLock: true }),
        className: 'bg-[#3b1730]',
      },
      {
        id: 'placa-barbearia',
        label: 'Placa Barbearia',
        icon: CreditCard,
        onClick: () => executeMobileAction('placa-barbearia', () => onTabChange('placa-barbearia')),
        className: 'bg-[#172554]',
      },
      {
        id: 'reviews',
        label: 'Avaliações',
        icon: Bell,
        onClick: () => executeMobileAction('reviews', () => onTabChange('reviews')),
        className: 'bg-[#1f2937]',
        badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined,
      },
      {
        id: 'clients',
        label: 'Meus Clientes',
        icon: Users,
        onClick: () => executeMobileAction('clients', () => onTabChange('clients')),
        className: 'bg-[#1f2937]',
      },
      {
        id: 'service-categories',
        label: 'Meus Serviços',
        icon: Layers,
        onClick: () => executeMobileAction('service-categories', () => onTabChange('service-categories')),
        className: 'bg-[#1f2937]',
      },
      {
        id: 'products',
        label: 'Meus Produtos',
        icon: Package,
        onClick: () => executeMobileAction('products', () => onTabChange('products'), { respectPlanLock: true }),
        className: 'bg-[#1f2937]',
      },
      {
        id: 'professionals',
        label: 'Profissionais',
        icon: UserCheck,
        onClick: () => executeMobileAction('professionals', () => onTabChange('professionals')),
        className: 'bg-[#1f2937]',
      },
      {
        id: 'dashboard',
        label: 'Financeiro',
        icon: BarChart3,
        onClick: openFinancialDashboard,
        className: 'bg-[#1f2937]',
      },
      {
        id: 'expenses',
        label: 'Despesas',
        icon: DollarSign,
        onClick: () => executeMobileAction('expenses', () => onTabChange('expenses')),
        className: 'bg-[#1f2937]',
      },
      {
        id: 'taxes',
        label: 'Minhas Taxas',
        icon: Receipt,
        onClick: () => executeMobileAction('taxes', () => onTabChange('taxes')),
        className: 'bg-[#1f2937]',
      },
      {
        id: 'config',
        label: 'Config',
        icon: Settings,
        onClick: openSettings,
        className: 'bg-[#1f2937]',
      },
    ];

    const mainMobileMenuActions: Array<{ id: string; label: string; icon: LucideIcon; onClick: () => void; tone?: 'danger'; isActive?: boolean }> = [
      { id: 'admin-menu', label: 'Menu Admin', icon: Settings, onClick: openAdminMenu, isActive: showAdminMenu || isAdminTabActive },
      { id: 'support', label: 'Falar com Suporte', icon: MessageSquare, onClick: () => executeMobileAction('support', () => onTabChange('support')) },
      { id: 'passo-a-passo', label: 'Como funciona', icon: Rocket, onClick: () => executeMobileAction('passo-a-passo', () => onTabChange('passo-a-passo')) },
      { id: 'logout', label: 'Sair', icon: LogOut, onClick: onSignOut, tone: 'danger' },
    ];

    const isMobileActionVisuallyLocked = (itemId: string) =>
      isItemLockedByOnboarding(itemId) || isPlanLockedItem(itemId);

    const getMobileLockedLabel = (itemId: string) =>
      isPlanLockedItem(itemId) ? 'Plano' : isItemLockedByOnboarding(itemId) ? 'Bloqueado' : '';

    const mobileBottomButtonClass = (itemId: string) =>
      `relative text-center text-xs py-2 rounded-lg transition-colors ${
        isMobileActionVisuallyLocked(itemId)
          ? 'text-white/35'
          : 'text-white hover:bg-white/10'
      }`;

    if (!isExpanded) {
      return (
        <div className="fixed inset-x-0 top-0 z-40 pointer-events-none">
          <div className="p-3 flex items-center justify-between">
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="h-11 w-11 rounded-xl border border-white/20 bg-black/70 text-white flex items-center justify-center"
                title="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="h-11 px-3 rounded-xl border border-white/20 bg-black/70 text-white text-xs font-semibold tracking-wide flex items-center gap-2"
                title="Abrir menu"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Abrir menu
              </button>
            </div>
            <button
              type="button"
              onClick={onNotificationsClick}
              className="pointer-events-auto h-11 w-11 rounded-xl border border-white/20 bg-black/70 text-white flex items-center justify-center relative"
              title="Notificacoes"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
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
                  ✨ Recurso exclusivo do Plano Diamante
                </div>
                <div className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-sm leading-relaxed`}>
                  Seu plano Prata não inclui esse recurso. Para liberar, suba para o Diamante.
                </div>
                <button
                  type="button"
                  onClick={redirectUpgradeToDiamanteWhatsapp}
                  className="w-full mt-2 px-4 py-3 rounded-xl font-extrabold text-white bg-gradient-to-r from-fuchsia-600 to-purple-700"
                >
                  💎 Ser Diamante
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="fixed inset-0 z-40 bg-[#05070d] text-white overflow-y-auto">
          <div className="px-3 pb-24">
            <div className="pt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="h-10 w-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center"
                title="Fechar menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div className="text-center leading-tight">
                <div className="text-xl">👑</div>
                <div
                  className="text-[28px] text-white leading-none"
                  style={{
                    fontFamily: '"Segoe Script", "Lucida Handwriting", "Brush Script MT", cursive',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                  }}
                >
                  Agendei Fácil
                </div>
              </div>
              <button
                type="button"
                onClick={onNotificationsClick}
                className="h-10 w-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center relative"
                title="Notificacoes"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-[#111827] p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-full border border-amber-400/60 overflow-hidden bg-black flex items-center justify-center">
                  {establishmentImage ? (
                    <img src={establishmentImage} alt={establishmentName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl">🏪</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold leading-[1.15] break-words">
                    Olá, {establishmentName}!
                  </p>
                  <p className="text-white/80 text-sm font-semibold break-words">
                    {establishmentCode ? `Código: ${establishmentCode}` : 'Bem-vindo ao sistema'}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-right shrink-0">
                <p className="text-xs text-white/70">Hoje é</p>
                <p className="text-[14px] font-extrabold">{todayLabel}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-lg font-extrabold tracking-wide text-white/90">AÇÕES PRINCIPAIS</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {primaryActions.map((action) => {
                  const isLocked = isMobileActionVisuallyLocked(action.id);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.onClick}
                      aria-disabled={isLocked}
                      className={`relative rounded-2xl border px-2 py-2 text-center min-h-[76px] transition-colors ${
                        isLocked
                          ? 'bg-[#111827] border-white/10 text-white/45'
                          : `border-white/10 ${action.className} text-white hover:bg-[#263244]`
                      }`}
                    >
                      {isLocked && (
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] font-black text-white/80">
                          <Lock className="h-2.5 w-2.5" />
                          {getMobileLockedLabel(action.id)}
                        </span>
                      )}
                      {action.badge != null && action.badge > 0 && !isLocked && (
                        <span className="absolute right-2 top-2 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                          {action.badge > 99 ? '99+' : action.badge}
                        </span>
                      )}
                      <action.icon className={`h-4 w-4 mb-2 mx-auto ${isLocked ? 'text-white/35' : 'text-white/95'}`} />
                      <p className={`text-[10px] font-extrabold leading-[1.05] whitespace-normal break-normal ${isLocked ? 'text-white/50' : ''}`}>
                        {Array.isArray(action.labelLines) && action.labelLines.length > 0
                          ? action.labelLines.map((line, lineIdx) => (
                              <span key={`${action.id}-line-${lineIdx}`} className="block">
                                {line}
                              </span>
                            ))
                          : action.label}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-2">
                {mainMobileMenuActions.filter((action) => action.id === 'admin-menu').map((action) => {
                  const Icon = action.icon;
                  const isDanger = action.tone === 'danger';
                  const isAdminMenuAction = action.id === 'admin-menu';
                  const isLocked = isAdminMenuAction && hasAdminPin && !isSettingsUnlocked;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.onClick}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                        isDanger
                          ? 'border-red-500/30 bg-red-600/10 text-red-200 hover:bg-red-600/20'
                          : action.isActive
                            ? 'border-white bg-white text-black'
                            : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="relative">
                        <Icon className="h-5 w-5" />
                        {isLocked && <Lock className="absolute -bottom-1 -right-1 h-3 w-3 text-amber-400" />}
                      </div>
                      <span className="flex-1 text-sm font-extrabold">{action.label}</span>
                      {isAdminMenuAction ? (
                        <ChevronRight className={`h-4 w-4 opacity-70 transition-transform ${showAdminMenu ? 'rotate-90' : ''}`} />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-70" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {showAdminMenu && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b1220] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold tracking-wide text-white/90">MENU ADMIN</p>
                  <p className="text-xs text-white/55 font-semibold">Assinantes, pagamentos, equipe e configurações.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-extrabold text-white/70">
                  Admin
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {businessActions.map((action) => {
                  const isLocked = isMobileActionVisuallyLocked(action.id);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.onClick}
                      aria-disabled={isLocked}
                      className={`relative rounded-xl border px-1.5 py-2.5 text-center min-h-[72px] transition-colors ${
                        isLocked
                          ? 'border-white/5 bg-black/25 text-white/35'
                          : `border-white/10 ${action.className} text-white hover:bg-[#263244]`
                      }`}
                    >
                      {isLocked && (
                        <Lock className="absolute right-1 top-1 h-2.5 w-2.5 text-white/40" />
                      )}
                      {action.badge != null && action.badge > 0 && !isLocked && (
                        <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {action.badge > 99 ? '99+' : action.badge}
                        </span>
                      )}
                      <action.icon className={`h-4 w-4 mx-auto mb-1.5 ${isLocked ? 'text-white/30' : 'text-white/90'}`} />
                      <p className={`text-[9px] font-extrabold leading-[1.05] whitespace-normal break-normal ${isLocked ? 'text-white/40' : ''}`}>{action.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            <div className="mt-3 space-y-2">
              {mainMobileMenuActions.filter((action) => action.id !== 'admin-menu').map((action) => {
                const Icon = action.icon;
                const isDanger = action.tone === 'danger';
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      isDanger
                        ? 'border-red-500/30 bg-red-600/10 text-red-200 hover:bg-red-600/20'
                        : action.isActive
                          ? 'border-white bg-white text-black'
                          : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1 text-sm font-extrabold">{action.label}</span>
                    <ChevronRight className="h-4 w-4 opacity-70" />
                  </button>
                );
              })}
            </div>
            {topMonthlyWinner && !dismissTopWinnerCard ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => executeMobileAction('top10-clientes', () => onTabChange('top10-clientes'))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    executeMobileAction('top10-clientes', () => onTabChange('top10-clientes'));
                  }
                }}
                className="mt-4 w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 rounded-2xl"
                aria-label="Abrir ranking Top 1 do mês"
              >
                <TopMonthlyWinnerCard
                  winner={topMonthlyWinner}
                  className="!p-3"
                  onDismiss={() => setDismissTopWinnerCard(true)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => executeMobileAction('top10-clientes', () => onTabChange('top10-clientes'))}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] px-3 py-3 text-left"
              >
                <p className="text-amber-300 text-xs font-bold">🏆 TOP 1 BARBEIRO</p>
                <p className="text-white text-sm font-extrabold mt-1">Ver destaque do mês e ranking</p>
              </button>
            )}

          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#05070d] px-3 py-2">
            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={() => executeMobileAction('appointments', () => onTabChange('appointments'))} className={mobileBottomButtonClass('appointments')}>
                {isMobileActionVisuallyLocked('appointments') && <Lock className="absolute right-2 top-1 h-2.5 w-2.5 text-white/35" />}
                <Home className="h-4 w-4 mx-auto mb-1" />
                Início
              </button>
              <button type="button" onClick={() => executeMobileAction('appointments', () => onTabChange('appointments'))} className={mobileBottomButtonClass('appointments')}>
                {isMobileActionVisuallyLocked('appointments') && <Lock className="absolute right-2 top-1 h-2.5 w-2.5 text-white/35" />}
                <Calendar className="h-4 w-4 mx-auto mb-1" />
                Agenda
              </button>
              <button type="button" onClick={openFinancialDashboard} className={mobileBottomButtonClass('dashboard')}>
                {isMobileActionVisuallyLocked('dashboard') && <Lock className="absolute right-2 top-1 h-2.5 w-2.5 text-white/35" />}
                <DollarSign className="h-4 w-4 mx-auto mb-1" />
                Financeiro
              </button>
              <button type="button" onClick={openSettings} className={mobileBottomButtonClass('config')}>
                <MoreHorizontal className="h-4 w-4 mx-auto mb-1" />
                Mais
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ✅ Modal de upgrade do Plano (Prata → Diamante) */}
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
                ✨ Recurso exclusivo do Plano Diamante
              </div>
              <div className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-sm leading-relaxed`}>
                Seu plano Prata não inclui esse recurso.
                <br />
                Para liberar, o próximo nível é o <strong>Plano Diamante</strong>.
              </div>

              <div className={`mt-2 rounded-xl p-3 border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-gray-800'}`}>
                <div className={`${isLight ? 'text-gray-900' : 'text-gray-100'} text-sm font-extrabold`}>
                  💎 No Plano DIAMANTE você libera:
                </div>
                <div className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-sm leading-relaxed mt-2`}>
                  <div className="mt-2 space-y-1">
                    <div>✅ Sistema de estoque de produtos</div>
                    <div>✅ Sistema completo de assinantes</div>
                    <div>✅ Profissionais ilimitados</div>
                    <div>✅ Controle de comissões por profissionais</div>
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
                    Fale com o suporte para ativar o Diamante.
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

      {showAdminMenu && !isMobile && (
        <div
          className={`fixed top-0 bottom-0 z-50 w-80 border-r shadow-2xl ${
            isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#070a12] border-white/10 text-white'
          }`}
          style={{ left: isExpanded ? '16rem' : '4rem' }}
        >
          <div className={`flex items-center justify-between px-4 py-4 border-b ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
            <div>
              <div className="text-lg font-extrabold">Menu Admin</div>
              <div className={`text-xs mt-0.5 ${isLight ? 'text-gray-600' : 'text-white/60'}`}>
                Opções internas liberadas com a senha de 4 dígitos.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdminMenu(false)}
              className={`h-9 w-9 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-gray-100' : 'hover:bg-white/10'}`}
              title="Fechar Menu Admin"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 86px)' }}>
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const isPlanLocked = Boolean((item as any).lockedByPlan);
              const isOnboardingLocked = !isPlanLocked && isItemLockedByOnboarding(item.id);
              return (
                <button
                  key={`admin-${item.id}`}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    if (!isPlanLocked && !isOnboardingLocked) {
                      setShowAdminMenu(false);
                    }
                  }}
                  className={`relative w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    item.isActive
                      ? isLight
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-black border-white'
                      : isPlanLocked || isOnboardingLocked
                        ? isLight
                          ? 'bg-gray-100 text-gray-500 border-gray-200'
                          : 'bg-white/5 text-white/45 border-white/10'
                        : isLight
                          ? 'bg-white text-gray-900 hover:bg-gray-50 border-gray-200'
                          : 'bg-white/5 text-white hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {(isPlanLocked || isOnboardingLocked) && (
                      <Lock className="absolute -bottom-1 -right-1 h-3 w-3 text-amber-400" />
                    )}
                    {item.showBadge && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold leading-none">
                        {item.badgeCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold truncate">
                      {item.label}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${item.isActive ? 'opacity-70' : isLight ? 'text-gray-500' : 'text-white/50'}`}>
                      {isPlanLocked ? 'Recurso do plano Diamante' : isOnboardingLocked ? 'Bloqueado pelo passo a passo' : mobileDescriptions[item.id] || 'Abrir opção administrativa'}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </button>
              );
            })}

            {adminShortcutItems.map((item) => {
              const Icon = item.icon;
              const isPlanLocked = Boolean(item.lockedByPlan);
              const isOnboardingLocked = !isPlanLocked && isItemLockedByOnboarding(item.id);
              return (
                <button
                  key={`admin-shortcut-${item.id}`}
                  type="button"
                  onClick={item.onClick}
                  className={`relative w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    item.isActive
                      ? isLight
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-black border-white'
                      : isPlanLocked || isOnboardingLocked
                        ? isLight
                          ? 'bg-gray-100 text-gray-500 border-gray-200'
                          : 'bg-white/5 text-white/45 border-white/10'
                        : isLight
                          ? 'bg-white text-gray-900 hover:bg-gray-50 border-gray-200'
                          : 'bg-white/5 text-white hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {(isPlanLocked || isOnboardingLocked) && (
                      <Lock className="absolute -bottom-1 -right-1 h-3 w-3 text-amber-400" />
                    )}
                    {item.showBadge && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold leading-none">
                        {item.badgeCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold truncate">
                      {item.label}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${item.isActive ? 'opacity-70' : isLight ? 'text-gray-500' : 'text-white/50'}`}>
                      {isPlanLocked ? 'Recurso do plano Diamante' : isOnboardingLocked ? 'Bloqueado pelo passo a passo' : item.description}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        aria-hidden="true"
        className={`hidden md:block flex-shrink-0 transition-all duration-300 ${isExpanded ? 'w-64' : 'w-16'}`}
      />

      <div
        className={`flex fixed left-0 top-0 bottom-0 border-r transition-all duration-300 z-40 flex-col ${isExpanded ? 'w-64' : 'w-16'
          } ${isLight ? 'bg-white border-gray-200' : 'bg-gradient-to-b from-gray-900 via-black to-black border-gray-800'
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

          {sidebarMenuItems.map((item, index) => {
            const Icon = item.icon;
            const isIndicationItem = item.id === 'indication';
            const isWhatsappPremiumItem = item.id === 'whatsapp-reminders';
            const isSubscribersItem = item.id === 'subscribers';
            const isAppointmentsItem = item.id === 'appointments';
            const isBookingPageItem = item.id === 'client-page';
            const isLastItem = index === sidebarMenuItems.length - 1;
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
