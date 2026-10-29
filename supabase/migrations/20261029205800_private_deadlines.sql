BEGIN;

CREATE TABLE IF NOT EXISTS public.process_deadlines (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  process_id text NOT NULL,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 300),
  due_date date NOT NULL,
  responsible text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'média' CHECK (priority IN ('alta', 'média', 'baixa')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_deadlines_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT process_deadlines_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE CASCADE
);

ALTER TABLE public.process_deadlines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.process_deadlines FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.process_deadlines TO authenticated;

DROP POLICY IF EXISTS process_deadlines_select_own ON public.process_deadlines;
CREATE POLICY process_deadlines_select_own ON public.process_deadlines
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_deadlines_insert_own ON public.process_deadlines;
CREATE POLICY process_deadlines_insert_own ON public.process_deadlines
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_deadlines_update_own ON public.process_deadlines;
CREATE POLICY process_deadlines_update_own ON public.process_deadlines
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_deadlines_delete_own ON public.process_deadlines;
REVOKE DELETE ON TABLE public.process_deadlines FROM authenticated;

CREATE INDEX IF NOT EXISTS process_deadlines_owner_process_date_idx
  ON public.process_deadlines (owner_id, process_id, due_date);

CREATE OR REPLACE FUNCTION public.set_process_deadline_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_process_deadline_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS process_deadlines_set_updated_at ON public.process_deadlines;
CREATE TRIGGER process_deadlines_set_updated_at
  BEFORE UPDATE ON public.process_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.set_process_deadline_updated_at();

COMMENT ON TABLE public.process_deadlines IS
  'Prazos vinculados a processos e isolados por owner_id; FK composta impede referências cruzadas entre contas.';

COMMIT;
