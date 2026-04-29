# Etapa 5 - Fechamento com metrica real

Objetivo: validar com numeros reais que o sistema ficou estavel para uso intenso.

## Escopo (fluxos criticos)

- `/dashboard/establishment`
- Aba `Financeiro`
- Blocos:
  - `taxa de ocupacao e faturamento detalhado`
  - `ver atendimentos detalhado por profissional`
- Fluxo de carregamento de pagamentos e despesas do mes

## Criterios de aprovacao (go/no-go)

- Console da aplicacao sem spam de debug (aceitando apenas erros reais)
- Sem `400/404` repetitivos de tabelas opcionais
- Tempo para abrir cada secao critica menor que 2.5s no desktop medio
- Sem travamentos visiveis no PWA durante uso normal
- Sem pico anormal de erros no Supabase durante janela de teste

## Coleta de metricas - frontend

Rodar 5 ciclos por fluxo e anotar:

- Tempo para abrir `/dashboard/establishment`
- Tempo para abrir bloco `faturamento detalhado`
- Tempo para abrir bloco `atendimentos por profissional`
- Quantidade de requests no Network por acao
- Quantidade de erros (4xx/5xx) por acao

Modelo de registro:

```text
Fluxo:
Tentativa 1:
Tentativa 2:
Tentativa 3:
Tentativa 4:
Tentativa 5:
Media:
Erros:
Observacoes:
```

## Coleta de metricas - banco (Supabase)

Executar no SQL Editor antes e depois da janela de teste.

### 1) Top queries por tempo total

```sql
select
  query,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows
from pg_stat_statements
order by total_exec_time desc
limit 20;
```

### 2) Queries de `appointments` por tempo medio

```sql
select
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows,
  query
from pg_stat_statements
where query ilike '%appointments%'
order by mean_exec_time desc
limit 20;
```

### 3) Taxa de erro HTTP no periodo de teste

Usar logs do dashboard do Supabase e anotar:

- total de 4xx
- total de 5xx
- endpoints mais frequentes com erro

## Janela de teste recomendada

- Duracao: 30 minutos
- Simulacao: operacao real com varios usuarios navegando em paralelo
- Prioridade: abrir e fechar as secoes do Financeiro, alternar periodo e profissional

## Resultado final esperado

- Console limpo de debug
- Sem erro repetitivo da app
- Tempo medio estavel nas secoes criticas
- Sem degradacao perceptivel no PWA

Se todos os itens acima forem atendidos, Etapa 5 pode ser considerada concluida.
