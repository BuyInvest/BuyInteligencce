
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RATE LIMIT
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  user_id uuid NOT NULL,
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket_key, window_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_buckets TO authenticated;
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rl_owner_read" ON public.rate_limit_buckets;
CREATE POLICY "rl_owner_read" ON public.rate_limit_buckets FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid, p_key text, p_max integer, p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_window timestamptz; v_count integer;
BEGIN
  v_window := date_trunc('second', now()) - make_interval(secs => (extract(epoch from now())::bigint % p_window_seconds));
  INSERT INTO public.rate_limit_buckets (user_id, bucket_key, window_start, count)
  VALUES (p_user_id, p_key, v_window, 1)
  ON CONFLICT (user_id, bucket_key, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO v_count;
  DELETE FROM public.rate_limit_buckets
   WHERE user_id = p_user_id AND bucket_key = p_key
     AND window_start < now() - make_interval(secs => p_window_seconds * 4);
  RETURN v_count <= p_max;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log (action, created_at DESC);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_owner_read" ON public.audit_log;
CREATE POLICY "audit_owner_read" ON public.audit_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "audit_owner_insert" ON public.audit_log;
CREATE POLICY "audit_owner_insert" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (auth.uid(), 'role.grant', 'user_role', NEW.user_id::text,
            jsonb_build_object('role', NEW.role, 'target_user', NEW.user_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (auth.uid(), 'role.revoke', 'user_role', OLD.user_id::text,
            jsonb_build_object('role', OLD.role, 'target_user', OLD.user_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_audit_trg ON public.user_roles;
CREATE TRIGGER user_roles_audit_trg
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();

-- MCP TOKEN ENCRYPTION
ALTER TABLE public.mcp_connections
  ADD COLUMN IF NOT EXISTS bearer_token_encrypted bytea;

CREATE OR REPLACE FUNCTION public.get_mcp_bearer(p_connection_id uuid, p_key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_enc bytea; v_plain text;
BEGIN
  SELECT bearer_token_encrypted, bearer_token INTO v_enc, v_plain
    FROM public.mcp_connections WHERE id = p_connection_id;
  IF v_enc IS NOT NULL THEN
    RETURN extensions.pgp_sym_decrypt(v_enc, p_key);
  END IF;
  RETURN v_plain;
END;
$$;
REVOKE ALL ON FUNCTION public.get_mcp_bearer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mcp_bearer(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_mcp_bearer(p_connection_id uuid, p_bearer text, p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF p_bearer IS NULL OR length(p_bearer) = 0 THEN
    UPDATE public.mcp_connections
       SET bearer_token_encrypted = NULL, bearer_token = NULL
     WHERE id = p_connection_id;
  ELSE
    UPDATE public.mcp_connections
       SET bearer_token_encrypted = extensions.pgp_sym_encrypt(p_bearer, p_key),
           bearer_token = NULL
     WHERE id = p_connection_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_mcp_bearer(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_mcp_bearer(uuid, text, text) TO service_role;

REVOKE SELECT (bearer_token, bearer_token_encrypted) ON public.mcp_connections FROM authenticated;
