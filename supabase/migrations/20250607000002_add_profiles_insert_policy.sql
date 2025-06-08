-- Add insert policy for profiles
CREATE POLICY "System can insert user profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Grant insert permission to authenticated users
GRANT INSERT ON public.profiles TO authenticated; 