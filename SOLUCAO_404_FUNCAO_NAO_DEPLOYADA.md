# 🚨 Solução: Função 404 - Não Deployada

## ❌ Problema

A função `mercadopago-get-payment-method` está retornando **404** mesmo usando URL direta:
```
POST https://agendeifacil.com/.netlify/functions/mercadopago-get-payment-method
404 (Not Found)
```

## ✅ Solução: Verificar Deploy no Netlify

### **1. Verificar se a Função foi Deployada**

**No painel do Netlify:**
1. Acesse: https://app.netlify.com
2. Selecione seu site: `agendeifacil.com`
3. Vá em **Functions** (menu lateral esquerdo)
4. Procure por `mercadopago-get-payment-method`

**Se NÃO aparecer:**
- ❌ A função **NÃO foi deployada**
- ✅ **Solução:** Fazer deploy manual

**Se aparecer:**
- ✅ A função está deployada
- ⚠️ Pode ser cache ou deploy ainda não aplicado

---

### **2. Forçar Deploy Manual**

**No painel do Netlify:**
1. Vá em **Deploys**
2. Clique em **Trigger deploy** → **Deploy site**
3. Aguarde o build completar (2-3 minutos)
4. Verifique se a função aparece em **Functions**

---

### **3. Verificar Último Deploy**

1. No Netlify → **Deploys**
2. Veja o último deploy
3. Clique nele para ver detalhes
4. Verifique:
   - **Status:** Deve estar "Published" (verde)
   - **Functions:** Deve listar `mercadopago-get-payment-method`
   - **Build Log:** Verifique se há erros de build

**Se houver erros:**
- ❌ Corrija os erros e faça novo deploy

---

### **4. Testar Após Deploy**

Após o deploy completar, teste novamente no console:

```javascript
fetch('https://agendeifacil.com/.netlify/functions/mercadopago-get-payment-method', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bin: '550209' })
})
  .then(async r => {
    console.log('Status:', r.status);
    const data = await r.json();
    console.log('Resposta:', data);
  })
  .catch(err => console.error('Erro:', err));
```

**Resultados esperados:**
- ✅ **200 + JSON:** Função funcionando ✅
- ❌ **404:** Função ainda não deployada → Fazer deploy manual
- ❌ **500:** Função OK mas `MERCADOPAGO_ACCESS_TOKEN` não configurado

---

## 🚀 Ação Imediata

**Faça isso AGORA:**

1. **No Netlify:** Deploys → Trigger deploy → Deploy site
2. **Aguarde 2-3 minutos** para o build completar
3. **Verifique:** Functions → `mercadopago-get-payment-method` aparece?
4. **Teste novamente** o pagamento no cartão

---

## ⚠️ Importante

**A função só existe em produção após:**
1. ✅ Commit no Git (já feito)
2. ✅ Push para o repositório (já feito)
3. ✅ Netlify fazer build e deploy (pode estar pendente)

**Se você acabou de fazer commit/push, aguarde o deploy automático ou force um deploy manual.**
