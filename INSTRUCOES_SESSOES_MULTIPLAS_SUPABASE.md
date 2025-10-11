# 🔧 Como Permitir Múltiplas Sessões Simultâneas no Supabase

## 📋 Passo a Passo

### 1. Acesse o Painel do Supabase
1. Vá para: https://supabase.com/dashboard
2. Faça login com sua conta
3. Selecione o projeto **"Agenda Fácil"**

---

### 2. Navegue até Authentication
1. No menu lateral esquerdo, clique em **"Authentication"** 🔐
2. Clique em **"Providers"**

---

### 3. Configure o Email Provider
1. Localize **"Email"** na lista de providers
2. Clique em **"Email"** para expandir as configurações
3. Role até encontrar **"Concurrent Sessions"** ou **"Session Settings"**

---

### 4. Habilitar Múltiplas Sessões
Procure por uma das seguintes opções:

#### Opção A: "Allow Multiple Sessions"
- ✅ **MARQUE** esta opção
- Salve as alterações

#### Opção B: "Maximum Concurrent Sessions"
- Defina para: **5** ou **10** (permite vários dispositivos)
- Salve as alterações

#### Opção C: "Single Session Only"
- ❌ **DESMARQUE** esta opção se estiver marcada
- Salve as alterações

---

### 5. Verificar Auth Settings Gerais
1. Ainda em **Authentication**, clique em **"URL Configuration"** ou **"Settings"**
2. Procure por **"Session Settings"**
3. Certifique-se que:
   - **Session Timeout**: Pelo menos **24 hours** (ou mais)
   - **Refresh Token Rotation**: **Enabled** ✅
   - **Allow Multiple Sessions per User**: **Enabled** ✅

---

### 6. Salvar e Testar
1. Clique em **"Save"** / **"Salvar"**
2. Aguarde 1-2 minutos para as mudanças propagarem
3. Peça ao cliente para:
   - Fazer logout em ambos os dispositivos
   - Fazer login no PC
   - Fazer login no celular
   - Testar se ambos funcionam simultaneamente

---

## 🎯 Configurações Recomendadas

```yaml
Auth Settings:
  - Allow Multiple Sessions: ENABLED ✅
  - Maximum Concurrent Sessions: 10
  - Session Timeout: 7 days (604800 seconds)
  - Refresh Token Rotation: ENABLED ✅
  - Auto-refresh Tokens: ENABLED ✅
```

---

## 🔄 Se Ainda Não Funcionar

### Verificar RLS (Row Level Security)
1. Vá em **Database** → **Policies**
2. Certifique-se que não há políticas bloqueando múltiplas sessões

### Limpar Cache do Cliente
Peça ao cliente para:
1. **No PC**: Ctrl + Shift + Delete → Limpar cache e cookies
2. **No Celular**: Configurações → Navegador → Limpar dados do site
3. Fazer login novamente em ambos

---

## 📞 Suporte Supabase

Se as configurações não aparecerem:
- **Docs**: https://supabase.com/docs/guides/auth/sessions
- **Discord**: https://discord.supabase.com/

---

## ✅ Após Configurar

O cliente **"agendei facil"** poderá:
- 💻 Usar no **PC** (Chrome/Edge/Firefox)
- 📱 Usar no **Celular** (Chrome/Safari)
- 🖥️ Usar no **Tablet**
- 🔄 **Simultaneamente** sem desconectar!

---

**DICA:** As configurações podem demorar 1-2 minutos para propagar. Peça ao cliente para aguardar antes de testar.

