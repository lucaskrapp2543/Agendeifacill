# 👁️ Funcionalidade: Ocultar/Desocultar Assinaturas

## ✅ **Funcionalidade implementada:**

Agora você pode **ocultar** assinaturas no Dashboard do Estabelecimento para que elas não apareçam no Booking para novos clientes.

## 🎯 **Como funciona:**

### **1. Ocultar uma assinatura:**

1. **Vá para** Dashboard do Estabelecimento → **Meus Assinantes**
2. **Na seção** "Tipos de Assinatura Criados"
3. **Clique no ícone** 👁️‍🗨️ (olho cortado) ao lado do botão Apagar
4. **Confirme** a ação
5. **Assinatura é ocultada** ✅

### **2. Desocultar uma assinatura:**

1. **Na mesma seção**, assinaturas ocultas aparecem com:
   - Badge amarelo "👁️ Oculta"
   - Fundo levemente diferente
   - Aviso: "⚠️ Não aparece no Booking para novos clientes"
2. **Clique no ícone** 👁️ (olho aberto)
3. **Confirme** a ação
4. **Assinatura volta a aparecer** no Booking ✅

## 📋 **Comportamento:**

### **Quando uma assinatura está OCULTA:**

- ❌ **NÃO aparece** no Booking (BookingPage) para novos clientes
- ❌ **NÃO aparece** no Reservar Cliente (ReservarCliente)
- ✅ **CONTINUA visível** no Dashboard do Estabelecimento (com badge "Oculta")
- ✅ **Assinantes existentes** continuam com acesso normal
- ✅ **Pode ser desocultada** a qualquer momento

### **Quando uma assinatura está VISÍVEL:**

- ✅ **Aparece** no Booking para novos clientes
- ✅ **Aparece** em todas as páginas de agendamento
- ✅ **Pode ser ocultada** a qualquer momento

## 🎨 **Interface:**

### **Dashboard do Estabelecimento:**

**Assinatura Visível:**
```
┌─────────────────────────────────────────────┐
│ Plano Mensal                                │
│ R$ 100,00                                   │
│ [✏️ Editar] [👁️‍🗨️ Ocultar] [🗑️ Apagar]    │
└─────────────────────────────────────────────┘
```

**Assinatura Oculta:**
```
┌─────────────────────────────────────────────┐
│ Plano Mensal 👁️ Oculta                      │
│ R$ 100,00                                   │
│ ⚠️ Não aparece no Booking para novos clientes│
│ [✏️ Editar] [👁️ Desocultar] [🗑️ Apagar]    │
└─────────────────────────────────────────────┘
```

## 🔧 **Implementação técnica:**

### **1. Banco de Dados:**

**Campo adicionado:**
```sql
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
```

- **is_hidden**: Boolean (padrão: FALSE)
- **TRUE**: Assinatura oculta no Booking
- **FALSE ou NULL**: Assinatura visível

### **2. Arquivos modificados:**

#### **SubscribersManager.tsx:**
- ✅ Importado ícones `Eye` e `EyeOff`
- ✅ Criada função `handleToggleHideSubscription`
- ✅ Adicionado botão Ocultar/Desocultar
- ✅ Adicionado badge "Oculta" para assinaturas ocultas
- ✅ Estilo visual diferenciado para assinaturas ocultas

#### **BookingPage.tsx:**
- ✅ Filtro adicionado no `fetchSubscriptions`
- ✅ Apenas assinaturas visíveis (is_hidden = false ou null) são mostradas

#### **ReservarCliente.tsx:**
- ✅ Query alterada para filtrar assinaturas ocultas
- ✅ `.or('is_hidden.is.null,is_hidden.eq.false')`

### **3. Função handleToggleHideSubscription:**

