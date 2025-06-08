import React from 'react';

interface DurationSelectorProps {
  value: number;
  onChange: (duration: number) => void;
  className?: string;
}

const durationOptions = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1 hora e meia' }
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