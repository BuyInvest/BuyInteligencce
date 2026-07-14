
-- Create private schema for internal helpers (not exposed via PostgREST API)
CREATE SCHEMA IF NOT EXISTS private;

-- Recreate helper functions in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    private.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_module_permissions
      WHERE user_id = _user_id AND module_key = _module_key
    )
$$;

CREATE OR REPLACE FUNCTION private.get_user_modules(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT module_key FROM public.user_module_permissions
  WHERE user_id = _user_id
$$;

-- Lock down execute on the private schema
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_module_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_modules(uuid) TO authenticated, service_role;

-- Recreate policies to reference private.has_role instead of public.has_role
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can read own permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.user_module_permissions;

CREATE POLICY "Users can read own permissions" ON public.user_module_permissions
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert permissions" ON public.user_module_permissions
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete permissions" ON public.user_module_permissions
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop the now-unused public functions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_module_access(uuid, text);
DROP FUNCTION IF EXISTS public.get_user_modules(uuid);
