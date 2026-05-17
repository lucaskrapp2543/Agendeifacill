import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { SendMessageInput, SendMessageResult } from './types';

type QueueProcessor = (job: SendMessageInput) => Promise<SendMessageResult>;

export class WhatsAppMessageQueue {
  private queue: Queue<SendMessageInput> | null = null;
  private worker: Worker<SendMessageInput> | null = null;
  private processor: QueueProcessor;
  private redis: IORedis | null = null;

  constructor(processor: QueueProcessor) {
    this.processor = processor;
  }

  initialize() {
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    const requireRedis = String(process.env.WHATSAPP_REQUIRE_REDIS || '').trim().toLowerCase() === 'true';
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

    console.log('✅ BullMQ inicializado para WhatsApp (queue: whatsapp-outbound).');
  }

  async enqueueOrSend(payload: SendMessageInput): Promise<SendMessageResult> {
    if (!this.queue) {
      const result = await this.processor(payload);
      return { ...result, deliveryMode: 'direct' };
    }

    const idempotencyKey = String(payload.idempotencyKey || '').trim();
    await this.queue.add('send-whatsapp', payload, {
      jobId: idempotencyKey || undefined,
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
