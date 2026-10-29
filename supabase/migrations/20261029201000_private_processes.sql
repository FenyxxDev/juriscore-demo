BEGIN;

-- Cada conta é isolada individualmente: roles e administradores não atravessam owner_id.
CREATE TABLE IF NOT EXISTS public.processes (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  case_number text NOT NULL CHECK (char_length(btrim(case_number)) > 0),
  client_id text NOT NULL,
  responsible text NOT NULL CHECK (char_length(btrim(responsible)) > 0),
  area text NOT NULL CHECK (char_length(btrim(area)) > 0),
  status text NOT NULL DEFAULT 'em-andamento'
    CHECK (status IN ('em-andamento', 'aguardando', 'atrasado', 'encerrado')),
  archived boolean NOT NULL DEFAULT false,
  tribunal text NOT NULL DEFAULT '',
  comarca text NOT NULL DEFAULT '',
  vara text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  observations text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT processes_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT processes_owner_case_number_uq UNIQUE (owner_id, case_number),
  CONSTRAINT processes_owner_client_fk
    FOREIGN KEY (owner_id, client_id)
    REFERENCES public.clients (owner_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.process_parties (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  process_id text NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) > 0),
  role text NOT NULL DEFAULT '',
  document text NOT NULL DEFAULT '-',
  representative text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_parties_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT process_parties_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.process_movements (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  process_id text NOT NULL,
  movement_type text NOT NULL CHECK (char_length(btrim(movement_type)) > 0),
  description text NOT NULL CHECK (char_length(btrim(description)) > 0),
  author text NOT NULL DEFAULT '',
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'datajud')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_movements_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT process_movements_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE CASCADE
);

ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.processes, public.process_parties, public.process_movements FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.processes, public.process_parties, public.process_movements TO authenticated;

