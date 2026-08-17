-- ============================================================
-- 023 — Novo papel: Atendente
--
-- Funcionário da recepção de uma unidade específica. Só admin cria
-- essa conta (mesmo padrão de médico). O atendente:
--   - cadastra paciente (só da própria unidade)
--   - cadastra/edita agendamento (só de pacientes da própria unidade)
--   - mexe na fila (check-in, chamar, voltar pra fila, cancelar)
--   - vê lista de pacientes e histórico de agendamentos da unidade
-- Não cadastra médico nem mexe em unidades/salas — isso continua
-- exclusivo do admin.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Libera o novo valor de role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'medico', 'atendente'));

-- 2. Tabela atendentes (extensão do profile, igual medicos)
CREATE TABLE IF NOT EXISTS public.atendentes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.atendentes ENABLE ROW LEVEL SECURITY;

-- 3. Funções auxiliares (mesmo padrão de is_medico()/current_medico_id())
CREATE OR REPLACE FUNCTION public.is_atendente()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'atendente'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_atendente_unidade_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unidade_id FROM atendentes WHERE user_id = auth.uid() AND ativo = true LIMIT 1;
$$;

-- 4. RLS — atendentes (admin gerencia tudo; atendente só lê o próprio registro)
CREATE POLICY "admin_all_atendentes" ON public.atendentes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "atendente_read_self" ON public.atendentes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 5. RLS — pacientes (só da própria unidade)
CREATE POLICY "atendente_select_pacientes" ON public.pacientes
  FOR SELECT TO authenticated
  USING (is_atendente() AND unidade_id = current_atendente_unidade_id());

CREATE POLICY "atendente_insert_pacientes" ON public.pacientes
  FOR INSERT TO authenticated
  WITH CHECK (is_atendente() AND unidade_id = current_atendente_unidade_id());

CREATE POLICY "atendente_update_pacientes" ON public.pacientes
  FOR UPDATE TO authenticated
  USING (is_atendente() AND unidade_id = current_atendente_unidade_id())
  WITH CHECK (is_atendente() AND unidade_id = current_atendente_unidade_id());

-- 6. RLS — agendamentos (só de pacientes da própria unidade)
CREATE POLICY "atendente_select_agendamentos" ON public.agendamentos
  FOR SELECT TO authenticated
  USING (
    is_atendente() AND EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = agendamentos.paciente_id AND p.unidade_id = current_atendente_unidade_id()
    )
  );

CREATE POLICY "atendente_insert_agendamentos" ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    is_atendente() AND EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = agendamentos.paciente_id AND p.unidade_id = current_atendente_unidade_id()
    )
  );

CREATE POLICY "atendente_update_agendamentos" ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (
    is_atendente() AND EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = agendamentos.paciente_id AND p.unidade_id = current_atendente_unidade_id()
    )
  )
  WITH CHECK (
    is_atendente() AND EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = agendamentos.paciente_id AND p.unidade_id = current_atendente_unidade_id()
    )
  );
