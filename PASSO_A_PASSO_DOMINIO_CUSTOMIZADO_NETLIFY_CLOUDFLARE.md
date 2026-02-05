# Passo a passo: Domínio customizado (Netlify + Cloudflare)

Use este guia se seu site está na **Netlify** e o domínio (DNS) está na **Cloudflare**. Faça um passo de cada vez.

---

## Antes de começar

- Você precisa do **Supabase em plano pago** (Pro).  
  Se ainda estiver no gratuito: [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto → **Settings** → **Billing** → fazer upgrade para Pro e ativar o add-on **Custom Domain**.

- Anote qual é o domínio do seu site. Exemplo: `agendeifacil.com.br`.  
  O subdomínio da API será: **api.agendeifacil.com.br** (troque só a primeira parte se seu domínio for outro).

---

## PASSO 1 – Supabase: pedir o domínio customizado

1. Abra o navegador e entre em: **https://supabase.com/dashboard**
2. Faça login e clique no **projeto do Agendei Fácil** (o que você usa no app).
3. No menu da esquerda, clique em **Project Settings** (ícone de engrenagem).
4. Procure a parte **Custom Domains** (ou **Add-ons** → **Custom Domain**).
5. Onde pedir o domínio, coloque: **api.agendeifacil.com.br**  
   (se seu site for outro, use **api.seudominio.com.br**).
6. Clique em **Add custom domain** (ou equivalente).
7. O Supabase vai mostrar **duas coisas** para você copiar:
   - **CNAME:** algo como `api` → `yznjqlphqpgddqzwoqvc.supabase.co`
   - **TXT:** um nome e um texto longo (para validação)
8. **Deixe essa aba aberta** e abra outra aba para o próximo passo.

---

## PASSO 2 – Cloudflare: criar o CNAME e o TXT

1. Abra: **https://dash.cloudflare.com**
2. Faça login e clique no **domínio** do seu site (ex.: agendeifacil.com.br).
3. No menu da esquerda, clique em **DNS** (ou **Records**).
4. **Criar o CNAME:**
   - Clique em **Add record** (ou **Adicionar registro**).
   - Tipo: **CNAME**.
   - **Name:** `api` (só isso; o Cloudflare já coloca o domínio).
   - **Target:** `yznjqlphqpgddqzwoqvc.supabase.co`
   - **Proxy status:** pode deixar **DNS only** (nuvem cinza) para esse registro.
   - Clique em **Save**.
5. **Criar o TXT:**
   - Clique de novo em **Add record**.
   - Tipo: **TXT**.
   - **Name:** o que o Supabase mostrou; em geral é `_acme-challenge.api` (só a parte antes do seu domínio).
   - **Content:** cole **exatamente** o valor que o Supabase mostrou (sem espaços no começo ou no fim).
   - Clique em **Save**.
6. Espere **2 a 5 minutos** e vá para o passo 3.

---

## PASSO 3 – Supabase: verificar e ativar

1. Volte na **aba do Supabase** (Project Settings → Custom Domains).
2. Deve ter um botão **Verify** ou **Reverify**. Clique nele.
3. Se aparecer que está tudo certo, clique em **Activate** (ou **Activate custom domain**).
4. Pode levar alguns minutos. Quando ativar, o Supabase vai mostrar que o domínio **https://api.agendeifacil.com.br** está ativo.
5. Anote essa URL: **https://api.agendeifacil.com.br** (ou a que você usou).

---

## PASSO 4 – Netlify: mudar a URL do Supabase

1. Abra: **https://app.netlify.com**
2. Faça login e clique no **site** do Agendei Fácil.
3. No menu de cima, clique em **Site configuration** (ou **Configuração do site**).
4. No menu da esquerda, clique em **Environment variables** (ou **Variáveis de ambiente**).
5. Procure a variável **VITE_SUPABASE_URL**.
   - Clique nos três pontinhos ao lado → **Edit** (ou **Edit variables**).
   - **Valor antigo:** `https://yznjqlphqpgddqzwoqvc.supabase.co`
   - **Valor novo:** `https://api.agendeifacil.com.br`  
     (use a URL que você ativou no passo 3; se usou outro subdomínio, coloque esse).
   - Salve.
6. Procure também a variável **SUPABASE_URL** (se existir).
   - Edite e coloque o **mesmo** valor: `https://api.agendeifacil.com.br`
   - Salve.

**Importante:** não mude **VITE_SUPABASE_ANON_KEY** nem **SUPABASE_SERVICE_ROLE_KEY**. Só a URL.

---

## PASSO 5 – Netlify: fazer um novo deploy

1. Ainda no site na Netlify, na aba **Deploys** (ou **Implantações**).
2. Clique em **Trigger deploy** → **Deploy site** (ou **Clear cache and deploy site**).
3. Espere o deploy terminar (alguns minutos).
4. Depois, teste o site: abra o seu domínio no celular ou no PC e faça login.

---

## Resumo

| Onde       | O que fazer |
|-----------|-------------|
| **Supabase** | Ativar Custom Domain com **api.agendeifacil.com.br** (ou api.seudominio.com.br). |
| **Cloudflare** | Criar registro **CNAME** `api` → `yznjqlphqpgddqzwoqvc.supabase.co` e **TXT** que o Supabase pedir. |
| **Netlify** | Em **Environment variables**, trocar **VITE_SUPABASE_URL** e **SUPABASE_URL** para **https://api.agendeifacil.com.br**. |
| **Netlify** | **Trigger deploy** para o site usar a nova URL. |

Depois disso, você e todos os clientes passam a usar o domínio seu em vez do supabase.co, sem precisar mudar nada no Windows nem no celular.
