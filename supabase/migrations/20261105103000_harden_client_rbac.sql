BEGIN;

-- A interface atual permite consultar e criar clientes, mas não editá-los nem excluí-los.
-- Remover privilégios/policies não usados reduz a superfície de mutação para todas as roles.
REVOKE ALL ON TABLE public.clients FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.clients TO authenticated;

DROP POLICY IF EXISTS clients_update_own ON public.clients;
DROP POLICY IF EXISTS clients_delete_own ON public.clients;

COMMENT ON TABLE public.clients IS
  'Clientes privados por conta. A API autenticada permite SELECT e INSERT owner-scoped; UPDATE/DELETE físicos permanecem desativados até existir fluxo autorizado.';

COMMIT;
