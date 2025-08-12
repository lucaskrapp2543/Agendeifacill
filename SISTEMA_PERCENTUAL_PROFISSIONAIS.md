# Sistema de Percentual para Profissionais

## 📋 Visão Geral

O sistema de percentual para profissionais permite que o dono do estabelecimento configure automaticamente quanto cada profissional recebe por serviço realizado, baseado em um percentual configurado.

## 🎯 Funcionalidades

### 1. **Cadastro de Profissionais com Percentual**
- **Localização**: Dashboard > Configurações > Profissionais
- **Campos**: Nome, Senha (PIN), **Percentual (%)**
- **Percentual padrão**: 100%

### 2. **Exibição de Valores**

#### **Visão do Dono (Dashboard Principal)**
- **Valor Bruto**: Valor total do serviço (sem desconto)
- **Valor Líquido**: Valor que o profissional recebe (com percentual aplicado)
- **Exemplo**: Corte R$ 100, percentual 50% → Bruto R$ 100, Líquido R$ 50

#### **Visão do Profissional (Dashboard Individual)**
- **Apenas Valor Líquido**: Profissional vê somente o que vai receber
- **Exemplo**: Corte R$ 100, percentual 50% → Profissional vê R$ 50

### 3. **Cálculos Automáticos**

#### **Totais Diários/Mensais**
- **Total Bruto**: Soma de todos os valores dos serviços
- **Total Líquido**: Soma dos valores com percentual aplicado
- **Exemplo**: 2 cortes de R$ 100 cada
  - Total Bruto: R$ 200
  - Total Líquido (50%): R$ 100

## 🔧 Como Configurar

### 1. **Adicionar Novo Profissional**
1. Acesse **Dashboard > Configurações**
2. Clique em **"Adicionar Profissional"**
3. Preencha:
   - **Nome**: Nome completo do profissional
   - **Percentual**: % que o profissional recebe (ex: 50 para 50%)
   - **Senha**: PIN de 4 dígitos para acesso

### 2. **Editar Percentual Existente**
1. Acesse **Dashboard > Configurações**
2. Localize o profissional na lista
3. Altere o campo **Percentual**
4. Clique em **"Salvar Profissionais"** ou aguarde o salvamento automático

## 📊 Exemplos Práticos

### **Exemplo 1: Percentual 50%**
- **Serviço**: Corte masculino
- **Valor**: R$ 100
- **Percentual**: 50%
- **Resultado**:
  - Dono vê: Bruto R$ 100, Líquido R$ 50
  - Profissional vê: R$ 50

### **Exemplo 2: Percentual 70%**
- **Serviço**: Barba
- **Valor**: R$ 80
- **Percentual**: 70%
- **Resultado**:
  - Dono vê: Bruto R$ 80, Líquido R$ 56
  - Profissional vê: R$ 56

### **Exemplo 3: Múltiplos Serviços**
- **Dia**: 2 cortes de R$ 100 cada
- **Percentual**: 50%
- **Resultado**:
  - Total Bruto: R$ 200
  - Total Líquido: R$ 100
  - Lucro Barbearia: R$ 100

## 🎨 Interface

### **Dashboard Principal (Dono)**
```
Faturamento Hoje
Hoje: R$ 1.000,00
Líquido: R$ 600,00

Agendamentos
Valor bruto: R$ 100,00
Valor líquido: R$ 60,00
Total bruto: R$ 100,00
Total líquido: R$ 60,00
```

### **Dashboard Profissional**
```
Meus Agendamentos
Valor: R$ 60,00 (apenas valor líquido)
```

## ⚙️ Configurações Técnicas

### **Migração de Dados**
- Profissionais existentes recebem percentual padrão de 100%
- Migração automática ao aplicar a atualização

### **Validações**
- Percentual: 0% a 100%
- Valores negativos não são permitidos
- Percentual padrão: 100%

### **Salvamento Automático**
- Percentual é salvo automaticamente quando alterado
- Botão "Salvar Profissionais" disponível para salvamento manual

## 🔄 Atualizações Futuras

### **Funcionalidades Planejadas**
- [ ] Dashboard individual para profissionais
- [ ] Relatórios detalhados por profissional
- [ ] Configuração de percentual por serviço
- [ ] Histórico de alterações de percentual

## 📞 Suporte

Para dúvidas sobre o sistema de percentual:
1. Consulte esta documentação
2. Entre em contato com o suporte técnico
3. Verifique os logs do sistema para erros

---

**Versão**: 1.0  
**Data**: Janeiro 2025  
**Autor**: Sistema Agendei 