# 💾 Cálculo de Custo de Armazenamento - Estabelecimento

## 📊 Estrutura de Dados de um Estabelecimento

### Campos Principais (tabela `establishments`):

| Campo | Tipo | Tamanho Aproximado |
|-------|------|-------------------|
| `id` | UUID | 16 bytes |
| `created_at` | TIMESTAMPTZ | 8 bytes |
| `updated_at` | TIMESTAMPTZ | 8 bytes |
| `name` | TEXT | ~50 bytes (nome médio) |
| `code` | TEXT | 4 bytes |
| `description` | TEXT | ~200 bytes (descrição média) |
| `owner_id` | UUID | 16 bytes |
| `business_hours` | JSONB | ~500 bytes (horários da semana) |
| `services_with_prices` | JSONB[] | ~2 KB (10 serviços médios) |
| `professionals` | JSONB[] | ~5 KB (5 profissionais médios) |
| `professionals_pins` | JSONB[] | ~500 bytes |
| `profile_image_url` | TEXT | ~100 bytes |
| `logo_url` | TEXT | ~100 bytes |
| `affiliate_link` | TEXT | ~100 bytes |
| `custom_photo_1-7_url` | TEXT | ~700 bytes (7 fotos × 100 bytes) |
| `pix_key_type` | TEXT | ~20 bytes |
| `pix_key` | TEXT | ~50 bytes |
| `review_link` | TEXT | ~100 bytes |
| `social_media_link` | TEXT | ~100 bytes |
| `pix_payment_link` | TEXT | ~100 bytes |
| `location_link` | TEXT | ~100 bytes |
| `wifi_password` | TEXT | ~20 bytes |
| `whatsapp` | TEXT | ~20 bytes |
| Campos booleanos (has_wifi, has_parking, etc.) | BOOLEAN | ~10 bytes |
| `credit_card_tax_percentage` | NUMERIC | ~8 bytes |
| `debit_card_tax_percentage` | NUMERIC | ~8 bytes |
| `card_brand_taxes` | JSONB | ~200 bytes |
| **Overhead PostgreSQL** | | ~200 bytes |

### **Total por Estabelecimento: ~10 KB**

---

## 💰 Cálculo de Custo (Supabase)

### Preços do Supabase (2024):
- **Free Tier**: 500 MB de banco de dados (grátis)
- **Pro Plan**: $25/mês (8 GB de banco de dados incluído)
- **Storage adicional**: ~$0.125 por GB/mês (após o limite)

### Cálculo de Armazenamento:

#### **Por Estabelecimento:**
- Tamanho: **10 KB** (0.00001 GB)
- **Custo mensal**: ~R$ 0,00007 (R$ 0,00 na prática)
- **Custo anual**: ~R$ 0,0008 (R$ 0,00 na prática)

#### **Para 1.000 Estabelecimentos:**
- Tamanho total: 10 MB (0.01 GB)
- **Custo mensal**: R$ 0,00 (dentro do free tier)
- **Custo anual**: R$ 0,00

#### **Para 100.000 Estabelecimentos:**
- Tamanho total: 1 GB
- **Custo mensal**: R$ 0,00 (dentro do plano Pro - 8 GB incluído)
- **Custo anual**: R$ 0,00

#### **Para 1.000.000 Estabelecimentos:**
- Tamanho total: 10 GB
- Armazenamento necessário: 10 GB
- Armazenamento incluído no Pro: 8 GB
- **Armazenamento adicional**: 2 GB
- **Custo mensal adicional**: 2 GB × $0.125 = **$0.25/mês** (~R$ 1,25/mês)
- **Custo anual**: ~**R$ 15,00/ano**

---

## 📈 Resumo de Custos Anuais

| Quantidade de Estabelecimentos | Armazenamento | Custo Mensal | Custo Anual |
|-------------------------------|---------------|--------------|-------------|
| 1 | 10 KB | R$ 0,00 | R$ 0,00 |
| 100 | 1 MB | R$ 0,00 | R$ 0,00 |
| 1.000 | 10 MB | R$ 0,00 | R$ 0,00 |
| 10.000 | 100 MB | R$ 0,00 | R$ 0,00 |
| 100.000 | 1 GB | R$ 0,00 | R$ 0,00 |
| 500.000 | 5 GB | R$ 0,00 | R$ 0,00 |
| 1.000.000 | 10 GB | R$ 1,25 | **R$ 15,00** |
| 5.000.000 | 50 GB | R$ 5,25 | **R$ 63,00** |
| 10.000.000 | 100 GB | R$ 11,50 | **R$ 138,00** |

---

## ⚠️ Observações Importantes:

1. **Armazenamento de Imagens**: Este cálculo **NÃO inclui** o armazenamento de imagens (fotos de perfil, logos, etc.). Essas ficam no Storage do Supabase, que tem custo separado.

2. **Índices do Banco**: O PostgreSQL cria índices que ocupam espaço adicional (~20-30% do tamanho da tabela).

3. **Dados Relacionados**: Este cálculo é apenas para a tabela `establishments`. Não inclui:
   - Tabela `appointments` (agendamentos - muito maior)
   - Tabela `client_subscriptions` (assinantes)
   - Tabela `subscriptions` (assinaturas)
   - Tabela `professional_payments` (pagamentos)

4. **Crescimento**: Com o uso, o tamanho aumenta conforme:
   - Mais serviços são adicionados
   - Mais profissionais são cadastrados
   - Mais configurações são adicionadas

---

## 🎯 Conclusão:

**O custo de armazenamento de um estabelecimento no banco de dados é praticamente ZERO.**

- ✅ 1 milhão de estabelecimentos = **R$ 15,00/ano**
- ✅ O custo é extremamente baixo
- ✅ Dentro do plano Pro do Supabase, você pode ter **800.000 estabelecimentos** sem custo adicional de armazenamento

**Resumo: O armazenamento NÃO é um problema de custo. O custo real vem de outras tabelas (agendamentos, por exemplo) e do armazenamento de imagens no Storage.**






