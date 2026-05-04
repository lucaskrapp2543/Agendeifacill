import React, { useState } from 'react';
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
}

const AdditionalProductModal = ({
  isOpen,
  onClose,
  onAdd,
  intervalMinutes = 15,
  maxDurationMinutes = 120
}: AdditionalProductModalProps) => {
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [extraDuration, setExtraDuration] = useState<string>(String(intervalMinutes));

  if (!isOpen) return null;

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
              placeholder="Ex: Sombrancelhas\Pézinho"
              required
            />
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