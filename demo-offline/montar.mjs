// ════════════════════════════════════════════════════════════════════════
// APRESENTAÇÃO OFFLINE — monta o app que roda sem internet.
// Uso (na raiz do projeto):  node demo-offline/montar.mjs ["pasta de saída"]
// Não mexe em nada do site de verdade: só lê o código e grava na pasta de saída.
// ════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'vite';
import { arquivosUsados } from './medir.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const require = createRequire(path.join(raiz, 'package.json'));
const sharp = require('sharp');

const base = path.resolve(process.argv[2] || path.join(aqui, 'saida'));
const app = path.join(base, 'app');
const versao = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const kb = (n) => Math.round(n / 1024);

fs.mkdirSync(base, { recursive: true });
process.env.AF_DEMO_SAIDA = app;

console.log('1/5 Montando o sistema com o banco de mentira...');
if (process.env.AF_DEMO_PULAR_BUILD === '1' && fs.existsSync(path.join(app, 'index.html'))) console.log('   (montagem do sistema reaproveitada)');
else await build({ configFile: path.join(aqui, 'vite.config.mjs'), logLevel: 'error' });

console.log('2/5 Copiando só as imagens usadas (comprimidas)...');
const pub = path.join(raiz, 'public');
const copiarComprimindo = async (origem, destino) => {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tam = fs.statSync(origem).size;
  const ext = path.extname(origem).toLowerCase();
  try {
    if (ext === '.png' && tam > 300 * 1024) {
      const buf = await sharp(origem).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).png({ palette: true, quality: 80, effort: 7 }).toBuffer();
      if (buf.length < tam) { fs.writeFileSync(destino, buf); return buf.length; }
    }
    if (ext === '.webp' && tam > 200 * 1024) {
      const buf = await sharp(origem).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
      if (buf.length < tam) { fs.writeFileSync(destino, buf); return buf.length; }
    }
  } catch { /* se não der para comprimir, copia como está */ }
  fs.copyFileSync(origem, destino);
  return tam;
};
const fora = new Set(['_redirects', '_headers', 'sw.js', 'manifest.json', 'force-update.js']);
let nImg = 0; let pesoImg = 0;
for (const arq of arquivosUsados()) {
  const nome = arq.rel.split('/').pop();
  const sempre = arq.rel.startsWith('icons/') || /^(novo-icone|favicon|fotopessoa)/i.test(nome);
  if (fora.has(arq.rel)) continue;
  if (!arq.usado && !sempre) continue;
  if (/\.(zip|mp4|mov|psd)$/i.test(nome)) continue;
  pesoImg += await copiarComprimindo(path.join(pub, arq.rel), path.join(app, arq.rel));
  nImg += 1;
}
for (const f of fs.readdirSync(path.join(aqui, 'fotos'))) {
  pesoImg += await copiarComprimindo(path.join(aqui, 'fotos', f), path.join(app, 'demo-fotos', f));
  nImg += 1;
}
fs.copyFileSync(path.join(raiz, 'node_modules', 'chart.js', 'dist', 'chart.umd.js'), path.join(app, 'demo-chart.umd.js'));
console.log(`   ${nImg} imagens, ${kb(pesoImg)} KB`);

