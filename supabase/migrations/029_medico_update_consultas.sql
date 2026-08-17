-- O prontuário agora é criado no INÍCIO da consulta (não só ao encerrar) e
-- salvo automaticamente enquanto o médico digita — precisa de permissão de
-- UPDATE em "consultas", que antes só tinha INSERT.
CREATE POLICY "medico_update_consultas" ON consultas
  FOR UPDATE TO authenticated
  USING (medico_id = current_medico_id())
  WITH CHECK (medico_id = current_medico_id());
