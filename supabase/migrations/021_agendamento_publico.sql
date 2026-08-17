-- ============================================================
-- 021 — Agendamento público (paciente marca sozinho)
--
-- Nova página pública /agendar deixa o próprio paciente escolher
-- especialista, dia e horário sem precisar de admin. O agendamento
-- criado por esse fluxo é marcado com origem = 'publico' (distinto de
-- 'sus' e 'manual', que já existiam) só para diferenciar nos
-- relatórios de onde veio o agendamento.
--
-- A sala não é escolhida aqui — continua sendo definida no check-in
-- (mesma lógica que já existe hoje), na unidade escolhida no
-- agendamento.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.agendamentos DROP CONSTRAINT IF EXISTS agendamentos_origem_check;
ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_origem_check
  CHECK (origem IN ('sus', 'manual', 'publico'));
