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
  Package,
  Receipt,
  Settings,
  Shuffle,
  UserCheck,
  Users,
  TrendingUp,
  Rocket
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

type TabType = 'appointments' | 'services' | 'settings' | 'financial-dashboard' | 'expenses' | 'clients' | 'subscribers' | 'products' | 'professionals' | 'service-categories' | 'taxes' | 'reserve-client' | 'ranking' | 'missing-clients' | 'draw' | 'passo-a-passo' | 'client-page' | 'indication';

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
  onBlockedItemClick
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

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
      id: 'config',
      label: 'Config | Página Agendamentos',
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

      <div className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 flex flex-col ${isExpanded ? 'w-64' : 'w-16'
        } md:relative md:z-auto md:flex-shrink-0`}>
        {/* Botão de toggle */}
        <div className="flex justify-between items-center p-2 border-b border-gray-200">
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-red-600 text-sm font-medium hover:text-red-700 transition-colors cursor-pointer"
              title="Recolher menu"
            >
              CLIQUE PARA RECOLHER
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              data-sidebar-toggle
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2.5 rounded-lg hover:bg-gray-100 transition-all relative border-2 ${
                !isExpanded 
                  ? 'border-blue-500 bg-blue-50 shadow-md hover:shadow-lg hover:scale-105' 
                  : 'border-transparent'
              }`}
              title={isExpanded ? 'Recolher menu' : 'Clique para abrir o menu'}
            >
              {isExpanded ? (
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              ) : (
                <div className="relative">
                  <ChevronRight className="h-5 w-5 text-blue-600 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                  </div>
                </div>
              )}
            </button>
            {!isExpanded && (
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap flex items-center gap-1.5 animate-pulse">
                <span>☰</span>
                <span>MENU</span>
              </div>
            )}
          </div>
        </div>

        {/* Lista de itens do menu */}
        <nav className="p-2 space-y-1 overflow-y-auto flex-1 scrollbar-hide">
          {/* Botão COMECE AQUI */}
          <div className="relative">
            <button
              onClick={() => handleItemClick(() => onTabChange('passo-a-passo'))}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                activeTab === 'passo-a-passo'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={isExpanded ? '' : 'COMECE AQUI'}
            >
              <Rocket className="h-5 w-5 flex-shrink-0" />
              {isExpanded && (
                <span className="text-sm font-medium whitespace-nowrap">
                  COMECE AQUI
                </span>
              )}
            </button>

            {/* Tooltip para menu recolhido */}
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                COMECE AQUI
              </div>
            )}
          </div>

          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isWhiteItem = (item as any).isWhite;
            const isIndicationItem = item.id === 'indication';
            return (
              <React.Fragment key={item.id}>
                <div className="relative">
                  <button
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                      isWhiteItem
                        ? 'bg-white text-white hover:bg-gray-50'
                        : isIndicationItem
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-md'
                          : item.isActive
                            ? 'bg-blue-600 text-white shadow-md'
                            : item.disabled
                              ? 'text-gray-400 cursor-not-allowed opacity-50'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    title={item.tooltip || (isExpanded ? '' : item.label)}
                  >
                    <div className="relative">
                      <Icon className={`h-5 w-5 flex-shrink-0 ${isWhiteItem ? 'text-white' : isIndicationItem ? 'text-white' : ''}`} />
                      {item.showBadge && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {item.badgeCount}
                        </span>
                      )}
                    </div>

                    {isExpanded && (
                      <>
                        <span className="text-sm font-medium whitespace-nowrap">
                          {item.label}
                        </span>
                        {item.id !== 'config' && (
                          <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-50 ml-auto" />
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
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
