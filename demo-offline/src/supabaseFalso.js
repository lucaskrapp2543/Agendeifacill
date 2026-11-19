// ════════════════════════════════════════════════════════════════════════
// APRESENTAÇÃO OFFLINE — "banco de mentira" que roda dentro do navegador.
//
// Este arquivo entra no lugar da biblioteca do banco (@supabase/supabase-js)
// SOMENTE na montagem da apresentação offline (demo-offline/vite.config.mjs).
// O sistema de verdade não usa nada daqui.
//
// Como funciona: os dados nascem de semente.js (sempre iguais) e tudo que for
// feito na apresentação (agendar, concluir, cadastrar) fica guardado só neste
// aparelho. O botão "Recomeçar" apaga o que foi feito e volta ao começo.
// ════════════════════════════════════════════════════════════════════════
import { montarBanco, EST_ID, EST_CODE, OWNER_ID, PROFS } from './semente.js';

const CHAVE_MUDANCAS = 'af_demo_offline_mudancas_v1';
const CHAVE_SESSAO = 'agendafacil_auth_token';
const GUEST_ID = 'c11e0000-0000-4000-8000-00000000c001';

const copia = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));
const agoraIso = () => new Date().toISOString();

// ── Banco em memória + mudanças guardadas no aparelho ─────────────────────
let db = montarBanco();
let mudancas = [];
let aplicadas = 0;
const tabela = (t) => { if (!db[t]) db[t] = []; return db[t]; };

