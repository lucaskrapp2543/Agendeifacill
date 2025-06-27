-- Create the loyal_customers table
CREATE TABLE IF NOT EXISTS loyal_customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  month_year TEXT GENERATED ALWAYS AS (TO_CHAR(created_at, 'YYYY-MM')) STORED
);

-- Create index for month filtering
CREATE INDEX IF NOT EXISTS idx_loyal_customers_month_year ON loyal_customers(month_year);

-- Add RLS policies
ALTER TABLE loyal_customers ENABLE ROW LEVEL SECURITY;

-- Allow establishment owners to manage their loyal customers
CREATE POLICY "Establishment owners can manage their loyal customers"
  ON loyal_customers
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT owner_id 
      FROM establishments 
      WHERE id = establishment_id
    )
  );

-- Allow establishment owners to insert loyal customers
CREATE POLICY "Establishment owners can insert loyal customers"
  ON loyal_customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT owner_id 
      FROM establishments 
      WHERE id = establishment_id
    )
  ); 