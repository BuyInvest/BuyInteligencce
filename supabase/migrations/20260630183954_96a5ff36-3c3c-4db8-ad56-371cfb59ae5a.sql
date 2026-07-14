
-- 1) MEMÓRIA DE CONTEXTO POR CONVERSA
CREATE TABLE IF NOT EXISTS public.buy_ai_thread_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL UNIQUE REFERENCES public.buy_ai_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text,
  current_intent text,
  intent_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  consulted_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  consulted_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_model text,
  avg_confidence real,
  message_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.buy_ai_thread_context TO authenticated;
GRANT ALL ON public.buy_ai_thread_context TO service_role;
ALTER TABLE public.buy_ai_thread_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own thread context" ON public.buy_ai_thread_context
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER buy_ai_thread_context_updated_at BEFORE UPDATE ON public.buy_ai_thread_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS buy_ai_thread_context_user_idx ON public.buy_ai_thread_context (user_id, updated_at DESC);

-- 2) LOGS DE RESPOSTAS
CREATE TABLE IF NOT EXISTS public.buy_ai_response_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.buy_ai_threads(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text,
  question text NOT NULL,
  answer text,
  question_category text,
  intent text,
  model text,
  confidence_score real,
  response_time_ms integer,
  library_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  used_external_ai boolean NOT NULL DEFAULT false,
  external_ai_provider text,
  had_error boolean NOT NULL DEFAULT false,
  error_message text,
  tokens_input integer,
  tokens_output integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.buy_ai_response_logs TO authenticated;
GRANT ALL ON public.buy_ai_response_logs TO service_role;
ALTER TABLE public.buy_ai_response_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own response logs" ON public.buy_ai_response_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS buy_ai_response_logs_user_idx ON public.buy_ai_response_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS buy_ai_response_logs_thread_idx ON public.buy_ai_response_logs (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS buy_ai_response_logs_category_idx ON public.buy_ai_response_logs (question_category, created_at DESC);
CREATE INDEX IF NOT EXISTS buy_ai_response_logs_model_idx ON public.buy_ai_response_logs (model, created_at DESC);

-- 3) FEEDBACK
DO $$ BEGIN
  CREATE TYPE public.buy_ai_feedback_rating AS ENUM ('util','nao_util','incompleta','incorreta','precisa_revisar','virar_documento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.buy_ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_log_id uuid REFERENCES public.buy_ai_response_logs(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.buy_ai_threads(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating public.buy_ai_feedback_rating NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.buy_ai_feedback TO authenticated;
GRANT ALL ON public.buy_ai_feedback TO service_role;
ALTER TABLE public.buy_ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback select" ON public.buy_ai_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own feedback insert" ON public.buy_ai_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS buy_ai_feedback_log_idx ON public.buy_ai_feedback (response_log_id);
CREATE INDEX IF NOT EXISTS buy_ai_feedback_user_idx ON public.buy_ai_feedback (user_id, created_at DESC);

-- 4) MEMÓRIA CORPORATIVA
DO $$ BEGIN
  CREATE TYPE public.buy_ai_corp_memory_status AS ENUM ('pendente','aprovado','rejeitado','arquivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.buy_ai_corporate_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  source_response_log_id uuid REFERENCES public.buy_ai_response_logs(id) ON DELETE SET NULL,
  source_thread_id uuid REFERENCES public.buy_ai_threads(id) ON DELETE SET NULL,
  suggested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  status public.buy_ai_corp_memory_status NOT NULL DEFAULT 'pendente',
  review_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.buy_ai_corporate_memory TO authenticated;
GRANT ALL ON public.buy_ai_corporate_memory TO service_role;
ALTER TABLE public.buy_ai_corporate_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suggester or admin read" ON public.buy_ai_corporate_memory
  FOR SELECT TO authenticated USING (suggested_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "user suggest" ON public.buy_ai_corporate_memory
  FOR INSERT TO authenticated WITH CHECK (suggested_by = auth.uid() AND status = 'pendente');
CREATE POLICY "admin update memory" ON public.buy_ai_corporate_memory
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete memory" ON public.buy_ai_corporate_memory
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER buy_ai_corporate_memory_updated_at BEFORE UPDATE ON public.buy_ai_corporate_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS buy_ai_corp_memory_status_idx ON public.buy_ai_corporate_memory (status, created_at DESC);

-- 5) AUDITORIA DE ACESSO SENSÍVEL
CREATE TABLE IF NOT EXISTS public.buy_ai_sensitive_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.buy_ai_threads(id) ON DELETE SET NULL,
  response_log_id uuid REFERENCES public.buy_ai_response_logs(id) ON DELETE SET NULL,
  resource_type text NOT NULL,
  resource_id text,
  action text NOT NULL DEFAULT 'read',
  reason text,
  allowed boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.buy_ai_sensitive_access_audit TO authenticated;
GRANT ALL ON public.buy_ai_sensitive_access_audit TO service_role;
ALTER TABLE public.buy_ai_sensitive_access_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin or owner read audit" ON public.buy_ai_sensitive_access_audit
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS buy_ai_sensitive_audit_user_idx ON public.buy_ai_sensitive_access_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS buy_ai_sensitive_audit_resource_idx ON public.buy_ai_sensitive_access_audit (resource_type, created_at DESC);

-- 6) MÉTRICAS DIÁRIAS
CREATE OR REPLACE VIEW public.buy_ai_metrics_daily
WITH (security_invoker = true) AS
WITH r_daily AS (
  SELECT
    date_trunc('day', created_at) AS day,
    count(*) AS total_questions,
    count(DISTINCT user_id) AS unique_users,
    count(*) FILTER (WHERE had_error) AS error_count,
    count(*) FILTER (WHERE used_external_ai) AS external_ai_count,
    count(*) FILTER (WHERE jsonb_array_length(coalesce(library_documents,'[]'::jsonb)) > 0) AS library_backed_count,
    avg(confidence_score) AS avg_confidence,
    avg(response_time_ms) AS avg_response_ms
  FROM public.buy_ai_response_logs
  GROUP BY 1
),
f_daily AS (
  SELECT
    date_trunc('day', created_at) AS day,
    count(*) FILTER (WHERE rating = 'util') AS feedback_positive,
    count(*) FILTER (WHERE rating IN ('nao_util','incorreta','incompleta')) AS feedback_negative
  FROM public.buy_ai_feedback
  GROUP BY 1
)
SELECT
  r.day,
  r.total_questions::bigint,
  r.unique_users::bigint,
  r.error_count::bigint,
  r.external_ai_count::bigint,
  r.library_backed_count::bigint,
  r.avg_confidence::real,
  r.avg_response_ms::real,
  COALESCE(f.feedback_positive, 0)::bigint AS feedback_positive,
  COALESCE(f.feedback_negative, 0)::bigint AS feedback_negative
FROM r_daily r
LEFT JOIN f_daily f USING (day)
ORDER BY r.day DESC;
GRANT SELECT ON public.buy_ai_metrics_daily TO authenticated;
