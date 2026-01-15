# 🔧 Variáveis de ambiente (Mercado Pago) — Exemplo

> ⚠️ **Não commite seu `.env` real.**  
> Use este arquivo só como referência do que configurar no **localhost** e no **Netlify**.

## Frontend (Vite) - Tokenização de Cartão

```bash
# Chave pública (APP_USR-...) usada para tokenizar cartão no navegador
# Esta chave é SEGURA para usar no frontend (não é a Access Token)
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Backend (Express / Netlify Functions)

```bash
# Client ID e Client Secret para OAuth
MERCADOPAGO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADOPAGO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# (Opcional) URL base da API (padrão: https://api.mercadopago.com)
#MERCADOPAGO_API_BASE_URL=https://api.mercadopago.com
```

## Onde pegar a `VITE_MERCADOPAGO_PUBLIC_KEY`

1. Acesse o [Painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app)
2. Vá em **Suas integrações** → Selecione sua aplicação
3. Vá em **Credenciais de produção** (ou **Credenciais de teste** para desenvolvimento)
4. Copie a **Chave pública** que começa com `APP_USR-`

⚠️ **IMPORTANTE:**
- Use **Credenciais de teste** para desenvolvimento local
- Use **Credenciais de produção** apenas quando for fazer deploy
- A chave pública é segura para usar no frontend (não é a Access Token)

## Exemplo completo do `.env` (local)

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Mercado Pago - Frontend (Tokenização de Cartão)
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Mercado Pago - Backend (OAuth)
MERCADOPAGO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADOPAGO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Configuração no Netlify (Produção)

1. Acesse o [Painel do Netlify](https://app.netlify.com)
2. Vá em **Site settings** → **Environment variables**
3. Adicione as variáveis:

### Variáveis para o Frontend (Build):
- `VITE_MERCADOPAGO_PUBLIC_KEY` = `APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Variáveis para as Functions (Backend):
- `MERCADOPAGO_CLIENT_ID` = `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- `MERCADOPAGO_CLIENT_SECRET` = `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

⚠️ **IMPORTANTE:** Após adicionar as variáveis no Netlify, faça um novo deploy para que as mudanças tenham efeito.

## Diferença entre as chaves

- **`VITE_MERCADOPAGO_PUBLIC_KEY`** (APP_USR-...): Usada no **frontend** para tokenizar cartões. É segura para expor no código.
- **`MERCADOPAGO_CLIENT_ID`** e **`MERCADOPAGO_CLIENT_SECRET`**: Usadas no **backend** para OAuth (conectar contas de vendedores). NUNCA exponha no frontend.
- **`mercadopago_access_token`**: Armazenado no banco de dados após OAuth. Cada estabelecimento tem o seu próprio token.
