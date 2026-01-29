import React from 'react';
import { Clock, DollarSign, Calendar } from 'lucide-react';

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
  return (
    <div className="space-y-3">
      {services.map(service => (
        <div
          key={service.id}
          className="w-full p-4 rounded-2xl transition-colors"
          style={{
            background: selectedService?.id === service.id ? 'rgba(230,199,139,0.10)' : '#151515',
            border: `1px solid ${selectedService?.id === service.id ? 'rgba(230,199,139,0.45)' : 'rgba(255,255,255,0.06)'}`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
          }}
        >
          <div className="flex flex-col space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: selectedService?.id === service.id ? '#E6C78B' : '#A1A1A1' }} />
              <span className="font-extrabold text-white">
                {service.name}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 font-semibold" style={{ color: selectedService?.id === service.id ? '#E6C78B' : '#A1A1A1' }}>
                <DollarSign className="h-4 w-4" style={{ color: selectedService?.id === service.id ? '#E6C78B' : '#A1A1A1' }} />
                <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
              </div>

              <div className="flex items-center gap-1" style={{ color: '#A1A1A1' }}>
                <Clock className="h-4 w-4" style={{ color: '#A1A1A1' }} />
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