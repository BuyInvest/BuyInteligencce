
-- 1. news_sources
CREATE TABLE public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'rss',
  country text NOT NULL DEFAULT 'BR',
  language text NOT NULL DEFAULT 'pt',
  sector_focus text,
  is_active boolean NOT NULL DEFAULT true,
  priority_level integer NOT NULL DEFAULT 3,
  refresh_interval_minutes integer NOT NULL DEFAULT 10,
  last_fetch_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_sources_public_read" ON public.news_sources FOR SELECT TO public USING (true);

CREATE TRIGGER update_news_sources_updated_at
  BEFORE UPDATE ON public.news_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. news_articles
CREATE TABLE public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  subtitle text,
  slug text,
  original_url text NOT NULL UNIQUE,
  original_category text,
  author_name text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  image_url text,
  raw_content text,
  cleaned_content text,
  translated_content_pt text,
  executive_summary_pt text,
  relevance_score integer DEFAULT 0,
  adherence_score integer DEFAULT 0,
  importance_level text DEFAULT 'normal',
  sentiment_label text,
  market_impact_label text,
  geographic_scope text DEFAULT 'nacional',
  is_duplicate boolean NOT NULL DEFAULT false,
  duplicate_group_id uuid,
  is_featured boolean NOT NULL DEFAULT false,
  is_classified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_articles_public_read" ON public.news_articles FOR SELECT TO public USING (true);

CREATE TRIGGER update_news_articles_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_news_articles_published_at ON public.news_articles(published_at DESC);
CREATE INDEX idx_news_articles_relevance ON public.news_articles(relevance_score DESC);
CREATE INDEX idx_news_articles_source ON public.news_articles(source_id);
CREATE INDEX idx_news_articles_classified ON public.news_articles(is_classified);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;

-- 3. article_tags
CREATE TABLE public.article_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.news_articles(id) ON DELETE CASCADE NOT NULL,
  tag_name text NOT NULL,
  UNIQUE(article_id, tag_name)
);

ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "article_tags_public_read" ON public.article_tags FOR SELECT TO public USING (true);

-- 4. monitoring_keywords
CREATE TABLE public.monitoring_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  keyword_group text NOT NULL DEFAULT 'geral',
  is_active boolean NOT NULL DEFAULT true,
  priority_level integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monitoring_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_keywords_public_read" ON public.monitoring_keywords FOR SELECT TO public USING (true);

-- 5. alerts
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.news_articles(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL DEFAULT 'keyword_match',
  alert_reason text,
  priority text NOT NULL DEFAULT 'medium',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_public_read" ON public.alerts FOR SELECT TO public USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- 6. daily_briefings
CREATE TABLE public.daily_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date date NOT NULL UNIQUE,
  title text,
  summary text,
  top_articles_json jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_briefings_public_read" ON public.daily_briefings FOR SELECT TO public USING (true);
