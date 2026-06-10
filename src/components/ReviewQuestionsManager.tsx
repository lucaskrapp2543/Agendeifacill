import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  EstablishmentReviewQuestion,
  MAX_REVIEW_QUESTIONS_PER_ESTABLISHMENT,
  REVIEW_QUESTION_TYPE_LABELS,
  ReviewQuestionAnswerType,
  fetchEstablishmentReviewQuestions,
} from '../lib/reviewQuestions';

type ReviewQuestionsManagerProps = {
  establishmentId: string;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const EMPTY_FORM = {
  question_text: '',
  answer_type: 'yes_no' as ReviewQuestionAnswerType,
};

export function ReviewQuestionsManager({ establishmentId, toast }: ReviewQuestionsManagerProps) {
  const [questions, setQuestions] = useState<EstablishmentReviewQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    if (!establishmentId) return;
    setIsLoading(true);
    try {
      const { data, error } = await fetchEstablishmentReviewQuestions(establishmentId);
      if (error) throw error;
      setQuestions(data);
    } catch (error: any) {
      console.error('Erro ao carregar perguntas da avaliação:', error);
      toast(
        [error?.message || 'Erro ao carregar perguntas', error?.code ? `(código: ${error.code})` : null]
          .filter(Boolean)
          .join(' '),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId, toast]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSaveQuestion = async () => {
    const text = String(form.question_text || '').trim();
    if (!text) {
      toast('Digite o texto da pergunta.', 'error');
      return;
    }
    if (text.length > 200) {
      toast('A pergunta deve ter no máximo 200 caracteres.', 'error');
      return;
    }

    if (!editingId && questions.length >= MAX_REVIEW_QUESTIONS_PER_ESTABLISHMENT) {
      toast(`Máximo de ${MAX_REVIEW_QUESTIONS_PER_ESTABLISHMENT} perguntas por estabelecimento.`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();

      if (editingId) {
        const { error } = await supabase
          .from('establishment_review_questions')
          .update({
            question_text: text,
            answer_type: form.answer_type,
            updated_at: nowIso,
          })
          .eq('id', editingId)
          .eq('establishment_id', establishmentId);

        if (error) throw error;
        toast('Pergunta atualizada.', 'success');
      } else {
        const maxOrder = questions.reduce((max, q) => Math.max(max, q.display_order || 0), -1);
        const { error } = await supabase.from('establishment_review_questions').insert({
          establishment_id: establishmentId,
          question_text: text,
          answer_type: form.answer_type,
          is_active: true,
          display_order: maxOrder + 1,
          updated_at: nowIso,
        });

        if (error) throw error;
        toast('Pergunta adicionada.', 'success');
      }

      resetForm();
      await loadQuestions();
    } catch (error: any) {
      console.error('Erro ao salvar pergunta:', error);
      toast(
        [error?.message || 'Erro ao salvar pergunta', error?.code ? `(código: ${error.code})` : null]
          .filter(Boolean)
          .join(' '),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (question: EstablishmentReviewQuestion) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('establishment_review_questions')
        .update({
          is_active: !question.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', question.id)
        .eq('establishment_id', establishmentId);

      if (error) throw error;
      await loadQuestions();
    } catch (error: any) {
      console.error('Erro ao alterar status da pergunta:', error);
      toast(
        [error?.message || 'Erro ao alterar status', error?.code ? `(código: ${error.code})` : null]
          .filter(Boolean)
          .join(' '),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm('Excluir esta pergunta? Avaliações antigas mantêm as respostas já enviadas.')) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('establishment_review_questions')
        .delete()
        .eq('id', questionId)
        .eq('establishment_id', establishmentId);

      if (error) throw error;
      toast('Pergunta excluída.', 'success');
      if (editingId === questionId) resetForm();
      await loadQuestions();
    } catch (error: any) {
      console.error('Erro ao excluir pergunta:', error);
      toast(
        [error?.message || 'Erro ao excluir pergunta', error?.code ? `(código: ${error.code})` : null]
          .filter(Boolean)
          .join(' '),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;

    const current = questions[index];
    const target = questions[swapIndex];
    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const { error: err1 } = await supabase
        .from('establishment_review_questions')
        .update({ display_order: target.display_order, updated_at: nowIso })
        .eq('id', current.id)
        .eq('establishment_id', establishmentId);

      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from('establishment_review_questions')
        .update({ display_order: current.display_order, updated_at: nowIso })
        .eq('id', target.id)
        .eq('establishment_id', establishmentId);

      if (err2) throw err2;
      await loadQuestions();
    } catch (error: any) {
      console.error('Erro ao reordenar perguntas:', error);
      toast(
        [error?.message || 'Erro ao reordenar', error?.code ? `(código: ${error.code})` : null]
          .filter(Boolean)
          .join(' '),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (question: EstablishmentReviewQuestion) => {
    setEditingId(question.id);
    setForm({
      question_text: question.question_text,
      answer_type: question.answer_type,
    });
    setShowAddForm(true);
  };

  const canAddMore = questions.length < MAX_REVIEW_QUESTIONS_PER_ESTABLISHMENT;

  return (
    <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full p-4 sm:p-6 border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Perguntas da Avaliação</h2>
          <p className="text-sm text-gray-600 mt-1">
            Crie até {MAX_REVIEW_QUESTIONS_PER_ESTABLISHMENT} perguntas extras para o cliente responder ao avaliar.
            Se não houver perguntas ativas, a avaliação continua igual.
          </p>
        </div>
        {canAddMore && !showAddForm && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors text-sm font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova pergunta
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-5 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
          <h3 className="font-bold text-gray-900">{editingId ? 'Editar pergunta' : 'Nova pergunta'}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pergunta</label>
            <input
              type="text"
              value={form.question_text}
              onChange={(e) => setForm((prev) => ({ ...prev, question_text: e.target.value.slice(0, 200) }))}
              placeholder="Ex.: Gostou do atendimento?"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-black focus:border-black outline-none"
              maxLength={200}
            />
            <div className="text-right text-xs text-gray-500 mt-1">{form.question_text.length}/200</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de resposta</label>
            <select
              value={form.answer_type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, answer_type: e.target.value as ReviewQuestionAnswerType }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-black focus:border-black outline-none"
            >
              {(Object.keys(REVIEW_QUESTION_TYPE_LABELS) as ReviewQuestionAnswerType[]).map((type) => (
                <option key={type} value={type} className="text-gray-900 bg-white">
                  {REVIEW_QUESTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveQuestion}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 text-sm font-semibold disabled:opacity-60"
            >
              {isSaving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm font-semibold disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-600 py-4">Carregando perguntas...</div>
      ) : questions.length === 0 ? (
        <div className="text-gray-500 py-6 text-center bg-gray-50 border border-gray-200 rounded-lg text-sm">
          Nenhuma pergunta cadastrada. O cliente verá apenas o formulário padrão de avaliação.
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className={`border rounded-xl p-4 ${question.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-80'}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-500">#{index + 1}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        question.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {question.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-medium">
                      {REVIEW_QUESTION_TYPE_LABELS[question.answer_type]}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 break-words">{question.question_text}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    title="Subir"
                    onClick={() => handleMove(index, 'up')}
                    disabled={isSaving || index === 0}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Descer"
                    onClick={() => handleMove(index, 'down')}
                    disabled={isSaving || index === questions.length - 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(question)}
                    disabled={isSaving}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(question)}
                    disabled={isSaving}
                    className={`px-3 py-2 rounded-lg text-xs font-bold ${
                      question.is_active
                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                        : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                    }`}
                  >
                    {question.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(question.id)}
                    disabled={isSaving}
                    className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        {questions.length}/{MAX_REVIEW_QUESTIONS_PER_ESTABLISHMENT} perguntas cadastradas
      </p>
    </div>
  );
}
