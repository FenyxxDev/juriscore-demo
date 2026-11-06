BEGIN;

-- Eventos jurídicos pertencem exclusivamente à conta autenticada.
CREATE TABLE IF NOT EXISTS public.process_hearings (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  process_id text NOT NULL,
  hearing_type text NOT NULL CHECK (char_length(btrim(hearing_type)) BETWEEN 1 AND 160),
  scheduled_date date NOT NULL,
  scheduled_time time without time zone NOT NULL,
  modality text NOT NULL CHECK (modality IN ('Presencial', 'Online', 'Híbrida')),
  location text NOT NULL CHECK (char_length(btrim(location)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'realizada', 'cancelada')),
  participants text NOT NULL DEFAULT '',
  responsible text NOT NULL CHECK (char_length(btrim(responsible)) BETWEEN 1 AND 160),
  observations text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_hearings_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT process_hearings_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.process_tasks (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  process_id text NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  due_date date NOT NULL,
  responsible text NOT NULL CHECK (char_length(btrim(responsible)) BETWEEN 1 AND 160),
  priority text NOT NULL DEFAULT 'média' CHECK (priority IN ('alta', 'média', 'baixa')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_tasks_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT process_tasks_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.calendar_appointments (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  process_id text,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  scheduled_date date NOT NULL,
  scheduled_time time without time zone,
  location text NOT NULL DEFAULT 'A definir',
  responsible text NOT NULL CHECK (char_length(btrim(responsible)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'concluido', 'cancelada')),
  observations text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_appointments_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT calendar_appointments_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE CASCADE
);

ALTER TABLE public.process_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_appointments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.process_hearings, public.process_tasks, public.calendar_appointments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.process_hearings, public.process_tasks, public.calendar_appointments TO authenticated;
-- A interface atual só altera status; demais campos não podem ser modificados por chamadas diretas à API.
GRANT UPDATE (status) ON TABLE public.process_hearings, public.process_tasks, public.calendar_appointments TO authenticated;

DROP POLICY IF EXISTS process_hearings_select_own ON public.process_hearings;
CREATE POLICY process_hearings_select_own ON public.process_hearings
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_hearings_insert_own ON public.process_hearings;
CREATE POLICY process_hearings_insert_own ON public.process_hearings
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_hearings_update_own ON public.process_hearings;
CREATE POLICY process_hearings_update_own ON public.process_hearings
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS process_tasks_select_own ON public.process_tasks;
CREATE POLICY process_tasks_select_own ON public.process_tasks
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_tasks_insert_authorized_role ON public.process_tasks;
CREATE POLICY process_tasks_insert_authorized_role ON public.process_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'perfil'), 'Advogado')
      IN ('Administrador', 'Advogado')
  );
DROP POLICY IF EXISTS process_tasks_update_own ON public.process_tasks;
CREATE POLICY process_tasks_update_own ON public.process_tasks
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS calendar_appointments_select_own ON public.calendar_appointments;
CREATE POLICY calendar_appointments_select_own ON public.calendar_appointments
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS calendar_appointments_insert_own ON public.calendar_appointments;
CREATE POLICY calendar_appointments_insert_own ON public.calendar_appointments
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS calendar_appointments_update_own ON public.calendar_appointments;
CREATE POLICY calendar_appointments_update_own ON public.calendar_appointments
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS process_hearings_owner_date_idx
  ON public.process_hearings (owner_id, scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS process_hearings_owner_process_idx
  ON public.process_hearings (owner_id, process_id);
CREATE INDEX IF NOT EXISTS process_tasks_owner_date_idx
  ON public.process_tasks (owner_id, due_date);
CREATE INDEX IF NOT EXISTS process_tasks_owner_process_idx
  ON public.process_tasks (owner_id, process_id);
CREATE INDEX IF NOT EXISTS calendar_appointments_owner_date_idx
  ON public.calendar_appointments (owner_id, scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS calendar_appointments_owner_process_idx
  ON public.calendar_appointments (owner_id, process_id);

CREATE OR REPLACE FUNCTION public.set_schedule_event_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_schedule_event_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS process_hearings_set_updated_at ON public.process_hearings;
CREATE TRIGGER process_hearings_set_updated_at
  BEFORE UPDATE ON public.process_hearings
  FOR EACH ROW EXECUTE FUNCTION public.set_schedule_event_updated_at();
DROP TRIGGER IF EXISTS process_tasks_set_updated_at ON public.process_tasks;
CREATE TRIGGER process_tasks_set_updated_at
  BEFORE UPDATE ON public.process_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_schedule_event_updated_at();
DROP TRIGGER IF EXISTS calendar_appointments_set_updated_at ON public.calendar_appointments;
CREATE TRIGGER calendar_appointments_set_updated_at
  BEFORE UPDATE ON public.calendar_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_schedule_event_updated_at();

-- Registra a audiência também na timeline, na mesma transação do INSERT.
CREATE OR REPLACE FUNCTION public.log_process_hearing_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.process_movements (
    owner_id, process_id, movement_type, description, author, actor_id, source
  ) VALUES (
    NEW.owner_id,
    NEW.process_id,
    'Audiência agendada',
    pg_catalog.format('%s marcada para %s às %s (%s).', NEW.hearing_type, NEW.scheduled_date, NEW.scheduled_time, NEW.modality),
    NEW.responsible,
    NEW.owner_id,
    'manual'
  );
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.log_process_hearing_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS process_hearings_log_movement ON public.process_hearings;
CREATE TRIGGER process_hearings_log_movement
  AFTER INSERT ON public.process_hearings
  FOR EACH ROW EXECUTE FUNCTION public.log_process_hearing_insert();

COMMENT ON TABLE public.process_hearings IS
  'Audiências privadas por conta; processo associado deve pertencer ao mesmo owner_id.';
COMMENT ON TABLE public.process_tasks IS
  'Tarefas privadas por conta; criação limitada a Administrador e Advogado, sem exclusão física.';
COMMENT ON TABLE public.calendar_appointments IS
  'Compromissos privados por conta, com vínculo opcional a processo do mesmo owner_id.';

COMMIT;
