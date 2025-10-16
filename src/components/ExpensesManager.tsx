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
  const [newExpense, setNewExpense] = useState({ name: '', amount: '', professional: '', professional_id: '', expense_date: '' });
  const { toast } = useToast();

  // Carregar despesas
  const loadExpenses = useCallback(async () => {
    if (!establishmentId || establishmentId.trim() === '') {
      console.log('⚠️ establishmentId não disponível ainda:', establishmentId);
      setIsLoading(false);
      return;
    }

    console.log('🔄 Carregando despesas para:', establishmentId, selectedMonth);
    try {
      setIsLoading(true);
      const startDate = startOfMonth(selectedMonth);
      const endDate = endOfMonth(selectedMonth);

      console.log('📅 Período:', startDate.toISOString(), 'até', endDate.toISOString());

      // Filtrar despesas por mês usando created_at (data de criação)
      const { data, error } = await supabase
        .from('establishment_expenses')
        .select('*')
        .eq('establishment_id', establishmentId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar despesas:', error);
        if (error.message.includes('relation "establishment_expenses" does not exist')) {
          console.log('📋 Tabela establishment_expenses não existe. Criando...');
          toast('Tabela de despesas não existe. Execute a migração primeiro.', 'error');
        } else {
          toast('Erro ao carregar despesas', 'error');
        }
        return;
      }

      console.log('✅ Despesas carregadas:', data?.length || 0);
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

    const amount = parseFloat(newExpense.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast('Valor inválido', 'error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('establishment_expenses')
        .insert({
          establishment_id: establishmentId,
          name: newExpense.name.trim(),
          amount: amount,
          professional: newExpense.professional.trim() || null,
          professional_id: newExpense.professional_id || null
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao adicionar despesa:', error);
        toast('Erro ao adicionar despesa', 'error');
        return;
      }

      setExpenses(prev => [data, ...prev]);
      setNewExpense({ name: '', amount: '', professional: '', expense_date: '' });
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

    const amount = parseFloat(newExpense.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast('Valor inválido', 'error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('establishment_expenses')
        .update({
          name: newExpense.name.trim(),
          amount: amount,
          professional: newExpense.professional.trim() || null,
          professional_id: newExpense.professional_id || null
        })
        .eq('id', editingExpense.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao editar despesa:', error);
        toast('Erro ao editar despesa', 'error');
        return;
      }

      setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? data : exp));
      setEditingExpense(null);
      setNewExpense({ name: '', amount: '', professional: '', expense_date: '' });
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
      expense_date: expense.expense_date || ''
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
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
          <Receipt className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Despesas</h1>
            <p className="text-sm text-gray-500">
              {expenses.length > 0
                ? `${expenses.length} despesa${expenses.length > 1 ? 's' : ''} em ${format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}`
                : `Nenhuma despesa em ${format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}`
              }
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar Despesa
        </button>
      </div>

      {/* Texto Explicativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-lg">ℹ️</span>
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">Aqui, qualquer profissional pode registrar despesas — por exemplo:</p>
            <ul className="space-y-1 mb-3">
              <li>💰 "Peguei R$50"</li>
              <li>🔧 "Quebrou algo, tirei X do caixa"</li>
              <li>💵 "Recebi um adiantamento de tanto"</li>
              <li>Entre outros.</li>
            </ul>
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3">
              <p className="font-medium text-yellow-800">⚠️ Lembre-se: toda retirada deve ser feita com autorização do seu superior.</p>
            </div>
            <p className="mt-3 text-blue-700">
              Todas as alterações realizadas aqui ficam registradas com histórico no financeiro, garantindo transparência e controle.
            </p>
            <div className="mt-3 bg-green-100 border border-green-300 rounded-lg p-3">
              <p className="font-medium text-green-800">📅 Importante:</p>
              <p className="text-sm text-green-700 mt-1">
                Cada mês possui suas próprias despesas. Ao trocar de mês, você verá apenas as despesas daquele período específico.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seletor de Mês */}
      <div className="flex items-center justify-between mb-6 bg-gray-50 rounded-lg p-4">
        <button
          onClick={handlePreviousMonth}
          className="p-4 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300 bg-white shadow-sm"
        >
          <ChevronLeft className="h-6 w-6 text-gray-700" />
        </button>
        <span className="text-xl font-bold text-gray-900 px-6">
          {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-4 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300 bg-white shadow-sm"
        >
          <ChevronRight className="h-6 w-6 text-gray-700" />
        </button>
      </div>

      {/* Resumo */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900">Total de Despesas</h2>
        </div>
        <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
        <p className="text-sm text-gray-500 mt-1">
          {expenses.length} {expenses.length === 1 ? 'despesa registrada' : 'despesas registradas'}
        </p>
      </div>

      {/* Lista de despesas */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Despesas</h2>

          {expenses.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma despesa em {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <p className="text-gray-500 mb-4">
                Este mês ainda não possui despesas registradas.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-blue-800">
                  💡 <strong>Dica:</strong> Cada mês tem suas próprias despesas.
                  Para registrar despesas neste mês, clique em "Adicionar Despesa".
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{expense.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{formatDate(expense.created_at)}</span>
                      {expense.professional && (
                        <span className="text-blue-600 font-medium">
                          👤 {expense.professional}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-red-600">
                      {formatCurrency(expense.amount)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar despesa"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Adicionar Despesa</h2>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Despesa
                </label>
                <input
                  type="text"
                  value={newExpense.name}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Água, Luz, Manutenção..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="">Selecione um profissional</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione o profissional que registrou a despesa (será descontado do salário dele)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewExpense({ name: '', amount: '', professional: '', professional_id: '', expense_date: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Editar Despesa</h2>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Despesa
                </label>
                <input
                  type="text"
                  value={newExpense.name}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Água, Luz, Manutenção..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="">Selecione um profissional</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione o profissional que registrou a despesa (será descontado do salário dele)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingExpense(null);
                  setNewExpense({ name: '', amount: '', professional: '', professional_id: '', expense_date: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditExpense}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
