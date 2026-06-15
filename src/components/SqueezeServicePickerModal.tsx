import { Clock, Flame, Scissors, Search, Star, Tag, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isDateInsidePaidSubscription } from '../lib/subscriberAppointmentFlags';
import { supabase } from '../lib/supabase';

export interface SqueezePickerServiceOption {
  id: string;
  name: string;
  price: number;
  duration: number;
  category?: string;
  is_subscription?: boolean;
  subscription_plan_id?: string;
  plan_value?: number;
  active_subscribers?: number;
  usage_count?: number;
}

type SqueezePickerTab = 'favorites' | 'services' | 'subscriptions';

interface SqueezeUsageAppointment {
  service?: string | null;
  status?: string | null;
  is_squeeze?: boolean | null;
  is_subscriber?: boolean | null;
  payment_method?: string | null;
  subscription_id?: string | null;
}

interface ProfessionalLike {
  id: string;
  specific_services?: Array<{ id?: string; name?: string; price?: number; duration?: number }>;
}

interface SqueezeServicePickerModalProps {
  open: boolean;
  establishmentId?: string;
  selectedProfessionalId?: string | null;
  professionals?: ProfessionalLike[];
  appointments?: SqueezeUsageAppointment[];
  onSelect: (service: SqueezePickerServiceOption) => void;
  onClose: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(value) ? value : 0
  );

const normalizeKey = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const matchesSearch = (item: SqueezePickerServiceOption, query: string): boolean => {
  const q = normalizeKey(query);
  if (!q) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  const haystack = normalizeKey(
    [
      item.name,
      item.category || '',
      item.is_subscription ? 'assinatura plano ass vip mensal' : 'serviço corte barba',
    ].join(' ')
  );

  if (haystack.includes(q)) return true;
  return tokens.every((token) => haystack.includes(token));
};

const buildUsageMaps = (appointments: SqueezeUsageAppointment[]) => {
  const serviceUsage = new Map<string, number>();
  const subscriptionUsage = new Map<string, number>();

  appointments.forEach((apt) => {
    if (!apt?.is_squeeze) return;
    if (String(apt.status || '').toLowerCase() === 'cancelled') return;

    const serviceName = String(apt.service || '').trim();
    if (serviceName) {
      const key = normalizeKey(serviceName);
      serviceUsage.set(key, (serviceUsage.get(key) || 0) + 1);
    }

    const isSubscriber =
      Boolean(apt.is_subscriber) || String(apt.payment_method || '').toLowerCase() === 'assinante';
    const subId = String(apt.subscription_id || '').trim();
    if (isSubscriber && subId) {
      subscriptionUsage.set(subId, (subscriptionUsage.get(subId) || 0) + 1);
    } else if (isSubscriber && serviceName) {
      const key = normalizeKey(serviceName);
      subscriptionUsage.set(key, (subscriptionUsage.get(key) || 0) + 1);
    }
  });

  return { serviceUsage, subscriptionUsage };
};

