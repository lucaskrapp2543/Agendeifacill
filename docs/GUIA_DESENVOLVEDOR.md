# 👨‍💻 Guia do Desenvolvedor - AgendaFácil

## 🚀 Setup Inicial

### 1. Configuração do Ambiente
```bash
# Clone do repositório
git clone [url-do-repositorio]
cd project

# Instalação das dependências
npm install

# Configuração das variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase
```

### 2. Estrutura de Pastas Importante
```
src/
├── components/     # Componentes reutilizáveis
├── pages/         # Páginas da aplicação  
├── context/       # Estados globais (Auth, Supabase)
├── lib/           # Configurações e utilitários
├── hooks/         # Custom hooks
└── types/         # Definições TypeScript
```

## 🔧 Comandos Essenciais

```bash
# Desenvolvimento
npm run dev                 # Servidor local
npm run dev -- --host      # Acesso via rede

# Build e Deploy  
npm run build              # Build de produção
npm run preview            # Preview do build

# Qualidade de Código
npm run lint               # ESLint
```

## 📋 Tarefas Comuns

### Adicionar Nova Página
1. Crie o arquivo em `src/pages/MinhaNovaPage.tsx`
2. Adicione a rota em `src/App.tsx`
3. Configure proteção se necessário (`ProtectedRoute`)

### Criar Novo Componente
1. Crie em `src/components/MeuComponente.tsx`
2. Use TypeScript para tipagem
3. Exporte como default

### Adicionar Nova Funcionalidade ao Supabase
1. Implemente a função em `src/lib/supabase.ts`
2. Use tratamento de erro (try/catch)
3. Adicione logs para debugging
4. Teste a função localmente

## 🗄️ Trabalhar com Banco de Dados

### Principais Funções (supabase.ts)
```typescript
// Autenticação
signUp()              # Criar conta
signIn()              # Login
signOut()             # Logout
getCurrentUser()      # Usuário atual

// Estabelecimentos
createEstablishment() # Criar estabelecimento
getEstablishmentByCode() # Buscar por código
updateEstablishment() # Atualizar dados

// Agendamentos
createAppointment()   # Criar agendamento
getClientAppointments() # Agendamentos do cliente
getEstablishmentAppointments() # Agendamentos do estabelecimento
cancelAppointment()   # Cancelar agendamento

// Favoritos
addFavoriteEstablishment() # Adicionar favorito
getUserFavoriteEstablishments() # Listar favoritos
removeFavoriteEstablishment() # Remover favorito
```

### Exemplo de Nova Função
```typescript
export const minhaNovaFuncao = async (parametro: string) => {
  try {
    console.log('Executando função:', parametro);
    
    const { data, error } = await supabase
      .from('tabela')
      .select('*')
      .eq('campo', parametro);

    if (error) {
      console.error('Erro na função:', error);
      throw error;
    }

    console.log('Resultado:', data);
    return { data, error: null };
    
  } catch (error: any) {
    console.error('Erro capturado:', error);
    return { data: null, error };
  }
};
```

## 🎨 Estilização com TailwindCSS

### Classes Mais Usadas
```css
/* Layout */
flex, grid, w-full, h-full
container, mx-auto, px-4

/* Cores do Projeto */
bg-blue-600       # Azul principal
bg-gray-100       # Fundo claro
text-gray-900     # Texto escuro
text-white        # Texto branco

/* Botões */
bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded

/* Cards */
bg-white rounded-lg shadow p-6

/* Responsivo */
sm:, md:, lg:, xl: # Breakpoints
```

### Exemplo de Componente Estilizado
```tsx
const MeuComponente = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Título do Componente
      </h2>
      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors">
        Meu Botão
      </button>
    </div>
  );
};
```

## 🔐 Sistema de Autenticação

### Context de Autenticação
```tsx
// Usar em qualquer componente
import { useAuth } from '../context/AuthContext';

const MeuComponente = () => {
  const { user, userRole, loading } = useAuth();
  
  if (loading) return <div>Carregando...</div>;
  
  if (!user) return <div>Não logado</div>;
  
  return <div>Olá, {user.email}! Você é: {userRole}</div>;
};
```

### Proteger Rotas
```tsx
// Em App.tsx
<Route 
  path="/minha-rota-protegida" 
  element={
    <ProtectedRoute allowedRoles={['client', 'premium']}>
      <MinhaPage />
    </ProtectedRoute>
  } 
/>
```

## 🚨 Debugging e Logs

### Console Logs Implementados
- Todas as funções do Supabase têm logs
- Erros são capturados e logados
- Use `console.log()` para debugging local

### Pontos de Debug Importantes
```typescript
// Sempre logue os dados importantes
console.log('Dados recebidos:', data);
console.log('Erro capturado:', error);
console.log('Estado atual:', state);

// Use try/catch em funções async
try {
  const result = await minhaFuncaoAsync();
  console.log('Sucesso:', result);
} catch (error) {
  console.error('Erro:', error);
}
```

## 📱 Responsividade

### Breakpoints TailwindCSS
```css
sm: 640px     # Mobile pequeno
md: 768px     # Tablet
lg: 1024px    # Desktop pequeno
xl: 1280px    # Desktop grande
```

### Exemplo Responsivo
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Mobile: 1 coluna, Tablet: 2 colunas, Desktop: 3 colunas */}
</div>
```

## 🔄 Estados e Context

### Context Disponíveis
- **AuthContext**: Estado de autenticação
- **SupabaseContext**: Cliente Supabase

### Exemplo de Custom Hook
```tsx
// src/hooks/useEstablishments.ts
import { useState, useEffect } from 'react';
import { getEstablishmentByCode } from '../lib/supabase';

export const useEstablishment = (code: string) => {
  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEstablishment = async () => {
      try {
        const { data, error } = await getEstablishmentByCode(code);
        if (error) throw error;
        setEstablishment(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchEstablishment();
    }
  }, [code]);

  return { establishment, loading, error };
};
```

## 🐛 Problemas Comuns e Soluções

### 1. Erro de Build
```bash
# Limpe node_modules e reinstale
rm -rf node_modules package-lock.json
npm install
```

### 2. Erro de Supabase Connection
- Verificar variáveis de ambiente (.env.local)
- Confirmar URL e chaves do Supabase
- Verificar se o projeto Supabase está ativo

### 3. Erro de Tipagem TypeScript
```typescript
// Use 'any' temporariamente e depois melhore
const dados: any = response;

// Ou crie interface específica
interface MinhaInterface {
  id: string;
  name: string;
}
```

### 4. Rota Protegida Não Funciona
- Verificar se user tem a role correta
- Confirmar se ProtectedRoute está configurado
- Checar se AuthContext está funcionando

## 📋 Checklist de Deploy

### Antes de Fazer Deploy
- [ ] `npm run build` executa sem erros
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Funcionalidades testadas localmente
- [ ] ESLint sem erros críticos
- [ ] Responsividade testada

### Deploy na Vercel
1. Conecte o repositório
2. Configure variáveis de ambiente
3. Build automático a cada push

## 🔗 Recursos Úteis

### Documentação
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://reactjs.org/docs)
- [TailwindCSS](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)

### Ferramentas de Desenvolvimento
- **Supabase Dashboard**: Gerenciar banco de dados
- **React DevTools**: Debug de componentes
- **Browser DevTools**: Network, Console, Elements

---

## 📞 Suporte

Se encontrar problemas:
1. Consulte esta documentação
2. Verifique os logs no console
3. Consulte a documentação das tecnologias
4. Procure soluções em issues do GitHub

---

*Última atualização: Novembro 2024* 