--- ============================================================
-- FIX ALL — rode este arquivo COMPLETO no Supabase SQL Editor
-- Cria todas as tabelas e aplica todas as migrations (001→006)
-- 100% idempotente — pode rodar mesmo que já exista tudo
-- ============================================================

-- ============================================================
-- 001 — Tabelas base
-- ============================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'medico')),
  nome       text not null,
  created_at timestamptz default now()
);

create table if not exists public.medicos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade unique,
  nome          text not null,
  crm           text not null unique,
  especialidade text not null,
  foto_url      text,
  meet_link     text not null,
  sala_slug     text not null unique,
  ativo         boolean default true,
  pausado       boolean default false,
  created_at    timestamptz default now()
);

create table if not exists public.pacientes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  cpf             text not null unique,
  data_nascimento date,
  telefone        text,
  email           text,
  sus_cartao      text,
  created_at      timestamptz default now()
);

create table if not exists public.agendamentos (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid references public.pacientes(id) not null,
  medico_id     uuid references public.medicos(id) not null,
  data_consulta date not null,
  motivo        text,
  observacoes   text,
  origem        text default 'sus' check (origem in ('sus', 'manual')),
  status        text default 'agendado',
  checkin_em    timestamptz,
  chamado_em    timestamptz,
  encerrado_em  timestamptz,
  triagem       jsonb,
  created_at    timestamptz default now()
);

create index if not exists idx_agendamentos_data    on public.agendamentos(data_consulta, status);
create index if not exists idx_agendamentos_medico  on public.agendamentos(medico_id, data_consulta);
create index if not exists idx_agendamentos_checkin on public.agendamentos(checkin_em asc) where status = 'checkin';

create table if not exists public.consultas (
  id                   uuid primary key default gen_random_uuid(),
  agendamento_id       uuid references public.agendamentos(id),
  medico_id            uuid references public.medicos(id),
  paciente_id          uuid references public.pacientes(id),
  evolucao             text,
  duracao_minutos      integer,
  avaliacao_nota       integer check (avaliacao_nota between 1 and 5),
  avaliacao_comentario text,
  created_at           timestamptz default now()
);

create table if not exists public.documentos (
  id             uuid primary key default gen_random_uuid(),
  consulta_id    uuid references public.consultas(id),
  medico_id      uuid references public.medicos(id),
  paciente_id    uuid references public.pacientes(id),
  tipo           text not null check (tipo in ('atestado','pedido_exame','receita','receita_controlada','encaminhamento','declaracao')),
  conteudo       jsonb not null,
  pdf_url        text,
  status         text default 'gerado' check (status in ('gerado','enviado_paciente','arquivado')),
  link_acesso    text unique,
  link_expira_em timestamptz,
  enviado_via    text,
  created_at     timestamptz default now()
);

create table if not exists public.importacoes_sus (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid references auth.users(id),
  arquivo_nome  text,
  total_linhas  integer,
  importados    integer,
  erros         integer,
  erros_detalhe jsonb,
  created_at    timestamptz default now()
);

-- RLS habilitado em todas as tabelas
alter table public.profiles        enable row level security;
alter table public.medicos         enable row level security;
alter table public.pacientes       enable row level security;
alter table public.agendamentos    enable row level security;
alter table public.consultas       enable row level security;
alter table public.documentos      enable row level security;
alter table public.importacoes_sus enable row level security;

-- Policy próprio perfil (não derruba)
drop policy if exists "own_profile" on public.profiles;
create policy "own_profile" on public.profiles for all using (auth.uid() = id);

-- Políticas públicas (sala do paciente)
drop policy if exists "public_sala_read_agendamentos" on public.agendamentos;
create policy "public_sala_read_agendamentos" on public.agendamentos for select using (true);

drop policy if exists "public_medico_read" on public.medicos;
create policy "public_medico_read" on public.medicos for select using (ativo = true);

drop policy if exists "public_doc_link" on public.documentos;
create policy "public_doc_link" on public.documentos
  for select using (link_acesso is not null and link_expira_em > now());

-- ============================================================
-- 002 — Constraint de status atualizada (aceite duplo)
-- ============================================================
alter table public.agendamentos
  drop constraint if exists agendamentos_status_check;

alter table public.agendamentos
  add constraint agendamentos_status_check
  check (status in (
    'agendado','checkin','aguardando_medico','aguardando_paciente',
    'em_consulta','concluido','faltou','cancelado'
  ));

-- ============================================================
-- 003 — Admin logs (idempotente)
-- ============================================================
create table if not exists public.admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users(id) on delete set null,
  acao        text not null,
  entidade    text,
  entidade_id uuid,
  detalhes    jsonb,
  created_at  timestamptz not null default now()
);

alter table public.admin_logs enable row level security;

