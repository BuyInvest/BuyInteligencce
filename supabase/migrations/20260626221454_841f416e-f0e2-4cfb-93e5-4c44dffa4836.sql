
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_mcp_bearer(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_mcp_bearer(uuid, text, text) FROM anon, authenticated, PUBLIC;
