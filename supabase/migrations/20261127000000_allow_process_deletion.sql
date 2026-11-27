BEGIN;

-- Permite deleção do próprio processo pelo dono (authenticated)
GRANT DELETE ON TABLE public.processes TO authenticated;
DROP POLICY IF EXISTS processes_delete_own ON public.processes;
CREATE POLICY processes_delete_own ON public.processes
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Permite deleção em cascata das partes e movimentações
GRANT DELETE ON TABLE public.process_parties TO authenticated;
DROP POLICY IF EXISTS process_parties_delete_own ON public.process_parties;
CREATE POLICY process_parties_delete_own ON public.process_parties
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

GRANT DELETE ON TABLE public.process_movements TO authenticated;
DROP POLICY IF EXISTS process_movements_delete_own ON public.process_movements;
CREATE POLICY process_movements_delete_own ON public.process_movements
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

COMMIT;
