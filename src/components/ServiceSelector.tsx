import React from 'react';
import { Clock, DollarSign, ChevronDown } from 'lucide-react';
import { Listbox } from '@headlessui/react';

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
  const selectedService = services.find(service => service.id === value);
  const useDropdown = services.length > 2;

  if (useDropdown) {
    return (
      <div className={className}>
        <Listbox value={selectedService} onChange={(service) => onChange(service)}>
          <div className="relative mt-1">
            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-[#242628] border border-gray-800 py-4 pl-4 pr-10 text-left focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
              {selectedService ? (
                <div className="flex flex-col space-y-2">
                  <span className="text-white font-medium">{selectedService.name}</span>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-gray-400">
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span>R$ {selectedService.price ? selectedService.price.toFixed(2).replace('.', ',') : '0,00'}</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{selectedService.duration || 0} minutos</span>
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-gray-400">Selecione um serviço</span>
              )}
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-[#242628] border border-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {services.map((service) => (
                <Listbox.Option
                  key={service.id}
                  value={service}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-3 px-4 ${
                      active ? 'bg-primary/20 text-white' : 'text-gray-300'
                    }`
                  }
                >
                  {({ selected }) => (
                    <div className="flex flex-col space-y-2">
                      <span className={`block truncate ${selected ? 'font-medium text-primary' : 'font-normal'}`}>
                        {service.name}
                      </span>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center text-gray-400">
                          <DollarSign className="h-4 w-4 mr-1" />
                          <span>R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'}</span>
                        </div>
                        <div className="flex items-center text-gray-400">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{service.duration || 0} minutos</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>
    );
  }

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