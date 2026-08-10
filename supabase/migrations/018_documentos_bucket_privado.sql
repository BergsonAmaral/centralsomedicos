-- ============================================================
-- 018 — Fecha o bucket "documentos" (receitas, atestados etc. com
-- dados de saúde do paciente não podem ficar acessíveis por URL
-- pública direta). Acesso passa a exigir:
--   - usuário autenticado (admin/médico) com createSignedUrl(), OU
--   - a página pública /doc/[token], que valida link_acesso +
--     link_expira_em antes de gerar uma signed URL de curta duração
--     via server/api/documentos/ver.get.ts (service role).
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'documentos';

-- Remove o acesso anônimo direto ao arquivo — o "gate" agora é
-- sempre a validação de token no endpoint /api/documentos/ver.
DROP POLICY IF EXISTS "Público pode visualizar documentos" ON storage.objects;
