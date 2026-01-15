# 🚀 Deploy Mercado Pago em Produção

## 📋 Checklist de Configuração

### 1. ✅ Netlify Functions Criadas

As seguintes functions foram criadas:
- `netlify/functions/mercadopago-oauth-authorize.ts`
- `netlify/functions/mercadopago-oauth-callback.ts`
- `netlify/functions/mercadopago-create-payment.ts`
- `netlify/functions/mercadopago-check-status.ts`

### 2. ✅ Redirects Configurados

Os redirects foram adicionados no `netlify.toml`:
- `/api/mercadopago/oauth/authorize` → `/.netlify/functions/mercadopago-oauth-authorize`
- `/api/mercadopago/oauth/callback` → `/.netlify/functions/mercadopago-oauth-callback`
- `/api/mercadopago/create-payment` → `/.netlify/functions/mercadopago-create-payment`
- `/api/mercadopago/check-status` → `/.netlify/functions/mercadopago-check-status`

### 3. 🔧 Configurar Variáveis de Ambiente no Netlify

Acesse o painel do Netlify → Site settings → Environment variables e adicione:

```env
# Mercado Pago OAuth
MERCADOPAGO_CLIENT_ID=5770063872135617
MERCADOPAGO_CLIENT_SECRET=seu_client_secret_aqui
MERCADOPAGO_REDIRECT_URI=https://seu-dominio.netlify.app/api/mercadopago/oauth/callback

# URLs da API (opcional, padrões já configurados)
MERCADOPAGO_API_BASE_URL=https://api.mercadopago.com
MERCADOPAGO_AUTH_BASE_URL=https://auth.mercadopago.com.br

# URLs de redirecionamento após OAuth (opcional)
MERCADOPAGO_SUCCESS_REDIRECT_URL=https://seu-dominio.netlify.app/dashboard?mp_connected=true
MERCADOPAGO_ERROR_REDIRECT_URL=https://seu-dominio.netlify.app/dashboard?mp_error=true
```

**⚠️ IMPORTANTE:** Substitua `seu-dominio.netlify.app` pelo seu domínio real do Netlify!

### 4. 🔗 Configurar Redirect URI no Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Vá em **"URLs de redirecionamento"** ou **"Redirect URIs"**
4. Adicione a URL de produção:
   ```
   https://seu-dominio.netlify.app/api/mercadopago/oauth/callback
   ```
5. **Para desenvolvimento local** (opcional, se quiser testar localhost):
   ```
   http://localhost:3001/api/mercadopago/oauth/callback
   ```

### 5. 🗄️ Executar Migração SQL no Supabase

Execute a migração para adicionar os campos no banco:

```sql
-- Arquivo: supabase/migrations/20260115_add_mercadopago_fields.sql
```

Ou execute diretamente no Supabase SQL Editor:

```sql
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS mercadopago_user_id TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_access_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_token_expires_at TIMESTAMPTZ;
```

### 6. 🚀 Fazer Deploy

```bash
# Commit e push das mudanças
git add .
git commit -m "feat: Adiciona integração Mercado Pago Marketplace"
git push origin main

# O Netlify fará deploy automaticamente
```

### 7. ✅ Testar em Produção

Após o deploy:

1. **Testar OAuth:**
   ```
   GET https://seu-dominio.netlify.app/api/mercadopago/oauth/authorize?establishmentId=SEU_ID
   ```

2. **Verificar callback:**
   - Autorize no Mercado Pago
   - Deve redirecionar para a URL de sucesso
   - Tokens devem estar salvos no banco

3. **Testar criação de pagamento:**
   ```
   POST https://seu-dominio.netlify.app/api/mercadopago/create-payment
   ```

## 🔍 Verificações Pós-Deploy

- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Redirect URI configurado no painel do Mercado Pago
- [ ] Migração SQL executada no Supabase
- [ ] Deploy concluído no Netlify
- [ ] Rota `/api/mercadopago/oauth/authorize` respondendo
- [ ] OAuth funcionando (testar autorização)
- [ ] Tokens sendo salvos no banco após callback
- [ ] Criação de pagamento funcionando

## 📝 Notas Importantes

1. **Domínio:** Certifique-se de usar o domínio correto do Netlify em todas as configurações
2. **HTTPS:** O Mercado Pago exige HTTPS em produção (o Netlify já fornece)
3. **Variáveis:** Nunca commite o `.env` com valores reais no Git
4. **Client Secret:** Mantenha o `MERCADOPAGO_CLIENT_SECRET` seguro

## 🆘 Troubleshooting

### Erro: "redirect_uri_mismatch"
- Verifique se a URL no Netlify está EXATAMENTE igual à configurada no Mercado Pago
- URLs são case-sensitive

### Erro: "invalid_client"
- Verifique se `MERCADOPAGO_CLIENT_ID` e `MERCADOPAGO_CLIENT_SECRET` estão corretos
- Verifique se as variáveis foram salvas no Netlify

### Callback não funciona
- Verifique os logs do Netlify Functions
- Confirme que a migração SQL foi executada
- Verifique se o Supabase está acessível
