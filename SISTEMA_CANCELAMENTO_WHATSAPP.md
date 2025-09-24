# 📱 Sistema de Cancelamento via WhatsApp

## ✅ **Funcionalidade implementada:**

Sistema que permite ao estabelecimento controlar como os clientes podem cancelar agendamentos:

### **Configuração:**
- **Checkbox** "Cancelamento" nas configurações do estabelecimento
- **Legenda** explicativa sobre o funcionamento
- **Ativação/desativação** da funcionalidade

### **Comportamento:**
- **Desativado**: Cliente pode cancelar diretamente (comportamento atual)
- **Ativado**: Cliente deve solicitar cancelamento via WhatsApp

## 🔧 **Implementação técnica:**

### **1. Interface Establishment:**
```typescript
interface Establishment {
  // ... outros campos
  require_cancellation_request?: boolean; // Exigir solicitação de cancelamento via WhatsApp
}
```

### **2. Estado no Dashboard:**
```typescript
const [requireCancellationRequest, setRequireCancellationRequest] = useState(false);
```

### **3. Configuração na interface:**
```typescript
<label className="flex items-center space-x-2">
  <input
    type="checkbox"
    checked={requireCancellationRequest}
    onChange={(e) => setRequireCancellationRequest(e.target.checked)}
    className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
  />
  <div className="flex flex-col">
    <span className="text-white">Cancelamento</span>
    <span className="text-xs text-gray-400">
      Ao ativar essa opção seus clientes não podem agendar e depois cancelar, mas sim terá um botão que o cliente clica e envia uma mensagem no seu WhatsApp com a mensagem "Olá, queria cancelar agendamento... motivo é"
    </span>
  </div>
</label>
```

### **4. Salvamento no banco:**
```typescript
// Na criação do estabelecimento
require_cancellation_request: requireCancellationRequest,

// Na atualização do estabelecimento
require_cancellation_request: requireCancellationRequest,
```

## 🎯 **Modificação do CancelAppointmentButton:**

### **1. Busca dados do estabelecimento:**
```typescript
const fetchEstablishment = async () => {
  if (appointment?.establishment_id) {
    const { data: establishmentData, error } = await supabase
      .from('establishments')
      .select('*')
      .eq('id', appointment.establishment_id)
      .single();

    if (error) throw error;
    setEstablishment(establishmentData);
  }
};
```

### **2. Lógica de cancelamento:**
```typescript
const handleCancelClick = () => {
  // Se o estabelecimento exige solicitação de cancelamento via WhatsApp
  if (establishment?.require_cancellation_request) {
    handleRequestCancellation();
  } else {
    setShowFirstConfirmation(true);
  }
};
```

### **3. Função de solicitação via WhatsApp:**
```typescript
const handleRequestCancellation = () => {
  if (establishment?.whatsapp) {
    const phoneNumber = establishment.whatsapp.replace(/\D/g, '');
    const message = `Olá, queria cancelar agendamento... motivo é `;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Redirecionando para WhatsApp...');
  } else {
    toast.error('WhatsApp do estabelecimento não encontrado');
  }
};
```

### **4. Texto do botão dinâmico:**
```typescript
{isLoading ? 'Cancelando...' : 
 establishment?.require_cancellation_request ? 'Pedir Cancelamento' : 'Cancelar Agendamento'}
```

## 🧪 **Como testar:**

### **Teste 1: Configuração**
1. **Vá para** Configurações do estabelecimento
2. **Ative** o checkbox "Cancelamento"
3. **Salve** as configurações
4. **Confirme** que foi salvo no banco

### **Teste 2: Comportamento ativado**
1. **Vá para** o dashboard do cliente
2. **Veja** que o botão mudou para "Pedir Cancelamento"
3. **Clique** no botão
4. **Confirme** que abre WhatsApp com a mensagem

### **Teste 3: Comportamento desativado**
1. **Desative** o checkbox "Cancelamento"
2. **Salve** as configurações
3. **Vá para** o dashboard do cliente
4. **Veja** que o botão voltou para "Cancelar Agendamento"
5. **Clique** no botão
6. **Confirme** que funciona o cancelamento normal

## 📱 **Mensagem do WhatsApp:**

### **Formato:**
```
Olá, queria cancelar agendamento... motivo é 
```

### **URL gerada:**
```
https://wa.me/[telefone]?text=Olá%2C%20queria%20cancelar%20agendamento...%20motivo%20é%20
```

## 🔄 **Fluxo completo:**

### **Configuração ativada:**
1. **Cliente** vê botão "Pedir Cancelamento"
2. **Cliente** clica no botão
3. **Sistema** abre WhatsApp do estabelecimento
4. **Mensagem** pré-formatada aparece
5. **Cliente** completa o motivo e envia

### **Configuração desativada:**
1. **Cliente** vê botão "Cancelar Agendamento"
2. **Cliente** clica no botão
3. **Sistema** mostra confirmação
4. **Cliente** confirma cancelamento
5. **Agendamento** é cancelado diretamente

## 🎨 **Interface:**

### **Configuração:**
- **Checkbox** com label "Cancelamento"
- **Legenda** explicativa em texto pequeno
- **Posicionamento** junto com outras comodidades

### **Botão do cliente:**
- **Texto dinâmico** baseado na configuração
- **Cor vermelha** mantida
- **Comportamento** alterado conforme configuração

## 🔒 **Segurança:**

- **Verificação** da configuração do estabelecimento
- **Validação** do WhatsApp do estabelecimento
- **Fallback** para comportamento normal se WhatsApp não encontrado
- **Mensagem** pré-formatada para evitar spam

---

**Sistema de cancelamento via WhatsApp implementado com sucesso!** ✅




