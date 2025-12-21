import { encryptApiKey } from '../server/crypto';

/**
 * Uso:
 *  WHATSAPP_REMINDERS_MASTER_KEY="..." npx tsx modules/whatsapp-reminders/tools/encryptApiKey.ts "SUA_API_KEY"
 */
const plain = process.argv.slice(2).join(' ').trim();

if (!plain) {
  console.error('Uso: npx tsx modules/whatsapp-reminders/tools/encryptApiKey.ts "SUA_API_KEY"');
  process.exit(1);
}

try {
  const encrypted = encryptApiKey(plain);
  process.stdout.write(encrypted + '\n');
} catch (e) {
  console.error('Erro ao criptografar:', e);
  process.exit(1);
}


