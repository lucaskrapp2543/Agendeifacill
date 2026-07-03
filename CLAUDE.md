# CLAUDE.md — Regras Obrigatórias do Projeto Agendei Fácil

Este arquivo contém regras obrigatórias para qualquer alteração feita no sistema Agendei Fácil.

Antes de alterar qualquer código, leia este documento com atenção.

O objetivo principal é evitar que uma melhoria em uma parte do sistema quebre outra funcionalidade já existente.

---

# Regra principal

O Agendei Fácil é um sistema em produção, usado por clientes reais.

Toda alteração deve ser feita com extremo cuidado.

Nunca trate uma mudança como isolada sem antes verificar seus impactos em outras partes do sistema.

---

# Nunca desconectar integrações em massa

É proibido fazer qualquer alteração que possa desconectar contas já conectadas.

Jamais desconectar em massa:

* Contas Mercado Pago
* Contas WhatsApp
* Integrações de pagamento
* Webhooks
* Tokens
* Access tokens
* Refresh tokens
* Credenciais
* Sessões
* Configurações já salvas dos clientes

Se alguma mudança tiver risco de desconectar contas conectadas, pare imediatamente e avise antes de implementar.

Nunca conclua esse tipo de alteração sem autorização explícita.

---

# Mercado Pago

A integração com Mercado Pago é crítica.

Não alterar sem extrema análise:

* OAuth
* Tokens
* Webhooks
* Split
* Recebimentos
* Pagamentos PIX
* Pagamentos cartão
* Status de pagamento
* Cancelamentos automáticos
* Configurações de pagamento obrigatório/opcional
* Pagamento 50% ou 100%
* Repasse de taxa ao cliente
* Histórico de pagamentos

Antes de mexer em qualquer parte do Mercado Pago, verifique onde essa lógica é usada no booking, agenda, financeiro, AFCoins e relatórios.

---

# WhatsApp

A integração WhatsApp também é crítica.

Não alterar sem cuidado:

* Conexão WhatsApp
* Sessões
* QR Code
* Envio de mensagens
* Lembretes
* Notificações
* Cancelamentos
* Mensagens automáticas
* Workers
* Filas
* Retries

Nunca fazer alteração que possa desconectar WhatsApps já conectados.

Se houver risco, avise antes.

---

# Antes de implementar qualquer função

Antes de criar, alterar ou corrigir uma funcionalidade, siga estes passos:

1. Identifique todos os arquivos relacionados.
2. Entenda onde a função é usada.
3. Verifique se existe lógica compartilhada com outras telas.
4. Verifique impacto no banco de dados.
5. Verifique impacto no financeiro.
6. Verifique impacto no booking.
7. Verifique impacto na agenda.
8. Verifique impacto em profissionais, clientes e assinantes.
9. Só depois implemente.

Não faça alterações cegas.

---

# Não quebrar uma função ao corrigir outra

É proibido corrigir uma tela quebrando outra.

Exemplo real:

Foi corrigida a contagem de atendimentos dos assinantes, porém isso quebrou a área “Meus Assinantes”, onde antes aparecia qual profissional atendeu, horário, dia e detalhes do atendimento.

Esse tipo de erro não pode acontecer.

Antes de entregar qualquer alteração, revise as telas relacionadas.

---

# Regra de impacto

Sempre que alterar uma função, pergunte:

* Essa função é usada em outro lugar?
* Esse dado aparece em outra tela?
* Esse cálculo alimenta o financeiro?
* Esse status altera agenda, cliente, assinante ou profissional?
* Esse campo é usado em relatórios?
* Essa mudança afeta mobile?
* Essa mudança afeta desktop?
* Essa mudança afeta clientes antigos?
* Essa mudança afeta clientes novos?

Se a resposta for “sim” ou “talvez”, investigue antes.

---

# Financeiro

O financeiro é uma área crítica.

Não alterar sem cuidado:

* Valor bruto
* Valor líquido
* Comissão
* Profissional responsável
* Serviço realizado
* Produto vendido
* Assinatura
* Pagamento online
* Pagamento local
* Taxas
* Repasses
* Relatórios
* Ranking
* Metas
* Histórico

Nunca alterar valores usados no financeiro apenas para corrigir exibição visual.

Se precisar mostrar “valor restante”, mantenha separado do “valor total do serviço”.

---

# Agenda e comanda

A agenda é uma das áreas mais importantes do sistema.

Não quebrar:

