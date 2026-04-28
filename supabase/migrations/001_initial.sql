-- =============================================
-- SoMedicos — Migração inicial completa
-- =============================================

-- =============================================
-- PERFIS (complementa o auth.users do Supabase)
-- =============================================
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'medico')),
  nome       text not null,
  created_at timestamptz default now()
);

-- =============================================
-- MÉDICOS
-- =============================================
create table medicos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade unique,
  nome          text not null,
  crm           text not null unique,
  especialidade text not null,
  foto_url      text,
  meet_link     text not null,        -- link FIXO da sala Google Meet
  sala_slug     text not null unique, -- slug da URL pública ex: "dra-ana-cardiologia"
  ativo         boolean default true,
  pausado       boolean default false,
  created_at    timestamptz default now()
);

-- =============================================
-- PACIENTES (originados da lista do SUS)
-- =============================================
create table pacientes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  cpf             text not null unique,
  data_nascimento date,
  telefone        text,
  email           text,
  sus_cartao      text,
  created_at      timestamptz default now()
);

-- =============================================
-- AGENDAMENTOS
-- =============================================
create table agendamentos (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid references pacientes(id) not null,
  medico_id     uuid references medicos(id) not null,
  data_consulta date not null,
  motivo        text,
  observacoes   text,
  origem        text default 'sus' check (origem in ('sus', 'manual')),

  status        text default 'agendado'
    check (status in ('agendado','checkin','em_consulta','concluido','faltou','cancelado')),

  checkin_em   timestamptz,  -- define a ORDEM na fila (nunca salvar posição)
  chamado_em   timestamptz,
  encerrado_em timestamptz,

  triagem      jsonb, -- { alergia: bool, febre: bool, urgencia: bool, obs: string }

  created_at   timestamptz default now()
);

create index idx_agendamentos_data    on agendamentos(data_consulta, status);
create index idx_agendamentos_medico  on agendamentos(medico_id, data_consulta);
create index idx_agendamentos_checkin on agendamentos(checkin_em asc) where status = 'checkin';

-- =============================================
-- CONSULTAS (histórico — sem ordenação obrigatória)
-- =============================================
create table consultas (
  id                   uuid primary key default gen_random_uuid(),
  agendamento_id       uuid references agendamentos(id),
  medico_id            uuid references medicos(id),
  paciente_id          uuid references pacientes(id),
  evolucao             text,
  duracao_minutos      integer,
  avaliacao_nota       integer check (avaliacao_nota between 1 and 5),
  avaliacao_comentario text,
  created_at           timestamptz default now()
);

-- =============================================
-- DOCUMENTOS
-- =============================================
create table documentos (
  id             uuid primary key default gen_random_uuid(),
  consulta_id    uuid references consultas(id),
  medico_id      uuid references medicos(id),
  paciente_id    uuid references pacientes(id),
  tipo           text not null
    check (tipo in ('atestado','pedido_exame','receita','receita_controlada','encaminhamento','declaracao')),
  conteudo       jsonb not null,
  pdf_url        text,
  status         text default 'gerado'
    check (status in ('gerado','enviado_paciente','arquivado')),
  link_acesso    text unique,       -- token UUID para acesso público
  link_expira_em timestamptz,       -- now() + 7 days
  enviado_via    text,              -- 'whatsapp' | 'email' | 'download'
  created_at     timestamptz default now()
);

-- =============================================
-- LOG DE IMPORTAÇÕES DO SUS
-- =============================================
create table importacoes_sus (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid references auth.users(id),
  arquivo_nome  text,
  total_linhas  integer,
  importados    integer,
  erros         integer,
  erros_detalhe jsonb,
  created_at    timestamptz default now()
);

-- =============================================
-- RLS — Row Level Security
-- =============================================
alter table profiles        enable row level security;
alter table medicos         enable row level security;
alter table pacientes       enable row level security;
alter table agendamentos    enable row level security;
alter table consultas       enable row level security;
alter table documentos      enable row level security;
alter table importacoes_sus enable row level security;

-- Perfil: usuário lê/atualiza o próprio
create policy "own_profile" on profiles
  for all using (auth.uid() = id);

-- Admin lê e escreve tudo
create policy "admin_all_medicos" on medicos
  for all using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_all_pacientes" on pacientes
  for all using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_all_agendamentos" on agendamentos
  for all using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_all_consultas" on consultas
  for all using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_all_documentos" on documentos
  for all using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_all_importacoes" on importacoes_sus
  for all using (auth.jwt() ->> 'role' = 'admin');

-- Médico lê seus próprios agendamentos
create policy "medico_read_agendamentos" on agendamentos
  for select using (
    auth.jwt() ->> 'role' = 'medico' and
    medico_id = (select id from medicos where user_id = auth.uid())
  );

-- Médico escreve suas próprias consultas
create policy "medico_write_consultas" on consultas
  for insert with check (
    auth.jwt() ->> 'role' = 'medico' and
    medico_id = (select id from medicos where user_id = auth.uid())
  );

create policy "medico_read_consultas" on consultas
  for select using (
    auth.jwt() ->> 'role' = 'medico' and
    medico_id = (select id from medicos where user_id = auth.uid())
  );

-- Médico escreve seus próprios documentos
create policy "medico_write_documentos" on documentos
  for insert with check (
    auth.jwt() ->> 'role' = 'medico' and
    medico_id = (select id from medicos where user_id = auth.uid())
  );

create policy "medico_read_documentos" on documentos
  for select using (
    auth.jwt() ->> 'role' = 'medico' and
    medico_id = (select id from medicos where user_id = auth.uid())
  );

-- Médico lê os próprios dados
create policy "medico_read_self" on medicos
  for select using (
    auth.jwt() ->> 'role' = 'medico' and
    user_id = auth.uid()
  );

-- Médico atualiza pausado
create policy "medico_update_pausado" on medicos
  for update using (
    auth.jwt() ->> 'role' = 'medico' and
    user_id = auth.uid()
  ) with check (
    auth.jwt() ->> 'role' = 'medico' and
    user_id = auth.uid()
  );

-- Tabela agendamentos: leitura pública para a tela /sala/[slug]
create policy "public_sala_read_agendamentos" on agendamentos
  for select using (true);

-- Tabela medicos: leitura pública para médicos ativos (sala)
create policy "public_medico_read" on medicos
  for select using (ativo = true);

-- Documentos: acesso público por link_acesso (token)
create policy "public_doc_link" on documentos
  for select using (
    link_acesso is not null and
    link_expira_em > now()
  );

-- =============================================
-- FUNÇÃO: gerar role no JWT após login
-- (executar via trigger no auth.users)
-- =============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- O profile é inserido manualmente pelo admin após criar o usuário
  return new;
end;
$$;

-- =============================================
-- STORAGE BUCKETS
-- =============================================
-- Executar no Supabase Dashboard > Storage:
-- 1. Criar bucket "documentos" (privado)
-- 2. Criar bucket "avatares" (público)

-- Policy de storage para documentos:
-- insert: médico autenticado
-- select: médico dono OU admin