console.log('3/5 Gravando as regras de app (instalar e abrir sem internet)...');
let icones = [];
try {
  icones = (JSON.parse(fs.readFileSync(path.join(pub, 'manifest.json'), 'utf8')).icons || [])
    .map((i) => ({ ...i, src: String(i.src).split('?')[0] }))
    .filter((i) => fs.existsSync(path.join(app, i.src.replace(/^\//, ''))));
} catch { icones = []; }
fs.writeFileSync(path.join(app, 'manifest.json'), JSON.stringify({
  name: 'Agendei Fácil — Apresentação', short_name: 'AF Apresentação', description: 'Apresentação do Agendei Fácil que funciona sem internet (dados de demonstração).',
  start_url: '/dashboard/establishment', scope: '/', display: 'standalone', orientation: 'any', lang: 'pt-BR', background_color: '#0b0b0c', theme_color: '#0b0b0c', icons: icones,
}, null, 2));
fs.writeFileSync(path.join(app, '_redirects'), '/*    /index.html   200\n');
fs.writeFileSync(path.join(app, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(app, '_headers'), '/index.html\n  Cache-Control: no-cache\n\n/sw-demo.js\n  Cache-Control: no-cache\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n');
fs.writeFileSync(path.join(app, 'sw.js'), '// Apresentação offline: este arquivo fica vazio de propósito (o app usa sw-demo.js).\nself.addEventListener("install", () => self.skipWaiting());\n');

const andar = (dir, rel = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const r = rel ? `${rel}/${e.name}` : e.name;
  return e.isDirectory() ? andar(path.join(dir, e.name), r) : [r];
});
const naoGuardar = new Set(['sw-demo.js', 'sw.js', '_redirects', '_headers']);
const todos = andar(app).filter((r) => !naoGuardar.has(r));
const obrigatorios = todos.filter((r) => r === 'index.html' || r.startsWith('assets/') || r === 'demo-chart.umd.js' || r === 'manifest.json').map((r) => encodeURI('/' + r));
const extras = todos.filter((r) => !(r === 'index.html' || r.startsWith('assets/') || r === 'demo-chart.umd.js' || r === 'manifest.json')).map((r) => encodeURI('/' + r));
const pesoTotal = todos.reduce((a, r) => a + fs.statSync(path.join(app, r)).size, 0);

fs.writeFileSync(path.join(app, 'sw-demo.js'), `// Apresentação offline do Agendei Fácil — guarda o app inteiro no aparelho.
const VERSAO = '${versao}';
const CACHE = 'af-demo-' + VERSAO;
const OBRIGATORIOS = ${JSON.stringify(obrigatorios)};
const EXTRAS = ${JSON.stringify(extras)};

async function guardar(cache, lista, obrigatorio) {
  for (let i = 0; i < lista.length; i += 12) {
    await Promise.all(lista.slice(i, i + 12).map(async (u) => {
      try {
        const r = await fetch(u, { cache: 'reload' });
        if (!r.ok) throw new Error('falhou ' + u);
        await cache.put(u, r);
      } catch (e) { if (obrigatorio) throw e; }
    }));
  }
}
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await guardar(cache, OBRIGATORIOS, true);
    await guardar(cache, EXTRAS, false);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) { if (k.startsWith('af-demo-') && k !== CACHE) await caches.delete(k); }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const ehPagina = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
    if (ehPagina) { const pagina = await cache.match('/index.html'); if (pagina) return pagina; }
    const guardado = await cache.match(url.pathname);
    if (guardado) return guardado;
    try {
      const r = await fetch(req);
      if (r.ok && r.type === 'basic') cache.put(url.pathname, r.clone());
      return r;
    } catch (err) {
      if (ehPagina) { const pagina = await cache.match('/index.html'); if (pagina) return pagina; }
      return new Response('', { status: 504, statusText: 'Sem internet' });
    }
  })());
});
`);

console.log('4/5 Preparando o atalho para abrir no computador...');
fs.copyFileSync(path.join(aqui, 'servidor.mjs'), path.join(base, 'servidor.mjs'));
fs.writeFileSync(path.join(base, 'ABRIR NO COMPUTADOR.bat'), '@echo off\r\ncd /d "%~dp0"\r\nwhere node >nul 2>nul\r\nif errorlevel 1 (\r\n  echo Este computador nao tem o Node instalado. Use o app no tablet.\r\n  pause\r\n  exit /b 1\r\n)\r\nstart "" http://localhost:4174/dashboard/establishment\r\nnode servidor.mjs app 4174\r\n');

console.log('5/5 Pronto.');
console.log(`   Pasta: ${base}`);
console.log(`   Arquivos no app: ${todos.length} | Tamanho total: ${(pesoTotal / 1048576).toFixed(1)} MB | Versão: ${versao}`);
