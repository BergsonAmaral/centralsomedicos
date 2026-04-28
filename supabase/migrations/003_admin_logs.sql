-- Tabela de auditoria de ações do administrador
create table if not exists admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users(id) on delete set null,
  admin_email text,
  acao        text not null,
  entidade    text,
  entidade_id uuid,
  detalhes    jsonb default '{}'::jsonb,
  ip          text,
  created_at  timestamptz default now()
);

create index if not exists idx_admin_logs_created on admin_logs(created_at desc);
create index if not exists idx_admin_logs_admin   on admin_logs(admin_id);
create index if not exists idx_admin_logs_acao    on admin_logs(acao);

alter table admin_logs enable row level security;

-- Apenas admins podem ler. Inserts vêm via cliente autenticado (qualquer usuário logado).
drop policy if exists "admin_logs_select" on admin_logs;
create policy "admin_logs_select" on admin_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "admin_logs_insert" on admin_logs;
create policy "admin_logs_insert" on admin_logs
  for insert
  to authenticated
  with check (auth.uid() is not null);
