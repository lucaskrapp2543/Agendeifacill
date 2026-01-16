# 🧪 Teste Direto da Função (Sem Redirect)

## ✅ Função está Deployada

A função `mercadopago-get-payment-method` está listada no Netlify (confirmado pela imagem).

## 🔍 Teste 1: Função Direta (Sem Redirect)

Abra o console do navegador (F12) e execute:

```javascript
// Testar diretamente a função (sem passar pelo redirect)
fetch('https://agendeifacil.com/.netlify/functions/mercadopago-get-payment-method', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bin: '550209' })
})
  .then(async r => {
    console.log('Status:', r.status);
    const data = await r.json();
    console.log('Resposta:', data);
    return data;
  })
  .catch(err => {
    console.error('Erro:', err);
  });
```

**Resultados esperados:**
- ✅ **200 + JSON com payment_method_id e issuer_id:** Função OK, problema é o redirect
- ❌ **404:** Função não está acessível (problema de deploy)
- ❌ **500:** Função OK mas `MERCADOPAGO_ACCESS_TOKEN` não configurado

---

## 🔍 Teste 2: Redirect (Via /api/)

```javascript
// Testar via redirect
fetch('https://agendeifacil.com/api/mercadopago/get-payment-method', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bin: '550209' })
})
  .then(async r => {
    console.log('Status:', r.status);
    const data = await r.json();
    console.log('Resposta:', data);
    return data;
  })
  .catch(err => {
    console.error('Erro:', err);
  });
```

**Resultados esperados:**
- ✅ **200 + JSON:** Redirect funcionando ✅
- ❌ **404:** Redirect não está funcionando (problema no `_redirects` ou `netlify.toml`)

---

## 🔍 Teste 3: Verificar _redirects no Deploy

No painel do Netlify:
1. **Deploys** → Último deploy
2. Clique em **Browse published files** ou **View deploy**
3. Procure por `_redirects` na raiz
4. Abra e verifique se contém:
   ```
   /api/mercadopago/get-payment-method /.netlify/functions/mercadopago-get-payment-method 200
   ```

**Se NÃO existir:**
- ❌ O `public/_redirects` não foi copiado para `dist/`
- ✅ **Solução:** Verificar build do Vite

---

## 🚀 Próximos Passos

1. Execute o **Teste 1** e me diga o resultado
2. Execute o **Teste 2** e me diga o resultado
3. Verifique o **Teste 3** no painel do Netlify

Com esses resultados, vou saber exatamente onde está o problema!
