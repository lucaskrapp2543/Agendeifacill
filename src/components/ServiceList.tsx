import React, { useState, useRef, useEffect } from 'react';
import { Clock, DollarSign, Calendar, ChevronDown } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const useDropdown = services.length > 2;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (useDropdown) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full cursor-pointer rounded-lg bg-[#1a1b1c] border border-gray-700 py-4 pl-4 pr-10 text-left focus:outline-none focus:border-green-500 hover:border-green-500/50"
        >
          {selectedService ? (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-300">{selectedService.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-gray-300">
                  <DollarSign className="h-4 w-4" />
                  <span>R$ {selectedService.price ? selectedService.price.toFixed(2).replace('.', ',') : '0,00'}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>{selectedService.duration || 0}min</span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-gray-400">Selecione um serviço</span>
          )}
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full overflow-auto rounded-md bg-[#1a1b1c] border border-gray-700 shadow-lg max-h-60">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => {
                  onSelect(service);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-green-500/20 transition-colors ${
                  selectedService?.id === service.id ? 'bg-green-500/20' : ''
                }`}
              >
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className={`h-5 w-5 ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className={`font-medium ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-300'}`}>
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-gray-300">
                      <DollarSign className="h-4 w-4" />
                      <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>{service.duration || 0}min</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

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
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className={`h-5 w-5 ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-400'}`} />
              <span className={`font-medium ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-300'}`}>
                {service.name}
              </span>
            </div>
            
            <div className={`flex items-center gap-1 font-medium ${selectedService?.id === service.id ? 'text-green-500' : 'text-gray-300'}`}>
              <DollarSign className="h-4 w-4" />
              <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
            </div>

            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="h-4 w-4" />
              <span>{service.duration || 0}min</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
} 