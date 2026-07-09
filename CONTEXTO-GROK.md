# 📘 Agendei Fácil — Briefing do Sistema (contexto para IA assistente)

> Documento de contexto para uma IA auxiliar entender o sistema **antes** de sugerir ou alterar qualquer código.
> ⚠️ **Sistema em PRODUÇÃO, com clientes reais e dinheiro real passando.** Cautela máxima em toda alteração.
> Idioma de trabalho: **português** (o dono não fala inglês). Data de referência deste documento: **julho/2026**.

---

## 1. O que é o produto

**Agendei Fácil** é um sistema de agendamento para **barbearias e salões**. Ele tem dois grandes lados:

- **Booking (cliente final):** o cliente entra por um link, escolhe serviço, profissional e horário, e agenda. Pode pagar online (antecipado) ou no local.
- **Painel do estabelecimento (dono/profissional):** agenda/comanda do dia, financeiro, assinaturas mensais, produtos, profissionais, serviços, lembretes de WhatsApp, fidelidade (AFCoins) e programa de indicação.

Público: donos de barbearia/salão e seus clientes finais. **Muito usado no CELULAR** — toda alteração visual precisa funcionar bem em mobile e desktop. Existem **clientes antigos** com dados/configs antigos → toda feature nova precisa de **fallback seguro** (nunca assumir que o campo novo está preenchido).

---

## 2. Stack & Infraestrutura

| Camada | Tecnologia | Deploy |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Netlify |
| Backend/API | Node + Express (`server/api-server.ts`) | Render (serviço `agendei-api`) |
| Banco + Auth | Supabase (Postgres + RLS + Auth) | Supabase Cloud |
| Filas (opcional) | Redis + BullMQ | Render (`agendei-redis2`) — fallback direto se sem `REDIS_URL` |
| WhatsApp | Baileys (`@whiskeysockets/baileys`) — **embutido no `agendei-api`** | Render + disco persistente `/var/data` |
| Pagamentos | **DOIS gateways: Mercado Pago e Pagar.me** | via API |

