
-- MCP Connections: cada usuário gerencia suas próprias conexões a servidores MCP
CREATE TABLE public.mcp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  preset TEXT,
  url TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'http' CHECK (transport IN ('http','sse')),
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','bearer','oauth')),
  bearer_token TEXT,
  oauth_tokens JSONB,
  oauth_client JSONB,
  auth_url TEXT,
  state TEXT NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','authenticating','failed','disabled')),
  last_error TEXT,
  tools_cache JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_connections TO authenticated;
GRANT ALL ON public.mcp_connections TO service_role;

ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own MCP connections"
  ON public.mcp_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_mcp_connections_updated_at
  BEFORE UPDATE ON public.mcp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mcp_connections_user ON public.mcp_connections(user_id, enabled);
