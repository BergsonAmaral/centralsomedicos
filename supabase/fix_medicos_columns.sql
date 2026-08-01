-- ============================================================
-- FIX — Colunas faltando na tabela medicos
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Adiciona valor_consulta (migration 009)
ALTER TABLE public.medicos
  ADD COLUMN IF NOT EXISTS valor_consulta NUMERIC(10, 2) DEFAULT 0;

-- 2. Torna meet_link opcional (migration 008)
ALTER TABLE public.medicos
  ALTER COLUMN meet_link DROP NOT NULL,
  ALTER COLUMN meet_link SET DEFAULT '';

-- 3. Torna sala_slug opcional (médicos usam a tabela salas agora)
ALTER TABLE public.medicos
  ALTER COLUMN sala_slug DROP NOT NULL;
