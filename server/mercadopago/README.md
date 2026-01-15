# Mercado Pago Marketplace - Módulo Backend

Este módulo implementa a integração com Mercado Pago Marketplace via OAuth para conectar contas de vendedores e criar pagamentos com `application_fee` para a plataforma.

## 📋 Estrutura

```
server/mercadopago/
├── mp.oauth.ts      # Lógica OAuth (autorização, callback, refresh token)
├── mp.service.ts    # Criação de pagamentos e verificação de status
├── mp.routes.ts     # Rotas Express (OAuth e pagamentos)
└── README.md        # Esta documentação
```

## 🔧 Configuração

### Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env`:

```env
# Mercado Pago OAuth
MERCADOPAGO_CLIENT_ID=seu_client_id_aqui
MERCADOPAGO_CLIENT_SECRET=seu_client_secret_aqui
MERCADOPAGO_REDIRECT_URI=http://localhost:3001/api/mercadopago/oauth/callback

# URLs da API (opcional, padrões já configurados)
MERCADOPAGO_API_BASE_URL=https://api.mercadopago.com
MERCADOPAGO_AUTH_BASE_URL=https://auth.mercadopago.com.br
```

### Banco de Dados

Execute a migração SQL para adicionar os campos necessários:

```sql
-- Arquivo: supabase/migrations/20260115_add_mercadopago_fields.sql
```

Isso adiciona as seguintes colunas na tabela `establishments`:
- `mercadopago_user_id` (TEXT)
- `mercadopago_access_token` (TEXT)
- `mercadopago_refresh_token` (TEXT)
- `mercadopago_token_expires_at` (TIMESTAMPTZ)

## 🚀 Rotas Disponíveis

### 1. Iniciar OAuth

**GET** `/api/mercadopago/oauth/authorize?establishmentId=xxx`

Retorna a URL de autorização OAuth do Mercado Pago.

**Resposta:**
```json
{
  "authorization_url": "https://auth.mercadopago.com.br/authorization?...",
  "establishment_id": "xxx"
}
```

### 2. Callback OAuth

**GET** `/api/mercadopago/oauth/callback?code=xxx&state=xxx`

Processa o callback do OAuth e salva os tokens no banco de dados.

**Resposta:**
```json
{
  "success": true,
  "message": "Conta do Mercado Pago conectada com sucesso",
  "user_id": 123456789,
  "establishment_id": "xxx"
}
```

### 3. Criar Pagamento

**POST** `/api/mercadopago/create-payment`

Cria um pagamento no Mercado Pago Marketplace com `application_fee = R$ 0,50`.

**Body:**
```json
{
  "establishmentId": "xxx",
  "amount": 1000,
  "description": "Pagamento de serviço",
  "payer": {
    "email": "cliente@example.com",
    "identification": {
      "type": "CPF",
      "number": "12345678900"
    }
  },
  "payment_method_id": "pix",
  "metadata": {
    "appointment_id": "yyy"
  }
}
```

**Resposta:**
```json
{
  "id": 1234567890,
  "status": "pending",
  "status_detail": "pending_waiting_payment",
  "transaction_amount": 10.00,
  "currency_id": "BRL",
  "date_created": "2026-01-15T10:00:00.000-04:00",
  "payment_method_id": "pix",
  "payer": {
    "id": "123456789",
    "email": "cliente@example.com"
  },
  "application_fee": 0.50
}
```

### 4. Verificar Status

**GET** `/api/mercadopago/check-status?paymentId=1234567890&establishmentId=xxx`

Verifica o status de um pagamento.

**Resposta:**
```json
{
  "id": 1234567890,
  "status": "approved",
  "status_detail": "accredited",
  "transaction_amount": 10.00,
  "currency_id": "BRL",
  "date_created": "2026-01-15T10:00:00.000-04:00",
  "date_approved": "2026-01-15T10:01:00.000-04:00",
  "payment_method_id": "pix",
  "payer": {
    "id": "123456789",
    "email": "cliente@example.com"
  },
  "application_fee": 0.50
}
```

## 🧪 Testando com Postman

### 1. Iniciar OAuth

```
GET http://localhost:3001/api/mercadopago/oauth/authorize?establishmentId=SEU_ESTABLISHMENT_ID
```

Copie a `authorization_url` e abra no navegador para autorizar.

### 2. Após autorizar, o callback será chamado automaticamente

O Mercado Pago redirecionará para `/api/mercadopago/oauth/callback` com o código.

### 3. Criar Pagamento

```
POST http://localhost:3001/api/mercadopago/create-payment
Content-Type: application/json

{
  "establishmentId": "SEU_ESTABLISHMENT_ID",
  "amount": 1000,
  "description": "Teste de pagamento",
  "payer": {
    "email": "teste@example.com",
    "identification": {
      "type": "CPF",
      "number": "12345678900"
    }
  },
  "payment_method_id": "pix"
}
```

### 4. Verificar Status

```
GET http://localhost:3001/api/mercadopago/check-status?paymentId=1234567890&establishmentId=SEU_ESTABLISHMENT_ID
```

## 📝 Notas Importantes

1. **Application Fee**: A taxa da plataforma está fixada em **R$ 0,50** (50 centavos) em `mp.routes.ts`. Para alterar, modifique a constante `applicationFee`.

2. **Access Token**: O `access_token` do vendedor é salvo no banco de dados após o OAuth. Ele expira em ~6 horas. Para renovar, use `refreshAccessToken()` em `mp.oauth.ts`.

3. **Segurança**: Os tokens são armazenados no banco de dados. Em produção, considere criptografar os tokens sensíveis.

4. **Idempotência**: Os pagamentos usam `X-Idempotency-Key` para prevenir duplicatas.

5. **Valores**: Todos os valores devem ser enviados em **centavos** (ex: R$ 10,00 = 1000).

## 🔄 Fluxo Completo

1. **Conectar Conta**: Vendedor acessa `/oauth/authorize` → autoriza no Mercado Pago → callback salva tokens
2. **Criar Pagamento**: Sistema chama `/create-payment` com `access_token` do vendedor
3. **Verificar Status**: Sistema chama `/check-status` para acompanhar o pagamento

## ⚠️ Próximos Passos (Não Implementados)

- [ ] Renovação automática de `access_token` quando expirar
- [ ] Webhooks do Mercado Pago para notificações de pagamento
- [ ] Interface gráfica para conectar conta (frontend)
- [ ] Tratamento de erros mais robusto
- [ ] Logs estruturados
