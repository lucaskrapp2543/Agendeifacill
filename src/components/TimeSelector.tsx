import React from 'react';

interface TimeSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export const TimeSelector: React.FC<TimeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = ''
}) => {
  // Gerar opções de horário de 15 em 15 minutos
  const generateTimeOptions = () => {
    const options = [
      { value: '', label: 'Selecione um horário' }
    ];
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        const timeValue = `${formattedHour}:${formattedMinute}`;
        
        options.push({
          value: timeValue,
          label: timeValue
        });
      }
    }
    
    return options;
  };

  const timeOptions = generateTimeOptions();

  // Garantir que o valor seja uma string válida ou vazia
  const selectValue = value && value !== 'null' ? value : '';

  return (
    <select
      value={selectValue}
      onChange={(e) => {
        const newValue = e.target.value;
        onChange(newValue === '' ? null : newValue);
      }}
      disabled={disabled}
      className={`input-field ${className}`}
    >
      {timeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}; 