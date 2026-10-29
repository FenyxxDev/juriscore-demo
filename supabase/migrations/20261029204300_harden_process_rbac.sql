BEGIN;

DROP POLICY IF EXISTS processes_update_own ON public.processes;
CREATE POLICY processes_update_own ON public.processes
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'perfil'), 'Advogado')
      IN ('Administrador', 'Advogado')
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'perfil'), 'Advogado')
      IN ('Administrador', 'Advogado')
  );

DROP POLICY IF EXISTS processes_delete_own ON public.processes;
REVOKE DELETE ON TABLE public.processes FROM authenticated;

DROP POLICY IF EXISTS process_parties_update_own ON public.process_parties;
DROP POLICY IF EXISTS process_parties_delete_own ON public.process_parties;
REVOKE UPDATE, DELETE ON TABLE public.process_parties FROM authenticated;

DROP POLICY IF EXISTS process_movements_update_own ON public.process_movements;
DROP POLICY IF EXISTS process_movements_delete_own ON public.process_movements;
REVOKE UPDATE, DELETE ON TABLE public.process_movements FROM authenticated;

COMMENT ON TABLE public.processes IS
  'Owner-scoped; only Administrador and Advogado roles can update; hard deletion is disabled through the authenticated API.';
COMMENT ON TABLE public.process_parties IS
  'Owner-scoped parties; changes are made atomically during process creation, with later update/delete disabled.';
COMMENT ON TABLE public.process_movements IS
  'Owner-scoped append-only movement history; authenticated users can read/insert but cannot update/delete.';

COMMIT;
