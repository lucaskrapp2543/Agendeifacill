// Deixa as fotos da apresentação offline mais leves (roda uma vez; pode rodar de novo sem problema).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(aqui, '..', 'package.json'));
const sharp = require('sharp');
const pasta = path.join(aqui, 'fotos');

let antes = 0; let depois = 0;
for (const f of fs.readdirSync(pasta)) {
  const arq = path.join(pasta, f);
  const tam = fs.statSync(arq).size; antes += tam;
  const lado = f.startsWith('loja_') ? 1280 : f.startsWith('prof_') || f === 'logo.webp' ? 512 : 720;
  const buf = await sharp(fs.readFileSync(arq)).resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  if (buf.length < tam) { fs.writeFileSync(arq, buf); depois += buf.length; } else depois += tam;
}
console.log(`fotos: ${(antes / 1024).toFixed(0)} KB -> ${(depois / 1024).toFixed(0)} KB`);
