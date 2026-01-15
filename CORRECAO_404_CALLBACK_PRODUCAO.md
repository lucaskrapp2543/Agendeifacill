# 🔧 Correção 404 - Callback Mercado Pago em Produção

## ❌ Problema

Ao clicar em "Conectar conta Mercado Pago" em produção, após autorizar no Mercado Pago, a URL de callback retorna **404**:

```
https://agendeifacil.com/api/mercadopago/oauth/callback?code=...&state=...
```

## ✅ Soluções Possíveis

### **1. Verificar se as Functions foram Deployadas**

As Netlify Functions precisam ser deployadas. Verifique:

1. Acesse: https://app.netlify.com
2. Vá em seu site → **Functions**
3. Procure por:
   - `mercadopago-oauth-authorize`
   - `mercadopago-oauth-callback`
   - `mercadopago-create-payment`
   - `mercadopago-check-status`

**Se NÃO aparecerem:** As functions não foram deployadas ainda.

### **2. Fazer Deploy das Functions**

```bash
git add .
git commit -m "feat: Adiciona Mercado Pago OAuth callback"
git push origin main
```

Aguarde o Netlify fazer o deploy (1-3 minutos).

### **3. Verificar Logs do Netlify**

1. No Netlify, vá em **Functions** → **mercadopago-oauth-callback**
2. Clique em **View logs**
3. Tente acessar a URL novamente
4. Veja se há erros nos logs

### **4. Verificar Build do Netlify**

1. No Netlify, vá em **Deploys**
2. Veja o último deploy
3. Verifique se houve erros no build
4. Se houver erros, corrija e faça novo deploy

### **5. Verificar Variáveis de Ambiente**

No Netlify, vá em **Site settings** → **Environment variables** e confirme que tem:

```
MERCADOPAGO_CLIENT_ID=5770063872135617
MERCADOPAGO_CLIENT_SECRET=seu_secret_aqui
MERCADOPAGO_REDIRECT_URI=https://agendeifacil.com/api/mercadopago/oauth/callback
SUPABASE_URL=sua_url_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_key_aqui
```

### **6. Testar Diretamente a Function**

Teste se a function está acessível:

```
https://agendeifacil.com/.netlify/functions/mercadopago-oauth-callback?code=test&state=test
```

- Se retornar JSON (mesmo que erro), a function está funcionando
- Se retornar 404, a function não foi deployada

## 🔍 Diagnóstico Rápido

Execute no console do navegador (na página de produção):

```javascript
fetch('https://agendeifacil.com/.netlify/functions/mercadopago-oauth-callback?code=test&state=test')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error)
```

**Resultados possíveis:**
- **404:** Function não deployada → Fazer commit e push
- **JSON com erro:** Function funcionando, mas com erro de validação → Verificar logs
- **Redirect 302:** Function funcionando corretamente ✅

## 🚀 Próximo Passo

**Se as functions não aparecem no painel do Netlify:**

1. Confirme que fez commit e push de todos os arquivos
2. Aguarde o deploy completar
3. Verifique se as functions aparecem em **Functions**
4. Teste novamente a URL de callback