function aplicar(m) {
  const linhas = tabela(m.t);
  if (m.op === 'ins') { if (!linhas.some((r) => r.id === m.row.id)) linhas.push(copia(m.row)); }
  else if (m.op === 'upd') { const r = linhas.find((x) => x.id === m.id); if (r) Object.assign(r, copia(m.patch)); }
  else if (m.op === 'del') { const i = linhas.findIndex((x) => x.id === m.id); if (i >= 0) linhas.splice(i, 1); }
}
function lerMudancas() { try { const v = JSON.parse(localStorage.getItem(CHAVE_MUDANCAS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function carregar() { db = montarBanco(); mudancas = lerMudancas(); mudancas.forEach(aplicar); aplicadas = mudancas.length; }
function registrar(m) {
  aplicar(m); mudancas.push(m); aplicadas = mudancas.length;
  try { localStorage.setItem(CHAVE_MUDANCAS, JSON.stringify(mudancas)); } catch { /* aparelho sem espaço: segue só na memória */ }
}
carregar();
// Outra aba (ex.: o link do cliente) mudou algo: esta aba acompanha.
window.addEventListener('storage', (e) => {
  if (e.key !== CHAVE_MUDANCAS) return;
  const novas = lerMudancas();
  if (novas.length < aplicadas) { carregar(); return; }
  novas.slice(aplicadas).forEach(aplicar); mudancas = novas; aplicadas = novas.length;
});

// ── Comparações ───────────────────────────────────────────────────────────
const ehDataHora = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v);
function comparar(a, b) {
  if (a == null || b == null) return null;
  if (typeof a === 'number' || (typeof b === 'number' && a !== '' && !Number.isNaN(Number(a)))) { const x = Number(a); const y = Number(b); if (!Number.isNaN(x) && !Number.isNaN(y)) return x < y ? -1 : x > y ? 1 : 0; }
  if (ehDataHora(a) && ehDataHora(b)) { const x = Date.parse(a); const y = Date.parse(b); if (!Number.isNaN(x) && !Number.isNaN(y)) return x < y ? -1 : x > y ? 1 : 0; }
  const x = String(a); const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
const igual = (a, b) => {
  if (a == null || b == null) return false;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return comparar(a, b) === 0;
};
function pegar(row, caminho) {
  if (row == null) return undefined;
  let c = String(caminho);
  if (c.includes('->')) { const partes = c.split(/->>?/).map((p) => p.trim().replace(/^'|'$/g, '')); let v = row; for (const p of partes) { v = v == null ? undefined : v[p]; } return v; }
  if (c in row) return row[c];
  if (c.includes('.')) { let v = row; for (const p of c.split('.')) { v = v == null ? undefined : (Array.isArray(v) ? v.map((i) => i && i[p]) : v[p]); } return v; }
  return row[c];
}
const padrao = (p, semCaixa) => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', semCaixa ? 'i' : '');
function valorTexto(v) {
  const s = String(v).trim().replace(/^"(.*)"$/, '$1');
  if (s === 'null') return null; if (s === 'true') return true; if (s === 'false') return false;
  return s;
}
function listaTexto(v) { return String(v).trim().replace(/^\(/, '').replace(/\)$/, '').split(',').map((x) => valorTexto(x)); }
function teste(op, v, alvo) {
  const um = (x) => {
    switch (op) {
      case 'eq': return igual(x, alvo);
      case 'neq': return x != null && alvo != null && !igual(x, alvo);
      case 'gt': { const c = comparar(x, alvo); return c !== null && c > 0; }
      case 'gte': { const c = comparar(x, alvo); return c !== null && c >= 0; }
      case 'lt': { const c = comparar(x, alvo); return c !== null && c < 0; }
      case 'lte': { const c = comparar(x, alvo); return c !== null && c <= 0; }
      case 'like': return x != null && padrao(alvo, false).test(String(x));
      case 'ilike': return x != null && padrao(alvo, true).test(String(x));
      case 'is': return alvo === null ? x == null : x === alvo;
      case 'in': return (Array.isArray(alvo) ? alvo : listaTexto(alvo)).some((a) => igual(x, a));
      case 'cs': case 'contains': {
        if (Array.isArray(x)) return (Array.isArray(alvo) ? alvo : [alvo]).every((a) => x.some((i) => igual(i, a)));
        if (x && typeof x === 'object' && alvo && typeof alvo === 'object') return Object.keys(alvo).every((kk) => igual(x[kk], alvo[kk]));
        return false;
      }
      case 'ov': case 'overlaps': return Array.isArray(x) && (Array.isArray(alvo) ? alvo : []).some((a) => x.some((i) => igual(i, a)));
      default: return true;
    }
  };
  // Filtro em relação "vários" (lista): vale se algum item passar.
  if (Array.isArray(v) && !['cs', 'contains', 'ov', 'overlaps'].includes(op)) return v.some(um);
  return um(v);
}
// Texto do .or('a.eq.1,b.is.null,and(c.eq.2,d.eq.3)')
function partirNoTopo(s) { const out = []; let n = 0; let cur = ''; for (const ch of s) { if (ch === '(') n += 1; if (ch === ')') n -= 1; if (ch === ',' && n === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur); return out.map((x) => x.trim()).filter(Boolean); }
function condTexto(txt) {
  const t = txt.trim();
  const grupo = t.match(/^(and|or)\((.*)\)$/s);
  if (grupo) { const partes = partirNoTopo(grupo[2]).map(condTexto); return grupo[1] === 'and' ? (r) => partes.every((f) => f(r)) : (r) => partes.some((f) => f(r)); }
  const m = t.match(/^([^.]+(?:->>?[^.]+)*)\.(not\.)?([a-z]+)\.(.*)$/s);
  if (!m) return () => true;
  const [, col, nao, op, bruto] = m;
  const alvo = op === 'in' ? listaTexto(bruto) : valorTexto(bruto);
  return (r) => { const ok = teste(op, pegar(r, col), alvo); return nao ? !ok : ok; };
}

// ── Relações entre tabelas (para select com "tabela(...)") ────────────────
const RELACOES = {
  service_subcategories: { service_categories: { t: 'service_categories', local: 'category_id', fora: 'id', varios: false } },
  service_categories: { service_subcategories: { t: 'service_subcategories', local: 'id', fora: 'category_id', varios: true } },
  client_subscriptions: { subscriptions: { t: 'subscriptions', local: 'subscription_id', fora: 'id', varios: false }, subscriber_attendances: { t: 'subscriber_attendances', local: 'id', fora: 'client_subscription_id', varios: true } },
  subscriber_attendances: { client_subscriptions: { t: 'client_subscriptions', local: 'client_subscription_id', fora: 'id', varios: false } },
  subscriptions: { client_subscriptions: { t: 'client_subscriptions', local: 'id', fora: 'subscription_id', varios: true } },
};
const singular = (n) => n.replace(/ies$/, 'y').replace(/s$/, '');
function relacao(t, nome, exemplo) {
  const fixa = RELACOES[t] && RELACOES[t][nome];
  if (fixa) return fixa;
  const fk = singular(nome) + '_id';
  if (exemplo && fk in exemplo) return { t: nome, local: fk, fora: 'id', varios: false };
  return { t: nome, local: 'id', fora: singular(t) + '_id', varios: true };
}
function relacoesDoSelect(cols) {
  const out = []; const re = /(?:([a-z_0-9]+)\s*:\s*)?([a-z_0-9]+)\s*(![a-z_0-9]+)?\s*\(/gi; let m;
  const texto = String(cols || '');
  while ((m = re.exec(texto))) out.push({ apelido: m[1] || m[2], nome: m[2], inner: (m[3] || '').toLowerCase() === '!inner' });
  return out;
}

// ── Regras do banco imitadas ──────────────────────────────────────────────
function aoInserir(t, row) {
  if (!row.id) row.id = novoId();
  if (!row.created_at) row.created_at = agoraIso();
  if (t === 'appointments') {
    const d = String(row.client_whatsapp || '').replace(/\D/g, '');
    if (d) row.client_whatsapp = d.length <= 11 ? '55' + d : d;
    if (row.total_price == null && row.price != null) row.total_price = row.price;
    if (!row.status) row.status = 'pending';
  }
}
function depoisDeInserir(t, row) {
  if (t !== 'appointments') return;
  const pro = PROFS.find((p) => p[0] === row.professional);
  registrar({ t: 'establishment_notifications', op: 'ins', row: { id: novoId(), establishment_id: row.establishment_id, type: 'new_appointment', title: 'Novo Agendamento!', message: `${row.client_name || 'Cliente'} agendou ${row.service || ''} para ${row.appointment_date} às ${row.appointment_time}${pro ? ' com ' + pro[1] : ''}`, appointment_id: row.id, read: false, created_at: agoraIso() } });
}
function depoisDeApagar(t, row) {
  if (t !== 'appointments') return;
  tabela('establishment_notifications').filter((n) => n.appointment_id === row.id).forEach((n) => registrar({ t: 'establishment_notifications', op: 'del', id: n.id }));
}

// ── Consulta (imita o jeito de pedir dados do sistema) ────────────────────
class Consulta {
  constructor(t) { this.t = t; this.op = 'select'; this.cols = '*'; this.filtros = []; this.ordens = []; this.lim = null; this.faixa = null; this.unico = null; this.contar = false; this.soCabeca = false; this.devolver = true; this.dados = null; this.conflito = null; }
  select(cols = '*', opts = {}) { this.cols = cols || '*'; this.devolver = true; if (opts && opts.count) this.contar = true; if (opts && opts.head) this.soCabeca = true; return this; }
  insert(rows) { this.op = 'insert'; this.dados = rows; this.devolver = false; return this; }
  upsert(rows, opts = {}) { this.op = 'upsert'; this.dados = rows; this.devolver = false; this.conflito = opts && opts.onConflict ? String(opts.onConflict).split(',').map((x) => x.trim()) : ['id']; return this; }
  update(patch) { this.op = 'update'; this.dados = patch; this.devolver = false; return this; }
  delete() { this.op = 'delete'; this.devolver = false; return this; }
  _f(col, op, alvo, nao) { this.filtros.push((r) => { const ok = teste(op, pegar(r, col), alvo); return nao ? !ok : ok; }); return this; }
  eq(c, v) { return this._f(c, 'eq', v); } neq(c, v) { return this._f(c, 'neq', v); }
  gt(c, v) { return this._f(c, 'gt', v); } gte(c, v) { return this._f(c, 'gte', v); }
  lt(c, v) { return this._f(c, 'lt', v); } lte(c, v) { return this._f(c, 'lte', v); }
  like(c, v) { return this._f(c, 'like', v); } ilike(c, v) { return this._f(c, 'ilike', v); }
  is(c, v) { return this._f(c, 'is', v); } in(c, v) { return this._f(c, 'in', v); }
  contains(c, v) { return this._f(c, 'contains', v); } overlaps(c, v) { return this._f(c, 'overlaps', v); }
  containedBy() { return this; } textSearch() { return this; }
  not(c, op, v) { return this._f(c, op, op === 'in' && typeof v === 'string' ? listaTexto(v) : v, true); }
  filter(c, op, v) { if (String(op).startsWith('not.')) return this._f(c, String(op).slice(4), valorTexto(v), true); return this._f(c, op, op === 'in' ? listaTexto(v) : (typeof v === 'string' ? valorTexto(v) : v)); }
  match(obj) { Object.keys(obj || {}).forEach((k) => this.eq(k, obj[k])); return this; }
  or(txt) { const partes = partirNoTopo(String(txt || '')).map(condTexto); if (partes.length) this.filtros.push((r) => partes.some((f) => f(r))); return this; }
  order(col, opts = {}) { let c = String(col); const m = c.match(/^([a-z_0-9]+)\(([a-z_0-9]+)\)$/i); if (m) c = `${m[1]}.${m[2]}`; else if (opts && (opts.foreignTable || opts.referencedTable)) c = `${opts.foreignTable || opts.referencedTable}.${c}`; this.ordens.push({ c, asc: !opts || opts.ascending !== false, nullsFirst: opts ? opts.nullsFirst : undefined }); return this; }
  limit(n) { this.lim = n; return this; } range(a, b) { this.faixa = [a, b]; return this; }
  single() { this.unico = 'single'; return this; } maybeSingle() { this.unico = 'maybe'; return this; }
  abortSignal() { return this; } returns() { return this; } throwOnError() { return this; } csv() { return this; } setHeader() { return this; }
  then(ok, falha) { return Promise.resolve().then(() => this._rodar()).then(ok, falha); }
  catch(f) { return this.then(undefined, f); }
  finally(f) { return this.then((v) => { f(); return v; }, (e) => { f(); throw e; }); }

  _embutir(linhas) {
    const rels = relacoesDoSelect(this.cols);
    if (!rels.length) return linhas;
    let saida = linhas;
    for (const rel of rels) {
      const def = relacao(this.t, rel.nome, saida[0]);
      const outras = tabela(def.t);
      saida.forEach((r) => {
        const achadas = outras.filter((o) => r[def.local] != null && igual(o[def.fora], r[def.local])).map(copia);
        r[rel.apelido] = def.varios ? achadas : (achadas[0] || null);
      });
      if (rel.inner) saida = saida.filter((r) => (Array.isArray(r[rel.apelido]) ? r[rel.apelido].length > 0 : r[rel.apelido] != null));
    }
    return saida;
  }
  _filtrar(linhas) { return linhas.filter((r) => this.filtros.every((f) => { try { return f(r); } catch { return false; } })); }
  _finalizar(linhas, total) {
    let l = linhas;
    if (this.ordens.length) {
      l = [...l].sort((a, b) => {
        for (const o of this.ordens) {
          const x = pegar(a, o.c); const y = pegar(b, o.c);
          if (x == null && y == null) continue;
          const nf = o.nullsFirst === undefined ? !o.asc : o.nullsFirst;
          if (x == null) return nf ? -1 : 1; if (y == null) return nf ? 1 : -1;
          const c = comparar(x, y); if (c) return o.asc ? c : -c;
        }
        return 0;
      });
    }
    if (this.faixa) l = l.slice(this.faixa[0], this.faixa[1] + 1);
    if (this.lim != null) l = l.slice(0, this.lim);
    const base = { error: null, status: 200, statusText: 'OK', count: this.contar ? total : null };
    if (this.soCabeca) return { ...base, data: null };
    if (this.unico) {
      if (l.length === 1) return { ...base, data: l[0] };
      if (l.length === 0 && this.unico === 'maybe') return { ...base, data: null };
      return { data: null, count: null, status: 406, statusText: 'Not Acceptable', error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${l.length} rows`, hint: null } };
    }
    return { ...base, data: l };
  }
  _rodar() {
    const linhas = tabela(this.t);
    if (this.op === 'select') {
      const filtradas = this._filtrar(this._embutir(linhas.map(copia)));
      return this._finalizar(filtradas, filtradas.length);
    }
    let afetadas = [];
    if (this.op === 'insert' || this.op === 'upsert') {
      const entrada = (Array.isArray(this.dados) ? this.dados : [this.dados]).filter(Boolean).map(copia);
      for (const row of entrada) {
        let existente = null;
        if (this.op === 'upsert') existente = linhas.find((r) => this.conflito.every((c) => row[c] != null && igual(r[c], row[c]))) || null;
        if (existente) { const patch = { ...row }; delete patch.id; registrar({ t: this.t, op: 'upd', id: existente.id, patch }); afetadas.push(existente); }
        else { aoInserir(this.t, row); registrar({ t: this.t, op: 'ins', row }); depoisDeInserir(this.t, row); afetadas.push(tabela(this.t).find((r) => r.id === row.id) || row); }
      }
    } else if (this.op === 'update') {
      const alvo = this._filtrar(this._embutir(linhas.map(copia))).map((r) => r.id);
      const patch = copia(this.dados) || {};
      alvo.forEach((id) => { registrar({ t: this.t, op: 'upd', id, patch }); const r = tabela(this.t).find((x) => x.id === id); if (r) afetadas.push(r); });
    } else if (this.op === 'delete') {
      const alvo = this._filtrar(this._embutir(linhas.map(copia)));
      alvo.forEach((r) => { registrar({ t: this.t, op: 'del', id: r.id }); depoisDeApagar(this.t, r); afetadas.push(r); });
    }
    if (!this.devolver) return { data: null, error: null, count: null, status: 201, statusText: 'Created' };
    const saida = this._embutir(afetadas.map(copia));
    return this._finalizar(saida, saida.length);
  }
}

// ── Funções do banco (rpc) imitadas ───────────────────────────────────────
const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const mesmoFone = (a, b) => { const x = soDigitos(a).replace(/^55/, ''); const y = soDigitos(b).replace(/^55/, ''); return !!x && x === y; };
const RPC = {
  get_establishment_public: (a) => tabela('establishments').filter((e) => String(e.code) === String(a.p_code)).map(copia),
  get_day_availability: (a) => tabela('appointments').filter((x) => x.establishment_id === a.p_establishment_id && x.appointment_date === a.p_date && x.status !== 'cancelled')
    .map((x) => ({ id: x.id, status: x.status, duration: x.duration, is_avulso: x.is_avulso, professional: x.professional, payment_status: x.payment_status ?? null, appointment_date: x.appointment_date, appointment_time: x.appointment_time, pix_payment_status: x.pix_payment_status ?? null, additional_products: x.additional_products ?? null })),
  get_completed_ranking: () => [],
  get_appointments_by_phone: (a) => { const f = a.p_phone || a.p_whatsapp || a.phone || Object.values(a || {}).find((v) => soDigitos(v).length >= 10); return tabela('appointments').filter((x) => mesmoFone(x.client_whatsapp, f)).map(copia); },
  get_client_appointments_for_establishment: (a) => { const f = Object.values(a || {}).find((v) => typeof v === 'string' && soDigitos(v).length >= 10 && !String(v).includes('-')); return tabela('appointments').filter((x) => x.establishment_id === EST_ID && (!f || mesmoFone(x.client_whatsapp, f))).map(copia); },
  public_is_client_booking_blocked: () => false,
  public_booking_whatsapp_info: () => null,
  afcoin_get_client_wallets: () => [],
  afcoin_register_booking_event: () => ({ ok: true, awarded: 0 }),
  list_establishment_monthly_goal_history: () => [],
  list_my_feature_requests: () => [],
  count_unread_feature_request_answers: () => 0,
  feature_requests_accepted_total: () => 0,
};
function rpc(nome, args) {
  const f = RPC[nome];
  let data = null;
  try { data = f ? f(args || {}) : null; } catch { data = null; }
  const res = { data, error: null, count: null, status: 200, statusText: 'OK' };
  const p = Promise.resolve(res);
  const q = { then: (a, b) => p.then(a, b), catch: (b) => p.catch(b), finally: (b) => p.finally(b) };
  ['single', 'maybeSingle', 'select', 'abortSignal', 'limit', 'order', 'eq', 'returns', 'throwOnError'].forEach((m) => { q[m] = () => q; });
  return q;
}

// ── Login de mentira ──────────────────────────────────────────────────────
const usuario = (id, email, role, extra) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { role, email, ...(extra || {}) }, created_at: '2026-01-10T12:00:00Z', updated_at: '2026-01-10T12:00:00Z' });
const sessaoDe = (user) => ({ access_token: 'offline', refresh_token: 'offline', token_type: 'bearer', expires_in: 315360000, expires_at: Math.floor(Date.now() / 1000) + 315360000, user });
const DONO = usuario(OWNER_ID, 'apresentacao@agendeifacil.offline', 'establishment', { full_name: 'Barbearia Teste 2027', establishment_name: 'Barbearia Teste 2027' });
const telaDeCliente = () => /^\/(booking|view-appointments|client|agendar|b\/)/.test(window.location.pathname);
let sessao = null;
const ouvintes = new Set();
function definirSessao(s, evento) {
  sessao = s;
  try { if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); else localStorage.removeItem(CHAVE_SESSAO); } catch { /* ignora */ }
  if (evento) ouvintes.forEach((cb) => { try { cb(evento, sessao); } catch { /* ignora */ } });
}
// Painel: já entra como dona da barbearia. Link do cliente: começa sem login, igual ao de verdade.
definirSessao(telaDeCliente() ? null : sessaoDe(DONO), null);
const entrar = async (cred) => {
  const email = String((cred && cred.email) || '');
  const user = telaDeCliente() ? usuario(GUEST_ID, email || 'cliente@agendeifacil.offline', 'client', (cred && cred.options && cred.options.data) || {}) : DONO;
  definirSessao(sessaoDe(user), 'SIGNED_IN');
  return { data: { user, session: sessao }, error: null };
};
const auth = {
  getSession: async () => ({ data: { session: sessao }, error: null }),
  getUser: async () => ({ data: { user: sessao ? sessao.user : null }, error: null }),
  refreshSession: async () => ({ data: { session: sessao, user: sessao ? sessao.user : null }, error: null }),
  setSession: async () => ({ data: { session: sessao, user: sessao ? sessao.user : null }, error: null }),
  signInWithPassword: entrar, signUp: entrar, signInAnonymously: entrar,
  signOut: async () => { definirSessao(null, 'SIGNED_OUT'); return { error: null }; },
  updateUser: async (attrs) => { if (sessao && attrs && attrs.data) sessao.user.user_metadata = { ...sessao.user.user_metadata, ...attrs.data }; return { data: { user: sessao ? sessao.user : null }, error: null }; },
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  onAuthStateChange: (cb) => { ouvintes.add(cb); setTimeout(() => { try { cb('INITIAL_SESSION', sessao); } catch { /* ignora */ } }, 0); return { data: { subscription: { unsubscribe: () => ouvintes.delete(cb) } } }; },
  admin: { listUsers: async () => ({ data: { users: [] }, error: null }) },
};

// ── Arquivos (fotos enviadas durante a apresentação) ──────────────────────
const enviados = {};
const lerComoDataUrl = (arq) => new Promise((res) => { try { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => res(''); fr.readAsDataURL(arq); } catch { res(''); } });
const storage = {
  from: (balde) => ({
    upload: async (caminho, arq) => { const url = arq && typeof arq === 'object' ? await lerComoDataUrl(arq) : ''; if (url) enviados[`${balde}/${caminho}`] = url; return { data: { path: caminho }, error: null }; },
    update: async (caminho) => ({ data: { path: caminho }, error: null }),
    remove: async () => ({ data: [], error: null }),
    list: async () => ({ data: [], error: null }),
    download: async () => ({ data: null, error: { message: 'Indisponível na apresentação offline' } }),
    createSignedUrl: async (caminho) => ({ data: { signedUrl: enviados[`${balde}/${caminho}`] || '' }, error: null }),
    createSignedUrls: async (lista) => ({ data: (lista || []).map((c) => ({ path: c, signedUrl: enviados[`${balde}/${c}`] || '' })), error: null }),
    getPublicUrl: (caminho) => ({ data: { publicUrl: enviados[`${balde}/${caminho}`] || `/demo-fotos/${String(caminho).split('/').pop()}` } }),
  }),
  listBuckets: async () => ({ data: [{ name: 'establishment-photos' }, { name: 'establishment-assets' }], error: null }),
  createBucket: async () => ({ data: {}, error: null }),
};

const canal = () => { const c = { on: () => c, subscribe: (cb) => { if (typeof cb === 'function') setTimeout(() => cb('SUBSCRIBED'), 0); return c; }, unsubscribe: async () => 'ok', send: async () => 'ok', track: async () => 'ok' }; return c; };
const cliente = {
  from: (t) => new Consulta(String(t)),
  rpc,
  auth,
  storage,
  channel: canal,
  removeChannel: async () => 'ok',
  removeAllChannels: async () => [],
  getChannels: () => [],
  functions: { invoke: async () => ({ data: null, error: null }) },
  realtime: { setAuth: () => {} },
};

// ── Nada sai para a internet ──────────────────────────────────────────────
const fetchOriginal = window.fetch.bind(window);
const json = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
window.fetch = async (entrada, opcoes) => {
  let url = '';
  try { url = String((entrada && entrada.url) || entrada); } catch { url = ''; }
  let u = null;
  try { u = new URL(url, window.location.href); } catch { u = null; }
  const mesmaOrigem = !!u && u.origin === window.location.origin;
  const ehApi = !!u && (/^\/(api|\.netlify)\//.test(u.pathname) || u.pathname.startsWith('/storage/v1/') || u.pathname.startsWith('/rest/v1/') || u.pathname.startsWith('/auth/v1/'));
  if (u && (!mesmaOrigem || ehApi)) {
    if (/whatsapp/i.test(u.pathname)) return json({ ok: true, success: true, status: 'disconnected', connected: false, phone: null, connected_at: null, last_seen: null });
    return json({ ok: true, success: true, offline: true });
  }
  return fetchOriginal(entrada, opcoes);
};
try { navigator.sendBeacon = () => true; } catch { /* ignora */ }

// ── Aviso e botão de recomeçar ────────────────────────────────────────────
function montarFaixa() {
  if (document.getElementById('af-demo-offline')) return;
  const estilo = document.createElement('style');
  estilo.textContent = 'iframe[src*="youtube"],iframe[src*="youtu.be"]{display:none!important}#af-demo-offline{position:fixed;left:8px;bottom:8px;z-index:2147483000;display:flex;gap:6px;align-items:center;font:600 11px/1 system-ui,Arial,sans-serif;background:#111;color:#fff;border:1px solid #d4a94a;border-radius:999px;padding:5px 6px 5px 10px;opacity:.85}#af-demo-offline button{font:700 11px/1 system-ui,Arial,sans-serif;background:#d4a94a;color:#111;border:0;border-radius:999px;padding:5px 9px;cursor:pointer}';
  document.head.appendChild(estilo);
  const caixa = document.createElement('div');
  caixa.id = 'af-demo-offline';
  const rotulo = document.createElement('span');
  rotulo.textContent = 'Apresentação';
  rotulo.style.cursor = 'pointer';
  caixa.appendChild(rotulo);
  const botoes = [];
  const botao = (texto, acao) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = texto; b.onclick = acao; caixa.appendChild(b); botoes.push(b); return b; };
  // Num app instalado no tablet não existe barra de endereço: estes botões trocam de tela.
  botao('Painel', () => { window.location.href = '/dashboard/establishment'; });
  botao('Link do cliente', () => { window.location.href = `/booking/${EST_CODE}`; });
  botao('↺ Recomeçar', () => { if (window.confirm('Apagar tudo que foi feito nesta apresentação e voltar ao começo?')) { try { localStorage.removeItem(CHAVE_MUDANCAS); } catch { /* ignora */ } window.location.href = '/dashboard/establishment'; } });
  // Toque em "Apresentação" encolhe/abre a faixa (para não cobrir a tela).
  let aberta = true;
  try { aberta = sessionStorage.getItem('af_demo_faixa') !== 'fechada'; } catch { /* ignora */ }
  const pintar = () => { botoes.forEach((b) => { b.style.display = aberta ? '' : 'none'; }); };
  rotulo.onclick = () => { aberta = !aberta; try { sessionStorage.setItem('af_demo_faixa', aberta ? 'aberta' : 'fechada'); } catch { /* ignora */ } pintar(); };
  pintar();
  document.body.appendChild(caixa);
  // Mostra quando o app já está guardado no aparelho (pode desligar a internet).
  try {
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => { rotulo.textContent = 'Apresentação ✓ sem internet'; }).catch(() => {});
  } catch { /* ignora */ }
}
// Aviso de "primeira visita" da agenda: já vem dispensado na apresentação.
try { localStorage.setItem(`appointments_intro_dismissed_${OWNER_ID}_${EST_ID}`, 'true'); } catch { /* ignora */ }
if (document.body) montarFaixa(); else window.addEventListener('DOMContentLoaded', montarFaixa);

window.__afDemoOffline = { banco: () => db, mudancas: () => mudancas };

export const createClient = () => cliente;
export class SupabaseClient {}
export default { createClient };
