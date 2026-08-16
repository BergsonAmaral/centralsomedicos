-- ============================================================
-- 019 — Impede sala sem unidade
--
-- O formulário de cadastro de sala (admin/salas.vue) já bloqueia
-- salvar sem unidade, mas testando direto contra o REST da Supabase
-- (POST /salas sem unidade_id) o insert passava — nada no banco
-- impedia. Uma sala órfã não aparece em nenhuma unidade na tela de
-- Salas e fica "invisível" para o admin, mas o link /sala/<slug>
-- continua funcionando.
--
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.salas ALTER COLUMN unidade_id SET NOT NULL;
