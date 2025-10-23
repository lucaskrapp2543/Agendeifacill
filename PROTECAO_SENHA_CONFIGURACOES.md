# 🔒 Proteção de Senha para Configurações Sensíveis

## ✅ **Funcionalidade implementada:**

Agora a **senha de 4 dígitos das configurações** protege as opções sensíveis dos profissionais:

- **% do profissional**
- **Senha do profissional** 
- **Meta mensal**

## 🔐 **Como funciona:**

### 1. **Modal de verificação de senha:**
- **Aparece** quando o usuário tenta alterar configurações sensíveis
- **Solicita** a senha de 4 dígitos das configurações
- **Verifica** se a senha está correta
- **Permite** a ação apenas se a senha for válida

### 2. **Configurações protegidas:**

#### **Meta mensal:**
- **Botão META** → Modal de meta → **Verificação de senha** → Salvar meta

#### **% do profissional:**
- **Alterar %** → **Verificação de senha** → Salvar percentual

#### **Senha do profissional:**
- **Alterar senha** → **Verificação de senha** → Salvar nova senha

## 🎯 **Fluxo de proteção:**

### **Primeira tentativa:**
1. **Usuário clica** em configuração sensível
2. **Modal de senha** aparece
3. **Usuário digita** senha de 4 dígitos
4. **Sistema verifica** senha
5. **Se correta**: Executa ação
6. **Se incorreta**: Mostra erro

### **Tentativas subsequentes:**
1. **Usuário clica** em outra configuração sensível
2. **Ação executada** diretamente (senha já verificada)
3. **Sem necessidade** de digitar senha novamente

## 🔧 **Componentes criados:**

### **ConfigPasswordModal.tsx:**
```typescript
interface ConfigPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (password: string) => Promise<boolean>;
  title: string;
  description: string;
}
```

**Características:**
- **Input de 4 dígitos** com máscara
- **Botão mostrar/ocultar** senha
- **Validação** de 4 dígitos
- **Loading state** durante verificação
- **Design consistente** com outros modais

## 📋 **Estados adicionados:**

```typescript
// Estados para proteção de configurações sensíveis
const [showConfigPasswordModal, setShowConfigPasswordModal] = useState(false);
const [configPasswordVerified, setConfigPasswordVerified] = useState(false);
const [pendingAction, setPendingAction] = useState<{
  type: 'percentage' | 'password' | 'goal';
  professionalId: string;
  data?: any;
} | null>(null);
```

## 🔄 **Funções implementadas:**

### **handleConfigPasswordVerify:**
- **Verifica** se a senha está correta
- **Compara** com `establishment.config_password`
- **Retorna** true/false

### **handleProtectedAction:**
- **Verifica** se senha já foi validada
- **Se sim**: Executa ação diretamente
- **Se não**: Abre modal de verificação

### **executeProtectedAction:**
- **Executa** a ação específica após verificação
- **Suporte** para percentage, password, goal

## 🧪 **Como testar:**

### **Teste 1: Meta mensal**
1. **Vá para** Profissionais
2. **Clique em META** de um profissional
3. **Digite** uma meta (ex: 50)
4. **Clique em Salvar**
5. **Modal de senha** deve aparecer
6. **Digite** a senha de 4 dígitos
7. **Confirme** que a meta foi salva

### **Teste 2: % do profissional**
1. **Altere** o percentual de um profissional
2. **Modal de senha** deve aparecer
3. **Digite** a senha
4. **Confirme** que o % foi alterado

### **Teste 3: Senha incorreta**
1. **Tente** alterar uma configuração
2. **Digite** senha incorreta
3. **Confirme** que aparece erro
4. **Digite** senha correta
5. **Confirme** que funciona

## 🎨 **Interface do modal:**

### **Header:**
- **Ícone** de cadeado (vermelho)
- **Título**: "Verificação de Senha"
- **Descrição**: "Digite a senha de 4 dígitos para alterar configurações sensíveis"

### **Input:**
- **Campo** de 4 dígitos
- **Máscara** automática (só números)
- **Botão** mostrar/ocultar senha
- **Placeholder**: "••••"

### **Botões:**
- **Cancelar**: Fecha modal
- **Verificar**: Executa verificação (com loading)

## 🔒 **Segurança:**

- **Senha** é comparada com `establishment.config_password`
- **Verificação** é feita no frontend e backend
- **Estado** de verificação é mantido durante a sessão
- **Ações** são executadas apenas após verificação

## 📊 **Mensagens:**

### **Sucesso:**
- "Senha verificada com sucesso!"
- "Meta do profissional salva com sucesso!"

### **Erro:**
- "A senha deve ter 4 dígitos"
- "Senha incorreta"
- "Erro ao verificar senha"

---

**Agora as configurações sensíveis dos profissionais estão protegidas pela senha de 4 dígitos das configurações!** 🔒













