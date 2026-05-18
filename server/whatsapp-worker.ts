import { initializeWhatsAppServices } from './services/whatsapp';

try {
  initializeWhatsAppServices();
  console.log('🚀 WhatsApp worker iniciado com sucesso.');
} catch (error) {
  console.error('❌ Falha ao iniciar WhatsApp worker:', error);
  process.exit(1);
}
