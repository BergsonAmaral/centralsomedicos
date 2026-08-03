-- ============================================================
-- 015 — Estrutura para integração com Memed (prescrição digital)
--        Prepara o campo de vínculo por médico. A conexão real só
--        funciona quando a Central SóMedicos for aprovada como
--        parceiro Memed e o token de integração for configurado.
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.medicos
  ADD COLUMN IF NOT EXISTS memed_token TEXT,
  ADD COLUMN IF NOT EXISTS memed_conectado_em TIMESTAMPTZ;
