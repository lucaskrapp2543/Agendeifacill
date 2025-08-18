import React, { useState } from 'react';

interface ReadMoreProps {
  text: string;
  maxLength?: number;
  className?: string;
}

const ReadMore: React.FC<ReadMoreProps> = ({ 
  text, 
  maxLength = 60, 
  className = "" 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Se o texto for menor que o limite, mostra tudo
  if (text.length <= maxLength) {
    return <span className={className}>{text}</span>;
  }

  // Se não estiver expandido, mostra apenas o início
  if (!isExpanded) {
    const truncatedText = text.substring(0, maxLength).trim();
    return (
      <span className={className}>
        {truncatedText}...{' '}
        <button
          onClick={() => setIsExpanded(true)}
          className="text-blue-500 hover:text-blue-600 font-medium underline cursor-pointer"
        >
          Ler mais
        </button>
      </span>
    );
  }

  // Se estiver expandido, mostra o texto completo
  return (
    <span className={className}>
      {text}{' '}
      <button
        onClick={() => setIsExpanded(false)}
        className="text-blue-500 hover:text-blue-600 font-medium underline cursor-pointer"
      >
        Ler menos
      </button>
    </span>
  );
};

export default ReadMore;
