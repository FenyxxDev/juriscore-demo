BEGIN;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX organization_members_organization_id_idx
  ON public.organization_members (organization_id, joined_at);

CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_email text NOT NULL CHECK (invited_email = lower(btrim(invited_email)) AND char_length(invited_email) BETWEEN 3 AND 254),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  declined_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (num_nonnulls(accepted_at, declined_at, revoked_at) <= 1)
);
CREATE INDEX organization_invites_invited_email_idx
  ON public.organization_invites (invited_email, created_at DESC);
CREATE INDEX organization_invites_organization_id_idx
  ON public.organization_invites (organization_id, created_at DESC);
CREATE UNIQUE INDEX organization_invites_one_open_per_email_idx
  ON public.organization_invites (organization_id, invited_email)
  WHERE accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organizations, public.organization_members, public.organization_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organizations, public.organization_members, public.organization_invites TO authenticated;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_organization_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    WHERE member.organization_id = p_organization_id
      AND member.user_id = (SELECT auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_organization_owner(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    WHERE member.organization_id = p_organization_id
      AND member.user_id = (SELECT auth.uid())
      AND member.role = 'owner'
  );
$function$;

REVOKE ALL ON FUNCTION private.is_organization_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_organization_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_organization_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_organization_owner(uuid) TO authenticated;

CREATE POLICY organizations_select_members_or_invitees
  ON public.organizations
  FOR SELECT TO authenticated
  USING (
    private.is_organization_member(id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_invites AS invitation
      WHERE invitation.organization_id = organizations.id
        AND invitation.invited_email = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
        AND invitation.accepted_at IS NULL
        AND invitation.declined_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expires_at > now()
    )
  );

CREATE POLICY organization_members_select_same_organization
  ON public.organization_members
  FOR SELECT TO authenticated
  USING (private.is_organization_member(organization_id));

CREATE POLICY organization_invites_select_invitee_or_owner
  ON public.organization_invites
  FOR SELECT TO authenticated
  USING (
    invited_email = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
    OR private.is_organization_owner(organization_id)
  );

CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := btrim(COALESCE(p_name, ''));
  v_organization_id uuid;
  v_email_confirmed_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Inicie sessão para criar uma organização.';
  END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'O nome da organização deve ter entre 2 e 120 caracteres.';
  END IF;
  SELECT user_row.email_confirmed_at
    INTO v_email_confirmed_at
    FROM auth.users AS user_row
    WHERE user_row.id = v_user_id;
  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirme o e-mail da conta antes de criar uma organização.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members AS member
    WHERE member.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Esta conta já está associada a uma organização.';
  END IF;

  INSERT INTO public.organizations (name, created_by)
  VALUES (v_name, v_user_id)
  RETURNING id INTO v_organization_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_organization_id, v_user_id, 'owner');
  RETURN v_organization_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_organization_invite(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_organization_id uuid;
  v_invite_id uuid;
  v_own_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Inicie sessão para convidar um membro.';
  END IF;
  IF char_length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Informe um endereço de e-mail válido.';
  END IF;
  SELECT member.organization_id
    INTO v_organization_id
    FROM public.organization_members AS member
    WHERE member.user_id = v_user_id AND member.role = 'owner';
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Somente a pessoa responsável pela organização pode criar convites.';
  END IF;
  SELECT lower(user_row.email)
    INTO v_own_email
    FROM auth.users AS user_row
    WHERE user_row.id = v_user_id;
  IF v_email = COALESCE(v_own_email, '') THEN
    RAISE EXCEPTION 'Não é possível convidar o próprio e-mail.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM auth.users AS target_user
    JOIN public.organization_members AS member ON member.user_id = target_user.id
    WHERE lower(target_user.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Esta conta já está associada a uma organização do JurisCore.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.organization_invites AS invitation
    WHERE invitation.organization_id = v_organization_id
      AND invitation.invited_email = v_email
      AND invitation.accepted_at IS NULL
      AND invitation.declined_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Já existe um convite válido para este e-mail.';
  END IF;

  UPDATE public.organization_invites AS invitation
    SET revoked_at = now()
    WHERE invitation.organization_id = v_organization_id
      AND invitation.invited_email = v_email
      AND invitation.accepted_at IS NULL
      AND invitation.declined_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at <= now();

  BEGIN
    INSERT INTO public.organization_invites (
      organization_id, invited_email, invited_by, expires_at
    )
    VALUES (v_organization_id, v_email, v_user_id, now() + interval '7 days')
    RETURNING id INTO v_invite_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um convite válido para este e-mail.';
  END;
  RETURN v_invite_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_email_confirmed_at timestamptz;
  v_organization_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Inicie sessão para aceitar o convite.';
  END IF;
  SELECT lower(user_row.email), user_row.email_confirmed_at
    INTO v_email, v_email_confirmed_at
    FROM auth.users AS user_row
    WHERE user_row.id = v_user_id;
  IF v_email IS NULL OR v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirme o e-mail da conta antes de aceitar o convite.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members AS member
    WHERE member.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Esta conta já está associada a uma organização. Um login só pode pertencer a uma organização de cada vez.';
  END IF;

  SELECT invitation.organization_id
    INTO v_organization_id
    FROM public.organization_invites AS invitation
    WHERE invitation.id = p_invite_id
      AND invitation.invited_email = v_email
      AND invitation.accepted_at IS NULL
      AND invitation.declined_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > now()
    FOR UPDATE;
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'O convite não existe, expirou ou foi cancelado para este e-mail.';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_organization_id, v_user_id, 'member');
  UPDATE public.organization_invites
    SET accepted_at = now(), accepted_by = v_user_id
    WHERE id = p_invite_id;
  RETURN v_organization_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_organization_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_email_confirmed_at timestamptz;
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Inicie sessão para recusar o convite.';
  END IF;
  SELECT lower(user_row.email), user_row.email_confirmed_at
    INTO v_email, v_email_confirmed_at
    FROM auth.users AS user_row
    WHERE user_row.id = v_user_id;
  IF v_email IS NULL OR v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirme o e-mail da conta antes de responder ao convite.';
  END IF;
  UPDATE public.organization_invites AS invitation
    SET declined_at = now()
    WHERE invitation.id = p_invite_id
      AND invitation.invited_email = v_email
      AND invitation.accepted_at IS NULL
      AND invitation.declined_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'O convite não existe, expirou ou já foi respondido.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_organization_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Inicie sessão para cancelar o convite.';
  END IF;
  UPDATE public.organization_invites AS invitation
    SET revoked_at = now()
    WHERE invitation.id = p_invite_id
      AND invitation.accepted_at IS NULL
      AND invitation.declined_at IS NULL
      AND invitation.revoked_at IS NULL
      AND private.is_organization_owner(invitation.organization_id);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'O convite não existe, já foi respondido ou não pertence à sua organização.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_organization_lawyers()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  user_id uuid,
  nome text,
  email text,
  oab text,
  areas text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    organization.id,
    organization.name,
    member.user_id,
    COALESCE(
      NULLIF(btrim(user_row.raw_user_meta_data ->> 'nome'), ''),
      NULLIF(btrim(user_row.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(user_row.raw_user_meta_data ->> 'name'), ''),
      split_part(user_row.email, '@', 1)
    ) AS nome,
    user_row.email,
    COALESCE(user_row.raw_user_meta_data ->> 'oab', '') AS oab,
    CASE
      WHEN jsonb_typeof(user_row.raw_user_meta_data -> 'areas') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(user_row.raw_user_meta_data -> 'areas'))
      ELSE ARRAY[]::text[]
    END AS areas
  FROM public.organization_members AS caller_member
  JOIN public.organization_members AS member
    ON member.organization_id = caller_member.organization_id
  JOIN public.organizations AS organization
    ON organization.id = member.organization_id
  JOIN auth.users AS user_row
    ON user_row.id = member.user_id
  WHERE caller_member.user_id = (SELECT auth.uid())
    AND COALESCE(NULLIF(user_row.raw_app_meta_data ->> 'perfil', ''), 'Advogado') = 'Advogado'
    AND COALESCE(user_row.raw_app_meta_data ->> 'perfil_status', '') <> 'rejeitado'
    AND (user_row.banned_until IS NULL OR user_row.banned_until <= now())
  ORDER BY lower(organization.name), lower(
    COALESCE(
      NULLIF(btrim(user_row.raw_user_meta_data ->> 'nome'), ''),
      NULLIF(btrim(user_row.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(user_row.raw_user_meta_data ->> 'name'), ''),
      split_part(user_row.email, '@', 1)
    )
  )
  LIMIT 500;
$function$;

REVOKE ALL ON FUNCTION public.create_organization(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_organization_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_organization_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_organization_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_organization_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_organization_lawyers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_organization_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_organization_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_organization_lawyers() TO authenticated;

COMMENT ON TABLE public.organizations IS
  'Organizações profissionais com associação explícita; não concede acesso aos dados jurídicos privados das contas.';
COMMENT ON TABLE public.organization_members IS
  'Membros que aceitaram explicitamente o vínculo com uma organização; cada conta pertence a no máximo uma organização.';
COMMENT ON TABLE public.organization_invites IS
  'Convites por e-mail com validade de sete dias; associação só ocorre após aceitação com e-mail confirmado.';

COMMIT;
