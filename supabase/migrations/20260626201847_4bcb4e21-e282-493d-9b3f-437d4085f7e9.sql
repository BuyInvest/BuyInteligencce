
CREATE TABLE public.buy_ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buy_ai_threads_user_idx ON public.buy_ai_threads(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buy_ai_threads TO authenticated;
GRANT ALL ON public.buy_ai_threads TO service_role;
ALTER TABLE public.buy_ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.buy_ai_threads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.buy_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.buy_ai_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buy_ai_messages_thread_idx ON public.buy_ai_messages(thread_id, created_at ASC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buy_ai_messages TO authenticated;
GRANT ALL ON public.buy_ai_messages TO service_role;
ALTER TABLE public.buy_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.buy_ai_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER buy_ai_threads_updated_at BEFORE UPDATE ON public.buy_ai_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
