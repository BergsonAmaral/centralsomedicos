-- ============================================================
-- RESET DE DADOS — apaga todos os registros, mantém estrutura
-- ⚠️  IRREVERSÍVEL — use apenas em ambiente de desenvolvimento
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Desativa triggers temporariamente para evitar cascata de erros
SET session_replication_role = replica;

-- Ordem: filhos antes dos pais (respeita foreign keys)
DELETE FROM public.admin_logs;
DELETE FROM public.documentos;
DELETE FROM public.consultas;
DELETE FROM public.agendamentos;
DELETE FROM public.importacoes_sus;
DELETE FROM public.pacientes;
DELETE FROM public.salas;
DELETE FROM public.medicos;
-- Preserva admins — apaga apenas perfis de médicos
DELETE FROM public.profiles WHERE role = 'medico';

-- Limpa arquivos do Storage (bucket documentos)
DELETE FROM storage.objects WHERE bucket_id = 'documentos';

-- Reativa triggers
SET session_replication_role = DEFAULT;
