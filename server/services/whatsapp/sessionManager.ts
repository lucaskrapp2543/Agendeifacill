import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import path from 'path';
import QRCode from 'qrcode';
import type { SessionStatusPayload, WhatsAppSessionStatus } from './types';

type SocketMapValue = {
  socket: any;
  reconnecting: boolean;
};

type SessionManagerOptions = {
  sessionsRootDir: string;
  onStatusChange?: (payload: SessionStatusPayload) => Promise<void> | void;
};

export class WhatsAppSessionManager {
  private sockets = new Map<string, SocketMapValue>();
  private qrCache = new Map<string, string | null>();
  private qrResolvers = new Map<string, () => void>();
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  private reconnectAttempts = new Map<string, number>();
  private manualDisconnect = new Set<string>();
  private readonly sessionsRootDir: string;
  private readonly onStatusChange?: (payload: SessionStatusPayload) => Promise<void> | void;

  constructor(options: SessionManagerOptions) {
    this.sessionsRootDir = options.sessionsRootDir;
    this.onStatusChange = options.onStatusChange;
  }

  private sanitizeUserId(userId: string): string {
    return String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  getSessionPath(userId: string): string {
    return path.join(this.sessionsRootDir, `user_${this.sanitizeUserId(userId)}`);
  }

  getQr(userId: string): string | null {
    return this.qrCache.get(String(userId || '').trim()) || null;
  }

  getSocket(userId: string): any | null {
    const item = this.sockets.get(String(userId || '').trim());
    return item?.socket || null;
  }

  isConnected(userId: string): boolean {
    const socket = this.getSocket(userId);
    return Boolean(socket?.user);
  }

  private async ensureSessionDir(userId: string): Promise<string> {
    const sessionPath = this.getSessionPath(userId);
    await fs.mkdir(sessionPath, { recursive: true });
    return sessionPath;
  }

  private async emitStatus(
    userId: string,
    status: WhatsAppSessionStatus,
    extras?: { phone?: string | null; connectedAt?: string | null; lastSeen?: string | null }
  ) {
    if (!this.onStatusChange) return;
    const payload: SessionStatusPayload = {
      userId,
      status,
      sessionPath: this.getSessionPath(userId),
      phone: extras?.phone ?? null,
      connectedAt: extras?.connectedAt ?? null,
      lastSeen: extras?.lastSeen ?? new Date().toISOString(),
    };
    await this.onStatusChange(payload);
  }

  async connect(userIdRaw: string, options?: { suppressQr?: boolean }): Promise<{ qr: string | null; sessionPath: string }> {
    const userId = String(userIdRaw || '').trim();
    if (!userId) throw new Error('userId é obrigatório para conectar WhatsApp.');

    const existing = this.sockets.get(userId);
    if (existing?.socket) {
      return { qr: this.getQr(userId), sessionPath: this.getSessionPath(userId) };
    }

    const sessionPath = await this.ensureSessionDir(userId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.windows('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 20_000,
      defaultQueryTimeoutMs: 60_000,
    });

    this.sockets.set(userId, { socket, reconnecting: false });
    await this.emitStatus(userId, 'connecting');

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update || {};

      if (qr) {
        const qrResolver = this.qrResolvers.get(userId);
        if (qrResolver) {
          this.qrResolvers.delete(userId);
          qrResolver();
        }
      }

      if (qr && !options?.suppressQr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
          this.qrCache.set(userId, qrDataUrl);
        } catch {
          this.qrCache.set(userId, null);
        }
        await this.emitStatus(userId, 'needs_qr');
      }

      if (connection === 'open') {
        this.qrCache.set(userId, null);
        this.reconnectAttempts.set(userId, 0);
        const jid = String(socket?.user?.id || '').trim();
        const phone = jid.includes(':') ? jid.split(':')[0] : jid.split('@')[0] || null;
        const connectedAt = new Date().toISOString();
        await this.emitStatus(userId, 'connected', { phone, connectedAt, lastSeen: connectedAt });
      }

      if (connection === 'close') {
        if (this.manualDisconnect.has(userId)) {
          this.manualDisconnect.delete(userId);
          return;
        }
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        await this.emitStatus(userId, isLoggedOut ? 'disconnected' : 'reconnecting');

        this.sockets.delete(userId);
        if (isLoggedOut) {
          this.clearReconnectTimer(userId);
          this.reconnectAttempts.set(userId, 0);
          return;
        }

        this.scheduleReconnect(userId);
      }
    });

    return { qr: this.getQr(userId), sessionPath };
  }

  private normalizePairingPhone(phoneRaw: string): string {
    const digits = String(phoneRaw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
    return digits;
  }

  private waitForQrSignal(userId: string, timeoutMs = 15_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.qrResolvers.delete(userId);
        reject(new Error('O WhatsApp demorou para liberar o código. Tente gerar novamente em alguns segundos.'));
      }, timeoutMs);

      this.qrResolvers.set(userId, () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async requestPairingCode(userIdRaw: string, phoneRaw: string): Promise<{ code: string; phone: string; sessionPath: string }> {
    const userId = String(userIdRaw || '').trim();
    if (!userId) throw new Error('userId é obrigatório para gerar código do WhatsApp.');

    const phone = this.normalizePairingPhone(phoneRaw);
    if (!phone || phone.length < 12) {
      throw new Error('Informe o número com DDD. Exemplo: 11999999999.');
    }

    const existing = this.sockets.get(userId);
    if (existing?.socket?.user) {
      throw new Error('WhatsApp já está conectado. Desconecte antes de parear outro número.');
    }
    if (existing?.socket) {
      try {
        this.manualDisconnect.add(userId);
        existing.socket.end?.(new Error('restart_for_pairing_code'));
      } catch {
        // ignore
      }
      this.sockets.delete(userId);
      this.qrCache.set(userId, null);
      this.clearReconnectTimer(userId);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Se estava em tentativa de QR/código anterior, limpa a sessão ainda não registrada.
    // Sessão conectada já foi bloqueada acima e também pelas rotas.
    try {
      await fs.rm(this.getSessionPath(userId), { recursive: true, force: true });
    } catch {
      // ignore
    }

    const qrReady = this.waitForQrSignal(userId);
    await this.connect(userId, { suppressQr: true });
    const socket = this.getSocket(userId);
    if (!socket) {
      throw new Error('Não foi possível iniciar a conexão do WhatsApp para gerar o código.');
    }
    if (socket?.user) {
      throw new Error('WhatsApp já está conectado. Desconecte antes de parear outro número.');
    }
    if (socket?.authState?.creds?.registered) {
      throw new Error('Já existe uma sessão registrada. Desconecte limpando a sessão antes de gerar outro código.');
    }
    if (typeof socket.requestPairingCode !== 'function') {
      throw new Error('Esta versão do Baileys não suporta conexão por código.');
    }

    await qrReady;
    const code = String(await socket.requestPairingCode(phone)).trim();
    if (!code) throw new Error('WhatsApp não retornou código de pareamento.');
    await this.emitStatus(userId, 'connecting');
    return { code, phone, sessionPath: this.getSessionPath(userId) };
  }

  private clearReconnectTimer(userId: string) {
    const oldTimer = this.reconnectTimers.get(userId);
    if (oldTimer) {
      clearTimeout(oldTimer);
      this.reconnectTimers.delete(userId);
    }
  }

  private scheduleReconnect(userId: string) {
    this.clearReconnectTimer(userId);
    const attempts = Number(this.reconnectAttempts.get(userId) || 0) + 1;
    this.reconnectAttempts.set(userId, attempts);
    const delayMs = Math.min(30_000, 5_000 * attempts);
    const timer = setTimeout(async () => {
      try {
        await this.connect(userId);
      } catch (error) {
        await this.emitStatus(userId, 'error', { lastSeen: new Date().toISOString() });
        this.scheduleReconnect(userId);
      }
    }, delayMs);
    this.reconnectTimers.set(userId, timer);
  }

  async disconnect(userIdRaw: string, clearSession = false): Promise<void> {
    const userId = String(userIdRaw || '').trim();
    if (!userId) return;

    const existing = this.sockets.get(userId);
    if (existing?.socket?.end) {
      this.manualDisconnect.add(userId);
      try {
        existing.socket.end(new Error('disconnect_by_user'));
      } catch {
        // ignore
      }
    }
    this.sockets.delete(userId);
    this.qrCache.set(userId, null);
    this.clearReconnectTimer(userId);
    this.reconnectAttempts.set(userId, 0);

    if (clearSession) {
      const sessionPath = this.getSessionPath(userId);
      try {
        await fs.rm(sessionPath, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    await this.emitStatus(userId, 'disconnected', { lastSeen: new Date().toISOString() });
  }
}
