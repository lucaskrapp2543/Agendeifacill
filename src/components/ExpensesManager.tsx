import { endOfMonth, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, DollarSign, Edit, Plus, Receipt, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Toaster';

interface Expense {
  id: string;
  establishment_id: string;
  name: string;
  amount: number;
  professional?: string;
  professional_id?: string;
  observation?: string | null;
  expense_context?: 'financial' | 'sidebar' | null;
  expense_date: string;
  created_at: string;
  updated_at: string;
}

interface Professional {
  id: string;
  name: string;
  specialties: string[];
  percentage?: number;
}

interface ExpensesManagerProps {
  establishmentId: string;
  selectedMonth?: Date;
  onMonthChange?: (newMonth: Date) => void;
  professionals?: Professional[];
}

export const ExpensesManager: React.FC<ExpensesManagerProps> = ({
  establishmentId,
  selectedMonth = new Date(),
  onMonthChange,
  professionals = []
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [newExpense, setNewExpense] = useState({
    name: '',
    amount: '',
    professional: '',
    professional_id: '',
    expense_date: format(selectedMonth, 'yyyy-MM-dd'),
    observation: ''
  });
  const { toast } = useToast();

  const getExpenseDateKey = (value?: string | null) => {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match?.[1]) return match[1];
    return raw;
  };

  // Carregar despesas
  const loadExpenses = useCallback(async () => {
    if (!establishmentId || establishmentId.trim() === '') {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const startDate = startOfMonth(selectedMonth);
      const endDate = endOfMonth(selectedMonth);

      const startDay = format(startDate, 'yyyy-MM-dd');
      const endDay = format(endDate, 'yyyy-MM-dd');

      // Filtrar despesas por mês usando expense_date (data real da despesa)
      let { data, error } = await supabase
        .from('establishment_expenses')
        .select('*')
        .eq('establishment_id', establishmentId)
        .gte('expense_date', startDay)
        .lte('expense_date', endDay)
        .or('expense_context.is.null,expense_context.eq.sidebar')
        .order('expense_date', { ascending: false });

      // Compatibilidade com bancos antigos sem colunas novas
      if (error && (String(error.message || '').toLowerCase().includes('expense_context') || String(error.message || '').toLowerCase().includes('expense_date'))) {
        const legacyResult = await supabase
          .from('establishment_expenses')
          .select('*')
          .eq('establishment_id', establishmentId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });

        data = (legacyResult.data || []).filter((expense: any) => {
          const professionalName = String(expense?.professional || '').trim();
          return Boolean(expense?.professional_id) || professionalName.length > 0;
        });
        error = legacyResult.error as any;
      }

      if (error) {
        console.error('❌ Erro ao carregar despesas:', error);
        if (error.message.includes('relation "establishment_expenses" does not exist')) {
          toast('Tabela de despesas não existe. Execute a migração primeiro.', 'error');
        } else {
          toast('Erro ao carregar despesas', 'error');
        }
        return;
      }

      setExpenses(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar despesas:', error);
      toast('Erro ao carregar despesas', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId, selectedMonth]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);


  // Funções para navegar entre os meses
  const handlePreviousMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    onMonthChange?.(newMonth);
  };

  // Adicionar nova despesa
  const handleAddExpense = async () => {
    if (!newExpense.name.trim() || !newExpense.amount.trim()) {
      toast('Preencha todos os campos', 'error');
      return;
    }
    if (!String(newExpense.expense_date || '').trim()) {
      toast('Informe a data da despesa', 'error');
      return;
    }

    const amount = parseFloat(newExpense.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast('Valor inválido', 'error');
      return;
    }

    try {
      const normalizedObservation = newExpense.observation.trim().slice(0, 150);
      const payload: any = {
        establishment_id: establishmentId,
        name: newExpense.name.trim(),
        amount: amount,
        expense_date: getExpenseDateKey(newExpense.expense_date),
        professional: newExpense.professional.trim() || null,
        professional_id: newExpense.professional_id || null,
        observation: normalizedObservation.length > 0 ? normalizedObservation : null,
        expense_context: 'sidebar',
      };

      let { data, error } = await supabase
        .from('establishment_expenses')
        .insert(payload)
        .select()
        .single();

      const addErrMsg = String(error?.message || '').toLowerCase();
      if (error && (addErrMsg.includes('observation') || addErrMsg.includes('expense_context') || addErrMsg.includes('expense_date'))) {
        const fallbackPayload: any = { ...payload };
        delete fallbackPayload.observation;
        delete fallbackPayload.expense_context;
        if (addErrMsg.includes('expense_date')) delete fallbackPayload.expense_date;
        ({ data, error } = await supabase
          .from('establishment_expenses')
          .insert(fallbackPayload)
          .select()
          .single());
      }

      if (error) {
        console.error('Erro ao adicionar despesa:', error);
        toast('Erro ao adicionar despesa', 'error');
        return;
      }

      setExpenses(prev => [data, ...prev]);
      setNewExpense({
        name: '',
        amount: '',
        professional: '',
        professional_id: '',
        expense_date: format(selectedMonth, 'yyyy-MM-dd'),
        observation: ''
      });
      setShowAddModal(false);
      toast('Despesa adicionada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao adicionar despesa:', error);
      toast('Erro ao adicionar despesa', 'error');
    }
  };

  // Editar despesa
  const handleEditExpense = async () => {
    if (!editingExpense || !newExpense.name.trim() || !newExpense.amount.trim()) {
      toast('Preencha todos os campos', 'error');
      return;
    }
    if (!String(newExpense.expense_date || '').trim()) {
      toast('Informe a data da despesa', 'error');
      return;
    }

    const amount = parseFloat(newExpense.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast('Valor inválido', 'error');
      return;
    }

    try {
      const normalizedObservation = newExpense.observation.trim().slice(0, 150);
      const payload: any = {
        name: newExpense.name.trim(),
        amount: amount,
        expense_date: getExpenseDateKey(newExpense.expense_date),
        professional: newExpense.professional.trim() || null,
        professional_id: newExpense.professional_id || null,
        observation: normalizedObservation.length > 0 ? normalizedObservation : null,
        expense_context: 'sidebar',
      };

      let { data, error } = await supabase
        .from('establishment_expenses')
        .update(payload)
        .eq('id', editingExpense.id)
        .select()
        .single();

      const editErrMsg = String(error?.message || '').toLowerCase();
      if (error && (editErrMsg.includes('observation') || editErrMsg.includes('expense_context') || editErrMsg.includes('expense_date'))) {
        const fallbackPayload: any = { ...payload };
        delete fallbackPayload.observation;
        delete fallbackPayload.expense_context;
        if (editErrMsg.includes('expense_date')) delete fallbackPayload.expense_date;
        ({ data, error } = await supabase
          .from('establishment_expenses')
          .update(fallbackPayload)
          .eq('id', editingExpense.id)
          .select()
          .single());
      }

      if (error) {
        console.error('Erro ao editar despesa:', error);
        toast('Erro ao editar despesa', 'error');
        return;
      }

      setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? data : exp));
      setEditingExpense(null);
      setNewExpense({
        name: '',
        amount: '',
        professional: '',
        professional_id: '',
        expense_date: format(selectedMonth, 'yyyy-MM-dd'),
        observation: ''
      });
      setShowEditModal(false);
      toast('Despesa editada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao editar despesa:', error);
      toast('Erro ao editar despesa', 'error');
    }
  };

  // Deletar despesa
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('establishment_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) {
        console.error('Erro ao deletar despesa:', error);
        toast('Erro ao deletar despesa', 'error');
        return;
      }

      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
      toast('Despesa excluída com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao deletar despesa:', error);
      toast('Erro ao deletar despesa', 'error');
    }
  };

  // Abrir modal de edição
  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setNewExpense({
      name: expense.name,
      amount: expense.amount.toString(),
      professional: expense.professional || '',
      professional_id: expense.professional_id || '',
      expense_date: getExpenseDateKey(expense.expense_date || ''),
      observation: expense.observation || ''
    });
    setShowEditModal(true);
  };

  // Calcular total de despesas
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Formatar valor para exibição
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    const raw = getExpenseDateKey(dateString);
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-').map((part) => Number(part));
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando despesas...</div>
      </div>
    );
  }

  if (!establishmentId || establishmentId.trim() === '') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-500 mb-2">Estabelecimento não carregado</div>
          <div className="text-sm text-gray-400">Aguarde o carregamento do estabelecimento...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-white">Despesas</h1>
            <p className="text-sm text-gray-400">
              {expenses.length > 0
                ? `${expenses.length} despesa${expenses.length > 1 ? 's' : ''} em ${format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}`
                : `Nenhuma despesa em ${format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}`
              }
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setNewExpense(prev => ({ ...prev, expense_date: format(selectedMonth, 'yyyy-MM-dd') }));
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar Despesa
        </button>
      </div>

      {/* Texto Explicativo */}
      <div className="bg-[#1a1b1c] border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-gray-300 text-lg">ℹ️</span>
          </div>
          <div className="text-sm text-gray-300">
            <p className="font-medium mb-2 text-white">Aqui, qualquer profissional pode registrar despesas — por exemplo:</p>
            <ul className="space-y-1 mb-3 text-gray-400">
              <li>💰 "Peguei R$50"</li>
              <li>🔧 "Quebrou algo, tirei X do caixa"</li>
              <li>💵 "Recebi um adiantamento de tanto"</li>
              <li>Entre outros.</li>
            </ul>
            <div className="bg-black border border-gray-700 rounded-lg p-3">
              <p className="font-medium text-gray-300">⚠️ Lembre-se: toda retirada deve ser feita com autorização do seu superior.</p>
            </div>
            <p className="mt-3 text-gray-400">
              Todas as alterações realizadas aqui ficam registradas com histórico no financeiro, garantindo transparência e controle.
            </p>
            <div className="mt-3 bg-black border border-gray-700 rounded-lg p-3">
              <p className="font-medium text-gray-300">📅 Importante:</p>
              <p className="text-sm text-gray-400 mt-1">
                Cada mês possui suas próprias despesas. Ao trocar de mês, você verá apenas as despesas daquele período específico.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seletor de Mês */}
      <div className="flex items-center justify-between mb-6 bg-[#1a1b1c] border border-gray-700 rounded-lg p-4">
        <button
          onClick={handlePreviousMonth}
          className="p-4 hover:bg-black rounded-lg transition-colors border border-gray-700 bg-black shadow-sm"
        >
          <ChevronLeft className="h-6 w-6 text-gray-300" />
        </button>
        <span className="text-xl font-bold text-white px-6">
          {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-4 hover:bg-black rounded-lg transition-colors border border-gray-700 bg-black shadow-sm"
        >
          <ChevronRight className="h-6 w-6 text-gray-300" />
        </button>
      </div>

      {/* Resumo */}
      <div className="bg-black border border-gray-700 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-white">Total de Despesas</h2>
        </div>
        <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
        <p className="text-sm text-gray-400 mt-1">
          {expenses.length} {expenses.length === 1 ? 'despesa registrada' : 'despesas registradas'}
        </p>
      </div>

      {/* Lista de despesas */}
      <div className="bg-black border border-gray-700 rounded-lg shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Histórico de Despesas</h2>

          {expenses.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Nenhuma despesa em {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <p className="text-gray-400 mb-4">
                Este mês ainda não possui despesas registradas.
              </p>
              <div className="bg-[#1a1b1c] border border-gray-700 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-gray-300">
                  💡 <strong>Dica:</strong> Cada mês tem suas próprias despesas.
                  Para registrar despesas neste mês, clique em "Adicionar Despesa".
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg hover:bg-[#1a1b1c] bg-[#1a1b1c]">
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{expense.name}</h3>
                    {expense.observation && (
                      <p className="text-sm text-gray-400 mt-1 break-words">
                        📝 {expense.observation}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{formatDate(String(expense.expense_date || expense.created_at || ''))}</span>
                      {expense.professional && (
                        <span className="text-gray-300 font-medium">
                          👤 {expense.professional}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-red-500">
                      {formatCurrency(expense.amount)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(expense)}
                        className="p-2 text-gray-400 hover:bg-black hover:text-gray-300 rounded-lg transition-colors"
                        title="Editar despesa"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 text-gray-400 hover:bg-black hover:text-red-500 rounded-lg transition-colors"
                        title="Excluir despesa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Adicionar Despesa */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-700 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-white mb-4">Adicionar Despesa</h2>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome da Despesa
                </label>
                <input
                  type="text"
                  value={newExpense.name}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Água, Luz, Manutenção..."
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c] placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profissional
                </label>
                <select
                  value={newExpense.professional_id}
                  onChange={(e) => {
                    const selectedProfessional = professionals.find(p => p.id === e.target.value);
                    setNewExpense(prev => ({
                      ...prev,
                      professional_id: e.target.value,
                      professional: selectedProfessional?.name || ''
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c]"
                >
                  <option value="">Selecione um profissional</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id} className="bg-[#1a1b1c]">
                      {professional.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Selecione o profissional que registrou a despesa (será descontado do salário dele)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c] placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data da Despesa
                </label>
                <input
                  type="date"
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, expense_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Observação (opcional)
                </label>
                <textarea
                  value={newExpense.observation}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, observation: e.target.value.slice(0, 150) }))}
                  placeholder="Escreva uma observação (até 150 caracteres)"
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c] placeholder-gray-500 resize-none"
                  rows={3}
                  maxLength={150}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {newExpense.observation.length}/150
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewExpense({
                    name: '',
                    amount: '',
                    professional: '',
                    professional_id: '',
                    expense_date: format(selectedMonth, 'yyyy-MM-dd'),
                    observation: ''
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-[#1a1b1c] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Despesa */}
      {showEditModal && editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-700 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-white mb-4">Editar Despesa</h2>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome da Despesa
                </label>
                <input
                  type="text"
                  value={newExpense.name}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Água, Luz, Manutenção..."
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c] placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profissional
                </label>
                <select
                  value={newExpense.professional_id}
                  onChange={(e) => {
                    const selectedProfessional = professionals.find(p => p.id === e.target.value);
                    setNewExpense(prev => ({
                      ...prev,
                      professional_id: e.target.value,
                      professional: selectedProfessional?.name || ''
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c]"
                >
                  <option value="">Selecione um profissional</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id} className="bg-[#1a1b1c]">
                      {professional.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Selecione o profissional que registrou a despesa (será descontado do salário dele)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c] placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data da Despesa
                </label>
                <input
                  type="date"
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, expense_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Observação (opcional)
                </label>
                <textarea
                  value={newExpense.observation}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, observation: e.target.value.slice(0, 150) }))}
                  placeholder="Escreva uma observação (até 150 caracteres)"
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-white bg-[#1a1b1c] placeholder-gray-500 resize-none"
                  rows={3}
                  maxLength={150}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {newExpense.observation.length}/150
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingExpense(null);
                  setNewExpense({
                    name: '',
                    amount: '',
                    professional: '',
                    professional_id: '',
                    expense_date: format(selectedMonth, 'yyyy-MM-dd'),
                    observation: ''
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-[#1a1b1c] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditExpense}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
