// Servidor simples para abrir a apresentação offline no próprio computador.
// Uso: node servidor.mjs [pasta do app] [porta]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const pasta = path.resolve(process.argv[2] || path.join(aqui, 'app'));
const porta = Number(process.argv[3] || 4174);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  let caminho = '/';
  try { caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { caminho = '/'; }
  let arquivo = path.join(pasta, caminho);
  if (!arquivo.startsWith(pasta)) { res.writeHead(403); res.end(); return; }
  const existe = fs.existsSync(arquivo) && fs.statSync(arquivo).isFile();
  // Endereço que não é arquivo (ex.: /dashboard/establishment): entrega o app.
  if (!existe) {
    if (path.extname(caminho)) { res.writeHead(404); res.end(); return; }
    arquivo = path.join(pasta, 'index.html');
  }
  const ext = path.extname(arquivo).toLowerCase();
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(arquivo).pipe(res);
}).listen(porta, () => console.log(`Apresentação offline em http://localhost:${porta}/dashboard/establishment`));