- **Dev local:** `npm run dev` sobe Vite na **5173** e a API na **3001** (o front faz proxy pra 3001). Se subir só o Vite com `PORT=5173`, a API quebra (ECONNREFUSED). No preview, rodar `dev:api` (3001) e `dev:vite` (5173) **separados**.
- Env do backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_CLIENT_ID/SECRET/REDIRECT_URI`, `PAGARME_SECRET_KEY`, `PAGARME_PLATFORM_RECIPIENT_ID`, `PLATFORM_FEE_CENTS`, `WHATSAPP_RUNTIME_ROLE`, `WHATSAPP_SESSIONS_DIR`.
- Env do frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

---

## 3. ⛔ REGRAS DE OURO (nunca violar)

1. **Nunca desconectar integrações em massa** — contas Mercado Pago, WhatsApp, webhooks, tokens/refresh tokens, sessões, credenciais salvas. Se uma mudança tem risco de desconectar contas, **parar e avisar antes**.
2. **Não mexer no Mercado Pago / Pagar.me** (OAuth, tokens, webhooks, split, PIX, cartão, status de pagamento, cancelamentos automáticos, 50%/100%, repasse de taxa) sem análise extrema.
3. **Não quebrar o financeiro** — valor bruto, líquido, comissão, taxa, repasse ao profissional, relatórios, ranking, metas. **Nunca alterar um valor usado no financeiro só para corrigir exibição visual.**
4. **Explicar antes de mexer** em: Mercado Pago, WhatsApp, financeiro, assinantes ou **banco de dados** (tabela/coluna/policy/RLS/função SQL) → explicar motivo, impacto e risco, e **aguardar aprovação**.
5. **Não corrigir uma tela quebrando outra.** Antes de entregar, revisar as telas relacionadas (ex.: já aconteceu de "arrumar" a contagem de atendimentos e quebrar o histórico de "Meus Assinantes").
6. Preferir **mudanças pequenas, com fallback, sem gambiarra**, reaproveitando funções existentes.

---

## 4. Mapa de arquivos principais

| Arquivo | Papel |
|---|---|
| `src/pages/EstablishmentDashboard.tsx` | **Dashboard principal do dono** — gigante (>500KB, o Babel avisa que "deoptimiza", mas compila). Agenda, financeiro, produtos, taxas, onboarding, configurações, etc. |
| `src/pages/BookingPage.tsx` | Booking do cliente (fluxo tipo chat). **Zero edição sem necessidade** — é o fluxo de produção do cliente final. |
| `src/components/BookingChatFlow.tsx` | Motor do chat de agendamento (mostra limite do assinante, "Restam X", etc.). |
| `src/components/SubscribersManager.tsx` | Tela **"Meus Assinantes"** — cards de assinantes, atendimentos, limites, bônus, lixeira/restauração. |
| `src/components/AllProfessionalsAppointmentsView.tsx` | Agenda de **todos os profissionais** + concluir atendimento de assinante na agenda. |
| `src/components/ProfessionalInfoModal.tsx` / `ProfessionalPaymentControl.tsx` | Financeiro/pagamento do profissional (bruto → taxa → líquido). |
| `src/components/AppointmentForm.tsx` | Formulário de agendamento (usado no painel). |
| `src/components/PaymentModal.tsx` | Modal de pagamento — **detecta sozinho** se o gateway ativo é Mercado Pago ou Pagar.me. |
| `src/components/Sidebar.tsx` | Menu lateral + **Menu Admin** (painel com atalhos; ordem em `ADMIN_MENU_PANEL_ORDER`, destaque via `featured`/`featuredTone`). |
| `src/lib/supabase.ts` | Client Supabase + funções de acesso. |
| `src/lib/subscriberSystem.ts` | Sistema de assinantes (buscar, criar, repasse `computeSubscriberRepassValue`). |
| `src/utils/monthlyLimitValidation.ts` | **`checkMonthlyLimit`** — validador central do limite mensal do assinante (usado no booking). |
| `src/utils/subscriptionUsagePeriod.ts` | Helpers de período/limite (`buildCarryoverMonthlyLimit`, `applyBonusCreditsToLimit`). |
| `src/utils/subscriberAppointmentFlags.ts` | **`isStrictSubscriberAppointment`** — decide se um atendimento é de assinante ou avulso. |
| `src/utils/appointmentPayment.ts` | `resolveBookingPaymentAmount` (valor a cobrar, respeitando 50%/100%). |
| `server/api-server.ts` | API Express: OAuth Mercado Pago, Pagar.me (recipient/payment/status), rotas WhatsApp, `cleanupPendingPayments()` (roda a cada 5 min). |
| `server/whatsapp/` | Integração WhatsApp (Baileys, rotas, sessões). |

---

## 5. Áreas críticas — detalhes técnicos

### 💳 Pagamentos (Mercado Pago + Pagar.me)
- **Dois gateways coexistem.** O `PaymentModal` detecta o gateway ativo do estabelecimento por conta própria (não depende do estado da página).
- Configs por estabelecimento: pagamento **obrigatório vs opcional**, **50% vs 100%** antecipado (`advance_payment_percentage`), quem absorve a taxa de cartão (`tax_deducted_by_establishment`), `pagarme_recipient_id`.
- **Split de plataforma** (Pagar.me): `PAGARME_PLATFORM_RECIPIENT_ID` + `PLATFORM_FEE_CENTS`.
- Agendamentos aguardando pagamento ficam em `status: 'pending_payment'` e são **limpos automaticamente** por `cleanupPendingPayments()` no servidor (a cada 5 min) — a página não precisa limpar.
- **Nunca** tocar em OAuth/tokens/webhooks sem aprovação explícita.

### 📱 WhatsApp (Baileys)
- Roda **dentro do `agendei-api`** (`WHATSAPP_RUNTIME_ROLE=all`), sessões em disco persistente (`WHATSAPP_SESSIONS_DIR`, ex.: `/var/data/whatsapp-sessions` no Render).
- Um **sweep** reconecta sessões automaticamente. Em **restart/redeploy** pode haver conflito "identity changed" → contas caem e o sweep reconecta sozinho depois. Recomendação em aberto: **desligar Auto-Deploy no Render** e/ou separar o WhatsApp num worker próprio.
- Usado para: lembretes automáticos (ex.: 1h antes), confirmações, cancelamentos, cobranças de assinatura.
- **Nunca** fazer algo que desconecte WhatsApps já conectados.

### 👑 Assinantes & Limites (área muito sensível)
- **`client_subscriptions`** (uma linha por cliente assinante) e **`subscriptions`** (o "plano"/tipo de assinatura).
- **`monthly_limit`** (em `client_subscriptions`) tem **DUPLO propósito**: (a) limite de agendamentos por mês E (b) **divisor de repasse financeiro** quando o plano usa "Dividir valor total". ⚠️ **NUNCA somar/alterar `monthly_limit` para mudar limite**, pois isso muda o valor pago ao profissional.
- Dois modelos de limite:
  - **Limite total** (`monthly_limit`).
  - **Limite por serviço** (`subscriptions.divide_services_enabled` + `divided_services` — cada serviço tem seu próprio limite; nesse caso o `monthly_limit` total costuma ser "ilimitado").
- **Validador central:** `checkMonthlyLimit` (em `monthlyLimitValidation.ts`), usado no booking (`BookingPage`, `BookingChatFlow`, `AppointmentForm`). Tem branch para limite total **e** para limite por serviço. O texto "Limite: 0/4 • Restam 4" no booking vem do retorno dessa função.
- **Atendimentos extras (bônus):** coluna **`bonus_credits`** (adicionada jul/2026) — soma ao limite (total **e** por serviço) **sem** tocar no `monthly_limit`/repasse. É fixo/recorrente por mês. Aplicado em ~5 pontos de validação (booking, agenda, auto-registro, atendimento manual, contagem do card).
- **Classificação assinante vs avulso:** `isStrictSubscriberAppointment` usa **link forte** (`subscription_id` / `subscriber_service_id` / `subscriber_service_name`) **antes** de olhar `payment_method`. Isso evita que uma assinatura com serviço extra pago via PIX seja contada como avulso.
- **`subscriber_attendances`**: registros de atendimentos usados pelo assinante (contagem mensal).
- **Soft delete**: assinante excluído recebe `archived_at` (não apaga histórico); há "Lixeira" para restaurar.
- Preservar sempre: histórico, profissional que atendeu, data/hora, serviço, contagem, status pago/não pago.

### 💰 Financeiro & Taxas
- Cálculo do profissional: **bruto → (− taxa de cartão) → líquido a receber**. A taxa só é descontada do profissional quando `tax_deducted_by_establishment = false`.
- Comissão via `commission_percentages`; taxa de cartão via `getCardTaxAmountForServiceBase`.
- Bug já corrigido (não regredir): **duplo clique em "Pagar"** registrava 2 pagamentos → resolvido com guarda síncrona (`useRef`, não só `useState`).

### 🗓️ Agenda / Comanda
- Abrir comanda, concluir, cancelar, pendente, transferir, "cliente faltou", gorjeta, trocar horário/serviço, serviço extra, produto, observações, forma de pagamento, valor, histórico do cliente. Tudo isso alimenta o financeiro — cuidado ao mexer.

### 🌐 Booking
- Rota `/booking/:id` → `BookingPage`. Existe também uma **página simples** `/booking/:id/af` → `BookingSimplePage` (wizard linear para público idoso/leigo), **isolada** (copia lógica validada, não edita o `BookingPage`).
- Respeita a config de pagamento obrigatório do estabelecimento (se exige antecipado, a simples também exige).

### 📦 Produtos
- **`products`**: `name`, `sale_price`, `cost_price`, `stock_quantity`, `image_url`, `commission_percentages` (% do vendedor).
- Vendas: **`product_sales`** (venda de balcão) e **`appointment_products`** (produto vendido dentro de um atendimento, ligado a `appointments`).
- Lucro do período = `faturamento − (custo × qtd) − repasse ao colaborador`. A tela "Meus Produtos" é **relatório** (só leitura); vender/cancelar produto é código separado (comanda/agenda).

### 🪙 AFCoins (fidelidade) & Indicação
- AFCoins: pontuação/resgate/benefícios (diferencial do produto). Regras próprias de ganho (ex.: nome+telefone, confirmação, bônus local/online). Preservar regras existentes.
- Indicação: "3 indicados = sistema grátis" etc.

---

## 6. Banco de dados — tabelas principais (Supabase/Postgres)

> Alterações de schema **só com aprovação** (migration explicada). Não remover colunas, não renomear campos em produção sem migração segura, cuidado com RLS.

- **`establishments`**: `id`, `code` (código de 4 dígitos do link), `name`, `pin_password` (senha de 4 dígitos do Menu Admin/financeiro), `logo_url`/`profile_image_url`, `limit_subscriber_bookings`, `limit_subscribers_one_week`, `pagarme_recipient_id`, `tax_deducted_by_establishment`, `advance_payment_percentage`, `booking_simple_page_enabled`.
- **`appointments`**: `id`, `appointment_date`, `client_whatsapp`, `client_name`, `service`, `subscriber_service_id`/`subscriber_service_name`, `subscription_id`, `is_subscriber`, `status` (`confirmed`/`completed`/`pending`/`pending_payment`/`cancelled`), `price`/`total_price`, `payment_method`, `establishment_id`.
- **`client_subscriptions`**: `id`, `subscription_id`, `subscriber_name`, `subscriber_whatsapp`, `client_name_override`, `client_whatsapp`, `monthly_limit`, **`bonus_credits`** (novo), `start_date`, `end_date`, `payment_status` (`paid`/`unpaid`), `archived_at`, `custom_subscription_value`, `subscription_value_change_history`, `created_at`, `updated_at`.
- **`subscriptions`** (planos): `id`, `name`, `value`, `duration_months`, `monthly_service_limit` (legado), `divide_services_enabled`, `divided_services` (limites por serviço), `divide_total_enabled`, `divide_total_attendances`, `fixed_commission_value`.
- **`subscriber_attendances`**: `id`, `client_subscription_id`, `establishment_id`, `professional_name`, `attendance_date`, `repass_value`, `created_by`.
- **`products`**, **`product_sales`**, **`appointment_products`** (ver seção Produtos).
- **`premium_subscriptions`**: sistema **antigo/legado** de assinatura (ainda consultado como fallback).
- **`subscription_sale_commissions`**: comissão de venda da assinatura.

---

## 7. Como trabalhar (ambiente & armadilhas)

- ⚠️ **O `npm run dev` local conecta no Supabase REAL de PRODUÇÃO.** Ao testar em localhost: **não** clicar em conectar/desconectar WhatsApp ou Mercado Pago, **não** fazer pagamento de verdade, e **não** registrar atendimentos em clientes reais (usar assinantes de teste). Ver telas/abrir modais/conferir números é seguro.
- Alterações de banco: fornecer o **SQL pronto** (idempotente, ex.: `ADD COLUMN IF NOT EXISTS ... DEFAULT ...`), com default seguro para não afetar clientes existentes, e rodar **no Supabase → SQL Editor** só após aprovação. Se o código lê uma coluna nova antes dela existir, a query quebra → criar a coluna **primeiro**.
- `tsc --noEmit` deve ficar em **0 erros** (o build da Netlify usa TypeScript). HMR do Vite não faz type-check.
- Antes de dizer "pronto": compila? tela abre? funcionalidade funciona? telas relacionadas ok? mobile ok? financeiro intacto? booking/agenda ok? sem desconectar MP/WhatsApp?
- Comunicação sempre em **português**, direto e didático.

---

## 8. Estado atual / mudanças recentes (jul/2026)

Trabalho recente (algumas mudanças ainda podem estar **não commitadas** no momento deste doc):

- **Atendimentos extras (bônus) por assinante:** nova coluna `client_subscriptions.bonus_credits`; botão "Limitar Cliente" virou **"🎁 Atendimentos extras"**; o bônus soma ao limite (total e por serviço) sem tocar no repasse.
- **Menu Admin reorganizado** (`Sidebar.tsx`): nova ordem e destaque por **família de cor** (verde = dinheiro, azul = clientes/agenda, roxo = catálogo/equipe), via `featured`/`featuredTone` em `ADMIN_MENU_PANEL_ORDER`.
- **"Meus Produtos"** ganhou detalhamento de vendas (quem vendeu, líquido, comparativo mês a mês) — aditivo, sem remover funções existentes.
- **Taxas ("Minhas Taxas")**: navegação por mês + taxa por profissional. **Financeiro do profissional**: decomposição bruto → taxa → líquido, respeitando `tax_deducted_by_establishment`.
- **Colaborador**: ao marcar um profissional como colaborador, o dono escolhe **quais agendas** ele pode ver/gerenciar (aparece no booking, diferente de secretária).
- **Correções**: duplicação de pagamento (duplo clique), classificação assinante-vs-avulso (link forte antes de payment_method), "Lixeira" de assinantes com restauração.

---

### Resumo em 1 frase
Sistema de agendamento em produção (React/TS/Vite/Tailwind + Supabase + Express na Render), com **pagamentos (MP + Pagar.me), WhatsApp (Baileys), assinaturas, financeiro e agenda** como áreas críticas — **toda alteração deve ser pequena, com fallback, sem quebrar integrações/financeiro, e explicada antes quando toca banco, pagamentos, WhatsApp, financeiro ou assinantes.**
