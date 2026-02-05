-- Erro 23503: "Key is not present in table 'users'" ao criar reserva no booking público.
-- client_id referencia auth.users(id); em alguns fluxos (convidado, atraso de replicação) o id pode não existir ainda.
-- Solução: permitir client_id NULL e aceitar INSERT quando cliente autenticado cria para si com client_id null.

BEGIN;

-- Remover FK para poder alterar a coluna
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;

-- Permitir NULL em client_id (booking sem usuário em auth.users ainda, ou convidado)
ALTER TABLE public.appointments
  ALTER COLUMN client_id DROP NOT NULL;

-- Recriar FK: quando preenchido, deve existir em auth.users; quando null, não valida
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Atualizar policy de INSERT para permitir cliente autenticado criar com client_id null
-- (ex.: convidado cujo id ainda não está em auth.users no momento do insert)
DROP POLICY IF EXISTS "Create appointments (client or owner)" ON public.appointments;

CREATE POLICY "Create appointments (client or owner)"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    OR (client_id IS NULL AND auth.uid() IS NOT NULL)
    OR public.is_owner_of_establishment(establishment_id)
  );

COMMIT;
