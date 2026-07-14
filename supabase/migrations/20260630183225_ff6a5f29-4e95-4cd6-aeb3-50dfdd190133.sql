
REVOKE EXECUTE ON FUNCTION public.match_library_chunks(vector, integer, real) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_library_chunks(vector, integer, real) TO service_role;

REVOKE EXECUTE ON FUNCTION public.library_documents_enqueue_index() FROM PUBLIC, anon, authenticated;
