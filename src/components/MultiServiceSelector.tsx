import React, { useState, useRef, useEffect } from 'react';
import { Clock, DollarSign, Calendar, ChevronDown, Plus, X } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface MultiServiceSelectorProps {
  services: Service[];
  selectedServices: Service[];
  onSelectServices: (services: Service[]) => void;
  maxServices?: number;
  onBookServices?: (services: Service[]) => void; // Nova função para agendar diretamente
}

export function MultiServiceSelector({ 
  services, 
  selectedServices, 
  onSelectServices, 
  maxServices = 4,
  onBookServices
}: MultiServiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleServiceToggle = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    
    if (isSelected) {
      // Remover serviço
      onSelectServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      // Adicionar serviço (se não exceder o limite)
      if (selectedServices.length < maxServices) {
        onSelectServices([...selectedServices, service]);
      }
    }
  };

  const removeService = (serviceId: string) => {
    onSelectServices(selectedServices.filter(s => s.id !== serviceId));
  };

  const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration, 0);

  return (
    <div className="space-y-4">
      {/* Serviços Selecionados */}
      {selectedServices.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Serviços Selecionados:</h3>
          <div className="space-y-2">
            {selectedServices.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <span className="font-medium text-primary">{service.name}</span>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span>R$ {service.price.toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{service.duration}min</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeService(service.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Resumo Total */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-gray-700">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-medium">Total: R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{totalDuration}min</span>
                </div>
              </div>
              <span className="text-sm text-gray-500">
                {selectedServices.length}/{maxServices} serviços
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown para Selecionar Mais Serviços */}
      {selectedServices.length < maxServices && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-full cursor-pointer rounded-lg bg-white border border-gray-300 py-4 pl-4 pr-10 text-left focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary hover:border-primary/50"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-gray-600" />
              <span className="text-gray-500">
                {selectedServices.length === 0 
                  ? 'Selecione um ou mais serviços' 
                  : `Adicionar mais serviços (${selectedServices.length}/${maxServices})`
                }
              </span>
            </div>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </span>
          </button>

          {isOpen && (
            <div className="absolute z-10 mt-1 w-full overflow-auto rounded-md bg-white border border-gray-300 shadow-lg max-h-60">
              {services
                .filter(service => !selectedServices.some(s => s.id === service.id))
                .map((service) => (
                  <div
                    key={service.id}
                    className="w-full px-4 py-3 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex flex-col space-y-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-gray-600" />
                        <span className="font-medium text-gray-900">{service.name}</span>
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
                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleServiceToggle(service);
                        }}
                        className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                          selectedServices.some(s => s.id === service.id)
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {selectedServices.some(s => s.id === service.id) ? '✓ Selecionado' : 'Selecionar'}
                      </button>
                      {onBookServices && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedServices.some(s => s.id === service.id)) {
                              onSelectServices([...selectedServices, service]);
                            }
                            onBookServices(selectedServices.some(s => s.id === service.id) ? selectedServices : [...selectedServices, service]);
                          }}
                          className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          Agendar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Mensagem quando limite atingido */}
      {selectedServices.length >= maxServices && (
        <div className="text-sm text-gray-500 text-center">
          Máximo de {maxServices} serviços selecionados
        </div>
      )}
    </div>
  );
}
