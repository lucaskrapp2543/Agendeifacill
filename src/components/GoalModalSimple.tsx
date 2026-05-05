import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Target, X } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category?: string;
}

interface ServiceCategory {
  id: string;
  name: string;
}

interface ServiceSubcategory {
  id: string;
  name: string;
  category_id: string;
  price?: number;
  duration?: number;
}

interface GoalHistoryItem {
  year: number;
  month: number;
  goalAmount: number;
  completedServices: number;
  bonusPercentage: number;
}

interface GoalModalSimpleProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    goalAmount: number,
    selectedServices: string[],
    serviceTargets: Record<string, number>,
    bonusPercentage: number
  ) => Promise<void>;
  professionalName: string;
  currentGoal?: number;
  currentSelectedServices?: string[];
  currentServiceTargets?: Record<string, number>;
  currentBonusPercentage?: number;
  currentCompletedServices?: number;
  currentMonth: Date;
  onMonthChange: (next: Date) => void;
  historyItems?: GoalHistoryItem[];
  services?: Service[];
  serviceCategories?: ServiceCategory[];
  serviceSubcategories?: ServiceSubcategory[];
  isLoading?: boolean;
}

const toMonthLabel = (date: Date) =>
  date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export function GoalModalSimple({
  isOpen,
  onClose,
  onSave,
  professionalName,
  currentGoal = 0,
  currentSelectedServices = [],
  currentServiceTargets = {},
  currentBonusPercentage = 0,
  currentCompletedServices = 0,
  currentMonth,
  onMonthChange,
  historyItems = [],
  services = [],
  serviceCategories = [],
  serviceSubcategories = [],
  isLoading = false,
}: GoalModalSimpleProps) {
  const [goalAmount, setGoalAmount] = useState<string>(String(currentGoal || ''));
  const [bonusPercentage, setBonusPercentage] = useState<string>(
    Number.isFinite(Number(currentBonusPercentage)) && Number(currentBonusPercentage) > 0
      ? String(Number(currentBonusPercentage))
      : ''
  );
  const [selectedServices, setSelectedServices] = useState<string[]>(currentSelectedServices);
  const [serviceTargets, setServiceTargets] = useState<Record<string, number>>(currentServiceTargets || {});
  const [showServiceSelection, setShowServiceSelection] = useState(false);
  const lastSyncedContextRef = useRef<string>('');

  const serviceOptions = useMemo(() => {
    const options: Array<{ key: string; label: string; meta: string }> = [];
    const seen = new Set<string>();

    services.forEach((service) => {
      const key = String(service.id || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({
        key,
        label: String(service.name || '').trim() || 'Serviço',
        meta: `${Number(service.duration || 0)}min • R$ ${Number(service.price || 0).toFixed(2).replace('.', ',')}`,
      });
    });

    serviceSubcategories.forEach((subcategory) => {
      const key = `subcategory_${String(subcategory.id || '').trim()}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      const categoryName =
        serviceCategories.find((category) => String(category.id) === String(subcategory.category_id))?.name || '';
      options.push({
        key,
        label: String(subcategory.name || '').trim() || 'Serviço',
        meta: `${categoryName || 'Categoria'} • ${Number(subcategory.duration || 0)}min • R$ ${Number(subcategory.price || 0).toFixed(2).replace('.', ',')}`,
      });
    });

    return options.sort((a, b) =>
      String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR', { sensitivity: 'base' })
    );
  }, [services, serviceSubcategories, serviceCategories]);

  useEffect(() => {
    if (!isOpen) {
      lastSyncedContextRef.current = '';
      return;
    }

    const syncContextKey = `${professionalName}::${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
    if (lastSyncedContextRef.current === syncContextKey) return;

    setGoalAmount(String(currentGoal || ''));
    setBonusPercentage(
      Number.isFinite(Number(currentBonusPercentage)) && Number(currentBonusPercentage) > 0
        ? String(Number(currentBonusPercentage))
        : ''
    );
    setSelectedServices(Array.isArray(currentSelectedServices) ? currentSelectedServices : []);
    setServiceTargets(currentServiceTargets || {});
    lastSyncedContextRef.current = syncContextKey;
  }, [
    isOpen,
    professionalName,
    currentMonth,
    currentGoal,
    currentSelectedServices,
    currentServiceTargets,
    currentBonusPercentage,
  ]);

  const handleToggleService = (serviceKey: string) => {
    setSelectedServices((prev) => {
      const exists = prev.includes(serviceKey);
      if (exists) {
        const next = prev.filter((item) => item !== serviceKey);
        setServiceTargets((current) => {
          const updated = { ...current };
          delete updated[serviceKey];
          return updated;
        });
        return next;
      }
      if (prev.length >= 10) {
        alert('Você pode selecionar no máximo 10 serviços na meta.');
        return prev;
      }
      setServiceTargets((current) => ({
        ...current,
        [serviceKey]: Math.max(1, Number(current[serviceKey] || 1)),
      }));
      return [...prev, serviceKey];
    });
  };

  const handleTargetChange = (serviceKey: string, value: string) => {
    const parsed = Number(String(value || '').replace(/[^\d]/g, ''));
    const nextValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    setServiceTargets((prev) => ({
      ...prev,
      [serviceKey]: nextValue,
    }));
  };

  const calculatedGlobalGoal = selectedServices.reduce((sum, key) => sum + Number(serviceTargets[key] || 0), 0);
  const effectiveGoalAmount = Number(goalAmount || 0) > 0 ? Number(goalAmount || 0) : calculatedGlobalGoal;
  const progressPercentage =
    effectiveGoalAmount > 0 ? Math.min(100, (Number(currentCompletedServices || 0) / effectiveGoalAmount) * 100) : 0;

  const handleSave = async () => {
    const amount = Number(goalAmount || 0);
    const normalizedAmount = Number.isFinite(amount) && amount > 0 ? amount : calculatedGlobalGoal;
    if (!normalizedAmount || normalizedAmount < 1) {
      alert('Defina a meta global (soma das quantidades ou valor manual maior que 0).');
      return;
    }
    const invalidTarget = selectedServices.some((serviceKey) => Number(serviceTargets[serviceKey] || 0) < 1);
    if (invalidTarget) {
      alert('Cada serviço selecionado precisa ter quantidade alvo de pelo menos 1.');
      return;
    }
    const bonusInput = String(bonusPercentage || '').trim();
    const parsedBonus = bonusInput.length === 0 ? 0 : Number(bonusInput.replace(',', '.'));
    if (!Number.isFinite(parsedBonus) || parsedBonus < 0) {
      alert('A % de ganho deve ser um número válido (ex.: 45).');
      return;
    }
    if (parsedBonus > 100) {
      alert('A % da meta não pode ser maior que 100.');
      return;
    }

    await onSave(
      normalizedAmount,
      selectedServices,
      selectedServices.reduce<Record<string, number>>((acc, key) => {
        acc[key] = Math.max(1, Number(serviceTargets[key] || 1));
        return acc;
      }, {}),
      parsedBonus
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Meta global por serviços</h3>
              <p className="text-sm text-gray-600">{professionalName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
            <button
              type="button"
              onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="px-3 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={isLoading}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800 capitalize">{toMonthLabel(currentMonth)}</span>
            <button
              type="button"
              onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="px-3 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={isLoading}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta global do mês</label>
              <input
                type="number"
                min="1"
                max="9999"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                placeholder={`Ex: ${calculatedGlobalGoal || 10}`}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Pode digitar manualmente ou usar a soma das quantidades dos serviços.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">% de ganho ao bater meta</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={bonusPercentage}
                onChange={(e) => setBonusPercentage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                placeholder="Opcional (ex: 45)"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Campo opcional. Se deixar vazio, será 0%.
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">Serviços da meta</h4>
              <button
                type="button"
                onClick={() => setShowServiceSelection((prev) => !prev)}
                className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
                disabled={isLoading}
              >
                {showServiceSelection ? 'Ocultar' : 'Selecionar serviços'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Se não selecionar serviços, a meta vale para todos os serviços atendidos.
            </p>

            {selectedServices.length > 0 && (
              <p className="text-xs text-blue-700 mt-2">
                Selecionados: {selectedServices.length} serviço(s) • Soma das quantidades: {calculatedGlobalGoal}
              </p>
            )}

            {showServiceSelection && (
              <div className="mt-3 max-h-[300px] overflow-y-auto border border-gray-200 rounded">
                <div className="p-2 space-y-2">
                  {serviceOptions.map((service) => {
                    const checked = selectedServices.includes(service.key);
                    return (
                      <div key={service.key} className="p-2 rounded border border-gray-200 bg-white">
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleService(service.key)}
                              disabled={isLoading}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{service.label}</div>
                              <div className="text-xs text-gray-500 truncate">{service.meta}</div>
                            </div>
                          </label>
                          {checked && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">Qtd meta</span>
                              <input
                                type="number"
                                min="1"
                                max="9999"
                                value={String(serviceTargets[service.key] || 1)}
                                onChange={(e) => handleTargetChange(service.key, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                                disabled={isLoading}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {serviceOptions.length === 0 && (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      Nenhum serviço disponível para selecionar.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800">
                Progresso atual: {Number(currentCompletedServices || 0)} / {effectiveGoalAmount || 0}
              </span>
              <span className="font-bold text-gray-900">{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${progressPercentage >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, progressPercentage)}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Histórico de metas</h4>
            <div className="max-h-[180px] overflow-y-auto space-y-2">
              {historyItems.length === 0 && (
                <p className="text-xs text-gray-500">Sem histórico salvo para este profissional.</p>
              )}
              {historyItems.map((item) => (
                <div key={`${item.year}-${item.month}`} className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="font-semibold text-gray-800">
                    {String(item.month).padStart(2, '0')}/{item.year}
                  </div>
                  <div className="text-gray-600">
                    Meta: {item.goalAmount} • Feitos: {item.completedServices} • % Meta: {item.bonusPercentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? 'Salvando...' : 'Salvar Meta'}
          </button>
        </div>
      </div>
    </div>
  );
}
