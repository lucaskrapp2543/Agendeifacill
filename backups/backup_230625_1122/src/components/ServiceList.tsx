import React from 'react';
import { Clock, DollarSign, Scissors } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface ServiceListProps {
  services: Service[];
  selectedService?: Service;
  onSelect: (service: Service) => void;
}

export function ServiceList({ services, selectedService, onSelect }: ServiceListProps) {
  return (
    <div className="space-y-2">
      {services.map(service => (
        <button
          key={service.id}
          onClick={() => onSelect(service)}
          className={`w-full text-left p-4 rounded-lg border transition-colors ${
            selectedService?.id === service.id
              ? 'bg-green-500/20 border-green-500 text-green-500'
              : 'bg-[#1a1b1c] border-gray-700 hover:border-green-500/50 hover:bg-green-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Scissors className={`h-5 w-5 ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-400'}`} />
              <span className={`font-medium ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-300'}`}>{service.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-gray-400">
                <Clock className="h-4 w-4" />
                <span>{service.duration || 0}min</span>
              </div>
              <div className={`flex items-center gap-1 font-medium ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-300'}`}>
                <DollarSign className="h-4 w-4" />
                <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
} 