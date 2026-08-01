-- ============================================================
-- 013 — Assinatura digital do médico
-- ============================================================

-- 1. Coluna para armazenar a URL pública da imagem da assinatura
ALTER TABLE public.medicos
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT;

-- 2. Bucket para as assinaturas (privado — acesso via URL pública do Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assinaturas', 'assinaturas', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS do bucket: médico só pode ler/escrever a própria assinatura; admin lê tudo
DROP POLICY IF EXISTS "assinaturas_insert_medico" ON storage.objects;
CREATE POLICY "assinaturas_insert_medico" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assinaturas' AND
    EXISTS (
      SELECT 1 FROM medicos
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assinaturas_update_medico" ON storage.objects;
CREATE POLICY "assinaturas_update_medico" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'assinaturas' AND
    EXISTS (
      SELECT 1 FROM medicos
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assinaturas_select_auth" ON storage.objects;
CREATE POLICY "assinaturas_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assinaturas');
