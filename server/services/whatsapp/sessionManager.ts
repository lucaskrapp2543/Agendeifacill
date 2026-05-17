import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
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
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
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

  async connect(userIdRaw: string): Promise<{ qr: string | null; sessionPath: string }> {
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
      browser: ['Agendei Fácil', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    this.sockets.set(userId, { socket, reconnecting: false });
    await this.emitStatus(userId, 'connecting');

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update || {};

      if (qr) {
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
        const jid = String(socket?.user?.id || '').trim();
        const phone = jid.includes(':') ? jid.split(':')[0] : jid.split('@')[0] || null;
        const connectedAt = new Date().toISOString();
        await this.emitStatus(userId, 'connected', { phone, connectedAt, lastSeen: connectedAt });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        await this.emitStatus(userId, isLoggedOut ? 'disconnected' : 'reconnecting');

        this.sockets.delete(userId);
        if (isLoggedOut) {
          this.clearReconnectTimer(userId);
          return;
        }

        this.scheduleReconnect(userId);
      }
    });

    return { qr: this.getQr(userId), sessionPath };
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
    const timer = setTimeout(async () => {
      try {
        await this.connect(userId);
      } catch (error) {
        await this.emitStatus(userId, 'error', { lastSeen: new Date().toISOString() });
        this.scheduleReconnect(userId);
      }
    }, 5000);
    this.reconnectTimers.set(userId, timer);
  }

  async disconnect(userIdRaw: string, clearSession = false): Promise<void> {
    const userId = String(userIdRaw || '').trim();
    if (!userId) return;

    const existing = this.sockets.get(userId);
    if (existing?.socket?.end) {
      try {
        existing.socket.end(new Error('disconnect_by_user'));
      } catch {
        // ignore
      }
    }
    this.sockets.delete(userId);
    this.qrCache.set(userId, null);
    this.clearReconnectTimer(userId);

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
