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

  constructor(options?: WhatsAppManagerOptions) {
    const sessionsRootDir =
      options?.sessionsRootDir || path.resolve(process.cwd(), 'sessions');

    this.sessionManager = new WhatsAppSessionManager({
      sessionsRootDir,
      onStatusChange: options?.onStatusChange,
    });
  }

  async connect(userId: string) {
    return this.sessionManager.connect(userId);
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
    return (
      msg.includes('connection closed') ||
      msg.includes('timed out waiting for message') ||
      msg.includes('not connected') ||
      msg.includes('stream errored out') ||
      msg.includes('websocket')
    );
  }

  private async getConnectedSocket(userId: string): Promise<any | null> {
    let socket = this.sessionManager.getSocket(userId);
    if (!socket || !socket?.user) {
      await this.connect(userId);
      socket = this.sessionManager.getSocket(userId);
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

    if (!socket || !socket?.user) {
      return {
        ok: false,
        provider: 'baileys',
        deliveryMode: 'direct',
        error: 'Sessão não conectada. Escaneie o QR Code.',
      };
    }

    try {
      const firstAttempt = await this.sendWithSocket(socket, phone, message);
      if (firstAttempt.ok) return firstAttempt;
      if (!this.isTransientConnectionError(firstAttempt.error)) return firstAttempt;

      // Retry único para reduzir falhas intermitentes de reconexão do WhatsApp Web.
      await this.disconnect(userId, false);
      await this.connect(userId);
      socket = await this.getConnectedSocket(userId);
      if (!socket || !socket?.user) return firstAttempt;

      const secondAttempt = await this.sendWithSocket(socket, phone, message);
      return secondAttempt.ok ? secondAttempt : firstAttempt;
    } catch (error: any) {
      return {
        ok: false,
        provider: 'baileys',
        deliveryMode: 'direct',
        error: String(error?.message || error || 'Falha ao enviar mensagem'),
      };
    }
  }
}
