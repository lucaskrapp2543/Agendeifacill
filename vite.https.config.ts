import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config';

/**
 * Servidor de desenvolvimento em HTTPS (porta 5174), só para testar no celular
 * o que o navegador libera apenas em https (ex.: "Compartilhar" do story, que
 * abre o Instagram/WhatsApp). Não é usado no build nem em produção.
 *
 * Como usar:  npm run dev:https   → abre https://<IP do PC>:5174 no celular
 *             (aceitar o aviso do certificado: Avançado → Continuar).
 *
 * Certificado autoassinado em certs.local/ (pasta ignorada pelo git). Para gerar
 * de novo (no Git Bash), troque o IP pelo do seu PC:
 *   openssl req -x509 -newkey rsa:2048 -nodes -keyout certs.local/dev-key.pem \
 *     -out certs.local/dev-cert.pem -days 825 -subj "/CN=Agendei dev local" \
 *     -addext "subjectAltName=IP:192.168.0.5,IP:127.0.0.1,DNS:localhost"
 */
const certDir = path.resolve(__dirname, 'certs.local');
const keyPath = path.join(certDir, 'dev-key.pem');
const certPath = path.join(certDir, 'dev-cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  throw new Error(
    `Certificado não encontrado em ${certDir}. Veja o comentário no topo de vite.https.config.ts para gerar.`
  );
}

export default mergeConfig(
  baseConfig,
  defineConfig({
    server: {
      port: 5174,
      strictPort: true,
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    },
  })
);
