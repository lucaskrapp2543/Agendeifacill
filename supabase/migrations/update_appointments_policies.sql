-- Adicionar coluna status se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'appointments' 
                  AND column_name = 'status') 
    THEN
        ALTER TABLE public.appointments 
        ADD COLUMN status text DEFAULT 'pending' NOT NULL;
    END IF;
END $$;

-- Adicionar constraint de status se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                  WHERE constraint_name = 'appointments_status_check') 
    THEN
        ALTER TABLE public.appointments 
        ADD CONSTRAINT appointments_status_check 
        CHECK (status IN ('pending', 'confirmed', 'cancelled'));
    END IF;
END $$;

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clients can cancel their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Establishments can manage appointment status" ON public.appointments;

-- Recriar as políticas
CREATE POLICY "Users can view their own appointments"
    ON public.appointments 
    FOR SELECT
    USING (
        auth.uid() = client_id OR 
        auth.uid() = establishment_id
    );

CREATE POLICY "Clients can create appointments"
    ON public.appointments 
    FOR INSERT
    WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their own appointments"
    ON public.appointments 
    FOR UPDATE
    USING (auth.uid() = client_id);

CREATE POLICY "Establishments can update appointments"
    ON public.appointments 
    FOR UPDATE
    USING (auth.uid() = establishment_id);

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS appointments_client_id_idx ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS appointments_establishment_id_idx ON public.appointments(establishment_id);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(appointment_date); 