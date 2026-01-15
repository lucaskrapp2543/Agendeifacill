# 🚀 Guia Rápido: Deploy Mercado Pago em Produção

## ✅ O que já está pronto:

1. ✅ Netlify Functions criadas (4 functions)
2. ✅ Redirects configurados no `netlify.toml`
3. ✅ Migração SQL criada
4. ✅ Código backend funcionando

## 📝 Passos para colocar em produção:

### **PASSO 1: Obter URL do seu site Netlify**

1. Acesse https://app.netlify.com
2. Selecione seu site
3. Vá em **Site settings** → **Domain management**
4. Copie a URL do seu site (ex: `seu-site-123.netlify.app`)

### **PASSO 2: Configurar Redirect URI no Mercado Pago**

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Vá em **"URLs de redirecionamento"** ou **"Redirect URIs"**
4. Adicione:
   ```
   https://SEU-DOMINIO.netlify.app/api/mercadopago/oauth/callback
   ```
   ⚠️ **Substitua `SEU-DOMINIO` pela URL real do seu site!**

### **PASSO 3: Configurar Variáveis de Ambiente no Netlify**

1. No Netlify, vá em **Site settings** → **Environment variables**
2. Adicione as seguintes variáveis:

```
MERCADOPAGO_CLIENT_ID=5770063872135617
MERCADOPAGO_CLIENT_SECRET=CDbynXjynWkW6Z2EKXF8YXB9Lugr89nU
MERCADOPAGO_REDIRECT_URI=https://SEU-DOMINIO.netlify.app/api/mercadopago/oauth/callback
```

⚠️ **Substitua `SEU-DOMINIO` pela URL real do seu site!**

### **PASSO 4: Executar Migração SQL no Supabase**

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o arquivo: `supabase/migrations/20260115_add_mercadopago_fields.sql`

Ou cole diretamente:

```sql
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS mercadopago_user_id TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_access_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_token_expires_at TIMESTAMPTZ;
```

### **PASSO 5: Fazer Deploy**

```bash
git add .
git commit -m "feat: Adiciona Mercado Pago Marketplace em produção"
git push origin main
```

O Netlify fará deploy automaticamente.

### **PASSO 6: Testar**

Após o deploy, teste:

1. **OAuth:**
   ```
   https://SEU-DOMINIO.netlify.app/api/mercadopago/oauth/authorize?establishmentId=1
   ```

2. **Deve retornar a URL de autorização do Mercado Pago**

3. **Após autorizar, deve redirecionar e salvar os tokens**

## 🔍 Verificar se está funcionando:

1. Acesse a URL de autorização
2. Autorize no Mercado Pago
3. Verifique no Supabase se os tokens foram salvos:
   ```sql
   SELECT id, name, mercadopago_user_id, mercadopago_access_token 
   FROM establishments 
   WHERE mercadopago_user_id IS NOT NULL;
   ```

## ⚠️ Problemas Comuns:

### "redirect_uri_mismatch"
- A URL no Netlify deve ser EXATAMENTE igual à do Mercado Pago
- Verifique se está usando `https://` (não `http://`)
- URLs são case-sensitive

### Variáveis não carregam
- Verifique se salvou as variáveis no Netlify
- Faça um novo deploy após adicionar variáveis
- Verifique os logs do Netlify Functions

### Callback não salva tokens
- Verifique se a migração SQL foi executada
- Verifique os logs do Netlify Functions
- Confirme que o Supabase está acessível

## 📞 Próximos Passos:

Após tudo funcionando:
- [ ] Testar criação de pagamento em produção
- [ ] Configurar webhooks do Mercado Pago (opcional)
- [ ] Adicionar renovação automática de tokens (opcional)
