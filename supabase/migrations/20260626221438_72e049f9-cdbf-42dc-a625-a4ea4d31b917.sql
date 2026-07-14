REVOKE ALL ON FUNCTION public.audit_user_roles_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_user_roles_change() FROM authenticated, anon;