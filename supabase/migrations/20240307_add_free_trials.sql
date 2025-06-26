-- Create the free trials table
CREATE TABLE free_trials (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    nome TEXT NOT NULL,
    estabelecimento TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pendente',
    visualizado BOOLEAN DEFAULT false
);

-- Set up RLS (Row Level Security)
ALTER TABLE free_trials ENABLE ROW LEVEL SECURITY;

-- Policy for admin/support access
CREATE POLICY "Allow support to view all trials" ON free_trials
    FOR SELECT TO authenticated
    USING (auth.uid() IN (
        SELECT user_id FROM profiles 
        WHERE role = 'support'
    ));

-- Policy for admin/support to update trials
CREATE POLICY "Allow support to update trials" ON free_trials
    FOR UPDATE TO authenticated
    USING (auth.uid() IN (
        SELECT user_id FROM profiles 
        WHERE role = 'support'
    ));

-- Policy for public insertion
CREATE POLICY "Allow public to insert trials" ON free_trials
    FOR INSERT TO anon
    WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_free_trials_data_criacao ON free_trials(data_criacao DESC);
CREATE INDEX idx_free_trials_status ON free_trials(status); 