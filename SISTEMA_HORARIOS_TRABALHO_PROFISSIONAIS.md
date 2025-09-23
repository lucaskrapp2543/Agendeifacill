# Sistema de Horários de Trabalho dos Profissionais

## Visão Geral

O sistema de horários de trabalho permite que cada profissional defina seus próprios horários de trabalho, independente do horário padrão do estabelecimento. Isso oferece maior flexibilidade para profissionais que trabalham em horários diferentes do estabelecimento.

## Funcionalidades Implementadas

### 1. Interface de Configuração

- **Localização**: Dashboard do Estabelecimento → Aba Profissionais → Botão "Horários de Trabalho"
- **Posição**: Logo abaixo da opção "Bloquear Horário"
- **Ícone**: ⏰

### 2. Modal de Configuração

O modal permite configurar horários para cada dia da semana com os seguintes campos:

- **Horário de entrada**: Quando o profissional começa a trabalhar
- **Horário de intervalo**: Início do intervalo (opcional)
- **Volta do intervalo**: Fim do intervalo (opcional)
- **Horário de saída**: Quando o profissional termina o trabalho

### 3. Lógica de Funcionamento

#### Comportamento Padrão
- Se o profissional **não configurar** horários personalizados, o sistema usa automaticamente o horário padrão do estabelecimento
- O horário padrão é definido nas "Configurações do Estabelecimento"

#### Comportamento Personalizado
- Se o profissional **configurar** horários personalizados, o sistema considera **exclusivamente** os horários do profissional
- Os clientes só poderão agendar nos horários que o profissional definiu como disponível

### 4. Exemplo Prático

**Cenário**: Profissional Antônio define que trabalha das 14h às 18h

**Resultado**:
- ❌ Clientes **não poderão** agendar às 11h ou 13h45
- ✅ Clientes **poderão** agendar apenas entre 14h e 18h
- O sistema só exibirá horários que correspondem à agenda do Antônio

## Estrutura Técnica

### Banco de Dados

```sql
-- Campo adicionado aos profissionais
work_hours: {
  "monday": {
    "enabled": true,
    "entry_time": "08:00",
    "break_start": "12:00",
    "break_end": "13:00",
    "exit_time": "17:00"
  },
  "tuesday": {
    "enabled": false
  },
  // ... outros dias
}
```

### Componentes Modificados

1. **TimeSlotSelector**: Lógica principal para gerar horários disponíveis
2. **BusinessHoursSelector**: Interface para seleção de horários
3. **AppointmentForm**: Integração com horários personalizados
4. **EstablishmentDashboard**: Interface de configuração

### Arquivos de Migração

- `create_professional_work_hours_system.sql`: Migração do banco de dados

## Como Usar

### Para o Estabelecimento

1. Acesse o Dashboard do Estabelecimento
2. Vá para a aba "Profissionais"
3. Clique em "Horários de Trabalho" no profissional desejado
4. Configure os horários para cada dia da semana
5. Salve as configurações

### Para os Clientes

- Os horários personalizados são aplicados automaticamente
- Não há necessidade de configuração adicional
- O sistema mostra apenas horários disponíveis do profissional

## Benefícios

1. **Flexibilidade**: Profissionais podem ter horários diferentes do estabelecimento
2. **Precisão**: Agendamentos respeitam a disponibilidade real de cada profissional
3. **Autonomia**: Cada profissional controla seus próprios horários
4. **Simplicidade**: Interface intuitiva e fácil de usar

## Considerações Técnicas

- Os horários personalizados têm prioridade sobre os horários padrão do estabelecimento
- O sistema valida se o serviço cabe no horário disponível
- Intervalos são opcionais e podem ser configurados conforme necessário
- A funcionalidade é compatível com o sistema de bloqueio de horários existente

## Status da Implementação

✅ **Concluído**:
- Interface de configuração
- Lógica de geração de horários
- Integração com sistema de agendamentos
- Migração do banco de dados

🔄 **Em Teste**:
- Validação completa da funcionalidade
- Testes de integração

## Próximos Passos

1. Testar a funcionalidade em ambiente de desenvolvimento
2. Validar com diferentes cenários de horários
3. Deploy para produção
4. Treinamento dos usuários
