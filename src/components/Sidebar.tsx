import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Crown, 
  Clock, 
  BarChart3, 
  Settings, 
  LogOut, 
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  Shuffle,
  Link,
  Receipt
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSignOut: () => void;
  unreadNotifications?: number;
  onNotificationsClick?: () => void;
  isNotificationsUnlocked?: boolean;
  isDashboardUnlocked?: boolean;
  isSettingsUnlocked?: boolean;
  onDashboardPinModal?: () => void;
  onSettingsPinModal?: () => void;
  establishment?: any;
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
  establishment
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

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

  // Expandir automaticamente quando clicar em um item (apenas em mobile)
  const handleItemClick = (onClick: () => void) => {
    // Em mobile, mantém o sidebar aberto após clicar em um item
    onClick();
  };

  const menuItems = [
         {
       id: 'notifications',
       label: 'Notificações',
       icon: Bell,
       onClick: () => handleItemClick(onNotificationsClick || (() => {})),
       isActive: false, // Notificações não é um tab, é um modal
       showBadge: unreadNotifications > 0,
       badgeCount: unreadNotifications,
       disabled: !isNotificationsUnlocked
     },
         {
       id: 'appointments',
       label: 'Meus Agendamentos',
       icon: Calendar,
       onClick: () => handleItemClick(() => onTabChange('appointments')),
       isActive: activeTab === 'appointments'
     },
         {
       id: 'clients',
       label: 'Meus Clientes',
       icon: Users,
       onClick: () => handleItemClick(() => onTabChange('clients')),
       isActive: activeTab === 'clients'
     },
         {
       id: 'reserve-client',
       label: 'Reservar Cliente',
       icon: Link,
       onClick: () => handleItemClick(() => onTabChange('reserve-client')),
       isActive: activeTab === 'reserve-client'
     },
         {
       id: 'ranking',
       label: 'Ranking Clientes',
       icon: Crown,
       onClick: () => handleItemClick(() => onTabChange('ranking')),
       isActive: activeTab === 'ranking'
     },
         {
       id: 'missing-clients',
       label: 'Clientes Sumidos',
       icon: Users,
       onClick: () => handleItemClick(() => onTabChange('missing-clients')),
       isActive: activeTab === 'missing-clients'
     },
         {
       id: 'draw',
       label: 'Sorteio',
       icon: Shuffle,
       onClick: () => handleItemClick(() => onTabChange('draw')),
       isActive: activeTab === 'draw'
     },
         {
       id: 'subscribers',
       label: 'Meus Assinantes',
       icon: Crown,
       onClick: () => handleItemClick(() => onTabChange('subscribers')),
       isActive: activeTab === 'subscribers'
     },
         {
       id: 'hours',
       label: 'Horários',
       icon: Clock,
       onClick: () => handleItemClick(() => {}),
       isActive: false,
       disabled: true,
       tooltip: 'Em breve'
     },
         {
       id: 'links',
       label: 'Meu Link',
       icon: Calendar,
       onClick: () => handleItemClick(() => onTabChange('services')),
       isActive: activeTab === 'services'
     },
         {
       id: 'dashboard',
       label: 'Dashboard',
       icon: BarChart3,
       onClick: () => handleItemClick(() => {
         if (establishment?.pin_password && establishment.pin_password.length > 0 && !isDashboardUnlocked) {
           onDashboardPinModal?.();
         } else {
           onTabChange('financial-dashboard');
         }
       }),
       isActive: activeTab === 'financial-dashboard'
     },
         {
       id: 'taxes',
       label: 'Minhas Taxas',
       icon: Receipt,
       onClick: () => handleItemClick(() => onTabChange('taxes')),
       isActive: activeTab === 'taxes'
     },
         {
       id: 'config',
       label: 'Config',
       icon: Settings,
       onClick: () => handleItemClick(() => {
         if (establishment?.pin_password && establishment.pin_password.length > 0 && !isSettingsUnlocked) {
           onSettingsPinModal?.();
         } else {
           onTabChange('settings');
         }
       }),
       isActive: activeTab === 'settings'
     },
         {
       id: 'logout',
       label: 'Sair',
       icon: LogOut,
       onClick: () => handleItemClick(onSignOut),
       isActive: false
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
      
      <div className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
        isExpanded ? 'w-64' : 'w-16'
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
        <button
          data-sidebar-toggle
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={isExpanded ? 'Recolher menu' : 'Expandir menu'}
        >
          {isExpanded ? (
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Lista de itens do menu */}
      <nav className="p-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="relative">
              <button
                onClick={item.onClick}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                  item.isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : item.disabled
                    ? 'text-gray-400 cursor-not-allowed opacity-50'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={item.tooltip || (isExpanded ? '' : item.label)}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {item.showBadge && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {item.badgeCount}
                    </span>
                  )}
                </div>
                
                {isExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {item.label}
                  </span>
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
          );
        })}
      </nav>
    </div>
    </>
  );
};

export default Sidebar;