async function loadSqueezePickerData(
  establishmentId: string,
  selectedProfessionalId: string | null | undefined,
  professionals: ProfessionalLike[]
): Promise<{ services: SqueezePickerServiceOption[]; subscriptions: SqueezePickerServiceOption[] }> {
  const categoryServices: SqueezePickerServiceOption[] = [];
  const legacyServices: SqueezePickerServiceOption[] = [];

  const { data: subcategoriesData } = await supabase
    .from('service_subcategories')
    .select(
      `
      id,
      name,
      price,
      duration,
      service_categories!inner (
        establishment_id,
        name
      )
    `
    )
    .eq('service_categories.establishment_id', establishmentId)
    .eq('is_active', true);

  (subcategoriesData || []).forEach((sub: any) => {
    categoryServices.push({
      id: String(sub.id),
      name: String(sub?.name || '').trim(),
      price: Number(sub?.price || 0),
      duration: Number(sub?.duration || 30),
      category: String(sub?.service_categories?.name || '').trim() || undefined,
    });
  });

  const { data: establishmentData } = await supabase
    .from('establishments')
    .select('services_with_prices')
    .eq('id', establishmentId)
    .single();

  (establishmentData?.services_with_prices || []).forEach((service: any) => {
    legacyServices.push({
      id: String(service?.id || service?.name || ''),
      name: String(service?.name || '').trim(),
      price: Number(service?.price || 0),
      duration: Number(service?.duration || 30),
      category: String(service?.category || service?.categoria || '').trim() || undefined,
    });
  });

  const selectedProfessional = professionals.find((p) => p.id === selectedProfessionalId);
  const specificServicesRaw = Array.isArray(selectedProfessional?.specific_services)
    ? selectedProfessional!.specific_services!
    : [];
  const specificServices = specificServicesRaw
    .map((service, index) => ({
      id: String(service?.id || `specific_${selectedProfessionalId || 'professional'}_${index}`),
      name: String(service?.name || '').trim(),
      price: Number(service?.price || 0),
      duration: Number(service?.duration || 30),
      category: 'Profissional',
    }))
    .filter((service) => service.name.length > 0);

  const generalServices = [...categoryServices, ...legacyServices];
  const selectedSource =
    categoryServices.length === 0 && specificServices.length > 0 ? specificServices : generalServices;

  const uniqueServices = selectedSource.reduce((acc: SqueezePickerServiceOption[], service) => {
    if (!acc.find((s) => s.id === service.id)) acc.push(service);
    return acc;
  }, []);

  const { data: subscriptionsData, error: subscriptionsError } = await supabase
    .from('subscriptions')
    .select('id, name, value, service_duration')
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: true });

  if (subscriptionsError) throw subscriptionsError;

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: clientSubsData } = await supabase
    .from('client_subscriptions')
    .select('subscription_id, payment_status, start_date, end_date')
    .eq('establishment_id', establishmentId);

  const activeCountByPlan = new Map<string, number>();
  (clientSubsData || []).forEach((row: any) => {
    if (!isDateInsidePaidSubscription(todayStr, row)) return;
    const planId = String(row?.subscription_id || '').trim();
    if (!planId) return;
    activeCountByPlan.set(planId, (activeCountByPlan.get(planId) || 0) + 1);
  });

  const subscriptions = (subscriptionsData || [])
    .map((sub: any) => ({
      id: `subscription_${String(sub?.id || '')}`,
      subscription_plan_id: String(sub?.id || '').trim(),
      name: String(sub?.name || '').trim(),
      price: 0,
      duration: Number(sub?.service_duration || 30),
      plan_value: Number(sub?.value || 0),
      is_subscription: true,
      active_subscribers: activeCountByPlan.get(String(sub?.id || '').trim()) || 0,
    }))
    .filter((sub) => sub.name.length > 0);

  return {
    services: uniqueServices.filter((s) => s.name.length > 0),
    subscriptions,
  };
}

