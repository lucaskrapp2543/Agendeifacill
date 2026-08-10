import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getSubscriptions, supabase } from '../lib/supabase';
import { useToast } from './ui/Toaster';

type EstablishmentService = {
  id: string;
  name: string;
  price: number;
  duration: number;
  source?: 'service' | 'subscription';
};

type AppointmentForServiceChange = {
  id: string;
  client_name?: string | null;
  service?: string | null;
};

interface ChangeAppointmentServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  appointment: AppointmentForServiceChange | null;
  onConfirm: (services: EstablishmentService[]) => Promise<void>;
}

const normalizarTexto = (v: any): string =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const fmtBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const toPositiveNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const normalized = raw.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function ChangeAppointmentServiceModal({
  isOpen,
  onClose,
  establishmentId,
  appointment,
  onConfirm,
}: ChangeAppointmentServiceModalProps) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [services, setServices] = useState<EstablishmentService[]>([]);
  const [search, setSearch] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const lastLoadedEstablishmentIdRef = useRef<string>('');

  // manter referência estável do toast (evita loop de effect por dependência instável)
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const filtered = useMemo(() => {
    const qRaw = String(search || '').trim();
    if (!qRaw) return services;
    const q = normalizarTexto(qRaw);
    const qDigits = qRaw.replace(/\D/g, '');
    return services.filter((s) => {
      const name = normalizarTexto(s.name);
      if (q && name.includes(q)) return true;
      if (qDigits) {
        const p = String(s.price || '').replace(/\D/g, '');
        if (p.includes(qDigits)) return true;
      }
      return false;
    });
  }, [services, search]);

  const selectedServices = useMemo(() => {
    const set = new Set(selectedServiceIds.map(String));
    return services.filter((s) => set.has(String(s.id)));
  }, [services, selectedServiceIds]);

  const selectedSummary = useMemo(() => {
    const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const totalDuration = selectedServices.reduce((sum, s) => sum + Number(s.duration || 0), 0);
    const names = selectedServices.map((s) => String(s.name || '').trim()).filter(Boolean);
    return {
      totalPrice,
      totalDuration,
      names,
    };
  }, [selectedServices]);

  // Inicializa quando abrir
  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelectedServiceIds([]);
    // Não limpar a lista toda vez que re-renderiza; só limpar quando muda de estabelecimento.
    if (lastLoadedEstablishmentIdRef.current && lastLoadedEstablishmentIdRef.current !== establishmentId) {
      setServices([]);
    }
  }, [isOpen]);

  // Buscar serviços do estabelecimento
  useEffect(() => {
    const run = async () => {
      if (!isOpen || !establishmentId) return;
      // ⚠️ NÃO reintroduzir cache aqui. Havia um "se já carregou este estabelecimento,
      // não recarrega" para evitar piscar — mas ele congelava a lista pela sessão
      // inteira: serviço EXCLUÍDO continuava aparecendo aqui (some no booking e no
      // resto do sistema, só neste modal não) e preço alterado seguia com o valor
      // velho, aplicando valor errado no atendimento. Recarregar a cada abertura é
      // barato e é a única forma de refletir exclusão e mudança de preço na hora.
      setIsLoading(true);
      try {
        const all: EstablishmentService[] = [];

        // 1) Sistema novo (categorias)
        const { data: subcategoriesData, error: subErr } = await supabase
          .from('service_subcategories')
          .select(
            `
              id,
              name,
              price,
              duration,
              is_active,
              service_categories!inner (
                establishment_id
              )
            `
          )
          .eq('service_categories.establishment_id', establishmentId)
          .eq('is_active', true);

        if (!subErr && Array.isArray(subcategoriesData)) {
          subcategoriesData.forEach((sub: any) => {
            all.push({
              id: String(sub?.id || ''),
              name: String(sub?.name || '').trim(),
              price: Number(sub?.price || 0),
              duration: Number(sub?.duration || 30),
            });
          });
        }

        // 2) Fallback (services_with_prices)
        const { data: establishmentData, error: estErr } = await supabase
          .from('establishments')
          .select('services_with_prices')
          .eq('id', establishmentId)
          .single();

        if (!estErr && (establishmentData as any)?.services_with_prices) {
          (establishmentData as any).services_with_prices.forEach((service: any) => {
            all.push({
              id: String(service?.id || ''),
              name: String(service?.name || '').trim(),
              price: Number(service?.price || 0),
              duration: Number(service?.duration || 30),
              source: 'service',
            });
          });
        }

        // 3) Assinaturas (planos) para permitir troca também entre planos
        const { data: subscriptionsData, error: subsErr } = await getSubscriptions(establishmentId);

        if (!subsErr && Array.isArray(subscriptionsData)) {
          subscriptionsData
            .filter((sub: any) => !Boolean(sub?.is_hidden))
            .forEach((sub: any) => {
              const subId = String(sub?.id || '').trim();
              const subName = String(sub?.name || '').trim();
              if (!subId || !subName) return;

              const dividedServices = Array.isArray(sub?.divided_services) ? sub.divided_services : [];
              const divideServicesEnabled = Boolean(sub?.divide_services_enabled);

              // Quando "dividir serviços" está ativo, usar SEMPRE a duração de cada serviço dividido.
              if (divideServicesEnabled && dividedServices.length > 0) {
                dividedServices.forEach((service: any, index: number) => {
                  const serviceName = String(service?.name || '').trim();
                  if (!serviceName) return;
                  const duration = toPositiveNumber(service?.duration, 0);
                  if (duration <= 0) return;
                  const dividedId = String(service?.id || '').trim() || `idx_${index}`;

                  all.push({
                    id: `subscription:${subId}:service:${dividedId}`,
                    name: `${subName} - ${serviceName}`,
                    price: 0,
                    duration,
                    source: 'subscription',
                  });
                });
                return;
              }

              all.push({
                id: `subscription:${subId}`,
                name: subName,
                price: 0, // Atendimento por assinatura não cobra serviço avulso
                duration: toPositiveNumber(sub?.service_duration, 30),
                source: 'subscription',
              });
            });
        }

        // Deduplicar por id e filtrar válidos
        const byId = new Map<string, EstablishmentService>();
        for (const s of all) {
          if (!s.id || !s.name) continue;
          if (s.source !== 'subscription' && !(Number(s.price) > 0)) continue;
          if (!byId.has(s.id)) byId.set(s.id, s);
        }
        const unique = Array.from(byId.values());
        unique.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

        setServices(unique);
        lastLoadedEstablishmentIdRef.current = establishmentId;
      } catch (e) {
        console.error('❌ Erro ao carregar serviços (trocar serviço):', e);
        toastRef.current('Não consegui carregar os serviços. Tente novamente.', 'error');
        setServices([]);
      } finally {
        setIsLoading(false);
      }
    };

    run();
    // Não colocar "toast" nas dependências (pode variar a cada render e causar loop).
    // `services.length` TAMBÉM saiu de propósito: sem o antigo guard de cache, ele
    // reexecutaria o efeito a cada setServices — buscando serviços em loop infinito.
    // Agora recarrega exatamente uma vez por abertura do modal, que é o objetivo.
  }, [isOpen, establishmentId]);

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!selectedServices || selectedServices.length === 0) {
      toast('Selecione 1 ou mais serviços.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await onConfirm(selectedServices);
      onClose();
    } catch (e) {
      // erro tratado pelo caller
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">Trocar serviço</h3>
              <p className="text-sm text-gray-600 truncate">
                {String(appointment.client_name || 'Cliente')} • Atual: {String(appointment.service || '—')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ao trocar o serviço, o valor e a duração do agendamento serão recalculados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSaving}
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar serviço por nome..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 bg-white"
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-[52vh] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-sm text-gray-600">Carregando serviços...</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">Nenhum serviço encontrado.</div>
              ) : (
                filtered.map((s) => {
                  const isSelected = selectedServiceIds.map(String).includes(String(s.id));
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const id = String(s.id);
                        setSelectedServiceIds((prev) => {
                          const set = new Set(prev.map(String));
                          if (set.has(id)) set.delete(id);
                          else set.add(id);
                          return Array.from(set);
                        });
                      }}
                      className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${
                        isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{s.name}</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {s.duration}min • {fmtBRL(s.price)}
                          </div>
                          {s.source === 'subscription' && (
                            <div className="text-[11px] font-bold text-purple-700 mt-0.5">
                              Plano de assinatura
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300'
                            }`}
                          >
                            {isSelected ? 'Selecionado' : 'Selecionar'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-600">
              {selectedServices.length > 0 ? (
                <span>
                  Novo: <strong>{selectedSummary.names.join(', ')}</strong> • {selectedSummary.totalDuration}min • {fmtBRL(selectedSummary.totalPrice)}
                </span>
              ) : (
                <span>Selecione 1 ou mais serviços para continuar.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving || selectedServices.length === 0}
                title={selectedServices.length === 0 ? 'Selecione 1 ou mais serviços' : 'Salvar'}
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

