# Sistema de Seleção de Serviços para Metas dos Profissionais

## 📋 Visão Geral

Este sistema permite que o estabelecimento defina quais serviços específicos contam para a meta de cada profissional, evitando distorções causadas por serviços muito rápidos ou de baixo valor.

## 🎯 Objetivo

- **Organizar melhor** os serviços que entram no cálculo da meta
- **Evitar distorções** causadas por serviços muito rápidos (ex: 5 minutos)
- **Definir de forma justa** quais serviços realmente importam para a meta de desempenho
- **Permitir flexibilidade** na configuração de metas por profissional

## 🔧 Como Funciona

### 1. **Configuração da Meta**
- Ao definir uma meta para um profissional, o sistema oferece duas opções:
  - **Todos os serviços**: Conta todos os agendamentos concluídos
  - **Serviços específicos**: Conta apenas os serviços selecionados

### 2. **Interface de Seleção**
- **Botão "Selecionar"**: Abre/fecha a lista de serviços
- **Checkboxes**: Para cada serviço disponível no estabelecimento
- **Botões rápidos**: "Selecionar Todos" e "Desmarcar Todos"
- **Indicador visual**: Mostra quantos serviços estão selecionados

### 3. **Cálculo da Meta**
- **Serviços selecionados**: Apenas agendamentos dos serviços escolhidos contam
- **Nenhum serviço selecionado**: Todos os agendamentos contam (comportamento padrão)
- **Progresso em tempo real**: Atualização automática baseada nos agendamentos concluídos

## 📊 Exemplo Prático

### Cenário: Barbearia com Antônio
- **Serviços disponíveis**: Corte de Cabelo, Barba, Sobrancelha, Hidratação
- **Meta definida**: 50 serviços/mês
- **Serviços selecionados**: Apenas "Corte de Cabelo" e "Barba"

### Resultado:
- ✅ **Corte de Cabelo** concluído → +1 na meta
- ✅ **Barba** concluída → +1 na meta  
- ❌ **Sobrancelha** concluída → Não conta na meta (apenas faturamento)
- ❌ **Hidratação** concluída → Não conta na meta (apenas faturamento)

## 🗄️ Estrutura do Banco de Dados

### Tabela: `professional_goals`
```sql
ALTER TABLE professional_goals 
ADD COLUMN selected_services JSONB DEFAULT '[]'::jsonb;
```

### Estrutura de Serviços com Categorias:
```json
{
  "services_with_prices": [
    {
      "id": "service_1",
      "name": "Corte de Cabelo",
      "price": 25.00,
      "duration": 30
    },
    {
      "id": "service_2", 
      "name": "Barba",
      "price": 15.00,
      "duration": 15
    },
    {
      "id": "service_3",
      "name": "Corte + Barba",
      "price": 35.00,
      "duration": 40,
      "category": "Pacotes"
    },
    {
      "id": "service_4",
      "name": "Hidratação",
      "price": 30.00,
      "duration": 45,
      "category": "Tratamentos"
    },
    {
      "id": "service_5",
      "name": "Escova",
      "price": 20.00,
      "duration": 30,
      "category": "Tratamentos"
    }
  ]
}
```

### Exemplo de Meta com Serviços Selecionados:
```json
{
  "id": "uuid",
  "establishment_id": "uuid", 
  "professional_id": "antonio_123",
  "year": 2024,
  "month": 12,
  "goal_amount": 50,
  "selected_services": ["service_1", "service_2", "service_3"]
}
```

## 🔄 Fluxo de Funcionamento

### 1. **Definição da Meta**
```
Usuário → Abre modal de meta → Define quantidade → Seleciona serviços → Salva
```

### 2. **Cálculo do Progresso**
```
Sistema → Busca agendamentos concluídos → Filtra por serviços selecionados → Calcula progresso
```

### 3. **Atualização em Tempo Real**
```
Novo agendamento concluído → Verifica se conta para meta → Atualiza progresso
```

## 🎨 Interface do Usuário

### Modal de Meta Atualizado:
- **Seção de quantidade**: Campo numérico para meta mensal
- **Seção de serviços**: Duas categorias organizadas
- **Indicadores visuais**: Cores diferentes para cada tipo
- **Botões de ação**: Selecionar/desmarcar todos ou por categoria

### Tipos de Seleção:

#### 🔵 **Serviços Normais** (sem categoria)
- Lista individual com checkboxes
- Serviços básicos do estabelecimento
- Seleção individual

#### 🟢 **Serviços por Categoria** (com categoria)
- Agrupados por categoria (ex: "Pacotes", "Tratamentos")
- Contador por categoria (ex: "Pacotes (2/3)")
- Botões "Todos" e "Nenhum" por categoria
- Seleção em lote por categoria

### Estados Visuais:
- 🟡 **Amarelo**: "Todos os serviços" contarão para a meta
- 🟢 **Verde**: "X serviço(s)" selecionado(s) para a meta
- 🔵 **Azul**: Serviços normais selecionados
- 🟢 **Verde**: Serviços por categoria selecionados

## 📈 Benefícios

### Para o Estabelecimento:
- **Controle preciso** sobre quais serviços contam para metas
- **Flexibilidade** para ajustar metas por tipo de serviço
- **Justiça** na avaliação de desempenho dos profissionais

### Para os Profissionais:
- **Metas mais realistas** baseadas em serviços relevantes
- **Motivação adequada** sem distorções por serviços rápidos
- **Transparência** sobre quais serviços contam para a meta

## 🔧 Implementação Técnica

### Arquivos Modificados:
1. **`GoalModal.tsx`**: Interface de seleção de serviços
2. **`EstablishmentDashboard.tsx`**: Integração com o modal
3. **`supabase.ts`**: Funções de banco de dados
4. **`add_goal_services_selection.sql`**: Migração do banco

### Funções Principais:
- `setProfessionalGoal()`: Salva meta com serviços selecionados
- `getProfessionalSelectedServices()`: Busca serviços selecionados
- `get_professional_goal_progress()`: Calcula progresso considerando filtros

## 🚀 Como Usar

### 1. **Acessar Metas**
- Ir para `/dashboard/establishment`
- Aba "Profissionais"
- Clicar em "Definir Meta" para um profissional

### 2. **Configurar Meta**
- Definir quantidade de serviços mensais
- Clicar em "Selecionar" para escolher serviços
- Marcar/desmarcar serviços desejados
- Salvar configuração

### 3. **Acompanhar Progresso**
- O sistema calcula automaticamente o progresso
- Considera apenas os serviços selecionados
- Atualiza em tempo real conforme agendamentos são concluídos

## ⚠️ Considerações Importantes

### Compatibilidade:
- **Metas existentes**: Continuam funcionando (todos os serviços)
- **Novas metas**: Podem usar seleção específica de serviços
- **Migração**: Automática e transparente

### Performance:
- **Índices otimizados** para consultas por serviços
- **Cache local** para melhorar responsividade
- **Consultas eficientes** no banco de dados

### Segurança:
- **Validação** de serviços selecionados
- **Permissões** adequadas para modificação de metas
- **Auditoria** de alterações nas configurações

---

## 📝 Resumo

O sistema de seleção de serviços para metas oferece **controle granular** sobre quais atendimentos contam para o desempenho dos profissionais, promovendo **justiça** e **flexibilidade** na gestão de metas do estabelecimento.

**Resultado**: Metas mais precisas e motivadoras, sem distorções causadas por serviços de diferentes complexidades ou durações.
