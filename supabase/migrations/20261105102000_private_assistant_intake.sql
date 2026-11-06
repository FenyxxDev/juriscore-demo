BEGIN;

CREATE TABLE IF NOT EXISTS public.assistant_intake_requests (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  process_id text,
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 5000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta')),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'encaminhado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_intake_requests_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT assistant_intake_requests_owner_client_fk
    FOREIGN KEY (owner_id, client_id)
    REFERENCES public.clients (owner_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT assistant_intake_requests_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE RESTRICT
);

ALTER TABLE public.assistant_intake_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assistant_intake_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.assistant_intake_requests TO authenticated;
GRANT UPDATE (status, updated_at) ON TABLE public.assistant_intake_requests TO authenticated;
REVOKE DELETE ON TABLE public.assistant_intake_requests FROM authenticated;

DROP POLICY IF EXISTS assistant_intake_select_own_assistant ON public.assistant_intake_requests;
CREATE POLICY assistant_intake_select_own_assistant ON public.assistant_intake_requests
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'perfil') = 'Assistente'
  );

DROP POLICY IF EXISTS assistant_intake_insert_own_assistant ON public.assistant_intake_requests;
CREATE POLICY assistant_intake_insert_own_assistant ON public.assistant_intake_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'perfil') = 'Assistente'
  );

DROP POLICY IF EXISTS assistant_intake_update_own_assistant ON public.assistant_intake_requests;
CREATE POLICY assistant_intake_update_own_assistant ON public.assistant_intake_requests
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'perfil') = 'Assistente'
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'perfil') = 'Assistente'
  );

CREATE INDEX IF NOT EXISTS assistant_intake_requests_owner_created_idx
  ON public.assistant_intake_requests (owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_assistant_intake_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_assistant_intake_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS assistant_intake_requests_set_updated_at ON public.assistant_intake_requests;
CREATE TRIGGER assistant_intake_requests_set_updated_at
  BEFORE UPDATE ON public.assistant_intake_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_assistant_intake_updated_at();

COMMENT ON TABLE public.assistant_intake_requests IS
  'Pedidos de triagem privados da conta autenticada; acessíveis apenas à role Assistente daquela mesma conta.';

COMMIT;
