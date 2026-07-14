// Shared rate-limit helper for Edge Functions
// Uses public.check_rate_limit RPC (SECURITY DEFINER, service_role only)
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function enforceRateLimit(
  admin: SupabaseClient,
  userId: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_user_id: userId,
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate-limit rpc error", error);
    return { ok: true }; // fail-open to avoid breaking app on infra glitch
  }
  if (data === false) return { ok: false, retryAfter: windowSeconds };
  return { ok: true };
}

export function rateLimitResponse(retryAfter: number, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Too many requests", retryAfter }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

// re-export for convenience
export { createClient };
