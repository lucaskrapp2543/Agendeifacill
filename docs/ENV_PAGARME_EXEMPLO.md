# 🔧 Variáveis de ambiente (Pagar.me) — Exemplo

> ⚠️ **Não commite seu `.env` real.**  
> Use este arquivo só como referência do que configurar no **localhost** e no **Netlify**.

## Backend (Express / Netlify Functions)

```bash
# Core v5 (server)
PAGARME_SECRET_KEY=SUA_PAGARME_SECRET_KEY_AQUI

# (Opcional) Encryption Key — só é necessária se você for tokenizar cartão NO SERVIDOR.
# Neste projeto, a tokenização do cartão é feita no FRONTEND usando pk_ (appId) e domínio permitido.
# Se você não quiser usar tokenização no servidor, pode deixar sem.
#PAGARME_ENCRYPTION_KEY=SUA_PAGARME_ENCRYPTION_KEY_AQUI

# Split (plataforma)
PAGARME_PLATFORM_RECIPIENT_ID=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PLATFORM_FEE_CENTS=50

# PIX
PIX_EXPIRES_IN_SECONDS=90
```

## Frontend (Vite)

```bash
# Chave pública (pk_) usada para tokenizar cartão no navegador (endpoint /tokens?appId=...)
VITE_PAGARME_PUBLIC_KEY=pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Domínios permitidos (IMPORTANTE para tokenização)

No painel da Pagar.me, em **Configurações → Conta → Domínios**, cadastre o(s) seu(s) domínio(s) do site.

Exemplos:
- Produção: `https://agendeifacil.com` e `https://www.agendeifacil.com`
- Se usar .com.br: `https://agendeifacil.com.br` e `https://www.agendeifacil.com.br`
- Localhost (para testar): `http://localhost:5173`

Sem isso, a tokenização pode falhar.

## Onde pegar a `VITE_PAGARME_PUBLIC_KEY`

- No painel da Pagar.me, em **Configurações → Chaves**, copie a **Chave pública** que começa com `pk_`.


