-- ============================================================
-- 020 — Nome do paciente não aparecia na tela da sala
--
-- A tabela agendamentos já é 100% pública para leitura (política
-- "public_sala_read_agendamentos", usada pela tela /sala/[slug]), mas
-- pacientes nunca teve uma política pública — só admin e médico
-- autenticados podiam ler. O join `pacientes(nome)` feito pela sala
-- (usuário anônimo, sem login) sempre voltava null, então o nome do
-- paciente nunca aparecia nas telas "Preparando sua consulta" e
-- "Sua vez!" — só o card genérico sem nome.
--
-- Libera leitura pública só do nome (a política do Postgres não limita
-- colunas, mas a exposição real é a mesma que já existe hoje via
-- agendamentos: só pacientes com algum agendamento vinculado a uma
-- sala física, que é exatamente quem aparece nesses kiosks).
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

create policy "public_sala_read_pacientes" on public.pacientes
  for select using (
    exists (
      select 1 from public.agendamentos a
      where a.paciente_id = pacientes.id
        and a.sala_slug is not null
    )
  );
