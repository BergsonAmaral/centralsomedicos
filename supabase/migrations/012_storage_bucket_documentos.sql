-- ============================================================
-- 012 — Criação do bucket de storage para documentos
-- Execute este script no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Criar bucket "documentos" como público ────────────────────────────────
-- (público para que getPublicUrl() funcione sem auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos',
  'documentos',
  true,
  10485760,  -- 10 MB por arquivo
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf'];

-- ── 2. Políticas de acesso ao storage ────────────────────────────────────────

-- Usuários autenticados podem fazer upload (médicos gerando documentos)
DROP POLICY IF EXISTS "Autenticados podem fazer upload de documentos" ON storage.objects;
CREATE POLICY "Autenticados podem fazer upload de documentos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos');

-- Usuários autenticados podem visualizar (admin e médico consultando)
DROP POLICY IF EXISTS "Autenticados podem visualizar documentos" ON storage.objects;
CREATE POLICY "Autenticados podem visualizar documentos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');

-- Qualquer um pode visualizar (necessário para iframe público / link enviado ao paciente)
DROP POLICY IF EXISTS "Público pode visualizar documentos" ON storage.objects;
CREATE POLICY "Público pode visualizar documentos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'documentos');

-- Autenticados podem deletar (admin limpando documentos de pacientes excluídos)
DROP POLICY IF EXISTS "Autenticados podem deletar documentos" ON storage.objects;
CREATE POLICY "Autenticados podem deletar documentos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos');
