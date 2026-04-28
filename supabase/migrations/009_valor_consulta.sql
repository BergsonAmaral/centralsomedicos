-- Adiciona valor por consulta ao cadastro do médico
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS valor_consulta NUMERIC(10, 2) DEFAULT 0;
