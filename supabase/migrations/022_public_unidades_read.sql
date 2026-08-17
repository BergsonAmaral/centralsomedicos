-- ============================================================
-- 022 — Leitura pública de unidades ativas
--
-- A nova página pública /agendar precisa listar as unidades pra o
-- paciente escolher onde vai atender, mas unidades só tinha política
-- de leitura pra usuário autenticado.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE POLICY "public_unidades_read" ON public.unidades
  FOR SELECT USING (ativo = true);
