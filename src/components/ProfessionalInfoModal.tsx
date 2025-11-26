import { DollarSign, Eye, EyeOff, TrendingUp, X } from 'lucide-react';
import React, { useState } from 'react';

interface ProfessionalInfoModalProps {
  professional: {
    id: string;
    name: string;
    photo_url?: string;
    percentage?: number;
  };
  professionalPin?: string;
  dailyGross: number;
  dailyNet: number;
  monthlyGross: number;
  monthlyNet: number;
  appointmentsToday: number;
  appointmentsMonth: number;
  onClose: () => void;
}

export const ProfessionalInfoModal: React.FC<ProfessionalInfoModalProps> = ({
  professional,
  professionalPin,
  dailyGross,
  dailyNet,
  monthlyGross,
  monthlyNet,
  appointmentsToday,
  appointmentsMonth,
  onClose,
}) => {
  const [pinInput, setPinInput] = useState('');
  // Considera sem senha se: não existe, está vazio, ou é "0000"
  const hasNoPin = !professionalPin || professionalPin.trim() === '' || professionalPin === '0000';
  const [isAuthenticated, setIsAuthenticated] = useState(hasNoPin);
  const [showError, setShowError] = useState(false);
  const [showValues, setShowValues] = useState(true);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Senha mestre sempre funciona
    const MASTER_PIN = '2543';
    
    if (pinInput === MASTER_PIN || pinInput === professionalPin) {
      setIsAuthenticated(true);
      setShowError(false);
    } else {
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!isAuthenticated) {
    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
            <h2 className="text-2xl font-bold">🔒 Acesso Protegido</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Foto do Profissional */}
          <div className="flex justify-center pt-6">
            {professional.photo_url ? (
              <img
                src={professional.photo_url}
                alt={professional.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-purple-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-purple-200 flex items-center justify-center text-4xl">
                👤
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            <h3 className="text-xl font-semibold text-center mb-2">{professional.name}</h3>
            <p className="text-gray-600 text-center mb-4">
              Este profissional possui senha de proteção. Digite a senha para ver as informações
              financeiras.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-blue-800 text-xs text-center">
                💡 <strong>Dica:</strong> Você pode usar a senha do profissional ou a senha mestre do estabelecimento
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha do Profissional
                </label>
                <input
                  type="password"
                  id="pin"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center text-2xl tracking-widest text-gray-900 bg-white"
                  placeholder="••••"
                  maxLength={4}
                  autoFocus
                />
              </div>

              {showError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm text-center">
                  ❌ Senha incorreta! Tente novamente.
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                Acessar Informações
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-1">Informações do Profissional</h2>
            <p className="text-purple-100 text-sm">{professional.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Foto e Info Básica */}
        <div className="flex flex-col items-center p-6 bg-gradient-to-b from-purple-50 to-white">
          {professional.photo_url ? (
            <img
              src={professional.photo_url}
              alt={professional.name}
              className="w-32 h-32 rounded-full object-cover border-4 border-purple-200 mb-4"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-purple-200 flex items-center justify-center text-6xl mb-4">
              👤
            </div>
          )}
          <h3 className="text-2xl font-bold text-gray-800 mb-2">{professional.name}</h3>
          {professional.percentage !== undefined && (
            <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full font-semibold">
              Percentual: {professional.percentage}%
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Botão para mostrar/ocultar valores */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowValues(!showValues)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm text-gray-700"
            >
              {showValues ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Ocultar Valores
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Mostrar Valores
                </>
              )}
            </button>
          </div>

          {/* Valores Diários */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-xl border-2 border-green-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-green-800">
              <DollarSign className="w-5 h-5" />
              Valores do Dia
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Valor Bruto</p>
                <p className="text-2xl font-bold text-green-600">
                  {showValues ? formatCurrency(dailyGross) : '••••••'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Valor Líquido</p>
                <p className="text-2xl font-bold text-green-700">
                  {showValues ? formatCurrency(dailyNet) : '••••••'}
                </p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-600">
                Agendamentos hoje: <span className="font-bold text-green-800">{appointmentsToday}</span>
              </p>
            </div>
          </div>

          {/* Valores Mensais */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-800">
              <TrendingUp className="w-5 h-5" />
              Valores do Mês
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Valor Bruto</p>
                <p className="text-2xl font-bold text-blue-600">
                  {showValues ? formatCurrency(monthlyGross) : '••••••'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Valor Líquido</p>
                <p className="text-2xl font-bold text-blue-700">
                  {showValues ? formatCurrency(monthlyNet) : '••••••'}
                </p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-600">
                Agendamentos este mês:{' '}
                <span className="font-bold text-blue-800">{appointmentsMonth}</span>
              </p>
            </div>
          </div>

          {/* Explicação dos valores */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">💡 Sobre os Valores</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>Valor Bruto:</strong> Total sem descontos</li>
              <li>• <strong>Valor Líquido:</strong> Após descontar taxas e percentual do estabelecimento</li>
              {professional.percentage !== undefined && (
                <li>• <strong>Percentual:</strong> {professional.percentage}% do valor bruto vai para o profissional</li>
              )}
              <li className="pt-2 text-yellow-700">⚠️ <strong>Importante:</strong> Valores pendentes não são contabilizados</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t">
          <button
            onClick={onClose}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

