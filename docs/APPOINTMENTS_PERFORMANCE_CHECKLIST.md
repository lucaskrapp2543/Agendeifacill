# Checklist de performance de agendamentos

## Objetivo
Medir e otimizar consultas da tabela `public.appointments` para suportar volume com estabilidade.

## 1) Resetar estatísticas (nao apaga dados)
```sql
select pg_stat_statements_reset();
```

## 2) Gerar carga real por 5-10 minutos
- Abrir dashboard de estabelecimento
- Alternar filtros de data/status
- Carregar lista de agendamentos
- Executar 1-2 cancelamentos

## 3) Top consultas de appointments (custo total)
```sql
select
  left(regexp_replace(query, '\s+', ' ', 'g'), 220) as query_sample,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows
from pg_stat_statements
where query ilike '%appointments%'
order by total_exec_time desc
limit 10;
```

## 4) Top consultas de appointments (latencia media)
```sql
select
  left(regexp_replace(query, '\s+', ' ', 'g'), 220) as query_sample,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows
from pg_stat_statements
where query ilike '%appointments%'
  and calls >= 20
order by mean_exec_time desc
limit 10;
```

## 5) Validar indices atuais da tabela
```sql
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'appointments'
order by indexname;
```

## 6) Criterio de sucesso inicial
- Quedas de `mean_ms` nas queries top
- Reducao de `total_ms` para consultas de dashboard
- Sem aumento relevante em erro de insert/update

## Observacoes
- `pg_stat_statements_reset()` limpa apenas metricas acumuladas.
- Nao remove agendamentos, clientes, pagamentos ou qualquer dado de negocio.
