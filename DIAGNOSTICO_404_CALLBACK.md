# 🔍 Diagnóstico 404 - Callback Mercado Pago

## ❌ Problema Atual

URL retorna 404:
```
https://agendeifacil.com/api/mercadopago/oauth/callback?code=TG-69693b3c1aa7e40001856586-3137348940&state=7fc0782a-5890-4c69-8572-91a05d16d0bd
```

## ✅ Checklist de Verificação

### **1. Verificar se Functions foram Deployadas**

**No painel do Netlify:**
1. Acesse: https://app.netlify.com
2. Selecione seu site
3. Vá em **Functions** (menu lateral)
4. Procure por `mercadopago-oauth-callback`

**Se NÃO aparecer:** A function não foi deployada → Fazer commit e push

### **2. Verificar Último Deploy**

1. No Netlify, vá em **Deploys**
2. Veja o último deploy
3. Clique nele para ver detalhes
4. Verifique se houve erros no build

**Se houver erros:** Corrija e faça novo deploy

### **3. Testar Function Diretamente**

Teste se a function está acessível (no console do navegador):

```javascript
fetch('https://agendeifacil.com/.netlify/functions/mercadopago-oauth-callback?code=test&state=test')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error)
```

**Resultados:**
- **404:** Function não deployada
- **JSON (erro):** Function funcionando, mas com erro
- **Redirect 302:** Function OK ✅

### **4. Verificar Logs**

1. No Netlify → **Functions** → `mercadopago-oauth-callback`
2. Clique em **View logs**
3. Tente acessar a URL novamente
4. Veja se aparecem logs

**Se não aparecer logs:** Function não está sendo chamada (problema de redirect)

### **5. Verificar Redirect no netlify.toml**

Confirme que o redirect está ANTES do catch-all:

```toml
[[redirects]]
  from = "/api/mercadopago/oauth/callback"
  to = "/.netlify/functions/mercadopago-oauth-callback"
  status = 200
  force = true
  methods = ["GET", "POST", "OPTIONS"]

# Catch-all DEVE VIR DEPOIS
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 🚀 Solução Imediata

**Se a function não foi deployada:**

```bash
git add .
git commit -m "fix: Adiciona callback Mercado Pago"
git push origin main
```

**Aguarde 2-3 minutos** para o Netlify fazer deploy.

**Depois, verifique:**
1. Functions aparecem no painel?
2. Teste a URL novamente
3. Veja os logs

## ⚠️ Possível Causa

O mais provável é que **as functions do Mercado Pago não foram deployadas ainda**. 

As functions só aparecem no Netlify após:
1. ✅ Commit no Git
2. ✅ Push para o repositório
3. ✅ Netlify fazer build e deploy

Se você acabou de criar os arquivos e não fez commit/push, elas não existem em produção ainda.
