# 🧹 Como Limpar Cache no Netlify e Cloudflare

## ⚠️ PROBLEMA
A página fica em loop de carregamento no Brave (e outros navegadores) mesmo após limpar cache do navegador.

## 🔧 SOLUÇÃO: Limpar Cache no Servidor

### **1. Netlify (se estiver usando)**

#### Opção A: Via Dashboard
1. Acesse: https://app.netlify.com
2. Vá em **Site settings** → **Build & deploy**
3. Role até **Deploys**
4. Clique em **"Clear cache and deploy site"** ou **"Trigger deploy"**
5. Isso força um novo deploy e limpa o cache

#### Opção B: Via API (mais rápido)
```bash
# No terminal, execute:
curl -X POST "https://api.netlify.com/api/v1/sites/SEU_SITE_ID/clear_cache" \
  -H "Authorization: Bearer SEU_TOKEN"
```

#### Opção C: Forçar novo deploy
1. Faça uma mudança pequena em qualquer arquivo
2. Faça commit e push
3. Isso força novo deploy e limpa cache

### **2. Cloudflare (se estiver usando)**

#### Via Dashboard:
1. Acesse: https://dash.cloudflare.com
2. Selecione seu domínio
3. Vá em **Caching** → **Configuration**
4. Clique em **"Purge Everything"** (Limpar Tudo)
5. Ou use **"Custom Purge"** para limpar URLs específicas

#### Via API:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

### **3. Vercel (se estiver usando)**
1. Acesse: https://vercel.com/dashboard
2. Vá no seu projeto
3. Clique em **Deployments**
4. Clique nos 3 pontinhos do último deploy
5. Selecione **"Redeploy"**

## 🎯 **RECOMENDAÇÃO**

**Se você não sabe qual está usando:**
1. Verifique o DNS do domínio `agendeifacil.com`
2. Veja qual CDN/proxy está na frente
3. Limpe o cache lá

**Ou simplesmente:**
- Faça um novo deploy (qualquer mudança pequena)
- Isso força limpeza de cache automaticamente

## ⚠️ **IMPORTANTE**

O código já foi corrigido para:
- ✅ Desabilitar autoCacheCleaner no Brave
- ✅ Detectar loops e parar automaticamente
- ✅ Não limpar cache infinitamente

Mas se o cache estiver no servidor (Netlify/Cloudflare), precisa limpar lá também!