drop policy if exists "admin_all_logs" on public.admin_logs;
create policy "admin_all_logs" on public.admin_logs
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 004 — sexo em pacientes + agendamento_id em documentos
-- ============================================================
alter table public.pacientes
  add column if not exists sexo text check (sexo in ('M', 'F', 'O'));

alter table public.documentos
  add column if not exists agendamento_id uuid references public.agendamentos(id) on delete set null;

create index if not exists idx_documentos_agendamento on public.documentos(agendamento_id);
create index if not exists idx_documentos_consulta    on public.documentos(consulta_id);
create index if not exists idx_documentos_medico      on public.documentos(medico_id, created_at desc);
create index if not exists idx_documentos_paciente    on public.documentos(paciente_id, created_at desc);
create index if not exists idx_consultas_medico       on public.consultas(medico_id, created_at desc);
create index if not exists idx_consultas_paciente     on public.consultas(paciente_id, created_at desc);

-- ============================================================
-- 005 — Corrigir RLS: usa profiles.role via SECURITY DEFINER
-- ============================================================

-- Helpers
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_medico()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'medico');
$$;

create or replace function public.current_medico_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from medicos where user_id = auth.uid() limit 1;
$$;

-- Drop policies antigas
drop policy if exists "admin_all_medicos"           on public.medicos;
drop policy if exists "admin_all_pacientes"         on public.pacientes;
drop policy if exists "admin_all_agendamentos"      on public.agendamentos;
drop policy if exists "admin_all_consultas"         on public.consultas;
drop policy if exists "admin_all_documentos"        on public.documentos;
drop policy if exists "admin_all_importacoes"       on public.importacoes_sus;
drop policy if exists "admin_all_logs"              on public.admin_logs;
drop policy if exists "medico_read_agendamentos"    on public.agendamentos;
drop policy if exists "medico_update_agendamentos"  on public.agendamentos;
drop policy if exists "medico_write_consultas"      on public.consultas;
drop policy if exists "medico_read_consultas"       on public.consultas;
drop policy if exists "medico_write_documentos"     on public.documentos;
drop policy if exists "medico_update_documentos"    on public.documentos;
drop policy if exists "medico_read_documentos"      on public.documentos;
drop policy if exists "medico_read_self"            on public.medicos;
drop policy if exists "medico_update_self"          on public.medicos;
drop policy if exists "medico_update_pausado"       on public.medicos;
drop policy if exists "medico_read_pacientes"       on public.pacientes;

-- Admin: acesso total
create policy "admin_all_medicos"      on public.medicos      for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_pacientes"    on public.pacientes    for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_agendamentos" on public.agendamentos for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_consultas"    on public.consultas    for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_documentos"   on public.documentos   for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_logs"         on public.admin_logs   for all to authenticated using (is_admin()) with check (is_admin());

do $$ begin
  if exists (select from information_schema.tables where table_name = 'importacoes_sus') then
    execute $p$
      drop policy if exists "admin_all_importacoes" on public.importacoes_sus;
      create policy "admin_all_importacoes" on public.importacoes_sus
        for all to authenticated using (is_admin()) with check (is_admin());
    $p$;
  end if;
end $$;

-- Médico: lê e atualiza só os seus
create policy "medico_read_self"       on public.medicos for select to authenticated using (user_id = auth.uid());
create policy "medico_update_self"     on public.medicos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "medico_read_agendamentos"   on public.agendamentos for select to authenticated using (medico_id = current_medico_id());
create policy "medico_update_agendamentos" on public.agendamentos for update to authenticated using (medico_id = current_medico_id()) with check (medico_id = current_medico_id());

create policy "medico_read_pacientes"  on public.pacientes for select to authenticated
  using (is_medico() and exists (
    select 1 from public.agendamentos a
    where a.paciente_id = pacientes.id and a.medico_id = current_medico_id()
  ));

create policy "medico_write_consultas"    on public.consultas for insert to authenticated with check (medico_id = current_medico_id());
create policy "medico_read_consultas"     on public.consultas for select to authenticated using (medico_id = current_medico_id());
create policy "medico_write_documentos"   on public.documentos for insert to authenticated with check (medico_id = current_medico_id());
create policy "medico_update_documentos"  on public.documentos for update to authenticated using (medico_id = current_medico_id()) with check (medico_id = current_medico_id());
create policy "medico_read_documentos"    on public.documentos for select to authenticated using (medico_id = current_medico_id());

-- ============================================================
-- 006 — Realtime
-- ============================================================
alter table public.agendamentos replica identity full;
alter table public.consultas    replica identity full;
alter table public.documentos   replica identity full;
alter table public.medicos      replica identity full;

do $$
declare tbl text;
begin
  foreach tbl in array array['agendamentos','consultas','documentos','medicos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
