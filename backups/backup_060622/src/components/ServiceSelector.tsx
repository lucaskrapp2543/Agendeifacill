import React from 'react';
import { Clock, DollarSign } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface ServiceSelectorProps {
  services: Service[];
  value: string;
  onChange: (service: Service | undefined) => void;
  className?: string;
}

export function ServiceSelector({ services, value, onChange, className = '' }: ServiceSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const service = services.find(s => s.id === e.target.value);
        onChange(service);
      }}
      className={`bg-[#242628] text-white border border-gray-800 rounded-lg px-3 py-2 ${className}`}
      required
    >
      <option value="">Selecione um serviço</option>
      {services.map(service => (
        <option 
          key={service.id} 
          value={service.id}
          className="flex items-center justify-between py-2"
        >
          {service.name} - R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'} - {service.duration || 0} minutos
        </option>
      ))}
    </select>
  );
} 