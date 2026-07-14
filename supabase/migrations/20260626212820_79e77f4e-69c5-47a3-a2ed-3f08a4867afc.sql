
CREATE TABLE public.buy_ai_tool_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.buy_ai_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'invoke',
  tool_name TEXT NOT NULL,
  server TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  duration_ms INTEGER,
  args_preview TEXT,
  result_preview TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_buy_ai_tool_calls_thread ON public.buy_ai_tool_calls(thread_id, created_at);
GRANT SELECT ON public.buy_ai_tool_calls TO authenticated;
GRANT ALL ON public.buy_ai_tool_calls TO service_role;
ALTER TABLE public.buy_ai_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own tool calls"
  ON public.buy_ai_tool_calls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
