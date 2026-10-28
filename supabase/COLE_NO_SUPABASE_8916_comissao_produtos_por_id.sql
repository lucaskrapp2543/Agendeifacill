-- ============================================================================
-- REFERENCE BarberShop (8916) — "% por colaborador" dos produtos: nomes antigos → ID + nome atual.
-- MOTIVO: o dono renomeou os profissionais e o % ficou gravado nos nomes antigos
--         ("Paulo Referência", "Emerson Referência", "Ricardo Referência", "Ricardo (menor)",
--         "Paulinho Henrique"), zerando a comissão das vendas novas.
-- O QUE FAZ: reescreve commission_percentages de 9 produtos DESTA barbearia (filtro por id
--         do produto + establishment_id). Mantém os mesmos percentuais, só troca as chaves.
-- RISCO: nenhum fora da 8916. Pode rodar mais de uma vez.
-- ============================================================================
-- Balm Azul: antes {"ADM":0,"Erick":0,"Paulo Referência":8,"Emerson Referência":8,"Ricardo Referência":8}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":8,"Ricardo Alves":8,"ca278e48-68b4-4428-9323-068e7ad3c702":8,"Emerson Coelho":8,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":8,"Paulo Damasceno":8,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = '5e382084-5b8f-47be-91f4-1e3becf35fca' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Bore splach: antes {"ADM":0,"Erick":0,"Paulo Referência":16.7,"Emerson Referência":16.7,"Ricardo Referência":16.7}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":16.7,"Ricardo Alves":16.7,"ca278e48-68b4-4428-9323-068e7ad3c702":16.7,"Emerson Coelho":16.7,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":16.7,"Paulo Damasceno":16.7,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = 'e200b974-aada-438f-b123-9cb1f962c2f0' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Gel cola: antes {"ADM":0,"Erick":0,"Paulo Referência":20,"Emerson Referência":20,"Ricardo Referência":20}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":20,"Ricardo Alves":20,"ca278e48-68b4-4428-9323-068e7ad3c702":20,"Emerson Coelho":20,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":20,"Paulo Damasceno":20,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = '97be3786-eeda-4313-95d5-328480f37b5a' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Perfume de barba: antes {"ADM":0,"Erick":0,"Paulo Referência":15,"Emerson Referência":15,"Ricardo Referência":15}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":15,"Ricardo Alves":15,"ca278e48-68b4-4428-9323-068e7ad3c702":15,"Emerson Coelho":15,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":15,"Paulo Damasceno":15,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = 'd5356035-aa5f-4824-9a7e-8c1bed29e85c' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Pomada Modeladora: antes {"ADM":0,"Erick":0,"Ricardo Alves":20,"Emerson Coelho":20,"Paulo Damasceno":20}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":20,"Ricardo Alves":20,"ca278e48-68b4-4428-9323-068e7ad3c702":20,"Emerson Coelho":20,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":20,"Paulo Damasceno":20,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = 'd42833da-2772-42c3-bd5c-d6bc97ccc030' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Sabonete de enxofre: antes {"ADM":0,"Emerson Coelho":10,"Ricardo (menor)":10,"Paulinho Henrique":10}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":10,"Ricardo Alves":10,"ca278e48-68b4-4428-9323-068e7ad3c702":10,"Emerson Coelho":10,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":10,"Paulo Damasceno":10,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = '38165b63-d5ff-432a-bc02-0cf29c0dc485' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Shampoo anticasp: antes {"ADM":0,"Erick":0,"Paulo Referência":7.5,"Emerson Referência":7.5,"Ricardo Referência":7.5}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":7.5,"Ricardo Alves":7.5,"ca278e48-68b4-4428-9323-068e7ad3c702":7.5,"Emerson Coelho":7.5,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":7.5,"Paulo Damasceno":7.5,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = 'b27b8f85-4c1f-438c-890a-e2340cb3b236' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Shampoo for mem 3 em 1: antes {"ADM":0,"Erick":0,"Paulo Referência":7.5,"Emerson Referência":7.5,"Ricardo Referência":7.5}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":7.5,"Ricardo Alves":7.5,"ca278e48-68b4-4428-9323-068e7ad3c702":7.5,"Emerson Coelho":7.5,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":7.5,"Paulo Damasceno":7.5,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = '745394e7-2899-4335-b844-81b7778db339' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
-- Shampoo vermelho Anabolizante: antes {"ADM":0,"Erick":0,"Paulo Referência":7.5,"Emerson Referência":7.5,"Ricardo Referência":7.5}
UPDATE public.establishment_products SET commission_percentages = '{"5a8e5661-c926-435a-b775-fda5edf7f8fc":7.5,"Ricardo Alves":7.5,"ca278e48-68b4-4428-9323-068e7ad3c702":7.5,"Emerson Coelho":7.5,"f2b04bee-a9c7-4f36-abdb-effef81a9b79":0,"Erick":0,"2e9c6ca1-4767-4a3c-bf6f-15e1e1aada22":7.5,"Paulo Damasceno":7.5,"1a9b2d6e-f90e-490e-8a16-2da09e8e2451":0,"ADM":0}'::jsonb
  WHERE id = '95ed4e2d-22e1-4fd6-9750-59a627183203' AND establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';

-- Conferir depois: SELECT name, commission_percentages FROM public.establishment_products WHERE establishment_id = '17fb0385-a7eb-4967-83e7-aa87785d66bd';
