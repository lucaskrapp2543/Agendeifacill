# Solução: Conectividade (ERR_NAME_NOT_RESOLVED) – Domínio customizado

## O problema
Algumas redes/operadoras não resolvem bem o domínio `*.supabase.co`. Resultado: "Problema de Conectividade", "Failed to fetch", `net::ERR_NAME_NOT_RESOLVED`. Você não pode pedir para cada cliente mudar DNS no celular.

## A solução (uma vez, vale para você e para todos os clientes)
**Usar um domínio SEU para a API do Supabase** em vez de `yznjqlphqpgddqzwoqvc.supabase.co`.

Exemplo: se seu app está em `https://agendeifacil.com.br`, você configura a API em `https://api.agendeifacil.com.br`. Quem abre o app já acessou o seu domínio – o mesmo DNS que resolveu `agendeifacil.com.br` costuma resolver `api.agendeifacil.com.br`. Assim a falha de DNS em `supabase.co` deixa de afetar seus clientes.

---

## Requisito
- **Supabase em plano pago** (Pro/Team) – o add-on **Custom Domain** é pago.  
  Ver: [Supabase Dashboard → Project → Settings → Add-ons → Custom Domain](https://supabase.com/dashboard/project/_/settings/addons?panel=customDomain).

Se estiver no plano gratuito, essa solução exige upgrade. Não existe solução 100% no código que force a rede do cliente a resolver `supabase.co`.

---

## Passos (resumo)

### 1. Escolher o subdomínio
Use um subdomínio do mesmo domínio do seu app, por exemplo:
- `api.agendeifacil.com.br`
- ou `db.agendeifacil.com.br`

(Substitua pelo domínio real do seu app.)

### 2. Configurar no Supabase
- No **Dashboard** do Supabase: [Settings → General](https://supabase.com/dashboard/project/_/settings/general) → seção **Custom Domains**.
- Ou pela **CLI** (se usar):  
  `supabase domains create --project-ref yznjqlphqpgddqzwoqvc --custom-hostname api.SEUDOMINIO.com.br`

O Supabase vai te dar:
- Um **CNAME** para apontar no DNS (ex.: `api.SEUDOMINIO.com.br` → `yznjqlphqpgddqzwoqvc.supabase.co`).
- Um **TXT** para `_acme-challenge.api.SEUDOMINIO.com.br` (validação/SSL).

### 3. Configurar no seu DNS (onde você gerencia o domínio)
No painel do domínio (Registro.br, Cloudflare, etc.):

1. **CNAME**
   - Nome: `api` (ou o subdomínio que escolheu).
   - Valor / alvo: `yznjqlphqpgddqzwoqvc.supabase.co`.
   - TTL baixo (ex.: 300) no início, para testar.

2. **TXT**
   - Nome: `_acme-challenge.api` (ou o que o Supabase indicar).
   - Valor: o que o Supabase mostrar (cópia exata, sem espaços extras).

### 4. Verificar e ativar no Supabase
- No Dashboard ou na CLI: **Reverify** / **Verify** o domínio.
- Depois: **Activate** o custom domain. O Supabase emite o SSL e passa a atender em `https://api.SEUDOMINIO.com.br`.

### 5. Trocar a URL no projeto
Quando o domínio customizado estiver ativo:

1. No **.env** (e nas variáveis de ambiente do Netlify/build):
   - Troque:
     - De: `VITE_SUPABASE_URL=https://yznjqlphqpgddqzwoqvc.supabase.co`
     - Para: `VITE_SUPABASE_URL=https://api.SEUDOMINIO.com.br`
   - Mantenha a mesma `VITE_SUPABASE_ANON_KEY` (não muda).

2. Onde tiver **SUPABASE_URL** (funções serverless, etc.), use a mesma URL:  
   `SUPABASE_URL=https://api.SEUDOMINIO.com.br`

3. **Auth (OAuth, etc.)**: Se usar login social, adicione no console de cada provedor (Google, etc.) a nova URL de callback, por exemplo:  
   `https://api.SEUDOMINIO.com.br/auth/v1/callback`  
   (além da antiga, se quiser manter durante a migração.)

4. **Deploy** de novo (front e funções que usam SUPABASE_URL).

---

## Resultado
- Você e todos os clientes passam a usar `https://api.SEUDOMINIO.com.br` em vez de `*.supabase.co`.
- Quem já consegue abrir seu app no celular/PC tende a conseguir acessar a API no mesmo domínio, sem precisar mudar DNS nem “código” em lugar nenhum.

---

## Se não puder usar Custom Domain (plano gratuito)
- Manter o modal de “Problema de Conectividade” com a dica: **usar dados móveis (4G)** ou **reiniciar o roteador** (já implementado).
- Não há como, só com código no front, obrigar a rede do cliente a resolver `supabase.co`; isso depende de DNS/rede.
