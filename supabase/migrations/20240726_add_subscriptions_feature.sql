-- Tabela para definir os tipos de assinatura oferecidos pelos estabelecimentos
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  value NUMERIC(10, 2) NOT NULL,
  duration_months INTEGER NOT NULL CHECK (duration_months >= 1 AND duration_months <= 12),
  UNIQUE (establishment_id, name) -- Garante que um estabelecimento não tenha duas assinaturas com o mesmo nome
);

-- Habilitar RLS para a tabela subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para subscriptions
-- Estabelecimentos podem criar suas próprias assinaturas
CREATE POLICY "Establishment owners can create subscriptions"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

-- Estabelecimentos podem ver e atualizar suas próprias assinaturas
CREATE POLICY "Establishment owners can manage their subscriptions"
  ON subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "Establishment owners can update their subscriptions"
  ON subscriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

-- Estabelecimentos podem deletar suas próprias assinaturas
CREATE POLICY "Establishment owners can delete subscriptions"
  ON subscriptions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

-- Clientes podem ver as assinaturas disponíveis de qualquer estabelecimento
CREATE POLICY "Clients can view subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (true);


-- Tipo ENUM para o status de pagamento
CREATE TYPE payment_status AS ENUM ('paid', 'unpaid');

-- Tabela para armazenar as assinaturas de clientes
CREATE TABLE IF NOT EXISTS client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Referencia auth.users diretamente para o cliente
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_status payment_status DEFAULT 'unpaid' NOT NULL,
  last_payment_date DATE, -- Para controle do reset mensal
  CONSTRAINT fk_client_subscription_establishment FOREIGN KEY (establishment_id) REFERENCES public.establishments(id) ON DELETE CASCADE
);

-- Habilitar RLS para a tabela client_subscriptions
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para client_subscriptions
-- Clientes podem ver e atualizar o status de pagamento de suas próprias assinaturas (caso precisem redefinir ou algo assim)
CREATE POLICY "Clients can view their own client subscriptions"
  ON client_subscriptions
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());
CREATE POLICY "Clients can update their own client subscriptions payment status"
  ON client_subscriptions
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());


-- Estabelecimentos podem criar client_subscriptions
CREATE POLICY "Establishment owners can create client subscriptions"
  ON client_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

-- Estabelecimentos podem ver e atualizar as assinaturas de seus clientes
CREATE POLICY "Establishment owners can view client subscriptions"
  ON client_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "Establishment owners can update client subscriptions"
  ON client_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

-- Estabelecimentos podem deletar as assinaturas de seus clientes
CREATE POLICY "Establishment owners can delete client subscriptions"
  ON client_subscriptions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

-- Opcional: Adicionar um índice para melhorar o desempenho das consultas por client_id
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_id ON client_subscriptions (client_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_establishment_id ON client_subscriptions (establishment_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_payment_status ON client_subscriptions (payment_status);

-- Adicionar coluna is_subscriber na tabela profiles para identificação rápida
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN DEFAULT false;

-- Política de RLS para atualizar is_subscriber no profiles
CREATE POLICY "Users can update their own is_subscriber status"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Trigger para atualizar is_subscriber quando um client_subscription é criado/deletado
CREATE OR REPLACE FUNCTION update_is_subscriber()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET is_subscriber = (SELECT EXISTS (SELECT 1 FROM client_subscriptions WHERE client_id = NEW.client_id))
    WHERE user_id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_is_subscriber_trigger
AFTER INSERT OR DELETE ON client_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_is_subscriber();

-- Trigger para atualizar is_subscriber em caso de update (se houver alguma mudança relevante, embora menos comum)
CREATE OR REPLACE TRIGGER update_is_subscriber_on_update_trigger
AFTER UPDATE ON client_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_is_subscriber(); 