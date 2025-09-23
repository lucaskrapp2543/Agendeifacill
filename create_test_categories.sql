-- Script para criar categorias e subcategorias de teste
-- Este script cria automaticamente categorias para o primeiro estabelecimento encontrado

-- 1. Buscar o primeiro estabelecimento
DO $$
DECLARE
    establishment_uuid UUID;
    category_corte_id UUID;
    category_barba_id UUID;
    category_tratamentos_id UUID;
BEGIN
    -- Buscar o primeiro estabelecimento
    SELECT id INTO establishment_uuid FROM establishments LIMIT 1;
    
    IF establishment_uuid IS NULL THEN
        RAISE NOTICE 'Nenhum estabelecimento encontrado!';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Estabelecimento encontrado: %', establishment_uuid;
    
    -- 2. Criar categorias
    INSERT INTO service_categories (establishment_id, name, display_order, is_active) 
    VALUES 
        (establishment_uuid, 'CORTE', 1, true),
        (establishment_uuid, 'BARBA', 2, true),
        (establishment_uuid, 'TRATAMENTOS', 3, true)
    RETURNING id INTO category_corte_id;
    
    -- Buscar os IDs das categorias criadas
    SELECT id INTO category_corte_id FROM service_categories WHERE establishment_id = establishment_uuid AND name = 'CORTE';
    SELECT id INTO category_barba_id FROM service_categories WHERE establishment_id = establishment_uuid AND name = 'BARBA';
    SELECT id INTO category_tratamentos_id FROM service_categories WHERE establishment_id = establishment_uuid AND name = 'TRATAMENTOS';
    
    -- 3. Criar subcategorias
    INSERT INTO service_subcategories (name, category_id, display_order, is_active) 
    VALUES 
        -- Subcategorias de CORTE
        ('Corte Masculino', category_corte_id, 1, true),
        ('Corte Feminino', category_corte_id, 2, true),
        ('Corte Infantil', category_corte_id, 3, true),
        
        -- Subcategorias de BARBA
        ('Barba Completa', category_barba_id, 1, true),
        ('Barba Simples', category_barba_id, 2, true),
        ('Bigode', category_barba_id, 3, true),
        
        -- Subcategorias de TRATAMENTOS
        ('Hidratação', category_tratamentos_id, 1, true),
        ('Escova', category_tratamentos_id, 2, true),
        ('Tintura', category_tratamentos_id, 3, true),
        ('Alisamento', category_tratamentos_id, 4, true);
    
    RAISE NOTICE 'Categorias e subcategorias criadas com sucesso!';
    RAISE NOTICE 'Categoria CORTE ID: %', category_corte_id;
    RAISE NOTICE 'Categoria BARBA ID: %', category_barba_id;
    RAISE NOTICE 'Categoria TRATAMENTOS ID: %', category_tratamentos_id;
    
END $$;

-- Verificar o resultado
SELECT 
    sc.name as categoria,
    ss.name as subcategoria,
    sc.display_order as ordem_categoria,
    ss.display_order as ordem_subcategoria
FROM service_categories sc
LEFT JOIN service_subcategories ss ON sc.id = ss.category_id
WHERE sc.is_active = true
ORDER BY sc.display_order, ss.display_order;
