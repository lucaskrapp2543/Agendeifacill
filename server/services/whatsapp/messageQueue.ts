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

  async enqueueOrSend(payload: SendMessageInput): Promise<SendMessageResult> {
    if (!this.queue) {
      const result = await this.processor(payload);
      return { ...result, deliveryMode: 'direct' };
    }

    const idempotencyKey = String(payload.idempotencyKey || '').trim();
    // BullMQ/Redis não aceita ":" em jobId customizado. Mantém idempotência,
    // mas troca separadores usados pelos nossos tipos (ex.: reminder_10m:uuid).
    const safeJobId = idempotencyKey ? idempotencyKey.replace(/:/g, '__') : undefined;
    await this.queue.add('send-whatsapp', payload, {
      jobId: safeJobId,
    });
    return {
      ok: true,
      provider: 'baileys',
      deliveryMode: 'queued',
      messageId: null,
    };
  }

  async shutdown() {
    try {
      await this.worker?.close();
      await this.queue?.close();
      await this.redis?.quit();
    } catch {
      // ignore
    }
  }
}
