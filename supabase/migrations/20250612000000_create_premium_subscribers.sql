-- Create premium_subscribers table
CREATE TABLE IF NOT EXISTS public.premium_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id TEXT NOT NULL,
  is_winner BOOLEAN DEFAULT false,
  winner_position INTEGER,
  last_draw_date TIMESTAMP WITH TIME ZONE
);

-- Add RLS policies
ALTER TABLE public.premium_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy to allow establishments to view their subscribers
CREATE POLICY "Establishments can view their subscribers" ON public.premium_subscribers
  FOR SELECT
  TO authenticated
  USING (establishment_id = current_user_id());

-- Policy to allow users to subscribe
CREATE POLICY "Users can subscribe" ON public.premium_subscribers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy to allow users to update their own subscription
CREATE POLICY "Users can update their own subscription" ON public.premium_subscribers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy to allow users to delete their own subscription
CREATE POLICY "Users can delete their own subscription" ON public.premium_subscribers
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add indexes
CREATE INDEX IF NOT EXISTS premium_subscribers_establishment_id_idx ON public.premium_subscribers(establishment_id);
CREATE INDEX IF NOT EXISTS premium_subscribers_user_id_idx ON public.premium_subscribers(user_id); 