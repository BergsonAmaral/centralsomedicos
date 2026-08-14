-- ============================================================
-- 016 — Sala pertence à UNIDADE, não ao médico
--
-- Modelo real do negócio: o paciente fica fisicamente na unidade
-- (hospital/UBS/itinerante), numa tela/sala virtual fixa daquele
-- local. O admin roteia o paciente daquela sala para qualquer
-- médico disponível no momento — o médico não tem mais uma sala
-- própria fixa.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Sala passa a pertencer à unidade (antes pertencia ao médico)
ALTER TABLE public.salas DROP CONSTRAINT IF EXISTS salas_medico_id_fkey;
ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE;
ALTER TABLE public.salas DROP COLUMN IF EXISTS medico_id;

-- Uma unidade pode ter várias salas — só o slug precisa ser único (já era).
CREATE INDEX IF NOT EXISTS idx_salas_unidade_id ON public.salas(unidade_id);

-- 2. medicos.sala_slug fica obsoleto — não é mais usado pelo app,
--    mas deixamos a coluna por segurança (não quebra nada existente).
