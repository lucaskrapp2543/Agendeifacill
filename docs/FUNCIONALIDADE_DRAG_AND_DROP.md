# Funcionalidade de Drag and Drop para Serviços

## Descrição

Implementamos uma funcionalidade de arrastar e soltar (drag and drop) para reordenar os serviços na seção de configurações do dashboard do estabelecimento.

## Como Funciona

### Para o Usuário
1. Acesse o dashboard do estabelecimento
2. Vá para a aba "Configurações"
3. Na seção "Serviços", você verá a lista de serviços cadastrados
4. Cada serviço tem um ícone de "grip" (⋮⋮) no lado esquerdo
5. Clique e arraste o ícone para mover o serviço para uma nova posição
6. A ordem será salva automaticamente

### Características Visuais
- **Ícone de arrastar**: Mostra claramente que o item pode ser movido
- **Feedback visual**: Durante o arrasto, o item fica semi-transparente e com borda destacada
- **Hover effect**: Ao passar o mouse sobre o ícone, ele muda de cor
- **Indicador de salvamento**: Mostra "Salvando ordem..." quando está salvando

## Implementação Técnica

### Componentes Criados
- `DraggableServiceList.tsx`: Componente principal com funcionalidade de drag and drop
- `SortableServiceItem.tsx`: Item individual arrastável (dentro do componente principal)

### Bibliotecas Utilizadas
- `@dnd-kit/core`: Funcionalidade básica de drag and drop
- `@dnd-kit/sortable`: Funcionalidade específica para ordenação
- `@dnd-kit/utilities`: Utilitários para transformações CSS

### Funcionalidades Implementadas
1. **Drag and Drop**: Arrastar e soltar para reordenar
2. **Salvamento Automático**: A ordem é salva automaticamente no banco de dados
3. **Feedback Visual**: Indicadores visuais durante o processo
4. **Acessibilidade**: Suporte para navegação por teclado
5. **Responsividade**: Funciona em dispositivos móveis e desktop

### Estrutura de Dados
```typescript
interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}
```

## Como Testar

1. Adicione alguns serviços no dashboard
2. Tente arrastar um serviço para uma posição diferente
3. Verifique se a ordem foi salva corretamente
4. Recarregue a página para confirmar que a ordem persiste

## Benefícios

- **UX Melhorada**: Interface mais intuitiva e moderna
- **Eficiência**: Reordenação rápida sem necessidade de formulários
- **Feedback Imediato**: O usuário vê instantaneamente as mudanças
- **Persistência**: A ordem é salva automaticamente no banco de dados

## Compatibilidade

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Mobile (iOS Safari, Chrome Mobile)
- ✅ Tablets
- ✅ Navegação por teclado
