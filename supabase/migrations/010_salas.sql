-- ============================================================
-- Múltiplas salas por médico
-- ============================================================

-- 1. Tabela de salas
CREATE TABLE IF NOT EXISTS salas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  nome        TEXT NOT NULL,
  medico_id   UUID REFERENCES medicos(id) ON DELETE SET NULL,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Coluna sala_slug nos agendamentos (qual sala o paciente foi direcionado)
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS sala_slug TEXT;

-- 3. Migrar sala_slug existente de medicos → salas
INSERT INTO salas (slug, nome, medico_id)
SELECT
  m.sala_slug,
  'Consultório — ' || m.nome,
  m.id
FROM medicos m
WHERE m.sala_slug IS NOT NULL AND m.sala_slug <> ''
ON CONFLICT (slug) DO NOTHING;

-- 4. RLS
ALTER TABLE salas ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ler (tela pública da sala)
CREATE POLICY "salas_select_public" ON salas
  FOR SELECT USING (true);

-- Apenas admin pode criar/editar/deletar
CREATE POLICY "salas_admin_all" ON salas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Realtime para salas
ALTER PUBLICATION supabase_realtime ADD TABLE salas;
