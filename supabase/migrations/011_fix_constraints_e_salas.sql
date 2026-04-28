-- ============================================================
-- 011 — Fix constraint de status + múltiplas salas por médico
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Recria constraint de status com TODOS os valores válidos ──────────────
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_status_check;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN (
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

-- ── 2. Políticas de avaliação pública (tela da sala pode atualizar) ──────────
DROP POLICY IF EXISTS "public_sala_update_avaliacao" ON public.agendamentos;
CREATE POLICY "public_sala_update_avaliacao" ON public.agendamentos
  FOR UPDATE TO anon
  USING  (status = 'aguardando_avaliacao')
  WITH CHECK (status = 'concluido');

DROP POLICY IF EXISTS "public_update_avaliacao_consulta" ON public.consultas;
CREATE POLICY "public_update_avaliacao_consulta" ON public.consultas
  FOR UPDATE TO anon
  USING  (true)
  WITH CHECK (true);

-- ── 3. Tabela de salas (múltiplas salas por médico) ──────────────────────────
CREATE TABLE IF NOT EXISTS salas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  nome       TEXT NOT NULL,
  medico_id  UUID REFERENCES medicos(id) ON DELETE SET NULL,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Coluna sala_slug nos agendamentos ─────────────────────────────────────
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS sala_slug TEXT;

-- ── 5. Migra sala_slug existente de medicos → salas ─────────────────────────
INSERT INTO salas (slug, nome, medico_id)
SELECT
  m.sala_slug,
  'Consultório — ' || m.nome,
  m.id
FROM medicos m
WHERE m.sala_slug IS NOT NULL AND m.sala_slug <> ''
ON CONFLICT (slug) DO NOTHING;

-- ── 6. RLS para salas ────────────────────────────────────────────────────────
ALTER TABLE salas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salas_select_public" ON salas;
CREATE POLICY "salas_select_public" ON salas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "salas_admin_all" ON salas;
CREATE POLICY "salas_admin_all" ON salas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 7. Realtime ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'salas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE salas;
  END IF;
END $$;
