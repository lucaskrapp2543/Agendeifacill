# 🔍 Como Verificar Erro no Callback Mercado Pago

## ❌ Problema Atual

Após autorizar no Mercado Pago, você é redirecionado para:
```
https://agendeifacil.com/dashboard?mp_error=true
```

Isso significa que a function foi executada, mas houve um erro.

## ✅ Como Diagnosticar

### **1. Verificar Logs da Function no Netlify**

1. Acesse: https://app.netlify.com
2. Selecione seu site
3. Vá em **Functions** → **mercadopago-oauth-callback**
4. Clique em **View logs**
5. Tente conectar novamente
6. Veja os logs que aparecem

**Procure por:**
- `❌ [MP OAuth Callback] Erro completo:` - Mostra detalhes do erro
- `🔄 [MP OAuth Callback] Processando:` - Confirma que chegou na function
- `✅ [MP OAuth Callback] Tokens salvos:` - Confirma sucesso

### **2. Erros Comuns e Soluções**

#### **Erro: "MERCADOPAGO_CLIENT_SECRET não configurado"**
**Solução:** Adicione no Netlify → Site settings → Environment variables:
```
MERCADOPAGO_CLIENT_SECRET=seu_secret_aqui
```

#### **Erro: "redirect_uri_mismatch"**
**Solução:** Verifique se a URL no painel do Mercado Pago está exatamente:
```
https://agendeifacil.com/api/mercadopago/oauth/callback
```

#### **Erro: "Supabase admin não configurado"**
**Solução:** Adicione no Netlify:
```
SUPABASE_URL=sua_url_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_key_aqui
```

#### **Erro: "Estabelecimento não encontrado"**
**Solução:** O `state` (establishmentId) não existe no banco. Verifique se o ID está correto.

#### **Erro: "invalid_grant" ou "invalid_code"**
**Solução:** O código de autorização expirou ou já foi usado. Tente conectar novamente.

### **3. Testar Manualmente**

No console do navegador, teste a function diretamente:

```javascript
fetch('https://agendeifacil.com/.netlify/functions/mercadopago-oauth-callback?code=test&state=SEU_ESTABLISHMENT_ID')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error)
```

Isso mostrará o erro exato que está acontecendo.

## 📝 Próximos Passos

1. **Verifique os logs** no Netlify (passo 1 acima)
2. **Copie o erro completo** que aparecer
3. **Corrija** conforme as soluções acima
4. **Teste novamente**

Os logs agora mostram mais detalhes para facilitar o diagnóstico.
