# 🧪 **GUIA COMPLETO DE TESTES - NOTA FISCAL**

---

## 🎯 **TESTES QUE VOCÊ PODE FAZER:**

### **1️⃣ TESTE BÁSICO - Download**
1. ✅ Abra um agendamento com CPF
2. ✅ Clique em "📄 Gerar NF"
3. ✅ Verifique se o arquivo baixa
4. ✅ Nome do arquivo: `NF_20251012_abc12345.xml`

### **2️⃣ TESTE DE VALIDAÇÃO - XML**
1. ✅ Abra o arquivo XML no navegador
2. ✅ Deve abrir sem erros
3. ✅ Deve mostrar dados estruturados

### **3️⃣ TESTE AVANÇADO - Validador**
1. ✅ Abra o arquivo `test-xml-validator.html` no navegador
2. ✅ Faça upload do XML gerado
3. ✅ Verifique se extrai todos os dados corretamente

### **4️⃣ TESTE DE CONTEÚDO**
Verifique se o XML contém:
- ✅ **Cliente:** Nome e CPF corretos
- ✅ **Serviço:** Descrição e valor corretos
- ✅ **Data/Hora:** Data do agendamento
- ✅ **Profissional:** Nome do profissional
- ✅ **Estabelecimento:** Nome e dados

---

## 🔍 **COMO USAR O VALIDADOR:**

### **Passo 1: Abrir o Validador**
```
http://192.168.0.6:5173/test-xml-validator.html
```

### **Passo 2: Fazer Upload**
1. Clique em "Escolher arquivo"
2. Selecione o XML baixado
3. Clique em "🔍 Validar XML"

### **Passo 3: Verificar Resultados**
- ✅ **Verde** = XML válido
- ❌ **Vermelho** = XML com erro
- 📋 **Dados extraídos** = Informações do agendamento

---

## 🎯 **TESTES ESPECÍFICOS:**

### **TESTE 1: CPF Obrigatório**
1. Tente gerar NF sem CPF
2. **Resultado esperado:** Erro "CPF é obrigatório"

### **TESTE 2: Dados Completos**
1. Agendamento com CPF
2. **Resultado esperado:** XML com todos os dados

### **TESTE 3: Caracteres Especiais**
1. Cliente com nome "João & Maria"
2. **Resultado esperado:** XML válido (caracteres escapados)

### **TESTE 4: Valores Decimais**
1. Serviço de R$ 75,50
2. **Resultado esperado:** XML com valor 75.50

---

## 📊 **O QUE O VALIDADOR VERIFICA:**

### **✅ Estrutura XML:**
- Tags bem formadas
- Caracteres escapados
- Sintaxe válida

### **✅ Dados da NFe:**
- Número da NF
- Data de emissão
- Natureza da operação

### **✅ Emitente:**
- CNPJ do estabelecimento
- Nome do estabelecimento

### **✅ Destinatário:**
- CPF do cliente
- Nome do cliente

### **✅ Produto/Serviço:**
- Código do produto
- Descrição do serviço
- Valor do serviço

### **✅ Totais:**
- Valor dos produtos
- Valor da NF
- ICMS calculado

### **✅ Informações Adicionais:**
- Data do agendamento
- Horário do agendamento
- Profissional responsável
- Duração do serviço

---

## 🚨 **PROBLEMAS COMUNS:**

### **❌ "CPF é obrigatório"**
- **Solução:** Certifique-se que o agendamento tem CPF

### **❌ "XML inválido"**
- **Solução:** Verifique se o arquivo não está corrompido

### **❌ "Erro de parsing"**
- **Solução:** O XML pode ter caracteres especiais não escapados

---

## 🎉 **RESULTADO ESPERADO:**

### **✅ XML Válido:**
```
✅ XML Válido!
📋 Dados da Nota Fiscal:
   Número: NF20251012T140424
   Data de Emissão: 2025-10-12T14:04:24.170Z
   Natureza da Operação: Venda de servicos

🏢 Emitente (Estabelecimento):
   CNPJ: 00000000000000
   Nome: Barbearia do João

👤 Destinatário (Cliente):
   CPF: 12345678900
   Nome: João Silva

🛠️ Produto/Serviço:
   Código: 001
   Descrição: Corte + Barba
   Valor: R$ 75.00

💰 Totais:
   Valor dos Produtos: R$ 75.00
   Valor da NF: R$ 75.00
   ICMS: R$ 13.50

📝 Informações Adicionais:
   Agendamento: 2025-10-12 as 17:30
   Profissional: Antonio
   Duracao: 60 minutos
```

---

## 🚀 **TESTE AGORA:**

1. **Gere uma Nota Fiscal**
2. **Abra o validador:** `test-xml-validator.html`
3. **Faça upload do XML**
4. **Verifique os resultados!**

**Se tudo estiver verde, está funcionando perfeitamente! 🎯💪**
