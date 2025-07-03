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
    <div className={`space-y-3 ${className}`}>
      {services.map(service => (
        <label
          key={service.id}
          className={`block w-full p-3 rounded-lg cursor-pointer transition-colors ${
            value === service.id
              ? 'bg-primary/20 border border-primary'
              : 'bg-[#242628] border border-gray-800 hover:border-gray-700'
          }`}
        >
          <input
            type="radio"
            name="service"
            value={service.id}
            checked={value === service.id}
            onChange={() => onChange(service)}
            className="hidden"
          />
          <div className="flex flex-col space-y-2">
            <span className="text-white font-medium">{service.name}</span>
            <div className="flex items-center text-gray-400">
              <DollarSign className="h-4 w-4 mr-1" />
              <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
            </div>
            <div className="flex items-center text-gray-400">
              <Clock className="h-4 w-4 mr-1" />
              <span>{service.duration || 0} minutos</span>
            </div>
          </div>
        </label>
      ))}
    </div>
  );
} 