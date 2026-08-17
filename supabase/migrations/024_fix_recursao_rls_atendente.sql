-- ============================================================
-- 024 — Corrige recursão infinita no RLS do atendente
--
-- As políticas de agendamentos para atendente (023) faziam um
-- subquery em pacientes. Mas pacientes já tinha uma política pra
-- médico que faz subquery em agendamentos. Postgres avalia TODAS as
-- políticas de SELECT de uma tabela juntas (OR) — então uma consulta
-- em pacientes avaliava a política de médico, que consultava
-- agendamentos, que avaliava a política de atendente, que consultava
-- pacientes de novo — loop infinito ("infinite recursion detected in
-- policy for relation pacientes").
--
-- Fix: mesmo padrão já usado em is_admin()/is_medico()/
-- current_medico_id() — uma função SECURITY DEFINER consulta a
-- tabela com privilégio elevado, sem re-acionar o RLS dela, quebrando
-- o ciclo.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.paciente_na_unidade_atendente(p_paciente_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pacientes
    WHERE id = p_paciente_id AND unidade_id = current_atendente_unidade_id()
  );
$$;

DROP POLICY IF EXISTS "atendente_select_agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "atendente_insert_agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "atendente_update_agendamentos" ON public.agendamentos;

CREATE POLICY "atendente_select_agendamentos" ON public.agendamentos
  FOR SELECT TO authenticated
  USING (is_atendente() AND paciente_na_unidade_atendente(paciente_id));

CREATE POLICY "atendente_insert_agendamentos" ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (is_atendente() AND paciente_na_unidade_atendente(paciente_id));

CREATE POLICY "atendente_update_agendamentos" ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (is_atendente() AND paciente_na_unidade_atendente(paciente_id))
  WITH CHECK (is_atendente() AND paciente_na_unidade_atendente(paciente_id));
