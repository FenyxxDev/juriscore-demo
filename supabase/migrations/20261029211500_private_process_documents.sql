BEGIN;

CREATE TABLE IF NOT EXISTS public.process_documents (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  process_id text NOT NULL,
  object_path text NOT NULL,
  file_name text NOT NULL CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 255),
  document_type text NOT NULL CHECK (char_length(btrim(document_type)) BETWEEN 1 AND 40),
  mime_type text NOT NULL CHECK (char_length(btrim(mime_type)) BETWEEN 1 AND 150),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_documents_pk PRIMARY KEY (owner_id, id),
  CONSTRAINT process_documents_owner_path_uq UNIQUE (owner_id, object_path),
  CONSTRAINT process_documents_owner_process_fk
    FOREIGN KEY (owner_id, process_id)
    REFERENCES public.processes (owner_id, id)
    ON DELETE CASCADE,
  CONSTRAINT process_documents_path_matches_owner_process_ck CHECK (
    split_part(object_path, '/', 1) = owner_id::text
    AND split_part(object_path, '/', 2) = process_id
    AND char_length(object_path) > char_length(owner_id::text) + char_length(process_id) + 2
  )
);

ALTER TABLE public.process_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.process_documents FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.process_documents TO authenticated;
REVOKE UPDATE, DELETE ON TABLE public.process_documents FROM authenticated;

DROP POLICY IF EXISTS process_documents_select_own ON public.process_documents;
CREATE POLICY process_documents_select_own ON public.process_documents
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS process_documents_insert_own ON public.process_documents;
CREATE POLICY process_documents_insert_own ON public.process_documents
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS process_documents_owner_process_created_idx
  ON public.process_documents (owner_id, process_id, created_at DESC);

COMMENT ON TABLE public.process_documents IS
  'Metadados de documentos privados vinculados a processo da mesma conta; não permite UPDATE/DELETE pela API autenticada.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'juriscore-documents',
  'juriscore-documents',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS juriscore_documents_insert_own_process ON storage.objects;
CREATE POLICY juriscore_documents_insert_own_process ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'juriscore-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.processes AS p
      WHERE p.owner_id = (SELECT auth.uid())
        AND p.id = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS juriscore_documents_select_own ON storage.objects;
CREATE POLICY juriscore_documents_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'juriscore-documents'
    AND owner_id = (SELECT auth.uid())::text
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

GRANT DELETE ON TABLE storage.objects TO authenticated;
DROP POLICY IF EXISTS juriscore_documents_delete_unregistered_own ON storage.objects;
CREATE POLICY juriscore_documents_delete_unregistered_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'juriscore-documents'
    AND owner_id = (SELECT auth.uid())::text
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.process_documents AS d
      WHERE d.owner_id = (SELECT auth.uid())
        AND d.object_path = storage.objects.name
    )
  );

CREATE OR REPLACE FUNCTION public.record_process_document_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_jwt jsonb := auth.jwt();
  v_author text := COALESCE(v_jwt -> 'user_metadata' ->> 'nome', v_jwt ->> 'email', 'Utilizador');
BEGIN
  INSERT INTO public.process_movements (
    owner_id, process_id, movement_type, description, author, actor_id, source
  ) VALUES (
    NEW.owner_id,
    NEW.process_id,
    'Documento anexado',
    'Documento "' || NEW.file_name || '" anexado ao processo.',
    v_author,
    auth.uid(),
    'manual'
  );
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_process_document_movement() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS process_documents_record_movement ON public.process_documents;
CREATE TRIGGER process_documents_record_movement
  AFTER INSERT ON public.process_documents
  FOR EACH ROW EXECUTE FUNCTION public.record_process_document_movement();

COMMIT;
