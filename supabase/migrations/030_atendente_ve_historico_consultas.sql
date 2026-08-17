-- Atendente precisa ver o histórico clínico completo do paciente da sua
-- unidade — de qualquer médico que já atendeu, não só quem está de
-- plantão agora. Antes não havia policy nenhuma pra atendente em
-- "consultas", então a tabela ficava invisível pra ela.
CREATE POLICY "atendente_select_consultas" ON public.consultas
  FOR SELECT TO authenticated
  USING (is_atendente() AND paciente_na_unidade_atendente(paciente_id));
