-- ============================================================
-- 014 — Corrige RLS: paciente (anon) não conseguia clicar "Entrar"
--        A tela /sala/* roda sem autenticação (redirectOptions.exclude).
--        Faltava política permitindo aguardando_paciente → em_consulta.
--        Sem isso, o UPDATE era rejeitado silenciosamente pelo RLS e o
--        médico nunca via a consulta iniciar.
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "public_sala_entrar_consulta" ON public.agendamentos;
CREATE POLICY "public_sala_entrar_consulta" ON public.agendamentos
  FOR UPDATE TO anon
  USING      (status = 'aguardando_paciente')
  WITH CHECK (status = 'em_consulta');
