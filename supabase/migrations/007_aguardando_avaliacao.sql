-- =============================================
-- 007 — Adiciona status "aguardando_avaliacao"
-- Fluxo: em_consulta → aguardando_avaliacao
--        (médico encerra) → paciente avalia → concluido
-- =============================================

-- Atualiza a constraint de status nos agendamentos
alter table public.agendamentos
  drop constraint if exists agendamentos_status_check;

alter table public.agendamentos
  add constraint agendamentos_status_check
  check (status in (
    'agendado',
    'checkin',
    'aguardando_medico',
    'aguardando_paciente',
    'em_consulta',
    'aguardando_avaliacao',
    'concluido',
    'faltou',
    'cancelado'
  ));

-- Política pública: a tela da sala (anon) pode ler agendamentos em avaliação
-- (a política de leitura pública já deve existir de 001, esta é só garantia)
drop policy if exists "public_sala_update_avaliacao" on public.agendamentos;
create policy "public_sala_update_avaliacao" on public.agendamentos
  for update to anon
  using  (status = 'aguardando_avaliacao')
  with check (status = 'concluido');

-- Política pública: anon pode atualizar consulta com a avaliação
drop policy if exists "public_update_avaliacao_consulta" on public.consultas;
create policy "public_update_avaliacao_consulta" on public.consultas
  for update to anon
  using  (true)
  with check (true);
