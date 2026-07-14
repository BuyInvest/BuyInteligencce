DROP POLICY IF EXISTS "article_tags_public_read" ON public.article_tags;
DROP POLICY IF EXISTS "Public can read article tags" ON public.article_tags;
DROP POLICY IF EXISTS "Anyone can read article tags" ON public.article_tags;

REVOKE SELECT ON public.article_tags FROM anon;
GRANT SELECT ON public.article_tags TO authenticated;

CREATE POLICY "article_tags_authenticated_read"
ON public.article_tags
FOR SELECT
TO authenticated
USING (true);