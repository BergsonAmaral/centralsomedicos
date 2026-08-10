-- ============================================================
-- Unidades (hospitais, UBS, postos itinerantes, regiões rurais)
-- Cada paciente pertence a uma unidade. As consultas dessa unidade
-- são encaminhadas manualmente pelo admin para qualquer médico
-- disponível no momento — não há vínculo fixo unidade↔médico.
-- ============================================================

CREATE TABLE IF NOT EXISTS unidades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'hospital' CHECK (tipo IN ('hospital', 'ubs', 'itinerante', 'rural')),
  cidade     TEXT,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES unidades(id) ON DELETE SET NULL;

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades_select_authenticated" ON unidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "unidades_admin_all" ON unidades
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE unidades;
