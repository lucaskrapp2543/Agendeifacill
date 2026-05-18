export type WhatsAppSessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'needs_qr'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type SessionStatusPayload = {
  userId: string;
  status: WhatsAppSessionStatus;
  phone?: string | null;
  connectedAt?: string | null;
  lastSeen?: string | null;
  sessionPath: string;
};

export type SendMessageInput = {
  userId: string;
  phone: string;
  message: string;
  idempotencyKey?: string;
  delayMs?: number;
  automationLog?: {
    appointmentId: string;
    messageType: string;
  };
};

export type SendMessageResult = {
  ok: boolean;
  provider: 'baileys';
  deliveryMode?: 'queued' | 'direct';
  ackConfirmed?: boolean;
  messageId?: string | null;
  error?: string | null;
};
