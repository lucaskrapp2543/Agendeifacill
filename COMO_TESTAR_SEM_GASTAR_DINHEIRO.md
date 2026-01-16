# 🧪 Como Testar Pagamentos Mercado Pago SEM Gastar Dinheiro

## ✅ Cartões de Teste do Mercado Pago

Você pode usar estes cartões para testar **SEM gastar dinheiro real**:

### 📋 Cartões Disponíveis

| Tipo | Bandeira | Número do Cartão | CVV | Vencimento |
|------|----------|------------------|-----|------------|
| **Crédito** | Mastercard | `5031 4332 1540 6351` | `123` | `11/30` |
| **Crédito** | Visa | `4235 6477 2802 5682` | `123` | `11/30` |
| **Crédito** | American Express | `3753 651535 56885` | `1234` | `11/30` |
| **Débito** | Elo | `5067 7667 8388 8311` | `123` | `11/30` |

### 🎯 Como Testar Diferentes Cenários

**IMPORTANTE:** O nome do titular do cartão determina o resultado do pagamento!

| Resultado | Nome do Titular | CPF |
|-----------|-----------------|-----|
| ✅ **Aprovado** | `APRO` | `12345678909` |
| ❌ **Recusado (erro geral)** | `OTHE` | `12345678909` |
| ⏳ **Pendente** | `CONT` | Qualquer |
| ❌ **Recusado (saldo insuficiente)** | `FUND` | Qualquer |
| ❌ **Recusado (CVV inválido)** | `SECU` | Qualquer |
| ❌ **Recusado (cartão expirado)** | `EXPI` | Qualquer |

### 📝 Exemplo de Teste

**Para testar pagamento APROVADO:**
- **Número:** `5031 4332 1540 6351`
- **Nome:** `APRO` (exatamente assim!)
- **CPF:** `12345678909`
- **CVV:** `123`
- **Vencimento:** `11/30`

**Para testar pagamento RECUSADO:**
- **Número:** `5031 4332 1540 6351`
- **Nome:** `OTHE` (exatamente assim!)
- **CPF:** `12345678909`
- **CVV:** `123`
- **Vencimento:** `11/30`

### ⚙️ Configuração Necessária

**1. Usar Access Token de TESTE:**
- No painel do Mercado Pago, vá em **Credenciais de teste**
- Use o `access_token` que começa com `TEST-`
- Configure no Netlify como `MERCADOPAGO_ACCESS_TOKEN`

**2. Usar Public Key de TESTE:**
- No painel do Mercado Pago, vá em **Credenciais de teste**
- Use a `public_key` que começa com `TEST-`
- Configure no `.env` local como `VITE_MERCADOPAGO_PUBLIC_KEY`

### 🔍 Como Verificar se Está em Modo Teste

O código já detecta automaticamente:
- Se `access_token` começa com `TEST-` → **MODO TESTE**
- Se `access_token` começa com `APP_USR-` → **MODO PRODUÇÃO**

Você verá nos logs:
```
🔍 [MP Get Payment Method] Ambiente detectado: TESTE
```

### ⚠️ IMPORTANTE

- **Cartões de teste só funcionam com tokens de TESTE**
- **Não use cartões de teste com tokens de PRODUÇÃO**
- **Em produção, use cartões reais (mas cuidado!)**

### 🎯 Teste Recomendado

1. Configure tokens de **TESTE** no Netlify/localhost
2. Use cartão: `5031 4332 1540 6351`
3. Nome: `APRO`
4. CPF: `12345678909`
5. CVV: `123`
6. Vencimento: `11/30`

**Resultado esperado:** Pagamento aprovado instantaneamente, sem cobrança real!
