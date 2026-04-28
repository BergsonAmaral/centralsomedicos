-- Adiciona estados de aceite duplo no fluxo de chamada
-- ADMIN chama → aguardando_medico → MÉDICO aceita → aguardando_paciente → PACIENTE entra → em_consulta

alter table agendamentos
  drop constraint if exists agendamentos_status_check;

alter table agendamentos
  add constraint agendamentos_status_check
  check (status in (
    'agendado',
    'checkin',
    'aguardando_medico',
    'aguardando_paciente',
    'em_consulta',
    'concluido',
    'faltou',
    'cancelado'
  ));
