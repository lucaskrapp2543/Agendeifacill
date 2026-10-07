import { Edit, GripVertical, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SpecificService {
  id: string;
  name: string;
  price: number;
  duration: number;
}

/**
 * Linha arrastável da lista "Serviços Cadastrados". A ORDEM desta lista é a ordem em que
 * o cliente vê os serviços (chat, /af e página completa), por isso dá para reordenar.
 * Mesma biblioteca/padrão de DraggableServiceList.tsx (categorias).
 */
function SortableSpecificServiceRow({
  sortableId,
  service,
  onEdit,
  onDelete,
}: {
  sortableId: string;
  service: SpecificService;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 bg-gray-800 rounded-lg border-2 ${isDragging ? 'border-blue-500 shadow-lg' : 'border-transparent'}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          title="Arrastar para mudar a ordem"
          aria-label="Arrastar para mudar a ordem"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="text-white font-medium truncate">{service.name}</div>
          <div className="text-gray-400 text-sm">
            R$ {service.price.toFixed(2)} • {service.duration}min
          </div>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
          title="Editar"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-red-400 hover:text-red-300 transition-colors"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
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

  // Arrastar para reordenar. Ids repetidos (cadastros antigos) usariam o mesmo id no
  // sortable e quebrariam o arrasto, então o id de arrasto leva a posição junto.
  const sortableIds = services.map((service, index) => `${String(service.id)}::${index}`);
  const sensors = useSensors(
    // Precisa mover 6px para começar a arrastar: toque/clique nos botões continua normal.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setServices((prev) => arrayMove(prev, oldIndex, newIndex));
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
              <strong>💡 Como funciona:</strong> Os serviços cadastrados aqui aparecem apenas quando o cliente selecionar este profissional.
              Use esta área para serviços exclusivos, como "Sobrancelhas", quando somente este profissional oferece esse atendimento.
            </p>
          </div>

          {/* Mensagem destacada */}
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg">
            <p className="text-yellow-200 text-sm font-semibold">
              ⚠️ Se você é o único profissional, normalmente não precisa cadastrar serviços específicos aqui. Use este campo apenas quando o profissional fizer algo diferente dos demais.
            </p>
          </div>

          {/* Ponto de atenção */}
          <div className="mb-6 p-4 bg-amber-950/40 border border-amber-500/60 rounded-lg">
            <p className="text-amber-200 text-sm font-bold">
              ⚠️ ATENÇÃO: ao cadastrar serviços nesta área, o sistema prioriza somente os serviços específicos deste profissional.
              Para os clientes, aparecerão apenas os serviços cadastrados aqui (e não os da seção "Meus serviços").
            </p>
          </div>

          {/* Lista de serviços existentes */}
          {services.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-medium text-white mb-1">Serviços Cadastrados:</h4>
              <p className="text-xs text-gray-400 mb-4">
                Segure em <GripVertical className="inline w-3.5 h-3.5 align-text-bottom" /> e arraste para mudar a ordem. É nessa ordem que o cliente vê os serviços. Clique em "Salvar Serviços" para gravar.
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {services.map((service, index) => (
                      <SortableSpecificServiceRow
                        key={sortableIds[index]}
                        sortableId={sortableIds[index]}
                        service={service}
                        onEdit={() => handleEditService(service)}
                        onDelete={() => handleDeleteService(service.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
