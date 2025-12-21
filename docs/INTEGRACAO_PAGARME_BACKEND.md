# 🔐 Integração Pagar.me - Backend

## ⚠️ IMPORTANTE: Segurança

**A chave `PAGARME_SECRET_KEY` NUNCA deve ser exposta ao frontend!**

- ✅ Use apenas em: Edge Functions, Serverless Functions, API Routes
- ❌ NUNCA use em: Componentes React, páginas do frontend, arquivos públicos

## 📁 Arquivos Criados

### 1. `src/lib/pagarme-server.ts`
Arquivo principal de integração com Pagar.me v5.

**Características:**
- Lê `PAGARME_SECRET_KEY` de `process.env` (variável de servidor)
- Usa API Pagar.me v5 (`/core/v5`)
- Funções exportadas:
  - `createRecipient()` - Criar conta de recebimento
  - `createPayment()` - Criar pagamento
  - `checkPaymentStatus()` - Verificar status

### 2. `src/pages/api/pagarme/create-recipient.ts`
API Route para criar recebedor.

**Endpoint:** `POST /api/pagarme/create-recipient`

**Body:**
```json
{
  "cpfCnpj": "12345678900",
  "bankName": "Banco do Brasil",
  "agency": "1234",
  "account": "12345678-9",
  "accountType": "conta_corrente",
  "legalName": "Nome do Estabelecimento"
}
```

### 3. `src/pages/api/pagarme/create-payment.ts`
API Route para criar pagamento.

**Endpoint:** `POST /api/pagarme/create-payment`

**Body:**
```json
{
  "amount": 100.00,
  "payment_method": "pix",
  "customer": {
    "name": "Cliente",
    "email": "cliente@email.com",
    "document": "12345678900",
    "phone": "11999999999"
  },
  "split": [
    {
      "recipient_id": "re_xxx",
      "amount": 9900,
      "type": "flat"
    }
  ],
  "metadata": {
    "appointment_id": "uuid"
  }
}
```

### 4. `src/pages/api/pagarme/check-status.ts`
API Route para verificar status.

**Endpoint:** `GET /api/pagarme/check-status?orderId=xxx`

## 🔧 Configuração

### 1. Variável de Ambiente

Adicione no seu servidor/plataforma:

```bash
PAGARME_SECRET_KEY=sua_chave_secreta_aqui
```

**Onde configurar:**
- **Vercel:** Settings → Environment Variables
- **Netlify:** Site settings → Environment variables
- **Supabase Edge Functions:** Dashboard → Edge Functions → Settings
- **Servidor próprio:** `.env` no servidor (nunca commitar!)

### 2. Verificar se está funcionando

```typescript
// Em um arquivo de servidor (não frontend!)
import { createRecipient } from '@/lib/pagarme-server';

// Testar
const result = await createRecipient({
  cpfCnpj: '12345678900',
  bankName: 'Banco do Brasil',
  agency: '1234',
  account: '12345678-9',
  legalName: 'Teste',
});
```

## 🚫 O que NÃO fazer

```typescript
// ❌ ERRADO - Nunca faça isso no frontend!
import { createRecipient } from '@/lib/pagarme-server';
// Isso expõe a chave secreta!

// ✅ CORRETO - Use API Routes
const response = await fetch('/api/pagarme/create-recipient', {
  method: 'POST',
  body: JSON.stringify(bankData),
});
```

## 📝 Exemplo de Uso no Frontend

```typescript
// No frontend, chame a API Route (não o arquivo direto!)
async function criarRecebedor(bankData: any) {
  const response = await fetch('/api/pagarme/create-recipient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bankData),
  });
  
  if (!response.ok) {
    throw new Error('Erro ao criar recebedor');
  }
  
  return await response.json();
}
```

## 🔄 Migração do Código Atual

O arquivo `src/lib/pagarme.ts` (frontend) deve ser atualizado para chamar as API Routes ao invés de fazer requisições diretas:

```typescript
// ANTES (frontend direto - ❌ inseguro)
import { createPagarMeRecipient } from '../lib/pagarme';

// DEPOIS (chamando API Route - ✅ seguro)
async function createPagarMeRecipient(bankData: any) {
  const response = await fetch('/api/pagarme/create-recipient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bankData),
  });
  
  return await response.json();
}
```

## ✅ Checklist de Segurança

- [ ] `PAGARME_SECRET_KEY` configurada apenas no servidor
- [ ] `.env` com chave está no `.gitignore`
- [ ] Nenhum import de `pagarme-server.ts` no frontend
- [ ] Todas as chamadas passam pelas API Routes
- [ ] Chave nunca aparece em console.log no frontend





