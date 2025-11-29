import React from 'react';

interface TimeSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  intervalMinutes?: number; // Novo parâmetro: intervalo em minutos (15, 20 ou 30)
}

export const TimeSelector: React.FC<TimeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  intervalMinutes = 15 // Padrão: 15 minutos
}) => {
  // Gerar opções de horário baseado no intervalo configurado
  const generateTimeOptions = () => {
    const options = [
      { value: '', label: 'Selecione um horário' }
    ];
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
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
  
  // Se o valor atual não está na lista de opções válidas (horário antigo),
  // adicionar ele como opção especial para não perder o valor
  const hasCurrentValueInOptions = timeOptions.some(opt => opt.value === selectValue);
  const finalOptions = hasCurrentValueInOptions 
    ? timeOptions 
    : selectValue && selectValue !== ''
      ? [
          { value: selectValue, label: `${selectValue} (atual)` },
          ...timeOptions.filter(opt => opt.value !== '')
        ]
      : timeOptions;

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
      {finalOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}; 