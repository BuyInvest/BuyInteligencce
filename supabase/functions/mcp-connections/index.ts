// Buy IA · MCP Connections CRUD + probe
// Lists, creates, deletes and tests MCP server connections for the authenticated user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { logAudit } from "../_shared/audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

type ProbeResult =
  | { ok: true; tools: Array<{ name: string; description?: string; inputSchema?: unknown }> }
  | { ok: false; error: string };

// Minimal MCP Streamable HTTP probe: initialize + tools/list
async function probeMcp(url: string, bearer?: string): Promise<ProbeResult> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.hostname !== "localhost") {
      return { ok: false, error: "Apenas URLs https:// são aceitas." };
    }
  } catch {
    return { ok: false, error: "URL inválida." };
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (bearer) baseHeaders.Authorization = `Bearer ${bearer}`;

  const callRpc = async (payload: unknown): Promise<unknown> => {
    const res = await fetch(url, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/event-stream")) {
      // Read SSE and find first JSON message line
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();
            if (data && data !== "[DONE]") {
              try {
                reader.cancel();
                return JSON.parse(data);
              } catch {}
            }
          }
        }
      }
      throw new Error("Sem resposta SSE válida.");
    }
    return await res.json();
  };

  try {
    const init = (await callRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "Buy IA", version: "1.0.0" },
      },
    })) as { error?: { message?: string } };
    if (init && typeof init === "object" && "error" in init && init.error) {
      return { ok: false, error: `MCP initialize falhou: ${init.error.message ?? "erro"}` };
    }

    const list = (await callRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })) as { result?: { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> }; error?: { message?: string } };
    if (list?.error) return { ok: false, error: `tools/list falhou: ${list.error.message}` };
    const tools = (list?.result?.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    }));
    return { ok: true, tools };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha desconhecida" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);
  const mcpKey = Deno.env.get("MCP_ENCRYPTION_KEY") ?? "";

  // Rate limit: 20 req/min por usuário
  const rl = await enforceRateLimit(admin, userId, "mcp-connections", 20, 60);
  if (!rl.ok) return rateLimitResponse(rl.retryAfter, corsHeaders);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "GET" ? "list" : "");

    // LIST
    if (req.method === "GET" || action === "list") {
      const { data, error } = await admin
        .from("mcp_connections")
        .select(
          "id, name, preset, url, transport, auth_type, state, last_error, tools_cache, enabled, created_at, updated_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ items: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE
    if (req.method === "DELETE" || action === "delete") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await admin
        .from("mcp_connections")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      await logAudit(admin, { userId, action: "mcp.connection.delete", resourceType: "mcp_connection", resourceId: id }, req);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      preset?: string | null;
      url?: string;
      transport?: "http" | "sse";
      auth_type?: "none" | "bearer" | "oauth";
      bearer_token?: string;
      enabled?: boolean;
      id?: string;
    };

    // TEST (probe only, no persistence)
    if (action === "test") {
      if (!body.url) {
        return new Response(JSON.stringify({ error: "url obrigatória" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const probe = await probeMcp(body.url, body.auth_type === "bearer" ? body.bearer_token : undefined);
      return new Response(JSON.stringify(probe), {
        status: probe.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE
    if (action === "create") {
      if (!body.name || !body.url) {
        return new Response(JSON.stringify({ error: "name e url são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authType = body.auth_type ?? "none";
      let probe: ProbeResult = { ok: true, tools: [] };
      let state: "ready" | "authenticating" | "failed" = "ready";
      let auth_url: string | null = null;

      if (authType === "oauth") {
        state = "authenticating";
        auth_url = null;
      } else {
        probe = await probeMcp(body.url, authType === "bearer" ? body.bearer_token : undefined);
        state = probe.ok ? "ready" : "failed";
      }

      const { data, error } = await admin
        .from("mcp_connections")
        .insert({
          user_id: userId,
          name: body.name,
          preset: body.preset ?? null,
          url: body.url,
          transport: body.transport ?? "http",
          auth_type: authType,
          bearer_token: null,
          state,
          last_error: probe.ok ? null : probe.error,
          tools_cache: probe.ok ? probe.tools : null,
          auth_url,
          enabled: body.enabled ?? true,
        })
        .select()
        .single();
      if (error) throw error;

      // Encrypt bearer at rest via SECURITY DEFINER RPC
      if (authType === "bearer" && body.bearer_token && mcpKey) {
        await admin.rpc("set_mcp_bearer", {
          p_connection_id: data.id,
          p_bearer: body.bearer_token,
          p_key: mcpKey,
        });
      }

      await logAudit(admin, {
        userId, action: "mcp.connection.create", resourceType: "mcp_connection",
        resourceId: data.id, metadata: { name: body.name, url: body.url, auth_type: authType, state },
      }, req);

      return new Response(JSON.stringify({ item: data, probe }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REFRESH (re-probe existing)
    if (action === "refresh") {
      if (!body.id) {
        return new Response(JSON.stringify({ error: "id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existing } = await admin
        .from("mcp_connections")
        .select("*")
        .eq("id", body.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "Conexão não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let bearer: string | undefined;
      if (existing.auth_type === "bearer" && mcpKey) {
        const { data: b } = await admin.rpc("get_mcp_bearer", { p_connection_id: body.id, p_key: mcpKey });
        bearer = (b as string | null) ?? undefined;
      }
      const probe = await probeMcp(existing.url, bearer);
      const { data, error } = await admin
        .from("mcp_connections")
        .update({
          state: probe.ok ? "ready" : "failed",
          last_error: probe.ok ? null : probe.error,
          tools_cache: probe.ok ? probe.tools : existing.tools_cache,
        })
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ item: data, probe }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TOGGLE
    if (action === "toggle") {
      if (!body.id) {
        return new Response(JSON.stringify({ error: "id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin
        .from("mcp_connections")
        .update({ enabled: body.enabled ?? true })
        .eq("id", body.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ item: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não suportada" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mcp-connections error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