* Abrir comanda
* Concluir atendimento
* Cancelar
* Pendente
* Transferir
* Cliente faltou
* Gorjeta
* Trocar horário
* Trocar serviço
* Serviço extra
* Produto
* Observações
* Forma de pagamento
* Valor do atendimento
* Histórico do cliente

Antes de alterar qualquer coisa na comanda, verifique se isso afeta o financeiro.

---

# Booking

O booking é onde o cliente final agenda.

Não quebrar:

* Escolha de serviço
* Escolha de profissional
* Escolha de horário
* Pagamento online
* Pagamento no local
* Pagamento obrigatório
* Pagamento opcional
* Pagamento 50%
* Pagamento 100%
* AFCoins
* Confirmação do agendamento
* Cancelamento automático
* Mensagens WhatsApp
* Cache
* Responsividade mobile

Sempre testar o fluxo completo do cliente após mexer no booking.

---

# Assinantes

A área de assinantes precisa preservar:

* Cliente assinante
* Histórico de atendimentos
* Profissional que atendeu
* Data
* Horário
* Serviço
* Quantidade de atendimentos usados
* Limites mensais
* Status pago/não pago
* Financeiro da assinatura

Não corrigir uma contagem quebrando o histórico.

---

# AFCoins

Não alterar sem cuidado:

* Pontuação
* Resgate
* Benefícios
* Regras de pagamento
* Relação com Mercado Pago
* Histórico
* Relatórios
* Custo pago pelo Agendei Fácil
* Mensagens para cliente
* Mensagens para barbearia

AFCoins é um diferencial do produto. Qualquer alteração deve preservar regras existentes.

---

# Banco de dados

Nunca alterar estrutura do banco sem explicar antes.

Antes de criar ou alterar tabelas, colunas, policies ou funções SQL:

1. Explique o motivo.
2. Explique o impacto.
3. Explique o risco.
4. Aguarde aprovação.

Não alterar RLS sem extremo cuidado.

Não remover colunas.

Não renomear campos usados em produção sem migração segura.

---

# Compatibilidade com clientes antigos

O sistema possui clientes antigos com configurações antigas.

Toda nova funcionalidade precisa ser compatível com dados existentes.

Nunca assumir que todos os estabelecimentos possuem os novos campos preenchidos.

Sempre prever fallback seguro.

---

# Mobile e desktop

Toda alteração visual deve funcionar em:

* Desktop
* Notebook
* Tablet
* Celular

Não entregar algo que funciona no PC e fica ruim no celular.

O Agendei Fácil é muito usado em celular.

---

# Antes de entregar a alteração

Antes de dizer que terminou, faça uma revisão mínima:

1. O sistema compila?
2. A tela principal abre?
3. A funcionalidade alterada funciona?
4. As telas relacionadas continuam funcionando?
5. O mobile não quebrou?
6. O financeiro não foi afetado indevidamente?
7. O booking continua funcionando?
8. A agenda continua funcionando?
9. Não houve desconexão de Mercado Pago?
10. Não houve desconexão de WhatsApp?

Se não tiver certeza, diga que precisa testar mais.

---

# Comunicação obrigatória

Se houver risco de quebrar algo importante, avise antes.

Se a alteração envolver Mercado Pago, WhatsApp, financeiro, booking, assinantes ou banco de dados, explique o plano antes de implementar.

Nunca faça alterações críticas silenciosamente.

---

# Como trabalhar neste projeto

Prefira sempre:

* Mudanças pequenas
* Código simples
* Reutilizar funções existentes
* Preservar comportamento atual
* Criar fallback
* Testar impacto
* Explicar riscos
* Evitar gambiarras
* Evitar duplicação
* Evitar alterar grandes partes sem necessidade

---

# O que jamais fazer

Jamais:

* Desconectar contas conectadas
* Quebrar Mercado Pago
* Quebrar WhatsApp
* Quebrar financeiro
* Quebrar booking
* Quebrar agenda
* Quebrar assinantes
* Alterar banco sem explicar
* Remover função existente sem autorização
* Alterar regra de negócio sem confirmar
* Entregar mudança sem revisar impacto

---

# Mentalidade obrigatória

Não estamos apenas criando funcionalidades.

Estamos mantendo um sistema usado por clientes reais.

Cada alteração precisa ser feita como profissional.

O objetivo é melhorar o sistema sem criar novos problemas.

Melhor fazer uma alteração menor e segura do que uma alteração grande que quebra partes importantes do Agendei Fácil.
