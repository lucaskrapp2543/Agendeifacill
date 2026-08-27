import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { WhatsAppSessionManager } from './sessionManager';
import type { SendMessageInput, SendMessageResult, SessionStatusPayload } from './types';

type WhatsAppManagerOptions = {
  sessionsRootDir?: string;
  onStatusChange?: (payload: SessionStatusPayload) => Promise<void> | void;
};

export class WhatsAppManager {
  private readonly sessionManager: WhatsAppSessionManager;
  private readonly sendChains = new Map<string, Promise<SendMessageResult>>();
  private restoreInProgress = false;
  private restoreTimer: NodeJS.Timeout | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options?: WhatsAppManagerOptions) {
    const configuredSessionsDir = String(process.env.WHATSAPP_SESSIONS_DIR || '').trim();
    const sessionsRootDir =
      options?.sessionsRootDir ||
      configuredSessionsDir ||
      path.resolve(process.cwd(), 'sessions');

    this.sessionManager = new WhatsAppSessionManager({
      sessionsRootDir,
      onStatusChange: options?.onStatusChange,
    });
  }

  async connect(userId: string) {
    return this.sessionManager.connect(userId);
  }

  async requestPairingCode(userId: string, phone: string) {
    return this.sessionManager.requestPairingCode(userId, phone);
  }

  async disconnect(userId: string, clearSession = false) {
    return this.sessionManager.disconnect(userId, clearSession);
  }

  getQr(userId: string) {
    return this.sessionManager.getQr(userId);
  }

  getSessionPath(userId: string) {
    return this.sessionManager.getSessionPath(userId);
  }

  isConnected(userId: string) {
    return this.sessionManager.isConnected(userId);
  }

  private hashStable(value: string): number {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private belongsToThisWorker(userId: string): boolean {
    const workerCount = Math.max(1, Number(process.env.WHATSAPP_WORKER_COUNT || 1) || 1);
    if (workerCount <= 1) return true;
    const workerId = Math.max(0, Number(process.env.WHATSAPP_WORKER_ID || 0) || 0);
    return this.hashStable(userId) % workerCount === workerId;
  }

  private parseBoolEnv(key: string, fallback: boolean): boolean {
    const raw = String(process.env[key] || '').trim().toLowerCase();
    if (!raw) return fallback;
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  }

  private async listRestorableUserIds(): Promise<string[]> {
    const fromDisk = await this.sessionManager.listSessionUserIdsFromDisk();
    const merged = new Set(fromDisk);

    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await supabase
          .from('whatsapp_sessions')
          .select('user_id,status')
          .in('status', ['connected', 'reconnecting', 'connecting', 'error']);
        for (const row of data || []) {
          const userId = String((row as any)?.user_id || '').trim();
          if (userId) merged.add(userId);
        }
      } catch (error) {
        console.warn('[whatsapp/restore] Falha ao listar sessões no banco:', error);
      }
    }

    return Array.from(merged).filter((userId) => this.belongsToThisWorker(userId));
  }

  /** Reconecta sessões salvas no disco após restart/deploy (em lotes para não sobrecarregar). */
  async restorePersistedSessions(reason: 'startup' | 'sweep' = 'startup'): Promise<void> {
    if (this.restoreInProgress) return;
    this.restoreInProgress = true;

    try {
      const userIds = await this.listRestorableUserIds();
      if (userIds.length === 0) {
        console.log(`[whatsapp/restore] Nenhuma sessão para restaurar (${reason}).`);
        return;
      }

      const batchSize = Math.min(
        Math.max(Number(process.env.WHATSAPP_RESTORE_BATCH_SIZE || 2) || 2, 1),
        10
      );
      const batchDelayMs = Math.min(
        Math.max(Number(process.env.WHATSAPP_RESTORE_BATCH_DELAY_MS || 2500) || 2500, 500),
        15_000
      );

      const pending = userIds.filter((userId) => !this.isConnected(userId));
      console.log(
        `[whatsapp/restore] Iniciando ${reason}: ${pending.length}/${userIds.length} sessão(ões) pendente(s).`
      );

      let restored = 0;
      let failed = 0;
      for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (userId) => {
            if (this.sessionManager.getSocket(userId)) return;
            try {
              await this.connect(userId);
              restored += 1;
            } catch (error) {
              failed += 1;
              console.warn('[whatsapp/restore] Falha ao restaurar sessão:', {
                userId,
                reason,
                error: String((error as any)?.message || error),
              });
            }
          })
        );
        if (i + batchSize < pending.length) {
          await this.sleep(batchDelayMs);
        }
      }

      console.log(`[whatsapp/restore] ${reason} concluído: ok=${restored}, falhas=${failed}.`);
    } finally {
      this.restoreInProgress = false;
    }
  }

  /** Dispara restore na subida e sweep periódico para sessões que caíram sem restart. */
  startSessionMaintenance() {
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    const defaultEnabled = nodeEnv === 'production';
    const autoRestore = this.parseBoolEnv('WHATSAPP_AUTO_RESTORE_SESSIONS', defaultEnabled);
    if (!autoRestore) {
      console.log('ℹ️ Restore automático de sessões WhatsApp desativado.');
      return;
    }

    const startupDelayMs = Math.min(
      Math.max(Number(process.env.WHATSAPP_RESTORE_STARTUP_DELAY_MS || 8000) || 8000, 2000),
      120_000
    );
    const sweepIntervalMs = Math.max(
      Number(process.env.WHATSAPP_RESTORE_SWEEP_INTERVAL_MS || 300_000) || 300_000,
      0
    );

    if (this.restoreTimer) clearTimeout(this.restoreTimer);
    this.restoreTimer = setTimeout(() => {
      void this.restorePersistedSessions('startup');
    }, startupDelayMs);

    console.log(
      `[whatsapp/restore] Auto-restore ativo: startup em ${startupDelayMs}ms` +
        (sweepIntervalMs > 0 ? `, sweep a cada ${sweepIntervalMs}ms.` : ', sweep desativado.')
    );

    // Limpeza periódica dos arquivos de sessão antigos. O disco de 10 GB encheu em
    // 27/08/2026 (ENOSPC) e derrubou o WhatsApp de TODOS os estabelecimentos: o
    // useMultiFileAuthState grava um arquivo por chave e nunca apaga nada. Sem esta
    // rotina, o disco volta a encher — só demora mais.
    // Roda uma vez na subida (com folga para não competir com o restore) e depois no
    // intervalo configurado. Nunca toca em creds.json (ver cleanupOldSessionFiles).
    const cleanupIntervalMs = Math.max(
      Number(process.env.WHATSAPP_SESSION_CLEANUP_INTERVAL_MS || 12 * 60 * 60 * 1000) || 12 * 60 * 60 * 1000,
      0
    );
    const cleanupMaxAgeDays = Math.max(
      Number(process.env.WHATSAPP_SESSION_CLEANUP_MAX_AGE_DAYS || 30) || 30,
      7
    );

    const runCleanup = async () => {
      try {
        const result = await this.sessionManager.cleanupOldSessionFiles({ maxAgeDays: cleanupMaxAgeDays });
        if (result.removedFiles > 0) {
          const freedMb = (result.freedBytes / (1024 * 1024)).toFixed(1);
          console.log(
            `[whatsapp/cleanup] ${result.removedFiles} arquivo(s) antigo(s) removido(s) ` +
            `(${freedMb} MB liberados) em ${result.scannedSessions} sessão(ões).`
          );
        } else {
          console.log(`[whatsapp/cleanup] Nada a remover (${result.scannedSessions} sessão(ões) verificadas).`);
        }
      } catch (error) {
        // Limpeza é manutenção: falhar aqui NUNCA pode derrubar conexão de ninguém.
        console.warn('[whatsapp/cleanup] Falha na limpeza de sessões antigas:', error);
      }
    };

    if (cleanupIntervalMs > 0) {
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      // primeira passada 5 min após subir: o restore das sessões tem prioridade
      setTimeout(() => { void runCleanup(); }, 5 * 60 * 1000);
      this.cleanupTimer = setInterval(() => { void runCleanup(); }, cleanupIntervalMs);
      console.log(
        `[whatsapp/cleanup] Limpeza ativa: a cada ${Math.round(cleanupIntervalMs / 3600000)}h, ` +
        `removendo arquivos sem uso há ${cleanupMaxAgeDays} dias.`
      );
    }

    if (sweepIntervalMs <= 0) return;
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = setInterval(() => {
      void this.restorePersistedSessions('sweep');
    }, sweepIntervalMs);
  }

  stopSessionMaintenance() {
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private normalizePhone(phoneRaw: string): string {
    const digits = String(phoneRaw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
    return digits;
  }

  private waitForServerAck(socket: any, messageId: string, timeoutMs = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      let finished = false;
      let timeout: NodeJS.Timeout | null = null;

      const finish = (value: boolean) => {
        if (finished) return;
        finished = true;
        if (timeout) clearTimeout(timeout);
        try {
          socket?.ev?.off?.('messages.update', onMessageUpdate);
        } catch {
          // ignore
        }
        resolve(value);
      };

      const onMessageUpdate = (updates: any[]) => {
        if (!Array.isArray(updates)) return;
        for (const item of updates) {
          const keyId = String(item?.key?.id || '').trim();
          if (!keyId || keyId !== messageId) continue;
          const status = Number(item?.update?.status ?? -1);
          if (status >= 1 && status <= 4) {
            finish(true);
            return;
          }
          if (status === 5) {
            finish(false);
            return;
          }
        }
      };

      try {
        socket?.ev?.on?.('messages.update', onMessageUpdate);
      } catch {
        resolve(false);
        return;
      }

      timeout = setTimeout(() => finish(false), timeoutMs);
    });
  }

  private isTransientConnectionError(error: any): boolean {
    const msg = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || error?.statusCode || error?.output?.statusCode || '').trim();
    return (
      code === '1006' ||
      msg === '1006' ||
      msg.includes('1006') ||
      msg.includes('connection closed') ||
      (msg.includes('closed') && msg.includes('connection')) ||
      msg.includes('timed out waiting for message') ||
      msg.includes('not connected') ||
      msg.includes('stream errored out') ||
      msg.includes('connection lost') ||
      msg.includes('socket closed') ||
      msg.includes('restart required') ||
      msg.includes('websocket')
    );
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitUntilConnected(userId: string, timeoutMs = 30_000): Promise<any | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const socket = this.sessionManager.getSocket(userId);
      if (socket?.user) return socket;
      await this.sleep(400);
    }
    return this.sessionManager.getSocket(userId);
  }

  private async getConnectedSocket(userId: string): Promise<any | null> {
    let socket = this.sessionManager.getSocket(userId);
    if (!socket || !socket?.user) {
      await this.connect(userId);
      socket = await this.waitUntilConnected(userId);
    }
    return socket || null;
  }

  private async sendWithSocket(
    socket: any,
    phone: string,
    message: string
  ): Promise<SendMessageResult> {
    const jid = `${phone}@s.whatsapp.net`;
    // Evita falso "enviado" quando o número não existe no WhatsApp.
    const recipientProbe = await socket.onWhatsApp(jid);
    const recipient = Array.isArray(recipientProbe) ? recipientProbe[0] : null;
    const recipientExists = Boolean(recipient?.exists || recipient?.jid);
    if (!recipientExists) {
      return {
        ok: false,
        provider: 'baileys',
        deliveryMode: 'direct',
        error: 'Número não encontrado no WhatsApp (verifique DDI/DDD/número).',
      };
    }

    const resolvedJid = String(recipient?.jid || `${phone}@s.whatsapp.net`).trim();
    const result = await socket.sendMessage(resolvedJid, { text: message });
    const messageId = String(result?.key?.id || '').trim() || null;
    if (!messageId) {
      return {
        ok: false,
        provider: 'baileys',
        deliveryMode: 'direct',
        error: 'Mensagem sem id de confirmação do WhatsApp.',
      };
    }

    const acked = await this.waitForServerAck(socket, messageId, 10000);
    if (!acked) {
      // Em redes instáveis (localhost/túneis), o ACK pode atrasar mesmo com entrega efetiva.
      // Marcamos como aceito pelo servidor (ok), porém sem confirmação de ACK.
      return {
        ok: true,
        provider: 'baileys',
        deliveryMode: 'direct',
        ackConfirmed: false,
        messageId,
        error:
          'Mensagem aceita pelo WhatsApp, mas sem confirmação imediata de ACK (pode ter sido entregue).',
      };
    }

    return { ok: true, provider: 'baileys', deliveryMode: 'direct', ackConfirmed: true, messageId };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const userIdKey = String(input.userId || '').trim();
    const previous = this.sendChains.get(userIdKey) || Promise.resolve({
      ok: true,
      provider: 'baileys',
    } as SendMessageResult);

    const current = previous
      .catch(() => ({
        ok: false,
        provider: 'baileys',
      } as SendMessageResult))
      .then(() => this.sendMessageUnsafe(input));

    this.sendChains.set(userIdKey, current);
    current.finally(() => {
      if (this.sendChains.get(userIdKey) === current) {
        this.sendChains.delete(userIdKey);
      }
    });
    return current;
  }

  private async sendMessageUnsafe(input: SendMessageInput): Promise<SendMessageResult> {
    const userId = String(input.userId || '').trim();
    const message = String(input.message || '').trim();
    const phone = this.normalizePhone(input.phone);

    if (!userId) return { ok: false, provider: 'baileys', error: 'userId ausente.' };
    if (!phone) return { ok: false, provider: 'baileys', error: 'Telefone inválido.' };
    if (!message) return { ok: false, provider: 'baileys', error: 'Mensagem vazia.' };

    let socket = await this.getConnectedSocket(userId);

    const attemptSend = async (): Promise<SendMessageResult> => {
      try {
        return await this.sendWithSocket(socket, phone, message);
      } catch (error: any) {
        const errorMessage =
          String(
            error?.message ||
              error?.code ||
              error?.statusCode ||
              error?.output?.statusCode ||
              error ||
              'Falha ao enviar mensagem'
          );
        return {
          ok: false,
          provider: 'baileys',
          deliveryMode: 'direct',
          error: errorMessage,
        };
      }
    };

    const configuredAttempts = Number(process.env.WHATSAPP_SEND_RETRY_ATTEMPTS || 4);
    const maxAttempts = Number.isFinite(configuredAttempts)
      ? Math.min(Math.max(configuredAttempts, 1), 8)
      : 4;
    let lastAttempt: SendMessageResult = {
      ok: false,
      provider: 'baileys',
      deliveryMode: 'direct',
      error: 'Sessão não conectada. Escaneie o QR Code.',
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      socket = await this.getConnectedSocket(userId);
      if (!socket || !socket?.user) {
        lastAttempt = {
          ok: false,
          provider: 'baileys',
          deliveryMode: 'direct',
          error: 'Sessão não conectada. Escaneie o QR Code.',
        };
      } else {
        lastAttempt = await attemptSend();
      }

      if (lastAttempt.ok) return lastAttempt;
      if (!this.isTransientConnectionError(lastAttempt.error)) return lastAttempt;
      if (attempt === maxAttempts) return lastAttempt;

      console.warn('[whatsapp/send] erro transitório, tentando reconectar e reenviar', {
        userId,
        phone,
        attempt,
        maxAttempts,
        error: lastAttempt.error || null,
      });

      try {
        await this.disconnect(userId, false);
        await this.sleep(Math.min(10_000, 1_500 * attempt));
        await this.connect(userId);
        await this.waitUntilConnected(userId, 20_000);
      } catch {
        // A próxima iteração tentará obter/conectar o socket novamente.
      }
    }

    return lastAttempt;
  }
}
