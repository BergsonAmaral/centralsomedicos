-- Permite cadastrar médicos que recebem por hora trabalhada, em vez de
-- (ou além de) por consulta — usado no relatório financeiro.
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS valor_hora numeric(10,2);
