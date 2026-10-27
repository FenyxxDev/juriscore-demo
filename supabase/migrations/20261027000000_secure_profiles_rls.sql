BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove as duas políticas permissivas confirmadas no painel Supabase.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- Reaplicação idempotente deste migration em ambientes já atualizados.
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_standard_role" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (auth.jwt() -> 'app_metadata' ->> 'perfil') = 'Administrador'
  );

CREATE POLICY "profiles_insert_own_standard_role"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND COALESCE(data ->> 'perfil', 'Advogado') = 'Advogado'
  );

-- Não são criadas policies UPDATE/DELETE: mudanças de role são feitas
-- exclusivamente por serviço confiável, nunca pelo cliente público.
COMMIT;
