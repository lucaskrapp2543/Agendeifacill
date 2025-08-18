import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface DraggableServiceListProps {
  services: Service[];
  onReorder: (services: Service[]) => void;
  isSaving?: boolean;
}

function SortableServiceItem({ service }: { service: Service }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between bg-[#242628] p-3 rounded-lg border-2 ${
        isDragging ? 'border-primary shadow-lg scale-105' : 'border-transparent hover:border-gray-600'
      } transition-all duration-200`}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-400 hover:text-white cursor-grab active:cursor-grabbing transition-colors p-1 rounded hover:bg-gray-700"
          title="Arrastar para reordenar"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="text-gray-300">{service.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-400">{service.duration}min</span>
        <span className="text-gray-300">R$ {service.price.toFixed(2).replace('.', ',')}</span>
      </div>
    </div>
  );
}

export function DraggableServiceList({ services, onReorder, isSaving = false }: DraggableServiceListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = services.findIndex(service => service.id === active.id);
      const newIndex = services.findIndex(service => service.id === over?.id);

      const newServices = arrayMove(services, oldIndex, newIndex);
      onReorder(newServices);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={services.map(service => service.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {services.map((service) => (
            <SortableServiceItem key={service.id} service={service} />
          ))}
        </div>
      </SortableContext>
      {isSaving && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-400">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
            Salvando ordem...
          </div>
        </div>
      )}
    </DndContext>
  );
}
