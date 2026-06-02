import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { SendMessageInput, SendMessageResult } from './types';

type QueueProcessor = (job: SendMessageInput) => Promise<SendMessageResult>;
type QueueMode = 'all' | 'producer' | 'consumer' | 'direct';

export class WhatsAppMessageQueue {
  private queue: Queue<SendMessageInput> | null = null;
  private worker: Worker<SendMessageInput> | null = null;
  private processor: QueueProcessor;
  private redis: IORedis | null = null;
  private delayedTimers = new Map<string, NodeJS.Timeout>();

  constructor(processor: QueueProcessor) {
    this.processor = processor;
  }

  initialize(mode: QueueMode = 'all') {
    const normalizedMode: QueueMode =
      mode === 'producer' || mode === 'consumer' || mode === 'direct' ? mode : 'all';
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    const requireRedis = String(process.env.WHATSAPP_REQUIRE_REDIS || '').trim().toLowerCase() === 'true';
    if (normalizedMode === 'direct') {
      console.warn('⚠️ WhatsApp queue em modo direct (sem BullMQ).');
      return;
    }

    if (!redisUrl) {
      if (requireRedis) {
        throw new Error('WHATSAPP_REQUIRE_REDIS=true, porém REDIS_URL não foi configurado.');
      }
      console.warn('⚠️ REDIS_URL não configurado. Fila BullMQ desativada (fallback direto).');
      return;
    }

    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
    this.queue = new Queue<SendMessageInput>('whatsapp-outbound', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 200,
      },
    });

    if (normalizedMode === 'all' || normalizedMode === 'consumer') {
      this.worker = new Worker<SendMessageInput>(
        'whatsapp-outbound',
        async (job) => this.processor(job.data),
        { connection: this.redis, concurrency: 4 }
      );

      this.worker.on('failed', (job, err) => {
        console.error('❌ Falha no worker whatsapp-outbound:', {
          jobId: job?.id,
          error: err?.message,
        });
      });
    }

    if (normalizedMode === 'producer') {
      console.log('✅ BullMQ inicializado para WhatsApp (modo producer).');
      return;
    }
    if (normalizedMode === 'consumer') {
      console.log('✅ BullMQ inicializado para WhatsApp (modo consumer).');
      return;
    }
    console.log('✅ BullMQ inicializado para WhatsApp (modo all).');
  }

  private scheduleInMemoryDelay(payload: SendMessageInput, delayMs: number): SendMessageResult {
    const configuredMaxDelay = Number(process.env.WHATSAPP_INMEMORY_MAX_DELAY_MS || 24 * 60 * 60_000);
    const maxDelayMs = Number.isFinite(configuredMaxDelay)
      ? Math.min(Math.max(configuredMaxDelay, 60_000), 7 * 24 * 60 * 60_000)
      : 24 * 60 * 60_000;

    if (delayMs > maxDelayMs) {
      console.warn('[whatsapp/queue] Atraso acima do limite in-memory; scheduler fará fallback.', {
        delayMs,
        maxDelayMs,
        idempotencyKey: payload.idempotencyKey || null,
      });
      return {
        ok: true,
        provider: 'baileys',
        deliveryMode: 'queued',
        messageId: null,
      };
    }

    const jobKey =
      String(payload.idempotencyKey || '').trim() ||
      `${payload.userId}::${payload.phone}::${payload.automationLog?.messageType || 'message'}::${delayMs}`;
    if (this.delayedTimers.has(jobKey)) {
      return { ok: true, provider: 'baileys', deliveryMode: 'queued', messageId: null };
    }

    const timer = setTimeout(() => {
      this.delayedTimers.delete(jobKey);
      void this.processor(payload).catch((error) => {
        console.error('[whatsapp/queue] Falha no envio agendado (fallback in-memory):', {
          jobKey,
          error: String((error as any)?.message || error),
        });
      });
    }, delayMs);

    this.delayedTimers.set(jobKey, timer);
    console.info('[whatsapp/queue] Mensagem agendada via fallback in-memory (sem BullMQ).', {
      jobKey,
      delayMs,
    });
    return { ok: true, provider: 'baileys', deliveryMode: 'queued', messageId: null };
  }

  async enqueueOrSend(payload: SendMessageInput): Promise<SendMessageResult> {
    const delayMs = Math.max(0, Number(payload.delayMs || 0) || 0);
    if (!this.queue) {
      if (delayMs > 0) {
        return this.scheduleInMemoryDelay(payload, delayMs);
      }
      const result = await this.processor(payload);
      return { ...result, deliveryMode: 'direct' };
    }

    const idempotencyKey = String(payload.idempotencyKey || '').trim();
    // BullMQ/Redis não aceita ":" em jobId customizado. Mantém idempotência,
    // mas troca separadores usados pelos nossos tipos (ex.: reminder_10m:uuid).
    const safeJobId = idempotencyKey ? idempotencyKey.replace(/:/g, '__') : undefined;
    await this.queue.add('send-whatsapp', payload, {
      jobId: safeJobId,
      delay: delayMs,
    });
    return {
      ok: true,
      provider: 'baileys',
      deliveryMode: 'queued',
      messageId: null,
    };
  }

  async shutdown() {
    for (const timer of this.delayedTimers.values()) {
      clearTimeout(timer);
    }
    this.delayedTimers.clear();
    try {
      await this.worker?.close();
      await this.queue?.close();
      await this.redis?.quit();
    } catch {
      // ignore
    }
  }
}
