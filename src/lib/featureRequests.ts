import { supabase } from './supabase';

/**
 * "Fazer pedidos": o estabelecimento pede melhorias/novidades e o suporte responde
 * no Menu Admin. Tudo passa pelas funções do banco (dono / admin conferidos lá).
 * Migration: supabase/migrations/20261012_pedidos_estabelecimentos.sql
 */
export type FeatureRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FeatureRequest {
  id: string;
  establishment_id: string;
  message: string;
  status: FeatureRequestStatus;
  admin_reply: string | null;
  created_at: string;
  answered_at: string | null;
  establishment_name?: string | null;
  establishment_code?: string | null;
}

export const FEATURE_REQUEST_STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  pending: 'Aguardando resposta',
  accepted: 'Pedido aceito',
  rejected: 'Pedido negado',
};

type RpcResult = { ok: boolean; error?: string; message?: string; items?: unknown; item?: unknown };

/** Banco sem a migration ainda (função não existe). */
const isMissingFunction = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST202' || msg.includes('could not find the function') || msg.includes('schema cache');
};

const readItems = (data: unknown): FeatureRequest[] => {
  const items = (data as RpcResult | null)?.items;
  return Array.isArray(items) ? (items as FeatureRequest[]) : [];
};

export async function listMyFeatureRequests(
  establishmentId: string
): Promise<{ ok: boolean; items: FeatureRequest[]; notReady?: boolean }> {
  const { data, error } = await supabase.rpc('list_my_feature_requests', { p_establishment_id: establishmentId });
  if (error) return { ok: false, items: [], notReady: isMissingFunction(error) };
  return { ok: (data as RpcResult)?.ok === true, items: readItems(data) };
}

export async function createFeatureRequest(
  establishmentId: string,
  message: string
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('create_feature_request', {
    p_establishment_id: establishmentId,
    p_message: message,
  });
  if (error) {
    return {
      ok: false,
      message: isMissingFunction(error)
        ? 'Ainda não disponível: falta liberar no sistema (rodar a atualização do banco).'
        : 'Não foi possível enviar agora. Tente novamente.',
    };
  }
  const result = data as RpcResult;
  if (result?.ok) return { ok: true };
  if (result?.error === 'forbidden') return { ok: false, message: 'Só o dono da conta pode enviar pedidos.' };
  return { ok: false, message: result?.message || 'Não foi possível enviar agora. Tente novamente.' };
}

export async function adminListFeatureRequests(): Promise<{ ok: boolean; items: FeatureRequest[]; notReady?: boolean }> {
  const { data, error } = await supabase.rpc('admin_list_feature_requests');
  if (error) return { ok: false, items: [], notReady: isMissingFunction(error) };
  return { ok: (data as RpcResult)?.ok === true, items: readItems(data) };
}

export async function adminAnswerFeatureRequest(
  requestId: string,
  status: FeatureRequestStatus,
  reply: string
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('admin_answer_feature_request', {
    p_request_id: requestId,
    p_status: status,
    p_reply: reply,
  });
  if (error) {
    return {
      ok: false,
      message: isMissingFunction(error)
        ? 'Falta rodar a atualização do banco (pedidos).'
        : 'Não foi possível salvar a resposta.',
    };
  }
  const result = data as RpcResult;
  if (result?.ok) return { ok: true };
  return { ok: false, message: result?.error === 'forbidden' ? 'Sem permissão de admin.' : 'Não foi possível salvar a resposta.' };
}
