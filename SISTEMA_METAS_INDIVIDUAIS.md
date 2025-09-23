# Sistema de Metas Individuais para Profissionais

## Funcionalidade Implementada

Este sistema permite que estabelecimentos definam metas mensais de serviços para cada profissional e acompanhem o progresso em tempo real.

## Como Funciona

### 1. Dashboard do Estabelecimento
- No dashboard, na seção "Profissionais", cada profissional agora tem um botão **"META"** 🎯
- O botão fica localizado acima do botão "Ausência"
- Ao clicar, abre um modal para definir a meta mensal

### 2. Definir Meta
- No modal, o proprietário pode:
  - Definir quantos serviços o profissional deve realizar no mês (ex: 10, 20, 50)
  - Usar sugestões rápidas (10, 20, 30, 50, 80, 100)
  - Visualizar explicação de como funciona
- A meta é salva automaticamente no banco de dados

### 3. Exibição na Tela de Agendamento
- Quando um cliente seleciona um profissional específico na tela de agendamento
- Aparece uma barra de progresso compacta mostrando:
  - Meta do mês (ex: 10 serviços)
  - Serviços realizados (ex: 6 serviços)
  - Percentual concluído (ex: 60%)
  - Serviços restantes (ex: 4 restantes)

### 4. Cálculo Automático
- O sistema conta automaticamente todos os agendamentos com status "completed" do profissional no mês atual
- A meta é mensal e se renova automaticamente a cada mês
- O progresso é atualizado em tempo real

## Estrutura do Banco de Dados

### Tabela: professional_goals
```sql
- id: UUID (chave primária)
- establishment_id: UUID (referência ao estabelecimento)
- professional_id: TEXT (ID do profissional)
- year: INTEGER (ano da meta)
- month: INTEGER (mês da meta, 1-12)
- goal_amount: INTEGER (quantidade de serviços na meta)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Funções Criadas
- `setProfessionalGoal()` - Define uma meta para um profissional
- `getProfessionalGoal()` - Obtém a meta de um profissional
- `getProfessionalGoalProgress()` - Calcula o progresso da meta
- `removeProfessionalGoal()` - Remove uma meta
- `getEstablishmentGoals()` - Obtém todas as metas de um estabelecimento

## Componentes Criados

### 1. GoalModal.tsx
- Modal para definir metas
- Interface intuitiva com sugestões rápidas
- Validação de entrada (1-999 serviços)
- Feedback visual durante salvamento

### 2. GoalProgressBar.tsx
- Barra de progresso visual
- Duas versões: completa (dashboard) e compacta (agendamento)
- Cores dinâmicas baseadas no progresso:
  - Verde: Meta atingida (100%+)
  - Azul: Bom progresso (75%+)
  - Amarelo: Progresso médio (50%+)
  - Vermelho: Progresso baixo (<50%)

### 3. Integração no ProfessionalSelector.tsx
- Carrega automaticamente o progresso quando um profissional é selecionado
- Exibe a barra de progresso compacta
- Atualização em tempo real

## Como Usar

### Para o Proprietário do Estabelecimento:
1. Acesse o Dashboard do Estabelecimento
2. Vá para a aba "Profissionais"
3. Clique no botão "META" 🎯 do profissional desejado
4. Defina a quantidade de serviços que o profissional deve realizar no mês
5. Clique em "Salvar Meta"

### Para os Clientes:
1. Na tela de agendamento, selecione um profissional específico
2. Veja automaticamente o progresso da meta do profissional
3. A barra mostra quantos serviços ele já fez e quantos faltam para a meta

## Características Técnicas

- **Metas Mensais**: Cada mês tem sua própria meta independente
- **Cálculo Automático**: Baseado em agendamentos com status "completed"
- **Tempo Real**: Atualização automática do progresso
- **Responsivo**: Funciona em desktop e mobile
- **Performance**: Consultas otimizadas com índices no banco
- **Segurança**: Row Level Security (RLS) implementado

## Exemplo de Uso

```
Profissional: João
Meta do Mês: 20 serviços
Serviços Realizados: 12
Progresso: 60%
Serviços Restantes: 8
```

A barra de progresso mostra 60% preenchida em azul, indicando bom progresso.

## Próximos Passos

Para aplicar esta funcionalidade:
1. Execute o script `create_professional_goals_system.sql` no banco de dados
2. Os componentes já estão integrados e funcionais
3. A funcionalidade estará disponível imediatamente no dashboard e na tela de agendamento
