import { parseServiceBookingWeekdays } from '../utils/serviceBookingDays';

const DAYS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  { key: 'wednesday', label: 'Qua' },
  { key: 'thursday', label: 'Qui' },
  { key: 'friday', label: 'Sex' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

/**
 * Opcional: dias em que o cliente pode agendar este serviço pelo link.
 * Todos marcados = sem trava (salva null). Mostra só os dias em que a barbearia abre.
 */
export function ServiceBookingDaysPicker({
  value,
  onChange,
  businessHours,
}: {
  value: unknown;
  onChange: (next: string[] | null) => void;
  businessHours?: Record<string, { enabled?: boolean } | undefined> | null;
}) {
  const hasHours = Boolean(businessHours) && Object.keys(businessHours || {}).length > 0;
  const openDays = DAYS.filter((day) => !hasHours || businessHours?.[day.key]?.enabled === true);
  const openKeys = openDays.map((day) => day.key);
  const saved = parseServiceBookingWeekdays(value);
  const savedOpen = saved ? saved.filter((key) => openKeys.includes(key)) : [];
  // Sem trava, ou trava só em dias que hoje estão fechados: mostra todos marcados.
  const selected = savedOpen.length > 0 ? savedOpen : openKeys;
  const restricted = selected.length < openKeys.length;

  const toggle = (key: string) => {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    if (next.length === 0) return; // Precisa sobrar pelo menos um dia.
    onChange(next.length === openKeys.length ? null : next);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm font-semibold text-gray-800 mb-2">
        Dias em que o cliente pode agendar <span className="font-normal text-gray-500">(opcional)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {openDays.map((day) => {
          const isOn = selected.includes(day.key);
          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(day.key)}
              className={`min-h-[40px] min-w-[44px] rounded-lg border px-2.5 text-sm font-semibold transition-colors ${
                isOn ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-500'
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-gray-600">
        {restricted
          ? 'No link de agendamento, o cliente só consegue marcar este serviço nos dias em verde. Pelo painel você marca em qualquer dia.'
          : 'Tudo em verde: o cliente marca em qualquer dia. Toque em um dia para tirar ele deste serviço.'}
      </p>
    </div>
  );
}
