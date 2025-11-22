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
  onSelectService: (service: Service) => void;
  onBookService?: (service: Service) => void; // Nova função para agendar diretamente
}

export function ServiceList({ services, selectedService, onSelectService, onBookService }: ServiceListProps) {
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
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full cursor-pointer rounded-lg bg-white border border-gray-300 py-4 pl-4 pr-10 text-left focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary hover:border-primary/50"
        >
          {selectedService ? (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">{selectedService.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-gray-700">
                  <DollarSign className="h-4 w-4" />
                  <span>R$ {selectedService.price ? selectedService.price.toFixed(2).replace('.', ',') : '0,00'}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{selectedService.duration || 0}min</span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-gray-500">Selecione um serviço</span>
          )}
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full overflow-auto rounded-md bg-white border border-gray-300 shadow-lg max-h-60">
            {services.map((service) => (
              <button
                type="button"
                key={service.id}
                onClick={() => {
                  onSelectService(service);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-primary/10 transition-colors ${
                  selectedService?.id === service.id ? 'bg-primary/10' : ''
                }`}
              >
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className={`h-5 w-5 ${selectedService?.id === service.id ? 'text-primary' : 'text-gray-600'}`} />
                    <span className={`font-medium ${selectedService?.id === service.id ? 'text-primary' : 'text-gray-900'}`}>
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-gray-700">
                      <DollarSign className="h-4 w-4" />
                      <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
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
    <div className="space-y-3">
      {services.map(service => (
        <div
          key={service.id}
          className={`w-full p-4 rounded-lg border transition-colors ${
            selectedService?.id === service.id
              ? 'bg-primary/10 border-primary'
              : 'bg-white border-gray-300'
          }`}
        >
          <div className="flex flex-col space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className={`h-5 w-5 ${selectedService?.id === service.id ? 'text-primary' : 'text-gray-600'}`} />
              <span className={`font-medium text-lg ${selectedService?.id === service.id ? 'text-primary' : 'text-gray-900'}`}>
                {service.name}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-1 font-medium ${selectedService?.id === service.id ? 'text-primary' : 'text-gray-700'}`}>
                <DollarSign className="h-4 w-4" />
                <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
              </div>

              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{service.duration || 0}min</span>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => onSelectService(service)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedService?.id === service.id
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {selectedService?.id === service.id ? '✓ Selecionado' : 'Selecionar Serviço'}
              </button>
              {onBookService && (
                <button
                  type="button"
                  onClick={() => onBookService(service)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Agendar
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 