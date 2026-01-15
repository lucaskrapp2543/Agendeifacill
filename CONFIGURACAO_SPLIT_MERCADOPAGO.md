# Configuração de Split no Mercado Pago Marketplace

## ⚠️ Problema Identificado

Quando um pagamento é feito via Mercado Pago, o estabelecimento está recebendo o valor total (ex: R$ 10,00) ao invés de receber apenas sua parte (ex: R$ 9,50), e a plataforma não está recebendo a taxa (ex: R$ 0,50).

## 🔍 Como Funciona o Split no Mercado Pago

No Mercado Pago Marketplace, o `application_fee` funciona assim:

1. **Cliente paga**: R$ 10,00
2. **Vendedor (estabelecimento) recebe**: R$ 9,50 (transaction_amount - application_fee)
3. **Plataforma recebe**: R$ 0,50 (application_fee) na conta da aplicação

## ✅ Configuração Necessária

Para o split funcionar corretamente, você precisa:

### 1. **Aplicação Configurada como Marketplace**

A aplicação no painel do Mercado Pago precisa estar configurada como "Marketplace". Isso permite que a aplicação receba a `application_fee`.

**Como verificar:**
1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Verifique se está configurada como "Marketplace" ou "Integrador"

### 2. **OAuth Configurado Corretamente**

Cada estabelecimento precisa ter seu próprio `access_token` obtido via OAuth (já implementado).

### 3. **application_fee no Payload**

O código já está enviando `application_fee: 0.50` (R$ 0,50) no payload do pagamento.

## 🔧 Verificação

Após fazer um pagamento, verifique nos logs:

```
💰 [MP Payment] Valores do split:
  transaction_amount: 10
  application_fee: 0.5
  vendedor_recebe: 9.5
  plataforma_recebe: 0.5
```

Se o `application_fee` não aparecer na resposta do Mercado Pago, significa que:
- A aplicação não está configurada como Marketplace
- Ou há algum problema na configuração da aplicação

## 📝 Próximos Passos

1. **Verificar configuração da aplicação no Mercado Pago**
2. **Testar um pagamento e verificar os logs**
3. **Se o problema persistir, verificar se a aplicação precisa ser recriada como Marketplace**

## 🆘 Se o Problema Persistir

Se mesmo após verificar a configuração o split não funcionar:

1. Verifique se a aplicação está ativa no painel do Mercado Pago
2. Verifique se o `CLIENT_ID` e `CLIENT_SECRET` estão corretos
3. Entre em contato com o suporte do Mercado Pago para verificar se a aplicação está configurada corretamente como Marketplace
