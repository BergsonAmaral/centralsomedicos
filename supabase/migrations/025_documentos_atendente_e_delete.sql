-- ============================================================
-- 025 — Atendente vê documentos (não apaga) + fecha exclusão pro admin
--
-- 1. A política de DELETE do storage "documentos" liberava qualquer
--    usuário autenticado a apagar qualquer arquivo — isso incluiria o
--    atendente, que não deve poder excluir documento nenhum. Restringe
--    a admin.
--
-- 2. Libera leitura da tabela documentos pro atendente, só dos
--    pacientes da própria unidade — usa a mesma função SECURITY
--    DEFINER de 024 pra não reabrir o problema de recursão de RLS.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Restringe exclusão de arquivo no storage a admin
DROP POLICY IF EXISTS "Autenticados podem deletar documentos" ON storage.objects;
CREATE POLICY "Admin pode deletar documentos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND is_admin());

-- 2. Atendente lê documentos da própria unidade (sem insert/update/delete)
CREATE POLICY "atendente_select_documentos" ON public.documentos
  FOR SELECT TO authenticated
  USING (is_atendente() AND paciente_na_unidade_atendente(paciente_id));
