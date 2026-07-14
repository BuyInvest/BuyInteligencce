
-- Restrict alerts and monitoring_keywords to authenticated users
DROP POLICY IF EXISTS alerts_public_read ON public.alerts;
CREATE POLICY alerts_authenticated_read ON public.alerts
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.alerts FROM anon;

DROP POLICY IF EXISTS monitoring_keywords_public_read ON public.monitoring_keywords;
CREATE POLICY monitoring_keywords_authenticated_read ON public.monitoring_keywords
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.monitoring_keywords FROM anon;

-- Revoke EXECUTE on SECURITY DEFINER helper functions from anon (and PUBLIC); keep for authenticated (needed by RLS policies) and service_role.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_module_access(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_modules(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_modules(uuid) TO authenticated, service_role;
