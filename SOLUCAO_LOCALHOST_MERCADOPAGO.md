# 🔧 Solução: Erro Mercado Pago em Localhost

## ❌ Problema

Ao clicar em "Conectar conta Mercado Pago" em localhost, aparece erro genérico do Mercado Pago.

**Causa:** O `redirect_uri` configurado no painel do Mercado Pago não inclui `http://localhost:3001`.

## ✅ Solução

### **Passo 1: Adicionar localhost no Painel do Mercado Pago**

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação (Client ID: `5770063872135617`)
3. Vá em **"URLs de redirecionamento"** ou **"Redirect URIs"**
4. Adicione **AMBAS** as URLs:

```
http://localhost:3001/api/mercadopago/oauth/callback
https://agendeifacil.com/api/mercadopago/oauth/callback
```

⚠️ **IMPORTANTE:** O Mercado Pago permite múltiplas URLs. Adicione as duas!

### **Passo 2: Verificar .env**

Confirme que seu `.env` tem:

```env
MERCADOPAGO_REDIRECT_URI=http://localhost:3001/api/mercadopago/oauth/callback
```

### **Passo 3: Reiniciar o servidor**

Após adicionar a URL no painel do Mercado Pago:

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
npm run dev:api
```

## 🔍 Como Verificar se Funcionou

1. Clique em "Conectar conta Mercado Pago" no dashboard
2. Deve abrir a página de autorização do Mercado Pago (não mais o erro)
3. Após autorizar, deve redirecionar para `http://localhost:3001/api/mercadopago/oauth/callback`

## 📝 Nota

- **Desenvolvimento:** Use `http://localhost:3001/api/mercadopago/oauth/callback`
- **Produção:** Use `https://agendeifacil.com/api/mercadopago/oauth/callback`

O Mercado Pago permite ter múltiplas URLs cadastradas, então você pode ter ambas configuradas ao mesmo tempo.
