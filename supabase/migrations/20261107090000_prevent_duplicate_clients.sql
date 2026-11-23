BEGIN;

-- Evita clientes repetidos por CPF/CNPJ, mesmo que o documento seja escrito
-- com máscaras diferentes. O bloqueio advisory serializa inserções concorrentes
-- sem apagar nem alterar eventuais duplicados históricos.
CREATE OR REPLACE FUNCTION public.reject_duplicate_client_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  normalized_document text;
BEGIN
  normalized_document := pg_catalog.regexp_replace(COALESCE(NEW.document, ''), '[^0-9]', '', 'g');
  IF normalized_document = '' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.owner_id::text || ':' || normalized_document, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.clients AS existing
    WHERE existing.owner_id = NEW.owner_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND pg_catalog.regexp_replace(COALESCE(existing.document, ''), '[^0-9]', '', 'g') = normalized_document
  ) THEN
    RAISE EXCEPTION 'Já existe um cliente com este CPF/CNPJ na sua conta.'
      USING ERRCODE = '23505', CONSTRAINT = 'clients_owner_normalized_document_uq';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_duplicate_client_document() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS clients_reject_duplicate_document ON public.clients;
CREATE TRIGGER clients_reject_duplicate_document
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_duplicate_client_document();

COMMENT ON FUNCTION public.reject_duplicate_client_document() IS
  'Impede novas inserções de clientes com CPF/CNPJ já registado para a mesma conta, comparando apenas dígitos.';

COMMIT;
