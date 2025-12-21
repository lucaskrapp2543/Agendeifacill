import {
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  DollarSign,
  Gift,
  Layers,
  Link,
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
import React, { useEffect, useState } from 'react';

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
  | 'passo-a-passo'
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
  onToggleLayoutTheme
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isLight = useLightLayout;

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


  // Recolher o sidebar quando clicar em um item
  const handleItemClick = (onClick: () => void) => {
    onClick();
    // Recolhe o sidebar após clicar em um item
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
      id: 'subscribers',
      label: 'Meus Assinantes',
      icon: Crown,
      onClick: () => {
        if (isItemLocked('subscribers')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('subscribers'));
        }
      },
      isActive: activeTab === 'subscribers',
      disabled: isItemLocked('subscribers')
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
        if (isItemLocked('products')) {
          onBlockedItemClick?.();
        } else {
          handleItemClick(() => onTabChange('products'));
        }
      },
      isActive: activeTab === 'products',
      disabled: isItemLocked('products')
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
      id: 'client-page',
      label: 'Página Clientes',
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

  return (
    <>
      {/* Overlay para mobile */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div
        className={`fixed left-0 top-0 bottom-0 border-r transition-all duration-300 z-40 flex flex-col ${isExpanded ? 'w-64' : 'w-16'
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
                  Passo a passo
                </span>
              )}
            </button>

            {/* Tooltip para menu recolhido */}
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                Passo a passo
              </div>
            )}
          </div>

          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isIndicationItem = item.id === 'indication';
            const isLembretesClientesItem = item.id === 'whatsapp-reminders';
            const isLastItem = index === menuItems.length - 1;

            return (
              <React.Fragment key={item.id}>
                <div className="relative">
                  <button
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${isIndicationItem
                      ? item.isActive
                        ? 'bg-white text-black shadow-md'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-md'
                      : isLembretesClientesItem && !item.disabled
                        ? item.isActive
                          ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 ring-1 ring-amber-200/40'
                          : isLight
                            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-950 hover:from-amber-100 hover:to-yellow-100 border border-amber-200/80 shadow-sm hover:shadow-md hover:shadow-amber-500/15'
                            : 'bg-gradient-to-r from-amber-500/15 to-yellow-500/10 text-amber-200 hover:from-amber-500/25 hover:to-yellow-500/20 border border-amber-400/20 shadow-sm shadow-amber-500/10'
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
                      }`}
                    title={item.tooltip || (isExpanded ? '' : item.label)}
                  >
                    <div className="relative">
                      <Icon
                        className={`h-5 w-5 flex-shrink-0 ${isIndicationItem
                          ? item.isActive
                            ? 'text-black'
                            : 'text-white'
                          : isLembretesClientesItem && !item.disabled
                            ? item.isActive
                              ? 'text-white'
                              : isLight
                                ? 'text-amber-700'
                                : 'text-amber-300'
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
                      {item.showBadge && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {item.badgeCount}
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
                            : isLembretesClientesItem && !item.disabled
                              ? item.isActive
                                ? 'text-white'
                                : isLight
                                  ? 'text-amber-900'
                                  : 'text-amber-300'
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
                          {item.label}
                        </span>
                        {item.id !== 'config' && (
                          <ChevronRight
                            className={`h-4 w-4 flex-shrink-0 opacity-50 ml-auto ${isIndicationItem
                              ? item.isActive
                                ? 'text-black'
                                : 'text-white'
                              : isLembretesClientesItem && !item.disabled
                                ? item.isActive
                                  ? 'text-white'
                                  : isLight
                                    ? 'text-amber-700'
                                    : 'text-amber-300'
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
                {/* Divisória entre botões */}
                {!isLastItem && (
                  <div className={`h-px w-full ${item.isActive ? 'bg-black opacity-20' : 'bg-white opacity-50'}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

      </div>
    </>
  );
};

export default Sidebar;
