import { supabase } from './supabase';

export type ReviewQuestionAnswerType = 'yes_no' | 'rating_1_5' | 'short_text';

export type EstablishmentReviewQuestion = {
  id: string;
  establishment_id: string;
  question_text: string;
  answer_type: ReviewQuestionAnswerType;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

export type ReviewCustomAnswer = {
  question_id: string;
  question_text: string;
  answer_type: ReviewQuestionAnswerType;
  value: string;
};

export const MAX_REVIEW_QUESTIONS_PER_ESTABLISHMENT = 5;

export const REVIEW_QUESTION_TYPE_LABELS: Record<ReviewQuestionAnswerType, string> = {
  yes_no: 'Sim / Não',
  rating_1_5: 'Nota de 1 a 5',
  short_text: 'Texto curto',
};

const isMissingReviewQuestionsTableError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    String((error as any)?.code || '') === '42P01' ||
    (msg.includes('establishment_review_questions') &&
      (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')))
  );
};

export const isMissingReviewCustomAnswersColumnError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('custom_answers') &&
    (msg.includes('could not find') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      String((error as any)?.code || '') === '42703' ||
      String((error as any)?.code || '') === 'PGRST204')
  );
};

const REVIEW_PROFESSIONAL_COLUMN_NAMES = ['professional_id', 'professional_name', 'professional_photo_url'];

export const isMissingReviewProfessionalColumnsError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || '').toLowerCase();
  return REVIEW_PROFESSIONAL_COLUMN_NAMES.some(
    (col) =>
      msg.includes(col) &&
      (msg.includes('could not find') ||
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        String((error as any)?.code || '') === '42703' ||
        String((error as any)?.code || '') === 'PGRST204')
  );
};

export type ReviewBookingProfessional = {
  id: string;
  name: string;
  photo_url?: string | null;
  hidden_from_booking?: boolean;
};

export const getReviewSelectableProfessionals = (professionals: unknown): ReviewBookingProfessional[] => {
  if (!Array.isArray(professionals)) return [];
  return professionals
    .map((raw) => {
      const p = raw as Partial<ReviewBookingProfessional>;
      const id = String(p?.id || '').trim();
      const name = String(p?.name || '').trim();
      if (!id || !name) return null;
      if (p.hidden_from_booking) return null;
      return {
        id,
        name,
        photo_url: p.photo_url ?? null,
        hidden_from_booking: false,
      };
    })
    .filter(Boolean) as ReviewBookingProfessional[];
};

export const formatReviewCustomAnswerDisplay = (answer: ReviewCustomAnswer): string => {
  const value = String(answer?.value || '').trim();
  if (!value) return '—';
  if (answer.answer_type === 'yes_no') {
    if (value === 'sim') return 'Sim';
    if (value === 'nao') return 'Não';
    return value;
  }
  if (answer.answer_type === 'rating_1_5') {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 1 && n <= 5) return `Nota ${n}/5`;
    return value;
  }
  return value;
};

export const parseReviewCustomAnswers = (raw: unknown): ReviewCustomAnswer[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Partial<ReviewCustomAnswer>;
      const question_id = String(row?.question_id || '').trim();
      const question_text = String(row?.question_text || '').trim();
      const answer_type = String(row?.answer_type || '').trim() as ReviewQuestionAnswerType;
      const value = String(row?.value || '').trim();
      if (!question_id || !question_text || !value) return null;
      if (!['yes_no', 'rating_1_5', 'short_text'].includes(answer_type)) return null;
      return { question_id, question_text, answer_type, value };
    })
    .filter(Boolean) as ReviewCustomAnswer[];
};

export async function fetchEstablishmentReviewQuestions(
  establishmentId: string,
  options?: { activeOnly?: boolean }
): Promise<{ data: EstablishmentReviewQuestion[]; error: any }> {
  const estId = String(establishmentId || '').trim();
  if (!estId) return { data: [], error: null };

  let query = supabase
    .from('establishment_review_questions')
    .select('id, establishment_id, question_text, answer_type, is_active, display_order, created_at, updated_at')
    .eq('establishment_id', estId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error && isMissingReviewQuestionsTableError(error)) {
    return { data: [], error: null };
  }
  return { data: (data as EstablishmentReviewQuestion[]) || [], error };
}

export function validateReviewCustomAnswers(
  questions: EstablishmentReviewQuestion[],
  answersByQuestionId: Record<string, string>
): { ok: true; payload: ReviewCustomAnswer[] } | { ok: false; message: string } {
  const payload: ReviewCustomAnswer[] = [];

  for (const question of questions) {
    if (!question.is_active) continue;
    const raw = String(answersByQuestionId[question.id] || '').trim();

    if (question.answer_type === 'yes_no') {
      if (raw !== 'sim' && raw !== 'nao') {
        return { ok: false, message: `Responda "${question.question_text}" com Sim ou Não.` };
      }
      payload.push({
        question_id: question.id,
        question_text: question.question_text,
        answer_type: question.answer_type,
        value: raw,
      });
      continue;
    }

    if (question.answer_type === 'rating_1_5') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return { ok: false, message: `Escolha uma nota de 1 a 5 em "${question.question_text}".` };
      }
      payload.push({
        question_id: question.id,
        question_text: question.question_text,
        answer_type: question.answer_type,
        value: String(n),
      });
      continue;
    }

    if (!raw) {
      return { ok: false, message: `Preencha "${question.question_text}".` };
    }
    if (raw.length > 200) {
      return { ok: false, message: `"${question.question_text}" deve ter no máximo 200 caracteres.` };
    }
    payload.push({
      question_id: question.id,
      question_text: question.question_text,
      answer_type: question.answer_type,
      value: raw,
    });
  }

  return { ok: true, payload };
}
