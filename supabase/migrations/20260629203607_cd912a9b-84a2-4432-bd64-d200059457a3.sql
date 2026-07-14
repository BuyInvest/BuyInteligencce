
CREATE TABLE public.library_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.library_documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  title text NOT NULL,
  summary text,
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  category_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_note text,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

GRANT SELECT, INSERT ON public.library_document_versions TO authenticated;
GRANT ALL ON public.library_document_versions TO service_role;

ALTER TABLE public.library_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read versions"
  ON public.library_document_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins insert versions"
  ON public.library_document_versions FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_lib_doc_versions_doc ON public.library_document_versions(document_id, version_number DESC);

CREATE OR REPLACE FUNCTION public.library_documents_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text;
BEGIN
  BEGIN
    v_note := current_setting('app.version_note', true);
  EXCEPTION WHEN OTHERS THEN v_note := NULL; END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.library_document_versions
      (document_id, version_number, title, summary, content, tags, status, category_id, metadata, change_note, author_id)
    VALUES
      (NEW.id, COALESCE(NEW.version, 1), NEW.title, NEW.summary, NEW.content, NEW.tags, NEW.status, NEW.category_id, NEW.metadata, COALESCE(NULLIF(v_note,''), 'Criação'), NEW.author_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.title, OLD.summary, OLD.content, OLD.tags, OLD.status, OLD.category_id) IS DISTINCT FROM
       (NEW.title, NEW.summary, NEW.content, NEW.tags, NEW.status, NEW.category_id) THEN
      INSERT INTO public.library_document_versions
        (document_id, version_number, title, summary, content, tags, status, category_id, metadata, change_note, author_id)
      VALUES
        (OLD.id, COALESCE(OLD.version, 1), OLD.title, OLD.summary, OLD.content, OLD.tags, OLD.status, OLD.category_id, OLD.metadata, NULLIF(v_note,''), OLD.author_id)
      ON CONFLICT (document_id, version_number) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_documents_snapshot ON public.library_documents;
CREATE TRIGGER trg_library_documents_snapshot
AFTER INSERT OR UPDATE ON public.library_documents
FOR EACH ROW EXECUTE FUNCTION public.library_documents_snapshot();

INSERT INTO public.library_document_versions
  (document_id, version_number, title, summary, content, tags, status, category_id, metadata, change_note, author_id, created_at)
SELECT d.id, COALESCE(d.version, 1), d.title, d.summary, d.content, d.tags, d.status, d.category_id, d.metadata, 'Versão inicial (backfill)', d.author_id, d.updated_at
FROM public.library_documents d
WHERE NOT EXISTS (
  SELECT 1 FROM public.library_document_versions v WHERE v.document_id = d.id
);

CREATE OR REPLACE FUNCTION public.restore_library_document_version(p_version_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.library_document_versions%ROWTYPE;
  v_new_version integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v FROM public.library_document_versions WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'version not found'; END IF;

  SELECT COALESCE(MAX(version), 1) + 1 INTO v_new_version FROM public.library_documents WHERE id = v.document_id;

  PERFORM set_config('app.version_note', 'Restaurada da v' || v.version_number || COALESCE(' — ' || p_note,''), true);

  UPDATE public.library_documents
     SET title = v.title,
         summary = v.summary,
         content = v.content,
         tags = v.tags,
         status = v.status,
         category_id = v.category_id,
         metadata = v.metadata,
         version = v_new_version,
         author_id = COALESCE(auth.uid(), author_id)
   WHERE id = v.document_id;

  RETURN v.document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_library_document_version(uuid, text) TO authenticated;