const ServiceCard: React.FC<{
  item: SqueezePickerServiceOption;
  onSelect: (item: SqueezePickerServiceOption) => void;
  variant: 'service' | 'subscription' | 'favorite';
}> = ({ item, onSelect, variant }) => {
  const isSubscription = Boolean(item.is_subscription);
  const borderClass =
    variant === 'subscription' || isSubscription
      ? 'border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-[#1a1b1c] hover:border-amber-400/60 hover:from-amber-900/30'
      : variant === 'favorite'
        ? 'border-orange-500/30 bg-gradient-to-br from-orange-950/30 to-[#1a1b1c] hover:border-orange-400/50 hover:from-orange-900/20'
        : 'border-gray-600/60 bg-gradient-to-br from-[#232425] to-[#1a1b1c] hover:border-blue-400/40 hover:from-[#2a2b2c]';

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group w-full text-left rounded-xl border p-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {isSubscription ? (
              <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : variant === 'favorite' ? (
              <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />
            ) : (
              <Scissors className="w-4 h-4 text-blue-400 flex-shrink-0" />
            )}
            <span className="font-semibold text-white truncate">{item.name}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-300">
            {isSubscription ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Tag className="w-3 h-3 text-amber-300" />
                  {formatCurrency(item.plan_value || 0)}/mês
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {item.duration} min
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <Users className="w-3 h-3" />
                  {item.active_subscribers || 0} ativo{(item.active_subscribers || 0) === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <Tag className="w-3 h-3" />
                  {formatCurrency(item.price)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {item.duration} min
                </span>
                {item.category && (
                  <span className="inline-flex items-center gap-1 text-blue-300/90">
                    <Tag className="w-3 h-3" />
                    {item.category}
                  </span>
                )}
              </>
            )}
          </div>
          {(item.usage_count || 0) > 0 && (
            <p className="mt-2 text-[11px] text-gray-500">
              Usado em {item.usage_count} encaixe{(item.usage_count || 0) === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0 mt-1">
          Selecionar
        </span>
      </div>
    </button>
  );
};

export const SqueezeServicePickerModal: React.FC<SqueezeServicePickerModalProps> = React.memo(
  ({
    open,
    establishmentId,
    selectedProfessionalId,
    professionals = [],
    appointments = [],
    onSelect,
    onClose,
  }) => {
    const [services, setServices] = useState<SqueezePickerServiceOption[]>([]);
    const [subscriptions, setSubscriptions] = useState<SqueezePickerServiceOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<SqueezePickerTab>('favorites');

    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollTopRef = useRef(0);
    const hasLoadedRef = useRef(false);
    const loadKeyRef = useRef('');
    const professionalsRef = useRef(professionals);
    professionalsRef.current = professionals;

    const { serviceUsage, subscriptionUsage } = useMemo(
      () => buildUsageMaps(appointments),
      [appointments]
    );

    const enrichedServices = useMemo(
      () =>
        services.map((s) => ({
          ...s,
          usage_count: serviceUsage.get(normalizeKey(s.name)) || 0,
        })),
      [services, serviceUsage]
    );

    const enrichedSubscriptions = useMemo(
      () =>
        subscriptions.map((s) => {
          const byPlan = s.subscription_plan_id
            ? subscriptionUsage.get(s.subscription_plan_id) || 0
            : 0;
          const byName = subscriptionUsage.get(normalizeKey(s.name)) || 0;
          return { ...s, usage_count: Math.max(byPlan, byName) };
        }),
      [subscriptions, subscriptionUsage]
    );

    const favoriteServices = useMemo(() => {
      return [...enrichedServices]
        .filter((s) => (s.usage_count || 0) > 0)
        .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
        .slice(0, 12);
    }, [enrichedServices]);

    const recentSubscriptions = useMemo(() => {
      return [...enrichedSubscriptions]
        .filter((s) => (s.usage_count || 0) > 0)
        .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
        .slice(0, 6);
    }, [enrichedSubscriptions]);

    const loadData = useCallback(async () => {
      if (!establishmentId) return;
      const loadKey = `${establishmentId}:${selectedProfessionalId || ''}`;
      const isSameKey = loadKeyRef.current === loadKey && hasLoadedRef.current;

      if (!isSameKey) {
        setLoading(true);
        setLoadError('');
      }

      try {
        const result = await loadSqueezePickerData(
          establishmentId,
          selectedProfessionalId,
          professionalsRef.current
        );
        setServices(result.services);
        setSubscriptions(result.subscriptions);
        hasLoadedRef.current = true;
        loadKeyRef.current = loadKey;
      } catch (error: any) {
        console.error('Erro ao carregar opções de encaixe:', error);
        setLoadError(String(error?.message || 'Erro ao carregar serviços'));
      } finally {
        setLoading(false);
      }
    }, [establishmentId, selectedProfessionalId]);

    useEffect(() => {
      if (!open) return;
      void loadData();
    }, [open, loadData]);

    useEffect(() => {
      if (!open) {
        setSearch('');
        setActiveTab('favorites');
        scrollTopRef.current = 0;
      }
    }, [open]);

    const handleScroll = () => {
      if (scrollRef.current) scrollTopRef.current = scrollRef.current.scrollTop;
    };

    useLayoutEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollTopRef.current;
    });

    const searchQuery = search.trim();
    const hasSearch = searchQuery.length > 0;

    const filteredServices = useMemo(
      () => enrichedServices.filter((s) => matchesSearch(s, searchQuery)),
      [enrichedServices, searchQuery]
    );

    const filteredSubscriptions = useMemo(
      () => enrichedSubscriptions.filter((s) => matchesSearch(s, searchQuery)),
      [enrichedSubscriptions, searchQuery]
    );

    const filteredFavorites = useMemo(
      () => favoriteServices.filter((s) => matchesSearch(s, searchQuery)),
      [favoriteServices, searchQuery]
    );

    const tabCounts = useMemo(
      () => ({
        favorites: filteredFavorites.length,
        services: filteredServices.length,
        subscriptions: filteredSubscriptions.length,
      }),
      [filteredFavorites.length, filteredServices.length, filteredSubscriptions.length]
    );

    const handleSelect = (item: SqueezePickerServiceOption) => {
      onSelect(item);
    };

    if (!open) return null;

    const tabs: Array<{ id: SqueezePickerTab; label: string; icon: React.ReactNode; count: number }> =
      [
        { id: 'favorites', label: 'Favoritos', icon: <Flame className="w-3.5 h-3.5" />, count: tabCounts.favorites },
        { id: 'services', label: 'Serviços', icon: <Scissors className="w-3.5 h-3.5" />, count: tabCounts.services },
        {
          id: 'subscriptions',
          label: 'Assinaturas',
          icon: <Star className="w-3.5 h-3.5" />,
          count: tabCounts.subscriptions,
        },
      ];

    const renderEmpty = (message: string) => (
      <div className="text-center py-10 px-4">
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    );

    const renderList = () => {
      if (loading && !hasLoadedRef.current) {
        return (
          <div className="space-y-3 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-[#2a2b2c] animate-pulse border border-gray-700/50" />
            ))}
          </div>
        );
      }

      if (loadError) {
        return (
          <div className="text-center py-8">
            <p className="text-sm text-red-300 mb-3">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Tentar novamente
            </button>
          </div>
        );
      }

      if (hasSearch) {
        const total = filteredServices.length + filteredSubscriptions.length;
        if (total === 0) {
          return renderEmpty(`Nenhum resultado para "${searchQuery}"`);
        }
        return (
          <div className="space-y-4">
            {filteredFavorites.length > 0 && (
              <section>
                <h4 className="text-xs font-bold text-orange-300 mb-2 uppercase tracking-wide">
                  🔥 Mais usados
                </h4>
                <div className="space-y-2">
                  {filteredFavorites.map((item) => (
                    <ServiceCard key={`fav-${item.id}`} item={item} onSelect={handleSelect} variant="favorite" />
                  ))}
                </div>
              </section>
            )}
            {filteredServices.length > 0 && (
              <section>
                <h4 className="text-xs font-bold text-blue-300 mb-2 uppercase tracking-wide">✂️ Serviços</h4>
                <div className="space-y-2">
                  {filteredServices.map((item) => (
                    <ServiceCard key={item.id} item={item} onSelect={handleSelect} variant="service" />
                  ))}
                </div>
              </section>
            )}
            {filteredSubscriptions.length > 0 && (
              <section>
                <h4 className="text-xs font-bold text-amber-300 mb-2 uppercase tracking-wide">⭐ Assinaturas</h4>
                <div className="space-y-2">
                  {filteredSubscriptions.map((item) => (
                    <ServiceCard key={item.id} item={item} onSelect={handleSelect} variant="subscription" />
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      }

      if (activeTab === 'favorites') {
        if (filteredFavorites.length === 0) {
          return (
            <div className="space-y-4">
              {renderEmpty('Ainda não há favoritos. Os serviços mais usados em encaixes aparecerão aqui.')}
              {filteredServices.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                    Sugestões de serviços
                  </h4>
                  <div className="space-y-2">
                    {filteredServices.slice(0, 6).map((item) => (
                      <ServiceCard key={item.id} item={item} onSelect={handleSelect} variant="service" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          );
        }
        return (
          <div className="space-y-2">
            {filteredFavorites.map((item) => (
              <ServiceCard key={item.id} item={item} onSelect={handleSelect} variant="favorite" />
            ))}
          </div>
        );
      }

      if (activeTab === 'services') {
        if (filteredServices.length === 0) {
          return renderEmpty('Nenhum serviço cadastrado para este profissional.');
        }
        return (
          <div className="space-y-2">
            {filteredServices.map((item) => (
              <ServiceCard key={item.id} item={item} onSelect={handleSelect} variant="service" />
            ))}
          </div>
        );
      }

      if (activeTab === 'subscriptions') {
        if (filteredSubscriptions.length === 0) {
          return renderEmpty('Nenhuma assinatura cadastrada.');
        }
        return (
          <div className="space-y-4">
            {recentSubscriptions.length > 0 && (
              <section>
                <h4 className="text-xs font-bold text-amber-300 mb-2 uppercase tracking-wide">
                  📌 Assinaturas recentes
                </h4>
                <div className="space-y-2">
                  {recentSubscriptions.map((item) => (
                    <ServiceCard key={`recent-${item.id}`} item={item} onSelect={handleSelect} variant="subscription" />
                  ))}
                </div>
              </section>
            )}
            <section>
              {recentSubscriptions.length > 0 && (
                <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Todas as assinaturas</h4>
              )}
              <div className="space-y-2">
                {filteredSubscriptions.map((item) => (
                  <ServiceCard key={item.id} item={item} onSelect={handleSelect} variant="subscription" />
                ))}
              </div>
            </section>
          </div>
        );
      }

      return null;
    };

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-[#141516] rounded-2xl w-full max-w-lg border border-gray-700/80 shadow-2xl shadow-black/50 flex flex-col max-h-[90dvh]">
          {/* Header fixo */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-800/80 flex-shrink-0">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">Adicionar encaixe</h3>
                <p className="text-xs text-gray-400 mt-0.5">Escolha o serviço ou assinatura</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar serviço ou assinatura..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#1e1f20] border border-gray-700 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                autoFocus
              />
            </div>

            {!hasSearch && (
              <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        active
                          ? tab.id === 'subscriptions'
                            ? 'bg-amber-600/20 text-amber-200 border border-amber-500/40'
                            : tab.id === 'favorites'
                              ? 'bg-orange-600/20 text-orange-200 border border-orange-500/40'
                              : 'bg-blue-600/20 text-blue-200 border border-blue-500/40'
                          : 'bg-[#1e1f20] text-gray-400 border border-gray-700/60 hover:border-gray-600'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                            active ? 'bg-black/20' : 'bg-gray-800'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {hasSearch && (
              <p className="text-[11px] text-gray-500 mt-2">
                Buscando em serviços e assinaturas • {tabCounts.services + tabCounts.subscriptions} resultado
                {tabCounts.services + tabCounts.subscriptions === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {/* Lista com scroll estável */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 py-4 min-h-0"
          >
            {renderList()}
          </div>

          {loading && hasLoadedRef.current && (
            <div className="px-5 py-2 border-t border-gray-800/60 flex-shrink-0">
              <p className="text-[11px] text-center text-gray-500 animate-pulse">Atualizando lista...</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

SqueezeServicePickerModal.displayName = 'SqueezeServicePickerModal';
