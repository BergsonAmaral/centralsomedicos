-- Superadmin: um admin "protegido" que não pode ser excluído por outro
-- admin comum. Continua sendo role='admin' (todas as permissões de admin
-- que já existem no sistema continuam valendo, sem precisar mexer em
-- nenhuma policy existente) — só ganha essa flag extra de proteção.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_superadmin = true
  );
$$;

-- Marca Jean e Ariana como superadmin
UPDATE profiles SET is_superadmin = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email IN ('jean@centralsomedicos.com.br', 'ariana@centralsomedicos.com.br')
);
