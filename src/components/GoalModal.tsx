import React, { useState } from 'react';
import { X, Target } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category?: string; // Categoria do serviço (opcional)
}

interface ServiceCategory {
  id: string;
  name: string;
  establishment_id: string;
  display_order: number;
  is_active: boolean;
}

interface ServiceSubcategory {
  id: string;
  name: string;
  category_id: string;
  display_order: number;
  is_active: boolean;
  service_categories?: ServiceCategory;
}

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goalAmount: number, selectedServices: string[]) => Promise<void>;
  professionalName: string;
  currentGoal?: number;
  currentSelectedServices?: string[];
  services: Service[];
  serviceCategories?: ServiceCategory[];
  serviceSubcategories?: ServiceSubcategory[];
  isLoading?: boolean;
}

export function GoalModal({ 
  isOpen, 
  onClose, 
  onSave, 
  professionalName,
  currentGoal = 0,
  currentSelectedServices = [],
  services = [],
  serviceCategories = [],
  serviceSubcategories = [],
  isLoading = false 
}: GoalModalProps) {
  const [goalAmount, setGoalAmount] = useState<string>(currentGoal.toString());
  const [selectedServices, setSelectedServices] = useState<string[]>(currentSelectedServices);
  const [showServiceSelection, setShowServiceSelection] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const handleSave = async () => {
    const amount = parseInt(goalAmount);
    
    if (isNaN(amount) || amount < 1) {
      alert('Por favor, digite um número válido maior que 0');
      return;
    }
    
    if (amount > 999) {
      alert('A meta não pode ser maior que 999 serviços');
      return;
    }
    
    // Sistema simples: sem seleção de serviços específicos
    await onSave(amount, []);
  };

  const handleClose = () => {
    setGoalAmount(currentGoal.toString());
    setSelectedServices(currentSelectedServices);
    setShowServiceSelection(false);
    onClose();
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAllServices = () => {
    setSelectedServices(services.map(s => s.id));
  };

  const handleDeselectAllServices = () => {
    setSelectedServices([]);
  };

  // Função para obter serviços sem categoria (serviços normais)
  const getNormalServices = () => {
    return services.filter(service => !service.category);
  };

  // Função para selecionar todos os serviços de uma categoria
  const handleSelectCategoryServices = (categoryId: string) => {
    const categorySubcategories = serviceSubcategories.filter(sub => sub.category_id === categoryId);
    const subcategoryIds = categorySubcategories.map(sub => `subcategory_${sub.id}`);
    
    setSelectedServices(prev => {
      const newSelection = [...prev];
      subcategoryIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      return newSelection;
    });
  };

  // Função para desmarcar todos os serviços de uma categoria
  const handleDeselectCategoryServices = (categoryId: string) => {
    const categorySubcategories = serviceSubcategories.filter(sub => sub.category_id === categoryId);
    const subcategoryIds = categorySubcategories.map(sub => `subcategory_${sub.id}`);
    
    setSelectedServices(prev => prev.filter(id => !subcategoryIds.includes(id)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] shadow-xl overflow-hidden flex flex-col">
        {/* Header - Fixo no topo */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Definir Meta Mensal
                </h3>
                <p className="text-sm text-gray-600 font-medium">
                  {professionalName}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Com scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">
                    Como funciona a meta?
                  </h4>
                  <p className="text-sm text-blue-700">
                    Defina quantos serviços o profissional deve realizar no mês. 
                    O sistema acompanhará automaticamente o progresso baseado nos agendamentos completados.
                    <br /><br />
                    <strong>Dica:</strong> Você pode selecionar serviços específicos ou categorias inteiras para a meta, 
                    evitando que serviços muito rápidos distorçam o resultado.
                    <br /><br />
                    <strong>Tipos de seleção:</strong>
                    <br />• <strong>Serviços Normais:</strong> Lista individual de serviços
                    <br />• <strong>Serviços por Categoria:</strong> Grupos organizados de serviços
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta de serviços por mês
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  min="1"
                  max="999"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center text-gray-900 bg-white"
                  placeholder="Ex: 10, 20, 50"
                  disabled={isLoading}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                  serviços
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Digite um número entre 1 e 999
              </p>
            </div>

            {/* Sugestões de metas */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Sugestões rápidas:
              </p>
              <div className="flex gap-2 flex-wrap">
                {[10, 20, 30, 50, 80, 100].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setGoalAmount(suggestion.toString())}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      goalAmount === suggestion.toString()
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    disabled={isLoading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de Serviços */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Serviços que contam para a meta
                </label>
                <button
                  type="button"
                  onClick={() => setShowServiceSelection(!showServiceSelection)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  disabled={isLoading}
                >
                  {showServiceSelection ? 'Ocultar' : 'Selecionar'}
                </button>
              </div>
              
              {selectedServices.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Todos os serviços</strong> contarão para a meta
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    <strong>{selectedServices.length} serviço(s)</strong> selecionado(s) para a meta
                  </p>
                </div>
              )}

              {showServiceSelection && (
                <div className="mt-3 space-y-4">
                  {/* Botões de ação geral */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllServices}
                      className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                      disabled={isLoading}
                    >
                      Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllServices}
                      className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      disabled={isLoading}
                    >
                      Desmarcar Todos
                    </button>
                  </div>

                  {/* Serviços Normais (sem categoria) */}
                  {getNormalServices().length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Serviços Normais
                      </h4>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                        <div className="space-y-1 p-3">
                          {getNormalServices().map((service) => (
                            <label
                              key={service.id}
                              className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedServices.includes(service.id)}
                                onChange={() => handleServiceToggle(service.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                                disabled={isLoading}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900 block">
                                  {service.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {service.duration}min - R$ {service.price.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Serviços por Categoria - Exatamente como na aba "Serviços (com dropdown)" */}
                  {serviceCategories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Serviços por Categoria
                      </h4>
                      
                      {serviceCategories.map((category) => {
                        const categorySubcategories = serviceSubcategories.filter(sub => sub.category_id === category.id);
                        const selectedInCategory = categorySubcategories.filter(sub => selectedServices.includes(`subcategory_${sub.id}`));
                        
                        return (
                          <div key={category.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            {/* Cabeçalho da categoria */}
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-lg font-semibold text-gray-900">
                                {category.name} ({selectedInCategory.length}/{categorySubcategories.length})
                              </h5>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSelectCategoryServices(category.id)}
                                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
                                  disabled={isLoading}
                                >
                                  Todos
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeselectCategoryServices(category.id)}
                                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                                  disabled={isLoading}
                                >
                                  Nenhum
                                </button>
                              </div>
                            </div>
                            
                            {/* Lista de subcategorias - Responsivo */}
                            {categorySubcategories.length === 0 ? (
                              <p className="text-gray-600 text-sm">Nenhum serviço cadastrado nesta categoria</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                                {categorySubcategories.map((subcategory) => (
                                  <label
                                    key={subcategory.id}
                                    className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                  >
                                    <div className="flex items-start gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedServices.includes(`subcategory_${subcategory.id}`)}
                                        onChange={() => handleServiceToggle(`subcategory_${subcategory.id}`)}
                                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-0.5 flex-shrink-0"
                                        disabled={isLoading}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <h6 className="font-medium text-gray-900 mb-2 text-sm">{subcategory.name}</h6>
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-xs">
                                            <span className="text-gray-600">Preço:</span>
                                            <span className="font-medium text-gray-900">R$ {subcategory.price?.toFixed(2).replace('.', ',') || '0,00'}</span>
                                          </div>
                                          <div className="flex justify-between text-xs">
                                            <span className="text-gray-600">Duração:</span>
                                            <span className="font-medium text-gray-900">{subcategory.duration || 0}min</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mensagem quando não há serviços */}
                  {services.length === 0 && (
                    <p className="p-3 text-sm text-gray-500 text-center border border-gray-200 rounded-lg">
                      Nenhum serviço disponível
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Fixo no final */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !goalAmount.trim() || parseInt(goalAmount) < 1}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </div>
              ) : (
                'Salvar Meta'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
