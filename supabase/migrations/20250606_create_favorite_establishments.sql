-- Create favorite_establishments table
CREATE TABLE IF NOT EXISTS favorite_establishments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  establishment_name TEXT NOT NULL,
  establishment_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Prevent duplicate favorites for same user+establishment
  UNIQUE(user_id, establishment_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_favorite_establishments_user_id ON favorite_establishments(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_establishments_establishment_id ON favorite_establishments(establishment_id);

-- Enable RLS (Row Level Security)
ALTER TABLE favorite_establishments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own favorite establishments" ON favorite_establishments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite establishments" ON favorite_establishments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite establishments" ON favorite_establishments
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON favorite_establishments TO authenticated;
GRANT ALL ON favorite_establishments TO service_role; 