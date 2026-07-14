
REVOKE ALL ON FUNCTION public.library_documents_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_library_document_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_library_document_version(uuid, text) TO authenticated;
