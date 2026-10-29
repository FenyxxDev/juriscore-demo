BEGIN;

-- Dados jurídicos são isolados por conta. Nenhum perfil pode consultar
-- registros pertencentes a outro usuário, inclusive Administradores.
CREATE TABLE IF NOT EXISTS public.clients (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  name text NOT NULL CHECK (char_length(btrim(name)) > 0),
  type text NOT NULL CHECK (type IN ('Pessoa Física', 'Pessoa Jurídica')),
  document text NOT NULL DEFAULT '-',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.clients FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;

DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
CREATE POLICY "clients_select_own"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "clients_insert_own" ON public.clients;
CREATE POLICY "clients_insert_own"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "clients_update_own" ON public.clients;
CREATE POLICY "clients_update_own"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "clients_delete_own" ON public.clients;
CREATE POLICY "clients_delete_own"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS clients_owner_updated_at_idx
  ON public.clients (owner_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_clients_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_clients_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

-- Os registros de clientes existentes eram fictícios e não devem ser migrados.
-- Remove somente essa chave legada para que os dados de demonstração não reapareçam.
UPDATE public.profiles
SET data = data - 'clients'
WHERE jsonb_typeof(data) = 'object'
  AND data ? 'clients';

-- Administradores também veem apenas o próprio perfil: roles não atravessam
-- limites de conta e a aprovação continua ocorrendo pela Edge Function confiável.
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_only" ON public.profiles;
CREATE POLICY "profiles_select_own_only"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

COMMENT ON TABLE public.clients IS
  'Clientes jurídicos isolados por conta autenticada; RLS restringe todas as operações ao owner_id.';

COMMIT;
