-- Drop the existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_type_check;

-- Add the updated constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_type_check CHECK (type IN ('client', 'establishment')); 