-- =============================================
-- 006 — Habilitar Realtime para tabelas-chave
-- (sem isso, INSERTs/UPDATEs feitos pelo admin
--  não chegam ao painel do médico/sala em tempo real)
-- =============================================

-- Garante REPLICA IDENTITY FULL (necessário para UPDATEs com filtros via Realtime)
alter table public.agendamentos replica identity full;
alter table public.consultas    replica identity full;
alter table public.documentos   replica identity full;
alter table public.medicos      replica identity full;

-- Adiciona à publication do Realtime (idempotente — usa schema explícito)
do $$
declare
  tbl text;
begin
  foreach tbl in array array['agendamentos','consultas','documentos','medicos']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