```typescript
const handleToggleHideSubscription = async (subscriptionId: string, currentHiddenState: boolean) => {
  const action = currentHiddenState ? 'desocultar' : 'ocultar';
  
  if (window.confirm(confirmMessage)) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ is_hidden: !currentHiddenState })
      .eq('id', subscriptionId);
    
    if (!error) {
      toast.success(`Assinatura ${action}da com sucesso!`);
      fetchSubscriptions();
    }
  }
};
```

## 🎯 **Casos de uso:**

### **1. Pausar temporariamente uma assinatura:**
- Não quer mais novos assinantes por enquanto
- Oculta a assinatura
- Assinantes atuais continuam normalmente
- Quando quiser, desoculta e volta a aceitar novos

### **2. Testar nova assinatura:**
- Cria uma assinatura nova
- Testa internamente
- Oculta enquanto não está pronta
- Quando aprovar, desoculta

### **3. Assinatura sazonal:**
- Tem uma assinatura especial para certa época
- Oculta fora da época
- Assinantes que já tem continuam
- Na época certa, desoculta

## 🔒 **Segurança:**

- ✅ Apenas o dono do estabelecimento pode ocultar/desocultar
- ✅ Requer confirmação antes de ocultar/desocultar
- ✅ Não afeta assinantes existentes
- ✅ Ação reversível a qualquer momento

## 📊 **Mensagens:**

### **Confirmação:**
- **Ocultar**: "Deseja ocultar esta assinatura? Ela não aparecerá mais no Booking para novos clientes (assinantes existentes não serão afetados)."
- **Desocultar**: "Deseja desocultar esta assinatura? Ela voltará a aparecer no Booking para novos clientes."

### **Sucesso:**
- "Assinatura ocultada com sucesso!"
- "Assinatura desocultada com sucesso!"

### **Erro:**
- "Erro ao ocultar assinatura."
- "Erro ao desocultar assinatura."

## 🧪 **Como testar:**

### **1. Antes de executar no código:**

**⚠️ IMPORTANTE: Execute este SQL no Supabase SQL Editor primeiro:**

```sql
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
```

### **2. Testando a funcionalidade:**

1. **Vá para** Dashboard → **Meus Assinantes**
2. **Veja** a lista de "Tipos de Assinatura Criados"
3. **Clique** no ícone 👁️‍🗨️ (olho cortado) de uma assinatura
4. **Confirme** "OK"
5. **Observe** que a assinatura agora tem:
   - Badge "👁️ Oculta"
   - Aviso amarelo
   - Ícone mudou para 👁️ (olho aberto)
6. **Abra** o Booking (página de agendamento)
7. **Verifique** que a assinatura **NÃO** aparece mais
8. **Volte** ao Dashboard
9. **Clique** no ícone 👁️ (olho aberto) para desocultar
10. **Confirme** "OK"
11. **Assinatura volta** a aparecer no Booking ✅

## 🔍 **Logs de Debug:**

Ao ocultar/desocultar, você verá no console:

```
🔐 Ocultando assinatura: abc-123-def
✅ Assinatura ocultada com sucesso!
📋 Total de assinaturas: 3
👁️ Assinaturas ocultas: 1
✅ Assinaturas visíveis: 2
```

## 📝 **Observações:**

- ✅ **Reversível**: Pode ocultar e desocultar quantas vezes quiser
- ✅ **Não deleta**: Dados da assinatura são preservados
- ✅ **Assinantes preservados**: Quem já é assinante continua normalmente
- ✅ **Controle total**: Apenas o dono do estabelecimento vê e controla

---

**Agora você tem controle total sobre quais assinaturas ficam disponíveis para novos clientes!** 👁️

## 🎁 **Benefícios:**

1. **Flexibilidade**: Pause temporariamente sem deletar
2. **Testes**: Crie e teste assinaturas antes de liberar
3. **Sazonalidade**: Ative/desative conforme a época
4. **Organização**: Mantenha histórico sem poluir o Booking
5. **Segurança**: Assinantes existentes não são afetados

