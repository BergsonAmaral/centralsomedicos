-- =============================================
-- 005 — Corrigir RLS para usar profiles.role
-- (as policies de 001 usavam auth.jwt() ->> 'role'
--  que não existe no JWT padrão do Supabase)
-- =============================================

-- Helper: usuário atual é admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: id do médico do usuário atual
create or replace function public.current_medico_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from medicos where user_id = auth.uid() limit 1;
$$;

-- Helper: usuário atual é médico?
create or replace function public.is_medico()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'medico'
  );
$$;

-- =============================================
-- Drop policies antigas (que usavam auth.jwt() ->> 'role')
-- =============================================
drop policy if exists "admin_all_medicos"      on medicos;
drop policy if exists "admin_all_pacientes"    on pacientes;
drop policy if exists "admin_all_agendamentos" on agendamentos;
drop policy if exists "admin_all_consultas"    on consultas;
drop policy if exists "admin_all_documentos"   on documentos;
drop policy if exists "admin_all_importacoes"  on importacoes_sus;

drop policy if exists "medico_read_agendamentos" on agendamentos;
drop policy if exists "medico_write_consultas"   on consultas;
drop policy if exists "medico_read_consultas"    on consultas;
drop policy if exists "medico_write_documentos"  on documentos;
drop policy if exists "medico_read_documentos"   on documentos;
drop policy if exists "medico_read_self"         on medicos;
drop policy if exists "medico_update_pausado"    on medicos;

-- =============================================
-- Recriar — admin (full access)
-- =============================================
create policy "admin_all_medicos"      on medicos      for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_pacientes"    on pacientes    for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_agendamentos" on agendamentos for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_consultas"    on consultas    for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_documentos"   on documentos   for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all_importacoes"  on importacoes_sus for all to authenticated using (is_admin()) with check (is_admin());

-- =============================================
-- Médico
-- =============================================
create policy "medico_read_self" on medicos
  for select to authenticated
  using (user_id = auth.uid());

create policy "medico_update_self" on medicos
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "medico_read_agendamentos" on agendamentos
  for select to authenticated
  using (medico_id = current_medico_id());

create policy "medico_update_agendamentos" on agendamentos
  for update to authenticated
  using (medico_id = current_medico_id())
  with check (medico_id = current_medico_id());

create policy "medico_read_pacientes" on pacientes
  for select to authenticated
  using (
    is_medico() and exists (
      select 1 from agendamentos a
      where a.paciente_id = pacientes.id
        and a.medico_id = current_medico_id()
    )
  );

create policy "medico_write_consultas" on consultas
  for insert to authenticated
  with check (medico_id = current_medico_id());

create policy "medico_read_consultas" on consultas
  for select to authenticated
  using (medico_id = current_medico_id());

create policy "medico_write_documentos" on documentos
  for insert to authenticated
  with check (medico_id = current_medico_id());

create policy "medico_update_documentos" on documentos
  for update to authenticated
  using (medico_id = current_medico_id())
  with check (medico_id = current_medico_id());

create policy "medico_read_documentos" on documentos
  for select to authenticated
  using (medico_id = current_medico_id());

-- =============================================
-- Acesso público (sala do paciente)
-- =============================================
-- public_sala_read_agendamentos e public_medico_read já existem em 001
-- (não precisam ser recriados)
