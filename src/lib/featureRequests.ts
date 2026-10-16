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
  /** Fotos anexadas (caminhos na pasta privada "feature-request-photos"). */
  photo_paths?: string[] | null;
  /** Quando o dono viu a resposta (null/antes de answered_at = resposta nova). */
  answer_seen_at?: string | null;
}

/** Resposta do suporte que o dono ainda não viu. */
export const isUnreadFeatureRequestAnswer = (request: FeatureRequest): boolean => {
  if (!request?.answered_at) return false;
  if (!request.answer_seen_at) return true;
  return new Date(request.answer_seen_at).getTime() < new Date(request.answered_at).getTime();
};

/** Balão do menu "Fazer pedidos": respostas ainda não vistas. Sem a função no banco: 0. */
export async function countUnreadFeatureRequestAnswers(establishmentId: string): Promise<number> {
  if (!establishmentId) return 0;
  try {
    const { data, error } = await supabase.rpc('count_unread_feature_request_answers', {
      p_establishment_id: establishmentId,
    });
    const count = Number(data);
    return error || !Number.isFinite(count) ? 0 : Math.max(0, Math.round(count));
  } catch {
    return 0;
  }
}

/** Ao abrir "Fazer pedidos": marca as respostas como vistas. */
export async function markFeatureRequestAnswersSeen(establishmentId: string): Promise<void> {
  if (!establishmentId) return;
  try {
    await supabase.rpc('mark_feature_request_answers_seen', { p_establishment_id: establishmentId });
  } catch {
    // sem a função no banco: o balão simplesmente não aparece
  }
}

/** Até 4 fotos por pedido (migration 20261016_pedidos_fotos.sql). */
export const FEATURE_REQUEST_MAX_PHOTOS = 4;
const PHOTOS_BUCKET = 'feature-request-photos';

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
  message: string,
  photoPaths: string[] = []
): Promise<{ ok: boolean; message?: string }> {
  // Sem fotos manda só os 2 campos de sempre (funciona com ou sem a atualização das fotos).
  const { data, error } = await supabase.rpc('create_feature_request', {
    p_establishment_id: establishmentId,
    p_message: message,
    ...(photoPaths.length > 0 ? { p_photo_paths: photoPaths } : {}),
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

/** Contador "pedidos aceitos" da tela Fazer pedidos (344 + aceites novos). Sem a função no banco: 344. */
export const FEATURE_REQUESTS_ACCEPTED_BASE = 344;
export async function getAcceptedFeatureRequestsTotal(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('feature_requests_accepted_total');
    const total = Number(data);
    if (error || !Number.isFinite(total)) return FEATURE_REQUESTS_ACCEPTED_BASE;
    return Math.max(FEATURE_REQUESTS_ACCEPTED_BASE, Math.round(total));
  } catch {
    return FEATURE_REQUESTS_ACCEPTED_BASE;
  }
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

// ---------------------------------------------------------------------------
// Fotos do pedido
// ---------------------------------------------------------------------------

/**
 * Reduz a foto no próprio aparelho antes de enviar (lado maior até 1600 px, JPEG ~75%).
 * Uma foto de celular de 3–5 MB vira ~150–300 KB: não pesa no sistema nem no plano.
 */
export async function compressImageForUpload(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível ler essa imagem.'));
      img.src = objectUrl;
    });
    const encode = (maxSide: number, quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível preparar a imagem.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.'))),
          'image/jpeg',
          quality
        );
      });
    let blob = await encode(1600, 0.75);
    if (blob.size > 1_500_000) blob = await encode(1280, 0.65);
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Envia uma foto já reduzida para a pasta do estabelecimento. Devolve o caminho salvo. */
export async function uploadFeatureRequestPhoto(
  establishmentId: string,
  blob: Blob
): Promise<{ ok: boolean; path?: string; message?: string }> {
  const random = Math.random().toString(36).slice(2, 10);
  const path = `${establishmentId}/${Date.now()}-${random}.jpg`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    return {
      ok: false,
      message: msg.includes('bucket') && msg.includes('not found')
        ? 'Envio de fotos ainda não disponível (falta atualizar o sistema). Envie o pedido sem foto.'
        : 'Não consegui enviar as fotos. Tente de novo.',
    };
  }
  return { ok: true, path };
}

/**
 * Links temporários (1 hora) para ver as fotos — a pasta é privada.
 * thumb = miniatura pequena (carrega rápido); full = foto inteira (só ao abrir).
 */
export async function getFeatureRequestPhotoLinks(
  paths: string[]
): Promise<Array<{ path: string; thumb: string; full: string }>> {
  const clean = (paths || []).filter(Boolean).slice(0, FEATURE_REQUEST_MAX_PHOTOS);
  if (clean.length === 0) return [];
  const { data: fullLinks } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrls(clean, 3600);
  const fullByPath = new Map<string, string>();
  (fullLinks || []).forEach((item: any) => {
    if (item?.path && item?.signedUrl) fullByPath.set(String(item.path), String(item.signedUrl));
  });
  const out: Array<{ path: string; thumb: string; full: string }> = [];
  for (const path of clean) {
    const full = fullByPath.get(path) || '';
    if (!full) continue;
    let thumb = full;
    try {
      const { data } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrl(path, 3600, {
        transform: { width: 240, height: 240, resize: 'cover', quality: 60 },
      });
      if (data?.signedUrl) thumb = data.signedUrl;
    } catch {
      // sem miniatura: usa a foto inteira
    }
    out.push({ path, thumb, full });
  }
  return out;
}
