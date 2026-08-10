-- =============================================
-- 016 — Agenda com horários fixos (slots de 15min)
-- Expediente por médico + horário do agendamento
-- =============================================

-- Expediente do médico
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS dias_atendimento smallint[] NOT NULL DEFAULT '{1,2,3,4,5}';
-- 0=domingo, 1=segunda, ..., 6=sábado (igual Date.getDay() do JS)

ALTER TABLE medicos ADD COLUMN IF NOT EXISTS horario_inicio time NOT NULL DEFAULT '08:00';
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS horario_fim    time NOT NULL DEFAULT '18:00';
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS duracao_slot_min smallint NOT NULL DEFAULT 15;

-- Horário do agendamento (slot escolhido)
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS horario time;

-- Evita dois agendamentos ativos no mesmo slot do mesmo médico
DROP INDEX IF EXISTS idx_agendamentos_slot_unico;
CREATE UNIQUE INDEX idx_agendamentos_slot_unico
  ON agendamentos(medico_id, data_consulta, horario)
  WHERE horario IS NOT NULL AND status <> 'cancelado';

CREATE INDEX IF NOT EXISTS idx_agendamentos_data_horario ON agendamentos(data_consulta, horario);
