# 🔗 INSTRUÇÕES PARA ATIVAR LINKS AFILIADOS

## ✅ BACKUPS CRIADOS
- ✅ `backups_links_afiliados/EstablishmentDashboard_backup.tsx`
- ✅ `backups_links_afiliados/ClientDashboard_backup.tsx`  
- ✅ `backups_links_afiliados/supabase_backup.ts`

## 🔧 PASSO 1: APLICAR MIGRAÇÃO NO SUPABASE

1. **Acesse**: https://app.supabase.com
2. **Entre no seu projeto**
3. **Vá em "SQL Editor"** (menu lateral)
4. **Cole este código SQL**:

```sql
-- MIGRAÇÃO: Adicionar coluna affiliate_link para estabelecimentos
-- Verificar se a coluna não existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='establishments' AND column_name='affiliate_link') THEN
        ALTER TABLE establishments ADD COLUMN affiliate_link TEXT;
        RAISE NOTICE 'Coluna affiliate_link adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna affiliate_link já existe.';
    END IF;
END $$;

-- Adicionar comentário descritivo
COMMENT ON COLUMN establishments.affiliate_link IS 'Link afiliado do estabelecimento';
```

5. **Clique em "Run"**
6. **Aguarde confirmação de sucesso**

## 🎯 DEPOIS DA MIGRAÇÃO:

✅ **O campo "Seu Link Afiliado Aqui" funcionará**
✅ **O botão "Ver link" aparecerá nos favoritos**
✅ **Links serão salvos permanentemente**

## 🚀 COMO TESTAR:

1. **Como estabelecimento**: `/dashboard/establishment`
   - Vá em "Configurações"
   - Adicione um link no campo "Seu Link Afiliado Aqui"
   - Clique "Atualizar Informações"
   - Saia e entre novamente - link deve estar salvo

2. **Como cliente**: `/dashboard/client`
   - Vá em "Meus Estabelecimentos"
   - Adicione um estabelecimento que tem link cadastrado
   - Você verá o botão "Ver link" ao lado de "Agendar"

## ⚠️ SE DER ERRO:

Execute no terminal:
```bash
# Restaurar backups
copy "backups_links_afiliados\EstablishmentDashboard_backup.tsx" "src\pages\EstablishmentDashboard.tsx"
copy "backups_links_afiliados\ClientDashboard_backup.tsx" "src\pages\ClientDashboard.tsx"
copy "backups_links_afiliados\supabase_backup.ts" "src\lib\supabase.ts"
```

## 📱 FUNCIONALIDADES INCLUÍDAS:

- ✅ Campo opcional para link afiliado
- ✅ Aceita qualquer URL (site, Instagram, WhatsApp, loja)
- ✅ Botão "Ver link" nos favoritos (ClientDashboard e PremiumDashboard)
- ✅ Link abre em nova aba
- ✅ Só aparece se estabelecimento tiver link cadastrado
- ✅ Responsivo (mobile e desktop) 