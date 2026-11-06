BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Perfis contêm dados pessoais; nem Administradores leem perfis de outras contas.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own_only ON public.profiles;

CREATE POLICY profiles_select_own_only
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- O bootstrap cria apenas a linha do próprio utilizador. Roles continuam em app_metadata.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.profiles TO authenticated;

COMMIT;
