# Implementação de Slots de Horário

## Objetivo
Mostrar lacunas (horários vazios) entre os agendamentos para facilitar visualização de horários disponíveis.

## Como Implementar

### 1. Adicionar a função após o filteredAppointments (linha ~2975):

```typescript
// Gerar grade de horários com lacunas
const generateTimeSlots = () => {
  if (selectedProfessional === '' || selectedProfessional === 'all') {
    return filteredAppointments;
  }

  const dayName = format(selectedDate, 'EEEE', { locale: ptBR }).toLowerCase();
  const dayKey = dayName as keyof typeof businessHours;
  const hoursForDay = businessHours[dayKey];

  if (!hoursForDay?.enabled) return filteredAppointments;

  const slots: any[] = [];
  const interval = use15MinuteInterval ? 15 : 30;

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const addSlots = (start: string, end: string) => {
    let curr = toMinutes(start);
    const endMins = toMinutes(end);

    while (curr < endMins) {
      const time = toTime(curr);
      const apt = filteredAppointments.find(a => a.appointment_time === time);
      
      slots.push(apt || { isEmpty: true, time });
      curr += interval;
    }
  };

  if (hoursForDay.open1 && hoursForDay.close1) {
    addSlots(hoursForDay.open1, hoursForDay.close1);
  }

  if (hoursForDay.open2 && hoursForDay.close2) {
    addSlots(hoursForDay.open2, hoursForDay.close2);
  }

  return slots;
};

const slotsToShow = generateTimeSlots();
```

### 2. Modificar a renderização (linha ~6298):

Trocar:
```typescript
{filteredAppointments.map((appointment) => (
```

Por:
```typescript
{slotsToShow.map((item, idx) => 
  item.isEmpty ? (
    <div key={`empty-${idx}`} className="bg-gray-700/30 rounded-lg w-full p-3 border-2 border-dashed border-gray-600">
      <div className="flex justify-between items-center">
        <span className="text-gray-300 text-sm font-medium">{item.time}</span>
        <span className="text-gray-400 text-xs uppercase">HORÁRIO DISPONÍVEL</span>
      </div>
    </div>
  ) : (
    <div key={item.id} ...resto do código do agendamento...
```

## Resultado
- Quando selecionar um profissional específico: mostra horários vazios + agendamentos
- Quando selecionar "Todos": mostra apenas agendamentos (sem lacunas)
