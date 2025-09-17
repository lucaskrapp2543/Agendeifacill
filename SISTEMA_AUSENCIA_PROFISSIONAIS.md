# Sistema de Ausência dos Profissionais

## 📋 Visão Geral

O sistema de ausência dos profissionais permite que o dono do estabelecimento configure dias específicos em que cada profissional estará ausente, bloqueando automaticamente novos agendamentos nesses dias.

## 🎯 Funcionalidades

### 1. **Configuração de Ausências**
- **Localização**: Dashboard → Estabelecimento → Configurações → Profissional
- **Acesso**: Nova opção "Ausência" abaixo das opções de percentual e senha
- **Interface**: Calendário interativo para seleção de dias

### 2. **Seleção de Dias**
- **Calendário Visual**: Interface intuitiva com calendário mensal
- **Navegação entre Meses**: Botões para navegar entre meses futuros
- **Múltipla Seleção**: Possibilidade de marcar vários dias não consecutivos
- **Exemplo**: Marcar dias 1, 2, 3, 4, 5, 6, 7, 8 → depois marcar dias 20, 21, 22, 23
- **Validação**: Não permite marcar dias passados ou navegar para meses passados

### 3. **Bloqueio Automático**
- **Agendamentos Bloqueados**: Nenhum cliente consegue agendar nos dias de ausência
- **Verificação em Tempo Real**: Sistema verifica ausências ao mostrar horários disponíveis
- **Mensagem Clara**: Exibe "Profissional ausente neste dia" quando necessário

## 🔧 Como Usar

### 1. **Configurar Ausências**
1. Acesse **Dashboard → Configurações**
2. Na seção **Profissionais**, localize o profissional desejado
3. Clique no botão **"Ausência"** (com ícone de calendário 📅)
4. No modal que abrir:
   - Use os botões **"← Anterior"** e **"Próximo →"** para navegar entre meses
   - Selecione os dias de ausência clicando nas datas
   - Dias selecionados aparecem em vermelho
   - Visualize a lista de dias selecionados
   - Clique em **"Salvar Ausências"**

### 2. **Navegar entre Meses**
- **Mês Atual**: Modal sempre abre no mês atual
- **Mês Anterior**: Botão "← Anterior" (desabilitado no mês atual)
- **Próximos Meses**: Botão "Próximo →" para navegar para meses futuros
- **Sem Limite**: Pode navegar para qualquer mês futuro (2025, 2026, etc.)

### 3. **Gerenciar Ausências**
- **Adicionar Dias**: Clique em novas datas no calendário
- **Remover Dias**: Clique novamente nas datas vermelhas ou use o "×" na lista
- **Visualizar Lista**: Veja todos os dias selecionados abaixo do calendário
- **Múltiplos Meses**: Selecione dias em diferentes meses navegando entre eles

### 4. **Verificar Bloqueios**
- **Teste de Agendamento**: Tente agendar nos dias de ausência
- **Resultado Esperado**: Sistema deve mostrar "Profissional ausente neste dia"
- **Outros Dias**: Funcionamento normal para dias não marcados como ausência

## 📊 Exemplos Práticos

### **Exemplo 1: Ausência de 1 semana**
- **Profissional**: João Silva
- **Dias Ausentes**: 15/01, 16/01, 17/01, 18/01, 19/01, 20/01, 21/01
- **Resultado**: Nenhum agendamento possível com João Silva nesta semana

### **Exemplo 2: Ausências Esparsas**
- **Profissional**: Maria Santos
- **Dias Ausentes**: 10/01, 25/01, 03/02, 15/02
- **Resultado**: Maria indisponível apenas nos dias específicos

### **Exemplo 3: Ausências em Múltiplos Meses**
- **Profissional**: Ana Costa
- **Janeiro 2025**: Ausente 15/01, 20/01, 25/01
- **Fevereiro 2025**: Ausente 05/02, 10/02, 15/02, 20/02
- **Março 2025**: Ausente 01/03, 08/03, 15/03
- **Resultado**: Ana indisponível nos dias específicos de cada mês

### **Exemplo 4: Múltiplos Profissionais**
- **João**: Ausente 15/01 a 21/01
- **Maria**: Ausente 10/01, 25/01
- **Pedro**: Sem ausências
- **Resultado**: Apenas Pedro disponível nos dias de ausência dos outros

## 🎨 Interface

### **Modal de Ausências**
```
┌─────────────────────────────────────┐
│ Configurar Ausências - João Silva   │
├─────────────────────────────────────┤
│ Selecione os dias de ausência...    │
│                                     │
│ [← Anterior]  Janeiro 2025  [Próximo →] │
│                                     │
│  Dom Seg Ter Qua Qui Sex Sáb        │
│   1   2   3   4   5   6   7        │
│   8   9  10  11  12  13  14        │
│  15  16  17  18  19  20  21        │
│  22  23  24  25  26  27  28        │
│                                     │
│ Dias Selecionados:                  │
│ [15/01] [16/01] [17/01] [18/01]    │
│                                     │
│        [Cancelar] [Salvar]          │
└─────────────────────────────────────┘
```

### **Agendamento Bloqueado**
```
┌─────────────────────────────────────┐
│ Horários Disponíveis                │
├─────────────────────────────────────┤
│ ❌ Profissional ausente neste dia   │
└─────────────────────────────────────┘
```

## ⚙️ Configurações Técnicas

### **Armazenamento**
- **Local**: Campo `absences` no array `professionals` da tabela `establishments`
- **Formato**: Array de strings no formato "YYYY-MM-DD"
- **Exemplo**: `["2025-01-15", "2025-01-16", "2025-01-17"]`

### **Validações**
- **Datas Passadas**: Não permitidas para seleção
- **Formato**: Sempre no padrão ISO (YYYY-MM-DD)
- **Limite**: Sem limite de dias de ausência

### **Integração**
- **TimeSlotSelector**: Verifica ausências antes de mostrar horários
- **AppointmentForm**: Bloqueia agendamentos em dias de ausência
- **BusinessHoursSelector**: Respeita ausências do profissional

## 🔄 Funcionalidades Futuras

### **Melhorias Planejadas**
- [ ] Ausências recorrentes (ex: toda segunda-feira)
- [ ] Ausências por período (ex: 15/01 a 20/01)
- [ ] Notificações automáticas para clientes
- [ ] Relatório de ausências
- [ ] Ausências por motivo (férias, doença, etc.)

## 📞 Suporte

### **Problemas Comuns**
1. **Ausências não aparecem**: Verificar se foram salvas corretamente
2. **Agendamentos ainda permitidos**: Limpar cache do navegador
3. **Modal não abre**: Verificar se há profissionais cadastrados

### **Contato**
Para dúvidas sobre o sistema de ausências:
1. Consulte esta documentação
2. Entre em contato com o suporte técnico
3. Verifique os logs do sistema para erros

---

**Versão**: 1.0  
**Data**: Janeiro 2025  
**Autor**: Sistema Agendei Fácil
