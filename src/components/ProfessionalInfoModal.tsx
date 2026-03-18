import { DollarSign, Eye, EyeOff, TrendingUp, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ProfessionalInfoModalProps {
  professional: {
    id: string;
    name: string;
    photo_url?: string;
    percentage?: number;
    hide_gross_in_financial?: boolean;
  };
  professionalPin?: string;
  dailyGross: number;
  dailyNet: number;
  monthlyGross: number;
  monthlyNet: number;
  appointmentsToday: number;
  appointmentsMonth: number;
  subscriberMonthlyAccumulated?: number;
  subscriberMonthlyPaid?: number;
  subscriberMonthlyPending?: number;
  subscriberAttendanceCount?: number;
  subscriberClientsCount?: number;
  subscriberSalesCount?: number;
  establishmentId?: string;
  selectedMonth?: Date;
  onClose: () => void;
}

interface ProfessionalPaymentHistoryItem {
  id: string;
  amount: number;
  payment_date: string;
  payment_source?: string | null;
  for_month?: string | null;
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
  subscriberMonthlyAccumulated = 0,
  subscriberMonthlyPaid = 0,
  subscriberMonthlyPending = 0,
  subscriberAttendanceCount = 0,
  subscriberClientsCount = 0,
  subscriberSalesCount = 0,
  establishmentId,
  selectedMonth,
  onClose,
}) => {
  const [pinInput, setPinInput] = useState('');
  // Considera sem senha se: não existe, está vazio, ou é "0000"
  const hasNoPin = !professionalPin || professionalPin.trim() === '' || professionalPin === '0000';
  const [isAuthenticated, setIsAuthenticated] = useState(hasNoPin);
  const [showError, setShowError] = useState(false);
  const [showValues, setShowValues] = useState(true);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<ProfessionalPaymentHistoryItem[]>([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(true);

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
  const hasSubscriberFinancial =
    subscriberMonthlyAccumulated > 0 || subscriberMonthlyPaid > 0 || subscriberMonthlyPending > 0;
  const hideGrossInFinancial = professional.hide_gross_in_financial === true;

  const selectedMonthKey = useMemo(() => {
    const base = selectedMonth || new Date();
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    let intervalRef: number | null = null;

    const loadPaymentHistory = async () => {
      if (!establishmentId || !professional.id) {
        if (!cancelled) setPaymentHistory([]);
        return;
      }

      setIsLoadingPayments(true);
      try {
        const { data, error } = await supabase
          .from('professional_payments')
          .select('id, amount, payment_date, payment_source, for_month')
          .eq('establishment_id', establishmentId)
          .eq('professional_id', professional.id)
          .order('payment_date', { ascending: false });

        if (error) throw error;

        const rows = ((data || []) as ProfessionalPaymentHistoryItem[])
          .filter((row) => {
            const source = String(row.payment_source || '').trim().toLowerCase();
            if (source && source !== 'normal') return false;

            const forMonth = String(row.for_month || '').trim();
            if (forMonth) return forMonth === selectedMonthKey;

            const dt = new Date(row.payment_date);
            if (Number.isNaN(dt.getTime())) return false;
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            return key === selectedMonthKey;
          })
          .map((row) => ({
            id: String(row.id || ''),
            amount: Number(row.amount || 0),
            payment_date: String(row.payment_date || ''),
            payment_source: row.payment_source || null,
            for_month: row.for_month || null,
          }));

        if (!cancelled) setPaymentHistory(rows);
      } catch (err) {
        console.error('Erro ao carregar histórico financeiro do profissional:', err);
        if (!cancelled) setPaymentHistory([]);
      } finally {
        if (!cancelled) setIsLoadingPayments(false);
      }
    };

    void loadPaymentHistory();
    intervalRef = window.setInterval(() => {
      void loadPaymentHistory();
    }, 15000);

    return () => {
      cancelled = true;
      if (intervalRef) window.clearInterval(intervalRef);
    };
  }, [establishmentId, professional.id, selectedMonthKey]);

  const totalPaid = paymentHistory
    .filter((row) => row.amount > 0)
    .reduce((sum, row) => sum + row.amount, 0);
  const totalWithdrawn = paymentHistory
    .filter((row) => row.amount < 0)
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const paymentCount = paymentHistory.filter((row) => row.amount > 0).length;
  const lastPaymentDate = paymentHistory.find((row) => row.amount > 0)?.payment_date || null;
  const pendingToReceive = Math.max(0, monthlyNet - totalPaid);

  const formatDateTime = (value: string) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <div className="bg-gradient-to-r from-gray-900 to-black text-white p-6 rounded-t-2xl flex justify-between items-center">
            <h2 className="text-2xl font-bold">🔒 Acesso Protegido</h2>
            <button
              onClick={onClose}
              data-tutorial-id="professional-info-close"
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
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-300"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl">
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

            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
              <p className="text-gray-800 text-xs text-center">
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
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 text-center text-2xl tracking-widest text-gray-900 bg-white"
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
                className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
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
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-black text-white p-6 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-1">Informações do Profissional</h2>
            <p className="text-gray-300 text-sm">{professional.name}</p>
          </div>
          <button
            onClick={onClose}
            data-tutorial-id="professional-info-close"
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Foto e Info Básica */}
        <div className="flex flex-col items-center p-6 bg-gradient-to-b from-gray-100 to-white">
          {professional.photo_url ? (
            <img
              src={professional.photo_url}
              alt={professional.name}
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-300 mb-4"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-6xl mb-4">
              👤
            </div>
          )}
          <h3 className="text-2xl font-bold text-gray-800 mb-2">{professional.name}</h3>
          {professional.percentage !== undefined && (
            <span className="px-4 py-2 bg-gray-200 text-gray-800 rounded-full font-semibold">
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
            <div className={`grid ${hideGrossInFinancial ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              {!hideGrossInFinancial && (
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Valor Bruto</p>
                  <p className="text-2xl font-bold text-green-600">
                    {showValues ? formatCurrency(dailyGross) : '••••••'}
                  </p>
                </div>
              )}
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Valor Líquido</p>
                <p className="text-2xl font-bold text-green-700">
                  {showValues ? formatCurrency(dailyNet) : '••••••'}
                </p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-600">
                Atendimentos concluídos hoje: <span className="font-bold text-green-800">{appointmentsToday}</span>
              </p>
            </div>
          </div>

          {/* Valores Mensais */}
          <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-5 rounded-xl border-2 border-gray-300">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
              <TrendingUp className="w-5 h-5" />
              Valores do Mês
            </h3>
            <div className={`grid ${hideGrossInFinancial ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              {!hideGrossInFinancial && (
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Valor Bruto</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {showValues ? formatCurrency(monthlyGross) : '••••••'}
                  </p>
                </div>
              )}
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Valor Líquido</p>
                <p className="text-2xl font-bold text-gray-900">
                  {showValues ? formatCurrency(monthlyNet) : '••••••'}
                </p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-600">
                Agendamentos este mês:{' '}
                <span className="font-bold text-gray-800">{appointmentsMonth}</span>
              </p>
            </div>
            {hasSubscriberFinancial && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-purple-800 mb-1">Assinaturas do mês</p>
                <p className="text-xs text-purple-700">
                  Acumulado: <strong>{showValues ? formatCurrency(subscriberMonthlyAccumulated) : '••••••'}</strong>
                  {' '}• Pago: <strong>{showValues ? formatCurrency(subscriberMonthlyPaid) : '••••••'}</strong>
                  {' '}• Pendente: <strong>{showValues ? formatCurrency(subscriberMonthlyPending) : '••••••'}</strong>
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Atendimentos: <strong>{subscriberAttendanceCount}</strong>
                  {' '}• Assinantes atendidos: <strong>{subscriberClientsCount}</strong>
                  {subscriberSalesCount > 0 ? <> • Vendas (bonus): <strong>{subscriberSalesCount}</strong></> : null}
                </p>
              </div>
            )}
          </div>

          {/* Histórico financeiro do colaborador (igual ao financeiro) */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold text-blue-800">Histórico de pagamentos do mês</h3>
              <button
                onClick={() => setShowPaymentHistory((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-white/80 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-white"
              >
                {showPaymentHistory ? 'Ocultar histórico' : 'Mostrar histórico'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-600">Total pago</p>
                <p className="text-xl font-bold text-green-700">
                  {showValues ? formatCurrency(totalPaid) : '••••••'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-600">Pendente para receber</p>
                <p className="text-xl font-bold text-blue-800">
                  {showValues ? formatCurrency(pendingToReceive) : '••••••'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-600">Status</p>
                <p className={`text-xl font-bold ${pendingToReceive > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {pendingToReceive > 0 ? 'Pendente' : 'Em dia'}
                </p>
              </div>
            </div>

            <div className="text-xs text-blue-800 mb-3">
              {paymentCount} pagamento(s) no mês
              {lastPaymentDate ? ` • Último pagamento: ${formatDateTime(lastPaymentDate)}` : ''}
              {totalWithdrawn > 0 ? ` • Retirado: ${showValues ? formatCurrency(totalWithdrawn) : '••••••'}` : ''}
            </div>

            {showPaymentHistory && (
              <div className="bg-white rounded-lg border border-blue-100 p-3 max-h-56 overflow-y-auto space-y-2">
                {isLoadingPayments ? (
                  <p className="text-sm text-gray-500">Carregando histórico...</p>
                ) : paymentHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum pagamento registrado neste mês.</p>
                ) : (
                  paymentHistory.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-2 p-2 rounded border border-gray-100 bg-gray-50">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {showValues
                            ? formatCurrency(Math.abs(row.amount))
                            : '••••••'}
                        </p>
                        <p className="text-xs text-gray-500">{formatDateTime(row.payment_date)}</p>
                      </div>
                      <span className={`text-xs font-semibold ${row.amount >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {row.amount >= 0 ? 'Pago' : 'Retirado'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Explicação dos valores */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">💡 Sobre os Valores</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {!hideGrossInFinancial && <li>• <strong>Valor Bruto:</strong> Total sem descontos</li>}
              <li>• <strong>Valor Líquido:</strong> Após descontar taxas e percentual do estabelecimento</li>
              {professional.percentage !== undefined && (
                <li>• <strong>Percentual:</strong> {professional.percentage}% do valor bruto vai para o profissional</li>
              )}
              {hasSubscriberFinancial && (
                <li>• <strong>Assinaturas:</strong> o pendente de assinaturas do mês já está somado no valor mensal</li>
              )}
              <li className="pt-2 text-yellow-700">⚠️ <strong>Importante:</strong> Valores pendentes não são contabilizados</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t">
          <button
            onClick={onClose}
            className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

