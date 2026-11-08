BEGIN;

CREATE TABLE IF NOT EXISTS public.datajud_request_counters (
  scope_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);

ALTER TABLE public.datajud_request_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.datajud_request_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.datajud_request_counters TO service_role;

CREATE OR REPLACE FUNCTION public.consume_datajud_request(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_window timestamptz := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp());
  v_global_count integer;
  v_user_count integer;
  v_user_scope text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  v_user_scope := 'user:' || p_user_id::text;

  DELETE FROM public.datajud_request_counters
  WHERE window_start < v_window - interval '2 minutes';

  INSERT INTO public.datajud_request_counters (scope_key, window_start, request_count)
  VALUES ('global', v_window, 1)
  ON CONFLICT (scope_key) DO UPDATE
    SET window_start = EXCLUDED.window_start,
        request_count = CASE
          WHEN public.datajud_request_counters.window_start = EXCLUDED.window_start
            THEN public.datajud_request_counters.request_count + 1
          ELSE 1
        END
  RETURNING request_count INTO v_global_count;

  INSERT INTO public.datajud_request_counters (scope_key, window_start, request_count)
  VALUES (v_user_scope, v_window, 1)
  ON CONFLICT (scope_key) DO UPDATE
    SET window_start = EXCLUDED.window_start,
        request_count = CASE
          WHEN public.datajud_request_counters.window_start = EXCLUDED.window_start
            THEN public.datajud_request_counters.request_count + 1
          ELSE 1
        END
  RETURNING request_count INTO v_user_count;

  RETURN v_global_count <= 90 AND v_user_count <= 5;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_datajud_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_datajud_request(uuid) TO service_role;

COMMENT ON TABLE public.datajud_request_counters IS
  'Contadores transitórios para limitar chamadas DataJud globalmente e por utilizador; acesso apenas pelo serviço.';
COMMENT ON FUNCTION public.consume_datajud_request(uuid) IS
  'Consome orçamento de chamada em janela UTC de um minuto: máximo 90 global e 5 por utilizador.';

COMMIT;
