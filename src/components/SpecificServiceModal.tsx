import { Edit, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';

interface SpecificService {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface SpecificServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (services: SpecificService[]) => void;
  professionalName: string;
  currentServices: SpecificService[];
}

export function SpecificServiceModal({
  isOpen,
  onClose,
  onSave,
  professionalName,
  currentServices
}: SpecificServiceModalProps) {
  const [services, setServices] = useState<SpecificService[]>(currentServices);
  const [editingService, setEditingService] = useState<SpecificService | null>(null);
  const [newService, setNewService] = useState({
    name: '',
    price: '',
    duration: ''
  });

  React.useEffect(() => {
    console.log('🔧 DEBUG - Modal recebeu serviços:', currentServices);
    setServices(currentServices);
  }, [currentServices]);

  const handleAddService = () => {
    if (!newService.name.trim() || !newService.price || !newService.duration) {
      return;
    }

    const service: SpecificService = {
      id: Date.now().toString(),
      name: newService.name.trim(),
      price: parseFloat(newService.price),
      duration: parseInt(newService.duration)
    };

    setServices(prev => [...prev, service]);
    setNewService({ name: '', price: '', duration: '' });
  };

  const handleEditService = (service: SpecificService) => {
    setEditingService(service);
    setNewService({
      name: service.name,
      price: service.price.toString(),
      duration: service.duration.toString()
    });
  };

  const handleUpdateService = () => {
    if (!editingService || !newService.name.trim() || !newService.price || !newService.duration) {
      return;
    }

    setServices(prev => prev.map(service =>
      service.id === editingService.id
        ? {
          ...service,
          name: newService.name.trim(),
          price: parseFloat(newService.price),
          duration: parseInt(newService.duration)
        }
        : service
    ));

    setEditingService(null);
    setNewService({ name: '', price: '', duration: '' });
  };

  const handleDeleteService = (serviceId: string) => {
    setServices(prev => prev.filter(service => service.id !== serviceId));
  };

  const handleSave = () => {
    console.log('🔧 DEBUG - Modal salvando serviços:', services);
    onSave(services);
    onClose();
  };

  const handleCancel = () => {
    setServices(currentServices);
    setEditingService(null);
    setNewService({ name: '', price: '', duration: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b1c] rounded-lg border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-white">
              Serviços Específicos - {professionalName}
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Descrição */}
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm">
              <strong>💡 Como funciona:</strong> Estes serviços aparecerão apenas quando o cliente selecionar este profissional específico.
              Por exemplo, se este profissional faz sobrancelhas, adicione "Sobrancelhas" aqui.
            </p>
          </div>

          {/* Mensagem destacada */}
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg">
            <p className="text-yellow-200 text-sm font-semibold">
              ⚠️ Se você é o único profissional, não precisa adicionar serviços aqui, e apenas se o profissional faz um serviço que outros não fazem.
            </p>
          </div>

          {/* Lista de serviços existentes */}
          {services.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-medium text-white mb-4">Serviços Cadastrados:</h4>
              <div className="space-y-3">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex-1">
                      <div className="text-white font-medium">{service.name}</div>
                      <div className="text-gray-400 text-sm">
                        R$ {service.price.toFixed(2)} • {service.duration}min
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditService(service)}
                        className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário para adicionar/editar serviço */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-4">
              {editingService ? 'Editar Serviço' : 'Adicionar Novo Serviço'}
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Nome do Serviço
                </label>
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Sobrancelhas, Manicure, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newService.price}
                    onChange={(e) => setNewService(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Duração (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newService.duration}
                    onChange={(e) => setNewService(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {editingService ? (
                  <>
                    <button
                      onClick={handleUpdateService}
                      disabled={!newService.name.trim() || !newService.price || !newService.duration}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Atualizar Serviço
                    </button>
                    <button
                      onClick={() => {
                        setEditingService(null);
                        setNewService({ name: '', price: '', duration: '' });
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleAddService}
                    disabled={!newService.name.trim() || !newService.price || !newService.duration}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Serviço
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Salvar Serviços
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
