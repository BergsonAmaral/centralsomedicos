-- =============================================
-- 004 — Adicionar sexo em pacientes e
--       agendamento_id em documentos
-- =============================================

-- 1. Sexo do paciente (M/F/O)
alter table pacientes
  add column if not exists sexo text check (sexo in ('M', 'F', 'O'));

-- 2. agendamento_id em documentos
--    Permite vincular o documento ao agendamento ANTES de a consulta ser criada
--    e atualizar consulta_id no encerramento.
alter table documentos
  add column if not exists agendamento_id uuid references agendamentos(id) on delete set null;

create index if not exists idx_documentos_agendamento on documentos(agendamento_id);
create index if not exists idx_documentos_consulta    on documentos(consulta_id);
create index if not exists idx_documentos_medico      on documentos(medico_id, created_at desc);
create index if not exists idx_documentos_paciente    on documentos(paciente_id, created_at desc);

-- 3. Índices úteis para os relatórios
create index if not exists idx_consultas_medico   on consultas(medico_id, created_at desc);
create index if not exists idx_consultas_paciente on consultas(paciente_id, created_at desc);
