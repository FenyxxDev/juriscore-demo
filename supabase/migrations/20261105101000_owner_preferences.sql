BEGIN;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences) = 'object'),
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(notifications) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.user_preferences TO authenticated;
GRANT UPDATE (preferences, notifications, updated_at) ON TABLE public.user_preferences TO authenticated;
REVOKE DELETE ON TABLE public.user_preferences FROM authenticated;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.patch_user_preferences(
  p_preferences jsonb DEFAULT '{}'::jsonb,
  p_notifications jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_preferences jsonb := COALESCE(p_preferences, '{}'::jsonb);
  v_notifications jsonb := COALESCE(p_notifications, '{}'::jsonb);
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF jsonb_typeof(v_preferences) <> 'object' OR jsonb_typeof(v_notifications) <> 'object' THEN
    RAISE EXCEPTION 'Preferences must be JSON objects';
  END IF;

  INSERT INTO public.user_preferences AS saved (owner_id, preferences, notifications, updated_at)
  VALUES (v_owner, v_preferences, v_notifications, now())
  ON CONFLICT (owner_id) DO UPDATE SET
    preferences = saved.preferences || EXCLUDED.preferences,
    notifications = saved.notifications || EXCLUDED.notifications,
    updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.patch_user_preferences(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_user_preferences(jsonb, jsonb) TO authenticated;

COMMIT;
