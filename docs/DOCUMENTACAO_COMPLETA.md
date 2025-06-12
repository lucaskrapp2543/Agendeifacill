# 📋 AgendaFácil - Documentação Completa do Projeto

## 📝 Índice
1. [Visão Geral](#visão-geral)
2. [Tecnologias Utilizadas](#tecnologias-utilizadas)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Funcionalidades](#funcionalidades)
6. [Tipos de Usuário](#tipos-de-usuário)
7. [Banco de Dados](#banco-de-dados)
8. [Configuração do Ambiente](#configuração-do-ambiente)
9. [Deploy e Hosting](#deploy-e-hosting)
10. [Como Executar o Projeto](#como-executar-o-projeto)
11. [Scripts Disponíveis](#scripts-disponíveis)
12. [Links Afiliados](#links-afiliados)
13. [Estrutura de Componentes](#estrutura-de-componentes)
14. [Autenticação e Autorização](#autenticação-e-autorização)
15. [Guia para Desenvolvimento](#guia-para-desenvolvimento)

---

## 🎯 Visão Geral

O **AgendaFácil** é um sistema completo de agendamentos online desenvolvido para facilitar a marcação de horários entre clientes e estabelecimentos. O sistema oferece três tipos de conta: Cliente, Estabelecimento e Premium, cada uma com funcionalidades específicas.

### Principais Objetivos:
- Simplificar o processo de agendamento de serviços
- Oferecer uma interface intuitiva para clientes e estabelecimentos
- Fornecer funcionalidades premium para usuários avançados
- Integrar sistema de links afiliados para monetização

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18.3.1** - Biblioteca principal para interface do usuário
- **TypeScript 5.5.3** - Tipagem estática para JavaScript
- **Vite 5.4.2** - Build tool e dev server
- **React Router DOM 6.23.0** - Roteamento da aplicação
- **TailwindCSS 3.4.1** - Framework CSS para estilização
- **Lucide React 0.344.0** - Biblioteca de ícones

### Backend/Database
- **Supabase 2.39.8** - Backend-as-a-Service (PostgreSQL + Auth + Storage)
- **PostgreSQL** - Banco de dados relacional (via Supabase)

### Utilitários
- **date-fns 3.6.0** - Manipulação de datas
- **ESLint 9.9.1** - Linting do código
- **PostCSS 8.4.35** - Processamento CSS
- **Autoprefixer 10.4.18** - Prefixos CSS automáticos

### Deploy e Hosting
- **Vercel** - Hospedagem da aplicação
- **Netlify** - Hospedagem alternativa configurada

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FRONTEND      │    │    SUPABASE     │    │   HOSTING       │
│   (React/TS)    │◄──►│   (PostgreSQL)  │    │   (Vercel)      │
│                 │    │   Auth + API    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   COMPONENTES   │    │   REAL-TIME     │    │      CDN        │
│   REUTILIZÁVEIS │    │   UPDATES       │    │   (Assets)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 📁 Estrutura do Projeto

```
project/
├── 📁 src/
│   ├── 📁 components/          # Componentes reutilizáveis
│   │   ├── ui/                 # Componentes de interface
│   │   └── ProtectedRoute.tsx  # Proteção de rotas
│   ├── 📁 context/             # Contextos React
│   │   ├── AuthContext.tsx     # Contexto de autenticação
│   │   └── SupabaseContext.tsx # Contexto Supabase
│   ├── 📁 hooks/               # Custom hooks
│   ├── 📁 lib/                 # Bibliotecas e configurações
│   │   ├── supabase.ts         # Cliente Supabase
│   │   └── appointmentsDebug.ts
│   ├── 📁 pages/               # Páginas da aplicação
│   │   ├── LandingPage.tsx     # Página inicial
│   │   ├── Login.tsx           # Login
│   │   ├── Register.tsx        # Cadastro
│   │   ├── ClientDashboard.tsx # Dashboard do cliente
│   │   ├── EstablishmentDashboard.tsx # Dashboard estabelecimento
│   │   ├── PremiumDashboard.tsx # Dashboard premium
│   │   ├── BookingPage.tsx     # Página de agendamento
│   │   └── ...outras páginas
│   ├── 📁 scripts/             # Scripts utilitários
│   ├── 📁 types/               # Definições TypeScript
│   │   └── supabase.ts         # Tipos do Supabase
│   ├── App.tsx                 # Componente principal
│   ├── main.tsx                # Ponto de entrada
│   └── index.css               # Estilos globais
├── 📁 public/                  # Assets públicos
├── 📁 supabase/                # Configurações do banco
│   ├── 📁 migrations/          # Migrações do banco
│   └── apply_migration.sql     # Scripts SQL
├── 📁 docs/                    # Documentação
├── 📁 backups/                 # Backups de arquivos
├── 📁 scripts/                 # Scripts de deploy
├── package.json                # Dependências NPM
├── vite.config.ts              # Configuração Vite
├── tailwind.config.js          # Configuração TailwindCSS
├── vercel.json                 # Configuração Vercel
├── netlify.toml                # Configuração Netlify
└── tsconfig.json               # Configuração TypeScript
```

---

## ⚡ Funcionalidades

### 🔹 Funcionalidades Gerais
- **Autenticação completa** (Login/Registro/Logout)
- **Múltiplos tipos de usuário** (Cliente, Estabelecimento, Premium)
- **Interface responsiva** (Desktop e Mobile)
- **Sistema de favoritos** para estabelecimentos
- **Notificações em tempo real**
- **Upload de imagens** para estabelecimentos

### 🔹 Para Clientes
- Buscar estabelecimentos por código
- Agendar horários disponíveis
- Visualizar histórico de agendamentos
- Cancelar agendamentos
- Adicionar estabelecimentos aos favoritos
- Acessar links afiliados dos estabelecimentos

### 🔹 Para Estabelecimentos
- Cadastrar serviços e preços
- Definir horários de funcionamento
- Gerenciar profissionais
- Visualizar todos os agendamentos
- Configurar informações do estabelecimento
- Adicionar link afiliado personalizado
- Upload de foto de perfil

### 🔹 Para Usuários Premium
- Todas as funcionalidades de cliente
- Funcionalidades exclusivas (em desenvolvimento)
- Interface diferenciada
- Prioridade no atendimento

---

## 👥 Tipos de Usuário

### 🔸 Cliente (`client`)
- **Acesso**: `/dashboard/client`
- **Permissões**: Agendar, visualizar histórico, favoritar estabelecimentos
- **Funcionalidades principais**:
  - Dashboard com agendamentos ativos
  - Busca por estabelecimentos
  - Sistema de favoritos
  - Acesso a links afiliados

### 🔸 Estabelecimento (`establishment`)
- **Acesso**: `/dashboard/establishment`
- **Permissões**: Gerenciar agendamentos, configurar estabelecimento
- **Funcionalidades principais**:
  - Painel de controle completo
  - Gerenciamento de serviços e preços
  - Controle de horários e profissionais
  - Visualização de todos os agendamentos
  - Configurações do estabelecimento

### 🔸 Premium (`premium`)
- **Acesso**: `/dashboard/premium`
- **Permissões**: Todas do cliente + funcionalidades exclusivas
- **Funcionalidades principais**:
  - Interface premium
  - Funcionalidades avançadas
  - Suporte prioritário

---

## 🗄️ Banco de Dados

### Principais Tabelas

#### `establishments`
```sql
- id (uuid, primary key)
- name (text)
- description (text)
- code (text, unique) - Código de busca
- owner_id (uuid, foreign key)
- services_with_prices (jsonb) - Serviços e preços
- professionals (jsonb) - Lista de profissionais
- business_hours (jsonb) - Horários de funcionamento
- profile_image_url (text) - URL da imagem de perfil
- affiliate_link (text) - Link afiliado
- created_at (timestamp)
- updated_at (timestamp)
```

#### `appointments`
```sql
- id (uuid, primary key)
- establishment_id (uuid, foreign key)
- client_id (uuid, foreign key)
- service_name (text)
- professional_name (text)
- appointment_date (date)
- appointment_time (time)
- status (text) - 'confirmed', 'cancelled', etc.
- created_at (timestamp)
```

#### `user_favorites`
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- establishment_id (uuid, foreign key)
- establishment_name (text)
- establishment_code (text)
- created_at (timestamp)
```

#### `premium_subscriptions`
```sql
- id (uuid, primary key)
- establishment_id (uuid, foreign key)
- subscriber_id (uuid, foreign key)
- display_name (text)
- whatsapp (text)
- created_at (timestamp)
```

---

## ⚙️ Configuração do Ambiente

### Variáveis de Ambiente Necessárias
Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Pré-requisitos
- **Node.js** 18+ 
- **npm** ou **yarn**
- **Conta Supabase** configurada
- **Git** para controle de versão

---

## 🚀 Deploy e Hosting

### Vercel (Principal)
- **URL de produção**: Configurada automaticamente
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Configuradas no dashboard

### Netlify (Alternativo)
- **Configuração**: `netlify.toml`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`

---

## 💻 Como Executar o Projeto

### 1. Clone o repositório
```bash
git clone [url-do-repositorio]
cd project
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
# Crie o arquivo .env.local
cp .env.example .env.local
# Edite com suas credenciais do Supabase
```

### 4. Execute em modo desenvolvimento
```bash
npm run dev
```

### 5. Acesse no navegador
```
http://localhost:5173
```

---

## 📜 Scripts Disponíveis

### Desenvolvimento
```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run dev --host   # Servidor com acesso via rede
```

### Build e Deploy
```bash
npm run build        # Gera build de produção
npm run preview      # Preview do build local
```

### Qualidade de Código
```bash
npm run lint         # Executa ESLint
```

---

## 🔗 Links Afiliados

### Como Funciona
- Estabelecimentos podem cadastrar links afiliados
- Links aparecem para clientes nos favoritos
- Sistema flexível (aceita qualquer URL)
- Abre em nova aba para não sair da aplicação

### Configuração
1. **Migração no Supabase**: Execute o SQL em `INSTRUCOES_LINKS_AFILIADOS.md`
2. **Campo no Dashboard**: Estabelecimentos preenchem o link
3. **Botão nos Favoritos**: Clientes veem "Ver link" quando disponível

### Tipos de Link Suportados
- Sites institucionais
- Instagram, Facebook
- WhatsApp Business
- Lojas online
- Qualquer URL válida

---

## 🧩 Estrutura de Componentes

### Componentes Principais
- **App.tsx** - Roteamento principal
- **ProtectedRoute.tsx** - Proteção de rotas por papel
- **Toaster** - Sistema de notificações

### Páginas por Papel
```typescript
// Rotas públicas
/                    -> LandingPage
/login              -> Login
/register           -> Register

// Rotas protegidas por papel
/dashboard/client         -> ClientDashboard (role: client)
/dashboard/establishment  -> EstablishmentDashboard (role: establishment)  
/dashboard/premium        -> PremiumDashboard (role: premium)
/booking/:id             -> BookingPage (roles: client, premium)
```

---

## 🔐 Autenticação e Autorização

### Sistema de Autenticação
- **Provider**: Supabase Auth
- **Método**: Email + Senha
- **Sessão**: Persistente via localStorage
- **Token**: Refresh automático

### Sistema de Autorização
- **Baseado em papéis** (`role` no metadata do usuário)
- **Proteção no frontend** via `ProtectedRoute`
- **RLS no Supabase** para segurança no backend

### Fluxo de Autenticação
1. Usuário faz login
2. Supabase retorna JWT com metadata
3. Role é extraída do metadata
4. Redirecionamento baseado na role
5. Rotas protegidas verificam permissões

---

## 👨‍💻 Guia para Desenvolvimento

### Padrões de Código
- **TypeScript** obrigatório para tipagem
- **Functional Components** com hooks
- **Context API** para estado global
- **TailwindCSS** para estilização
- **ESLint** para qualidade de código

### Estrutura de Arquivos
```typescript
// Para novos componentes
src/components/NomeDoComponente.tsx

// Para novas páginas  
src/pages/NomeDaPagina.tsx

// Para novos hooks
src/hooks/useNomeDoHook.ts

// Para novos tipos
src/types/nomeDoTipo.ts
```

### Convenções de Nomenclatura
- **Componentes**: PascalCase (`MyComponent`)
- **Arquivos**: PascalCase (`MyComponent.tsx`)
- **Hooks**: camelCase com `use` (`useMyHook`)
- **Variáveis**: camelCase (`myVariable`)
- **Constantes**: UPPER_SNAKE_CASE (`MY_CONSTANT`)

### Adicionando Novas Funcionalidades
1. **Crie branch** para a feature
2. **Implemente** seguindo os padrões
3. **Teste** localmente
4. **Faça commit** com mensagem descritiva
5. **Crie Pull Request** para revisão

### Debugging
- **Console logs** implementados em pontos críticos
- **Debug files** em `DEBUG_APPOINTMENTS.md`
- **Error handling** com try/catch
- **Toast notifications** para feedback

---

## 🔧 Manutenção e Suporte

### Backups
- **Código**: Pasta `backups/` com versões anteriores
- **Links Afiliados**: `backups_links_afiliados/`
- **Banco**: Migrations em `supabase/migrations/`

### Monitoramento
- **Logs Supabase**: Dashboard do Supabase
- **Performance**: Vite dev tools
- **Erros**: Console do navegador

### Solução de Problemas Comuns
1. **Erro de autenticação**: Verificar variáveis de ambiente
2. **Build falha**: Limpar `node_modules` e reinstalar
3. **Supabase connection**: Verificar URL e keys
4. **Rotas protegidas**: Verificar role do usuário

---

## 📞 Contato e Recursos

### Recursos Externos
- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://reactjs.org/docs
- **Vite Docs**: https://vitejs.dev/guide/
- **TailwindCSS**: https://tailwindcss.com/docs

### Suporte
Para suporte técnico, consulte:
1. Esta documentação
2. Comentários no código
3. Issues no repositório
4. Documentação das tecnologias utilizadas

---

## 📊 Status do Projeto

### ✅ Funcionalidades Implementadas
- Sistema de autenticação completo
- Dashboards para todos os tipos de usuário
- Sistema de agendamentos
- Links afiliados
- Sistema de favoritos
- Upload de imagens
- Interface responsiva

### 🚧 Em Desenvolvimento
- Funcionalidades premium avançadas
- Sistema de notificações push
- Relatórios e analytics
- API externa para integração

### 🔄 Melhorias Futuras
- Aplicativo mobile (React Native)
- Sistema de pagamentos
- Integração com calendários externos
- Notificações via email/SMS

---

*Documentação atualizada em: Novembro 2024*
*Versão do projeto: 0.1.0*