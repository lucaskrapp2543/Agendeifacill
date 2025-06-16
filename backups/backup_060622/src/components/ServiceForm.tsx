import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DurationSelector } from './DurationSelector';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface ServiceFormProps {
  services: Service[];
  onChange: (services: Service[]) => void;
}

export function ServiceForm({ services, onChange }: ServiceFormProps) {
  const handleAddService = () => {
    onChange([
      ...services,
      { id: Date.now().toString(), name: '', price: 0, duration: 30 }
    ]);
  };

  const handleRemoveService = (index: number) => {
    const newServices = services.filter((_, i) => i !== index);
    onChange(newServices);
  };

  const handleServiceChange = (index: number, field: keyof Service, value: any) => {
    const newServices = [...services];
    newServices[index] = {
      ...newServices[index],
      [field]: field === 'price' ? Number(value) : value
    };
    onChange(newServices);
  };

  return (
    <div className="space-y-4">
      {services.map((service, index) => (
        <div key={service.id} className="flex items-center gap-4">
          <input
            type="text"
            value={service.name}
            onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
            placeholder="Nome do serviço"
            className="bg-[#242628] text-white border border-gray-800 rounded-lg px-3 py-2 flex-1"
          />
          <input
            type="number"
            value={service.price}
            onChange={(e) => handleServiceChange(index, 'price', e.target.value)}
            placeholder="Preço"
            className="bg-[#242628] text-white border border-gray-800 rounded-lg px-3 py-2 w-32"
          />
          <DurationSelector
            value={service.duration}
            onChange={(value) => handleServiceChange(index, 'duration', value)}
            className="w-48"
          />
          <button
            onClick={() => handleRemoveService(index)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={handleAddService}
        className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors border border-gray-800 rounded-lg py-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar Serviço
      </button>
    </div>
  );
} 