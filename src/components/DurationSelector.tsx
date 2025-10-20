
interface DurationSelectorProps {
  value: number;
  onChange: (duration: number) => void;
  className?: string;
}

const durationOptions = [
  { value: 15, label: '15 minutos' },
  { value: 20, label: '20 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 40, label: '40 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1 hora e meia' },
  { value: 120, label: '2 horas' },
  { value: 150, label: '2 horas e meia' },
  { value: 180, label: '3 horas' },
  { value: 210, label: '3 horas e meia' },
  { value: 240, label: '4 horas' },
  { value: 270, label: '4 horas e meia' },
  { value: 300, label: '5 horas' },
  { value: 330, label: '5 horas e meia' },
  { value: 360, label: '6 horas' },
  { value: 390, label: '6 horas e meia' },
  { value: 420, label: '7 horas' },
  { value: 450, label: '7 horas e meia' },
  { value: 480, label: '8 horas' },
  { value: 510, label: '8 horas e meia' },
  { value: 540, label: '9 horas' },
  { value: 570, label: '9 horas e meia' },
  { value: 600, label: '10 horas' },
  { value: 630, label: '10 horas e meia' },
  { value: 660, label: '11 horas' },
  { value: 690, label: '11 horas e meia' },
  { value: 720, label: '12 horas' },
  { value: 750, label: '12 horas e meia' },
  { value: 780, label: '13 horas' },
  { value: 810, label: '13 horas e meia' },
  { value: 840, label: '14 horas' },
  { value: 870, label: '14 horas e meia' },
  { value: 900, label: '15 horas' },
  { value: 930, label: '15 horas e meia' },
  { value: 960, label: '16 horas' },
  { value: 990, label: '16 horas e meia' },
  { value: 1020, label: '17 horas' },
  { value: 1050, label: '17 horas e meia' },
  { value: 1080, label: '18 horas' },
  { value: 1110, label: '18 horas e meia' },
  { value: 1140, label: '19 horas' },
  { value: 1170, label: '19 horas e meia' },
  { value: 1200, label: '20 horas' },
  { value: 1230, label: '20 horas e meia' },
  { value: 1260, label: '21 horas' },
  { value: 1290, label: '21 horas e meia' },
  { value: 1320, label: '22 horas' },
  { value: 1350, label: '22 horas e meia' },
  { value: 1380, label: '23 horas' },
  { value: 1410, label: '23 horas e meia' },
  { value: 1440, label: '24 horas' }
];

export function DurationSelector({ value, onChange, className = '' }: DurationSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`bg-[#242628] text-white border border-gray-800 rounded-lg px-3 py-2 ${className}`}
    >
      <option value="">Selecione a duração</option>
      {durationOptions.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
} 