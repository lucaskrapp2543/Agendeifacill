# ✅ Verificar Configuração no Painel do Mercado Pago

## 🔍 O que verificar

Baseado nos logs, o OAuth está funcionando! Mas você precisa confirmar que a **URL de redirect** está configurada corretamente no painel do Mercado Pago.

## 📝 Passo a Passo

### **1. Acessar o Painel do Mercado Pago**

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Faça login com sua conta do Mercado Pago
3. Selecione sua aplicação (Client ID: `5770063872135617`)

### **2. Verificar URLs de Redirecionamento**

1. Procure por **"URLs de redirecionamento"** ou **"Redirect URIs"**
2. Verifique se está cadastrada a URL de **produção**:

```
https://agendeifacil.com/api/mercadopago/oauth/callback
```

⚠️ **IMPORTANTE:**
- A URL deve ser **EXATAMENTE** igual (case-sensitive)
- Deve incluir `https://`
- Não pode ter barra no final (`/`)

### **3. Se NÃO estiver cadastrada:**

1. Clique em **"Adicionar URL"** ou **"Add Redirect URI"**
2. Cole: `https://agendeifacil.com/api/mercadopago/oauth/callback`
3. Salve as alterações

### **4. URLs que podem estar cadastradas:**

Você pode ter **múltiplas URLs** cadastradas:

✅ **Produção:**
```
https://agendeifacil.com/api/mercadopago/oauth/callback
```

✅ **Desenvolvimento (opcional):**
```
http://localhost:3001/api/mercadopago/oauth/callback
```

## ✅ Como saber se está correto?

Se os logs mostram:
- ✅ `Token obtido com sucesso`
- ✅ `Tokens salvos`

**Então a configuração está correta!** 🎉

O problema de múltiplas chamadas já foi corrigido no código, então após o próximo deploy, tudo deve funcionar perfeitamente.

## 🔧 Se ainda der erro "redirect_uri_mismatch"

1. Verifique se a URL no Netlify (variável `MERCADOPAGO_REDIRECT_URI`) está **EXATAMENTE** igual à do painel
2. URLs são case-sensitive - verifique maiúsculas/minúsculas
3. Não pode ter espaços ou caracteres especiais

## 📝 Resumo

**Você precisa verificar:**
- ✅ URL `https://agendeifacil.com/api/mercadopago/oauth/callback` está cadastrada no painel do Mercado Pago

**Se já estiver cadastrada:**
- ✅ Tudo certo! Não precisa fazer mais nada no Mercado Pago
- ✅ Apenas aguarde o deploy das correções do código
