import {
  EstablishmentReviewQuestion,
  REVIEW_QUESTION_TYPE_LABELS,
} from '../lib/reviewQuestions';

type ReviewCustomQuestionFieldsProps = {
  questions: EstablishmentReviewQuestion[];
  answers: Record<string, string>;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
};

export function ReviewCustomQuestionFields({
  questions,
  answers,
  onChange,
  disabled = false,
}: ReviewCustomQuestionFieldsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="pt-2 border-t border-white/10 space-y-4">
      <p className="text-sm text-[#E6C78B] font-semibold leading-snug">
        Responda rapidinho para ajudar a barbearia a melhorar 💈
      </p>

      {questions.map((question) => (
        <div key={question.id} className="space-y-2">
          <label className="block text-sm text-white/90 font-medium leading-snug">
            {question.question_text}
          </label>

          {question.answer_type === 'yes_no' && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'sim', label: 'Sim' },
                { value: 'nao', label: 'Não' },
              ].map((opt) => {
                const selected = answers[question.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(question.id, opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                      selected
                        ? 'bg-[#E6C78B] text-black'
                        : 'bg-black/40 border border-white/15 text-white hover:border-white/30'
                    } disabled:opacity-60`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {question.answer_type === 'rating_1_5' && (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((score) => {
                const selected = answers[question.id] === String(score);
                return (
                  <button
                    key={score}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(question.id, String(score))}
                    className={`min-w-[2.75rem] px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                      selected
                        ? 'bg-[#E6C78B] text-black'
                        : 'bg-black/40 border border-white/15 text-white hover:border-white/30'
                    } disabled:opacity-60`}
                    aria-label={`Nota ${score}`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          )}

          {question.answer_type === 'short_text' && (
            <>
              <input
                type="text"
                value={answers[question.id] || ''}
                onChange={(e) => onChange(question.id, e.target.value.slice(0, 200))}
                disabled={disabled}
                placeholder="Sua resposta"
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25 disabled:opacity-60"
                maxLength={200}
              />
              <div className="text-right text-xs text-white/50">
                {(answers[question.id] || '').length}/200
              </div>
            </>
          )}

          <p className="text-[11px] text-white/40">{REVIEW_QUESTION_TYPE_LABELS[question.answer_type]}</p>
        </div>
      ))}
    </div>
  );
}
