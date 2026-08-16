-- ============================================================
-- 017 — Corrige cadastro de médico quebrado
--
-- A migration 016 moveu a sala do médico para a unidade e o campo
-- saiu do formulário de cadastro. Mas a coluna medicos.sala_slug
-- continuou NOT NULL, então qualquer médico novo falhava com:
--   null value in column "sala_slug" violates not-null constraint
--
-- A coluna não é mais usada pelo app (a sala agora vive em
-- salas.unidade_id). Mantida por segurança, apenas opcional.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.medicos ALTER COLUMN sala_slug DROP NOT NULL;
