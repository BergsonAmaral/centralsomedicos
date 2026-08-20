-- Comissão por produtividade: se o médico atender mais pacientes numa hora
-- do que a meta cadastrada, aquela hora específica passa a valer o
-- "valor/hora bônus" em vez do valor/hora normal, na Folha de Pagamento.
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS meta_atendimentos_hora integer;
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS valor_hora_bonus numeric(10,2);
