-- ============================================================================
-- "Fazer pedidos": até 4 FOTOS por pedido (vistas pelo estabelecimento e pelo admin).
-- ----------------------------------------------------------------------------
-- MOTIVO: o cliente quer mandar print/foto junto com o pedido.
--
-- O QUE FAZ:
--   1) Pasta PRIVADA de arquivos "feature-request-photos" (até 2 MB por foto,
--      só JPG/PNG/WEBP). As fotos já chegam reduzidas pelo celular (~200 KB).
--   2) Quem pode ENVIAR: só o dono, e só dentro da pasta do próprio estabelecimento.
--      Quem pode VER: o dono (as dele) e o admin. Ninguém de fora, nem com o link.
--   3) Campo photo_paths no pedido + funções de pedido aceitando/devolvendo as fotos.
--
-- RISCO: nenhum para o que já existe. Não mexe nas outras pastas de arquivos nem
-- nos pedidos já feitos (ficam sem foto). A função de enviar continua aceitando o
-- formato antigo (sem fotos), então o site atual segue funcionando.
-- ============================================================================
BEGIN;

-- 1) Pasta privada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feature-request-photos', 'feature-request-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2) Enviar: só o dono, na pasta "<id do estabelecimento>/..."
DROP POLICY IF EXISTS "feature_request_photos_owner_insert" ON storage.objects;
CREATE POLICY "feature_request_photos_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'feature-request-photos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT e.id::text FROM public.establishments e WHERE e.owner_id = auth.uid()
  )
);

-- Ver: o dono (pasta dele) ou o admin
DROP POLICY IF EXISTS "feature_request_photos_owner_admin_select" ON storage.objects;
CREATE POLICY "feature_request_photos_owner_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'feature-request-photos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin_user()
    OR (storage.foldername(name))[1] IN (
      SELECT e.id::text FROM public.establishments e WHERE e.owner_id = auth.uid()
    )
  )
);

-- 3) Fotos no pedido
ALTER TABLE public.establishment_feature_requests
  ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL DEFAULT '{}';

-- Enviar pedido (agora com fotos opcionais). Troca a versão antiga de 2 parâmetros
-- por esta de 3 (o 3º tem padrão vazio, então chamadas antigas continuam funcionando).
DROP FUNCTION IF EXISTS public.create_feature_request(uuid, text);
CREATE OR REPLACE FUNCTION public.create_feature_request(
  p_establishment_id uuid,
  p_message text,
  p_photo_paths text[] DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_msg text := btrim(coalesce(p_message, ''));
  v_paths text[] := coalesce(p_photo_paths, '{}');
  v_row public.establishment_feature_requests%ROWTYPE;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = p_establishment_id;
  IF v_owner IS NULL OR auth.uid() IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF length(v_msg) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_short', 'message', 'Escreva um pouco mais sobre o seu pedido.');
  END IF;
  IF length(v_msg) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_long', 'message', 'O pedido pode ter no máximo 2000 letras.');
  END IF;
  IF coalesce(array_length(v_paths, 1), 0) > 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_photos', 'message', 'Envie no máximo 4 fotos por pedido.');
  END IF;
  -- Só fotos da pasta do próprio estabelecimento
  IF EXISTS (
    SELECT 1 FROM unnest(v_paths) AS p(path)
    WHERE p.path IS NULL OR p.path NOT LIKE p_establishment_id::text || '/%' OR p.path LIKE '%..%'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_photo', 'message', 'Foto inválida. Tente enviar de novo.');
  END IF;
  IF (SELECT count(*) FROM public.establishment_feature_requests
      WHERE establishment_id = p_establishment_id AND status = 'pending') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_pending',
      'message', 'Você já tem 10 pedidos aguardando resposta. Aguarde o suporte responder.');
  END IF;

  INSERT INTO public.establishment_feature_requests (establishment_id, message, created_by, photo_paths)
  VALUES (p_establishment_id, v_msg, auth.uid(), v_paths)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_row));
END;
$$;

-- Ver os próprios pedidos (agora com as fotos)
CREATE OR REPLACE FUNCTION public.list_my_feature_requests(p_establishment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_items jsonb;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = p_establishment_id;
  IF v_owner IS NULL OR auth.uid() IS NULL
     OR (v_owner IS DISTINCT FROM auth.uid() AND NOT public.is_admin_user()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'items', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT id, establishment_id, message, status, admin_reply, created_at, answered_at, photo_paths
    FROM public.establishment_feature_requests
    WHERE establishment_id = p_establishment_id
    ORDER BY created_at DESC
    LIMIT 100
  ) r;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- Admin: todos os pedidos (agora com as fotos)
CREATE OR REPLACE FUNCTION public.admin_list_feature_requests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'items', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT f.id, f.establishment_id, f.message, f.status, f.admin_reply, f.created_at, f.answered_at, f.photo_paths,
           e.name AS establishment_name, e.code AS establishment_code
    FROM public.establishment_feature_requests f
    LEFT JOIN public.establishments e ON e.id = f.establishment_id
    ORDER BY f.created_at DESC
    LIMIT 3000
  ) r;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_feature_request(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_feature_request(uuid, text, text[]) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
