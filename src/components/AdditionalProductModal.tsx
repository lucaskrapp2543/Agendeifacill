import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';

interface AdditionalProduct {
  name: string;
  price: number;
  // Duração extra (em minutos) que será somada à duração base do agendamento para bloquear horários
  duration?: number;
}

interface AdditionalProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: AdditionalProduct) => boolean | Promise<boolean>;
  intervalMinutes?: number; // intervalo configurado (15/20/30...)
  maxDurationMinutes?: number; // padrão: 120
  serviceCategories?: Array<{
    id: string;
    name: string;
    is_active?: boolean;
  }>;
  serviceSubcategories?: Array<{
    id: string;
    category_id: string;
    name: string;
    price: number;
    is_active?: boolean;
  }>;
}

const AdditionalProductModal = ({
  isOpen,
  onClose,
  onAdd,
  intervalMinutes = 15,
  maxDurationMinutes = 120,
  serviceCategories = [],
  serviceSubcategories = [],
}: AdditionalProductModalProps) => {
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [extraDuration, setExtraDuration] = useState<string>(String(intervalMinutes));
  const [showMyServicesPicker, setShowMyServicesPicker] = useState(false);
  const [selectedCatalogCategoryId, setSelectedCatalogCategoryId] = useState('');
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState('');

  const safeInterval = Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 15;
  const safeMax = Number.isFinite(maxDurationMinutes) && maxDurationMinutes > 0 ? maxDurationMinutes : 120;

  // Sempre oferecer 0 e 5 min, além do intervalo padrão do estabelecimento
  const durationOptionsSet = new Set<number>();
  durationOptionsSet.add(0);
  if (safeMax >= 5) durationOptionsSet.add(5);

  for (let m = safeInterval; m <= safeMax; m += safeInterval) {
    durationOptionsSet.add(m);
  }

  const durationOptions = Array.from(durationOptionsSet).sort((a, b) => a - b);
  const categoriesWithServices = useMemo(() => {
    const activeCategories = (serviceCategories || []).filter((category) => category && category.id && category.name && category.is_active !== false);
    const activeServices = (serviceSubcategories || []).filter((service) => service && service.id && service.category_id && service.name && Number.isFinite(Number(service.price)) && service.is_active !== false);
    return activeCategories
      .map((category) => ({
        id: String(category.id),
        name: String(category.name),
        services: activeServices
          .filter((service) => String(service.category_id) === String(category.id))
          .map((service) => ({
            id: String(service.id),
            name: String(service.name),
            price: Number(service.price || 0),
          })),
      }))
      .filter((category) => category.services.length > 0);
  }, [serviceCategories, serviceSubcategories]);
  const selectedCategoryServices = useMemo(() => {
    if (!selectedCatalogCategoryId) return [];
    const found = categoriesWithServices.find((category) => String(category.id) === String(selectedCatalogCategoryId));
    return found?.services || [];
  }, [categoriesWithServices, selectedCatalogCategoryId]);

  const formatPriceInput = (value: number): string => {
    const safe = Number(value || 0);
    return safe.toFixed(2).replace('.', ',');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const price = parseFloat(productPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      alert('Por favor, insira um valor válido');
      return;
    }

    const duration = parseInt(extraDuration, 10);
    if (!Number.isFinite(duration) || duration < 0) {
      alert('Por favor, selecione um tempo válido');
      return;
    }

    const canClose = await onAdd({
      name: productName,
      price: price,
      duration
    });

    if (!canClose) return;

    // Limpa os campos
    setProductName('');
    setProductPrice('');
    setExtraDuration(String(safeInterval));
    setShowMyServicesPicker(false);
    setSelectedCatalogCategoryId('');
    setSelectedCatalogServiceId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-4">
          Adicionar Serviço Extra
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Nome do Serviço
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Ex: Sobrancelhas / Pézinho"
              required
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowMyServicesPicker((prev) => !prev)}
              className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white text-sm hover:border-gray-500 transition-colors"
            >
              Meus Serviços
            </button>

            {showMyServicesPicker && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={selectedCatalogCategoryId}
                    onChange={(e) => {
                      setSelectedCatalogCategoryId(e.target.value);
                      setSelectedCatalogServiceId('');
                    }}
                    className="w-full px-3 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione uma categoria</option>
                    {categoriesWithServices.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Serviço
                  </label>
                  <select
                    value={selectedCatalogServiceId}
                    onChange={(e) => {
                      const serviceId = e.target.value;
                      setSelectedCatalogServiceId(serviceId);
                      const selectedService = selectedCategoryServices.find((service) => String(service.id) === String(serviceId));
                      if (selectedService) {
                        // Regra: preencher apenas nome e valor; tempo permanece manual.
                        setProductName(selectedService.name);
                        setProductPrice(formatPriceInput(selectedService.price));
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    disabled={!selectedCatalogCategoryId}
                  >
                    <option value="">
                      {selectedCatalogCategoryId ? 'Selecione um serviço' : 'Escolha a categoria primeiro'}
                    </option>
                    {selectedCategoryServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} — R$ {service.price.toFixed(2).replace('.', ',')}
                      </option>
                    ))}
                  </select>
                </div>

                {categoriesWithServices.length === 0 && (
                  <p className="text-xs text-gray-400">
                    Nenhum serviço encontrado em Meus Serviços.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Valor (R$)
            </label>
            <input
              type="text"
              value={productPrice}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d,]/g, '');
                setProductPrice(value);
              }}
              className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="0,00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Tempo extra (min)
            </label>
            <select
              value={extraDuration}
              onChange={(e) => setExtraDuration(e.target.value)}
              className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              {durationOptions.map((m) => (
                <option key={m} value={String(m)} className="bg-[#1a1b1c]">
                  {m} min
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdditionalProductModal; 