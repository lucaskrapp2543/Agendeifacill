// Mede quais arquivos de public/ o sistema realmente usa (para o app offline não ficar gigante).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const pub = path.join(raiz, 'public');

const andar = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const rel = base ? `${base}/${e.name}` : e.name;
  return e.isDirectory() ? andar(path.join(dir, e.name), rel) : [rel];
});
const lerFontes = (dir) => fs.readdirSync(dir, { withFileTypes: true }).map((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return lerFontes(p);
  return /\.(tsx?|jsx?|css|html|json)$/.test(e.name) ? fs.readFileSync(p, 'utf8') : '';
}).join('\n');

const texto = lerFontes(path.join(raiz, 'src')) + '\n' + fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
export function arquivosUsados() {
  return andar(pub).map((rel) => {
    const nome = rel.split('/').pop();
    const usado = texto.includes(nome) || texto.includes(encodeURI(nome)) || texto.includes(encodeURIComponent(nome));
    return { rel, tamanho: fs.statSync(path.join(pub, rel)).size, usado };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lista = arquivosUsados();
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
  const usados = lista.filter((x) => x.usado);
  console.log('arquivos em public:', lista.length, mb(lista.reduce((a, b) => a + b.tamanho, 0)));
  console.log('usados no codigo:', usados.length, mb(usados.reduce((a, b) => a + b.tamanho, 0)));
  for (const lim of [300, 800, 1500, 3000]) {
    const g = usados.filter((x) => x.tamanho <= lim * 1024);
    console.log(`usados ate ${lim} KB:`, g.length, mb(g.reduce((a, b) => a + b.tamanho, 0)));
  }
  console.log('--- usados grandes (> 800 KB) ---');
  usados.filter((x) => x.tamanho > 800 * 1024).sort((a, b) => b.tamanho - a.tamanho).forEach((x) => console.log(mb(x.tamanho), x.rel));
}
