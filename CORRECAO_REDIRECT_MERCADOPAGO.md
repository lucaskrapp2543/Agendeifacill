# 🔧 Correção Redirect Mercado Pago

## ✅ Problemas Corrigidos

### 1. Query Params Case-Insensitive
**Problema:** A URL pode vir com `establishmentid` (minúsculo) mas o código buscava `establishmentId` (camelCase).

**Solução:** Atualizado `netlify/functions/_utils.ts` para buscar query params de forma case-insensitive.

### 2. Redirects Mais Robustos
**Problema:** Redirects específicos podem não estar capturando todas as variações.

**Solução:** 
- Adicionado `POST` aos métodos permitidos (além de `GET`)
- Adicionado redirect genérico `/api/mercadopago/*` como fallback

## 📝 Mudanças Aplicadas

### `netlify/functions/_utils.ts`
```typescript
// ANTES: Busca case-sensitive
export function getQueryParam(event: HandlerEvent, key: string): string | null {
  return (event.queryStringParameters && event.queryStringParameters[key]) || null;
}

// DEPOIS: Busca case-insensitive
export function getQueryParam(event: HandlerEvent, key: string): string | null {
  if (!event.queryStringParameters) return null;
  
  const lowerKey = key.toLowerCase();
  for (const [paramKey, value] of Object.entries(event.queryStringParameters)) {
    if (paramKey.toLowerCase() === lowerKey) {
      return value || null;
    }
  }
  return null;
}
```

### `netlify.toml`
- ✅ Adicionado `POST` aos métodos permitidos em todos os redirects
- ✅ Adicionado redirect genérico `/api/mercadopago/*` como fallback

## 🚀 Próximo Passo

**Fazer deploy:**

```bash
git add .
git commit -m "fix: Query params case-insensitive e redirects genéricos para Mercado Pago"
git push origin main
```

## 🔍 Teste Após Deploy

1. **Teste com `/api/mercadopago/oauth/authorize`:**
   ```
   https://agendeifacil.com/api/mercadopago/oauth/authorize?establishmentId=SEU_ID
   ```
   Deve retornar JSON com `authorization_url` (não mais 404)

2. **Teste com parâmetro minúsculo:**
   ```
   https://agendeifacil.com/api/mercadopago/oauth/authorize?establishmentid=SEU_ID
   ```
   Também deve funcionar agora

3. **Verifique no painel Netlify:**
   - Functions devem aparecer em "Functions"
   - Logs devem mostrar requisições chegando

## ⚠️ Importante

Se ainda der 404 após o deploy:
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Aguarde 1-2 minutos após o deploy (Netlify pode levar tempo para propagar redirects)
3. Verifique se o `establishmentId` existe no banco de dados
