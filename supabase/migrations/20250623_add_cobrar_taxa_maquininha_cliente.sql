ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS cobrar_taxa_maquininha_cliente BOOLEAN DEFAULT FALSE;
