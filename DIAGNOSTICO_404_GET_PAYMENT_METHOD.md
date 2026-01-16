# 🔍 Diagnóstico 404 - get-payment-method

## ❌ Problema Atual

URL retorna 404 em **outro computador** (não é cache):
```
POST https://agendeifacil.com/api/mercadopago/get-payment-method
```

## ✅ Checklist de Verificação no Netlify

### **1. Verificar se a Função foi Deployada**

**No painel do Netlify:**
1. Acesse: https://app.netlify.com
2. Selecione seu site: `agendeifacil.com`
3. Vá em **Functions** (menu lateral esquerdo)
4. Procure por `mercadopago-get-payment-method`

**Se NÃO aparecer:**
- ❌ A função não foi deployada
- ✅ **Solução:** Fazer novo deploy completo

**Se aparecer:**
- ✅ A função está deployada
- ⚠️ Verificar próximo passo

---

### **2. Verificar Último Deploy**

1. No Netlify, vá em **Deploys**
2. Veja o último deploy (deve ser o commit `489994d` ou mais recente)
3. Clique nele para ver detalhes
4. Verifique:
   - **Status:** Deve estar "Published" (verde)
   - **Functions:** Deve listar `mercadopago-get-payment-method`
   - **Build Log:** Verifique se há erros de build

**Se houver erros:**
- ❌ Corrija os erros e faça novo deploy

**Se não houver erros mas função não aparece:**
- ⚠️ Verificar próximo passo

---

### **3. Testar Function Diretamente**

Teste se a function está acessível (no console do navegador):

```javascript
// Testar diretamente a função (sem redirect)
fetch('https://agendeifacil.com/.netlify/functions/mercadopago-get-payment-method', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bin: '550209' })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**Resultados:**
- **404:** Function não deployada ou não encontrada
- **500 (erro de configuração):** Function deployada mas `MERCADOPAGO_ACCESS_TOKEN` não configurado
- **200 (JSON com payment_method_id):** Function OK ✅

---

### **4. Verificar Redirect**

Teste se o redirect está funcionando:

```javascript
// Testar via redirect
fetch('https://agendeifacil.com/api/mercadopago/get-payment-method', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bin: '550209' })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**Resultados:**
- **404:** Redirect não configurado ou `_redirects` não foi copiado para `dist/`
- **200 (JSON):** Redirect OK ✅

---

### **5. Verificar Arquivo _redirects no Deploy**

1. No Netlify → **Deploys** → Último deploy
2. Clique em **Browse published files** ou **View deploy**
3. Procure por `_redirects` na raiz do deploy
4. Abra o arquivo e verifique se contém:
   ```
   /api/mercadopago/get-payment-method /.netlify/functions/mercadopago-get-payment-method 200
   ```

**Se NÃO existir:**
- ❌ O arquivo `public/_redirects` não foi copiado para `dist/`
- ✅ **Solução:** Verificar build do Vite

**Se existir mas sem a linha:**
- ❌ O arquivo não foi atualizado
- ✅ **Solução:** Fazer novo deploy

---

### **6. Verificar Logs da Function**

1. No Netlify → **Functions** → `mercadopago-get-payment-method`
2. Clique em **View logs**
3. Tente fazer um pagamento novamente
4. Veja se aparecem logs

**Se não aparecer logs:**
- ❌ Function não está sendo chamada (problema de redirect)

**Se aparecer logs:**
- ✅ Function está sendo chamada
- ⚠️ Verificar o erro específico nos logs

---

## 🚀 Soluções Rápidas

### **Solução 1: Forçar Deploy Completo**

No painel do Netlify:
1. **Deploys** → **Trigger deploy** → **Deploy site**
2. Aguarde o build completar
3. Verifique se a função aparece em **Functions**

### **Solução 2: Verificar Build Local**

Teste localmente se o build está copiando o `_redirects`:

```bash
npm run build
# Verificar se dist/_redirects existe e contém a rota
```

### **Solução 3: Verificar Variável de Ambiente**

No painel do Netlify:
1. **Site settings** → **Environment variables**
2. Verifique se `MERCADOPAGO_ACCESS_TOKEN` está configurada
3. Se não estiver, adicione e faça novo deploy

---

## 📋 Resumo do Que Fazer Agora

1. ✅ Verificar no Netlify se a função `mercadopago-get-payment-method` aparece em **Functions**
2. ✅ Verificar se o último deploy está "Published" (verde)
3. ✅ Testar a função diretamente: `/.netlify/functions/mercadopago-get-payment-method`
4. ✅ Verificar se `_redirects` existe no deploy publicado
5. ✅ Verificar se `MERCADOPAGO_ACCESS_TOKEN` está configurada

**Me avise o resultado de cada verificação!**