DROP POLICY IF EXISTS processes_select_own ON public.processes;
CREATE POLICY processes_select_own ON public.processes
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS processes_insert_own ON public.processes;
CREATE POLICY processes_insert_own ON public.processes
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS processes_update_own ON public.processes;
CREATE POLICY processes_update_own ON public.processes
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS processes_delete_own ON public.processes;
CREATE POLICY processes_delete_own ON public.processes
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS process_parties_select_own ON public.process_parties;
CREATE POLICY process_parties_select_own ON public.process_parties
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_parties_insert_own ON public.process_parties;
CREATE POLICY process_parties_insert_own ON public.process_parties
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_parties_update_own ON public.process_parties;
CREATE POLICY process_parties_update_own ON public.process_parties
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_parties_delete_own ON public.process_parties;
CREATE POLICY process_parties_delete_own ON public.process_parties
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS process_movements_select_own ON public.process_movements;
CREATE POLICY process_movements_select_own ON public.process_movements
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_movements_insert_own ON public.process_movements;
CREATE POLICY process_movements_insert_own ON public.process_movements
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_movements_update_own ON public.process_movements;
CREATE POLICY process_movements_update_own ON public.process_movements
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_movements_delete_own ON public.process_movements;
CREATE POLICY process_movements_delete_own ON public.process_movements
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS processes_owner_updated_at_idx
  ON public.processes (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS processes_owner_client_idx
  ON public.processes (owner_id, client_id);
CREATE INDEX IF NOT EXISTS process_parties_owner_process_idx
  ON public.process_parties (owner_id, process_id);
CREATE INDEX IF NOT EXISTS process_movements_owner_process_time_idx
  ON public.process_movements (owner_id, process_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.set_process_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_process_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS processes_set_updated_at ON public.processes;
CREATE TRIGGER processes_set_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.set_process_updated_at();

-- Criação e partes ficam numa única transação e só aceitam clientes do mesmo owner.
CREATE OR REPLACE FUNCTION public.create_process_with_parties(
  p_case_number text,
  p_client_id text,
  p_responsible text,
  p_area text,
  p_tribunal text DEFAULT '',
  p_comarca text DEFAULT '',
  p_vara text DEFAULT '',
  p_summary text DEFAULT '',
  p_observations text DEFAULT '',
  p_parties jsonb DEFAULT '[]'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_process_id text;
  v_party jsonb;
  v_name text;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada obrigatória.' USING ERRCODE = '28000';
  END IF;
  IF p_case_number IS NULL OR char_length(btrim(p_case_number)) = 0 THEN
    RAISE EXCEPTION 'Número do processo obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF p_client_id IS NULL OR char_length(btrim(p_client_id)) = 0 THEN
    RAISE EXCEPTION 'Cliente obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF p_responsible IS NULL OR char_length(btrim(p_responsible)) = 0 THEN
    RAISE EXCEPTION 'Responsável obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF p_area IS NULL OR char_length(btrim(p_area)) = 0 THEN
    RAISE EXCEPTION 'Área jurídica obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF p_parties IS NULL OR jsonb_typeof(p_parties) <> 'array' THEN
    RAISE EXCEPTION 'A lista de partes deve ser um array JSON.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.processes (
    owner_id, case_number, client_id, responsible, area, tribunal, comarca, vara, summary, observations
  ) VALUES (
    v_owner, btrim(p_case_number), btrim(p_client_id), btrim(p_responsible), btrim(p_area),
    coalesce(p_tribunal, ''), coalesce(p_comarca, ''), coalesce(p_vara, ''),
    coalesce(p_summary, ''), coalesce(p_observations, '')
  ) RETURNING id INTO v_process_id;

  FOR v_party IN SELECT value FROM jsonb_array_elements(p_parties) AS item(value) LOOP
    v_name := nullif(btrim(v_party ->> 'nome'), '');
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Cada parte deve ter um nome.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.process_parties (
      owner_id, process_id, name, role, document, representative
    ) VALUES (
      v_owner, v_process_id, v_name,
      coalesce(nullif(btrim(v_party ->> 'papel'), ''), ''),
      coalesce(nullif(btrim(v_party ->> 'doc'), ''), '-'),
      coalesce(nullif(btrim(v_party ->> 'rep'), ''), btrim(p_responsible))
    );
  END LOOP;

  RETURN v_process_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_process_with_parties(text, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_process_with_parties(text, text, text, text, text, text, text, text, text, jsonb) TO authenticated;

-- Atualização do status e registo correspondente também são atómicos.
CREATE OR REPLACE FUNCTION public.set_process_status(
  p_process_id text,
  p_status text,
  p_archived boolean,
  p_note text,
  p_author text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_rows integer;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada obrigatória.' USING ERRCODE = '28000';
  END IF;
  IF p_status NOT IN ('em-andamento', 'aguardando', 'atrasado', 'encerrado') THEN
    RAISE EXCEPTION 'Status de processo inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.processes
  SET status = p_status,
      archived = coalesce(p_archived, archived)
  WHERE owner_id = v_owner AND id = p_process_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Processo não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF nullif(btrim(coalesce(p_note, '')), '') IS NOT NULL THEN
    INSERT INTO public.process_movements (
      owner_id, process_id, movement_type, description, author, actor_id, source
    ) VALUES (
      v_owner, p_process_id, 'Sistema', btrim(p_note), coalesce(nullif(btrim(p_author), ''), 'Utilizador'), v_owner, 'manual'
    );
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_process_status(text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_process_status(text, text, boolean, text, text) TO authenticated;

COMMENT ON TABLE public.processes IS
  'Processos isolados por owner_id; RLS limita cada operação ao utilizador autenticado.';
COMMENT ON TABLE public.process_parties IS
  'Partes de processos; a FK composta impede associar uma parte a processo de outro owner.';
COMMENT ON TABLE public.process_movements IS
  'Movimentações de processos, privadas por owner_id e com registo temporal.';

COMMIT;
