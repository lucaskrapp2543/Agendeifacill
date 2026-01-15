# 🔧 Correção 404 - Mercado Pago

## ❌ Problema Identificado

As rotas `/api/mercadopago/*` retornavam 404 porque:
- As Netlify Functions importavam de `../../server/mercadopago/`
- O diretório `server/` NÃO está incluído no build do Netlify
- As functions não conseguiam encontrar os módulos

## ✅ Solução Aplicada

### 1. Código Movido para `src/lib/mercadopago/`

**Arquivos criados:**
- ✅ `src/lib/mercadopago/mp-oauth.ts` (copiado de `server/mercadopago/mp.oauth.ts`)
- ✅ `src/lib/mercadopago/mp-service.ts` (copiado de `server/mercadopago/mp.service.ts`)

**Motivo:** O diretório `src/` está incluído no build, então as Netlify Functions conseguem importar.

### 2. Imports Atualizados nas Netlify Functions

**Arquivos corrigidos:**
- ✅ `netlify/functions/mercadopago-oauth-authorize.ts`
  - ANTES: `from '../../server/mercadopago/mp.oauth'`
  - DEPOIS: `from '../../src/lib/mercadopago/mp-oauth'`

- ✅ `netlify/functions/mercadopago-oauth-callback.ts`
  - ANTES: `from '../../server/mercadopago/mp.oauth'`
  - DEPOIS: `from '../../src/lib/mercadopago/mp-oauth'`

- ✅ `netlify/functions/mercadopago-create-payment.ts`
  - ANTES: `from '../../server/mercadopago/mp.service'`
  - DEPOIS: `from '../../src/lib/mercadopago/mp-service'`

- ✅ `netlify/functions/mercadopago-check-status.ts`
  - ANTES: `from '../../server/mercadopago/mp.service'`
  - DEPOIS: `from '../../src/lib/mercadopago/mp-service'`

### 3. Server Local Atualizado

- ✅ `server/mercadopago/mp.routes.ts` também atualizado para usar `src/lib/mercadopago/`
- ✅ Mantém compatibilidade com servidor local

## ✅ Verificações Finais

### netlify.toml
- ✅ `[functions] directory = "netlify/functions"` - CORRETO
- ✅ Redirects configurados ANTES do catch-all - CORRETO
- ✅ Rotas do Mercado Pago mapeadas corretamente - CORRETO

### Estrutura de Arquivos
- ✅ Functions em `netlify/functions/` - CORRETO
- ✅ Código em `src/lib/mercadopago/` - CORRETO
- ✅ Nomes dos arquivos correspondem aos redirects - CORRETO

## 🚀 Próximo Passo

**Fazer deploy:**

```bash
git add .
git commit -m "fix: Move Mercado Pago para src/lib para corrigir 404 no Netlify"
git push origin main
```

Após o deploy, as rotas devem funcionar em:
- `https://agendeifacil.com/api/mercadopago/oauth/authorize`
- `https://agendeifacil.com/api/mercadopago/oauth/callback`
- `https://agendeifacil.com/api/mercadopago/create-payment`
- `https://agendeifacil.com/api/mercadopago/check-status`

## 🔍 Como Verificar Após Deploy

1. Acesse: `https://agendeifacil.com/api/mercadopago/oauth/authorize?establishmentId=1`
2. Deve retornar JSON com `authorization_url` (não mais 404)
3. No painel Netlify → Functions, devem aparecer as 4 functions do Mercado Pago
