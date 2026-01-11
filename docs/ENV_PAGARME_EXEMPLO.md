# 🔧 Variáveis de ambiente (Pagar.me) — Exemplo

> ⚠️ **Não commite seu `.env` real.**  
> Use este arquivo só como referência do que configurar no **localhost** e no **Netlify**.

## Backend (Express / Netlify Functions)

```bash
# Core v5 (server)
PAGARME_SECRET_KEY=SUA_PAGARME_SECRET_KEY_AQUI

# Encryption Key (pública) — necessária para tokenizar cartão (/tokens)
# Sem isso, cartão vai falhar com "The request is invalid" / "Cartão indisponível"
PAGARME_ENCRYPTION_KEY=SUA_PAGARME_ENCRYPTION_KEY_AQUI

# Split (plataforma)
PAGARME_PLATFORM_RECIPIENT_ID=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PLATFORM_FEE_CENTS=50

# PIX
PIX_EXPIRES_IN_SECONDS=90
```

## Onde pegar a `PAGARME_ENCRYPTION_KEY`

- No painel da Pagar.me, procure por **API Keys / Chaves de API** e copie a **Encryption Key** (chave pública).


