import crypto from 'node:crypto';

/**
 * AES-256-GCM com IV aleatório.
 *
 * Formato do ciphertext:
 *   base64( version(1 byte) | iv(12 bytes) | tag(16 bytes) | data )
 *
 * OBS: este arquivo é para uso em backend/job.
 */
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

function getKeyFromEnv(envVarName = 'WHATSAPP_REMINDERS_MASTER_KEY'): Buffer {
  const raw = process.env[envVarName];
  if (!raw) {
    throw new Error(
      `Variável de ambiente ${envVarName} não configurada (necessária para criptografar/descriptografar api_key_encrypted).`
    );
  }

  // Aceita base64 (32 bytes) ou hex (64 chars) ou texto (derivado via sha256)
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && Buffer.from(raw, 'base64').length === 32) {
    return Buffer.from(raw, 'base64');
  }
  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest(); // 32 bytes
}

export function encryptApiKey(plain: string, envVarName?: string): string {
  const key = getKeyFromEnv(envVarName);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const data = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();

  const out = Buffer.concat([Buffer.from([VERSION]), iv, tag, data]);
  return out.toString('base64');
}

export function decryptApiKey(ciphertextB64: string, envVarName?: string): string {
  const key = getKeyFromEnv(envVarName);
  // Tolerar whitespace acidental (quebra de linha/espacos ao copiar/colar)
  const normalized = String(ciphertextB64 || '').replace(/\s+/g, '');
  const raw = Buffer.from(normalized, 'base64');
  if (raw.length < 1 + IV_LEN + TAG_LEN + 1) {
    throw new Error('Ciphertext inválido (tamanho insuficiente).');
  }

  const version = raw.readUInt8(0);
  if (version !== VERSION) {
    throw new Error(`Versão de ciphertext não suportada: ${version}`);
  }

  const iv = raw.subarray(1, 1 + IV_LEN);
  const tag = raw.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const data = raw.subarray(1 + IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
}


