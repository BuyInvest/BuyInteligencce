
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.library_document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.library_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER,
  embedding vector(1536),
  embedding_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

GRANT SELECT ON public.library_document_chunks TO authenticated;
GRANT ALL ON public.library_document_chunks TO service_role;

ALTER TABLE public.library_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_chunks_read_authenticated"
ON public.library_document_chunks
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS library_chunks_doc_idx
  ON public.library_document_chunks(document_id);

CREATE INDEX IF NOT EXISTS library_chunks_embedding_idx
  ON public.library_document_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.library_indexing_queue (
  document_id UUID NOT NULL PRIMARY KEY REFERENCES public.library_documents(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.library_indexing_queue TO service_role;
ALTER TABLE public.library_indexing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_queue_admin_read"
ON public.library_indexing_queue
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.library_documents_enqueue_index()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR
     (TG_OP = 'UPDATE' AND
      (OLD.title, OLD.summary, OLD.content, OLD.tags) IS DISTINCT FROM
      (NEW.title, NEW.summary, NEW.content, NEW.tags)) THEN
    INSERT INTO public.library_indexing_queue (document_id, status, queued_at, updated_at, attempts, last_error)
    VALUES (NEW.id, 'pending', now(), now(), 0, NULL)
    ON CONFLICT (document_id) DO UPDATE
      SET status = 'pending',
          queued_at = now(),
          updated_at = now(),
          attempts = 0,
          last_error = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_documents_enqueue_index ON public.library_documents;
CREATE TRIGGER trg_library_documents_enqueue_index
AFTER INSERT OR UPDATE ON public.library_documents
FOR EACH ROW EXECUTE FUNCTION public.library_documents_enqueue_index();

INSERT INTO public.library_indexing_queue (document_id, status)
SELECT id, 'pending' FROM public.library_documents
ON CONFLICT (document_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.match_library_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 8,
  similarity_threshold real DEFAULT 0.55
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  chunk_index INTEGER,
  content TEXT,
  similarity REAL,
  doc_title TEXT,
  doc_slug TEXT,
  doc_summary TEXT,
  doc_tags TEXT[],
  category_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::real AS similarity,
    d.title,
    d.slug,
    d.summary,
    d.tags,
    d.category_id
  FROM public.library_document_chunks c
  JOIN public.library_documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND d.status = 'published'
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_library_chunks(vector, integer, real) TO authenticated, service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('buy-ia-index-library');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'buy-ia-index-library',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gfwpqvnimkvmwqabbeih.supabase.co/functions/v1/index-library',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmd3Bxdm5pbWt2bXdxYWJiZWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzI2NTgsImV4cCI6MjA5MDA0ODY1OH0.GO1n6Cf1549BiyzwVvmlH8Wt3eJ1Rbg5Q7y-vSDWoZQ"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
