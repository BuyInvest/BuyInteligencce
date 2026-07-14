
-- daily_briefings: authenticated only
DROP POLICY IF EXISTS daily_briefings_public_read ON public.daily_briefings;
CREATE POLICY daily_briefings_authenticated_read ON public.daily_briefings
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.daily_briefings FROM anon;

-- news_articles: authenticated only
DROP POLICY IF EXISTS news_articles_public_read ON public.news_articles;
CREATE POLICY news_articles_authenticated_read ON public.news_articles
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.news_articles FROM anon;

-- news_sources: admin only (internal infra)
DROP POLICY IF EXISTS news_sources_public_read ON public.news_sources;
CREATE POLICY news_sources_admin_read ON public.news_sources
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE SELECT ON public.news_sources FROM anon;

-- alerts: admin only (limit Realtime broadcast scope)
DROP POLICY IF EXISTS alerts_authenticated_read ON public.alerts;
CREATE POLICY alerts_admin_read ON public.alerts
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
