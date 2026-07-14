// Buy IA · Streaming chat endpoint with MCP function calling (deferral pattern)
// Exposes only meta-tools `tool_search` / `tool_invoke` to the model; resolves
// real tool calls server-side against the user's enabled MCP connections.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { logAudit } from "../_shared/audit.ts";
import {
  retrieveKnowledge,
  buildKnowledgeSystemPrompt,
  routeModel,
} from "../_shared/knowledge-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_PROMPT = `Você é uma IA da Buy Invest Intelligence — especialista em Real Estate Industrial & Logístico do Brasil (galpões classe A/AAA, BTS, sale leaseback, condomínios logísticos, portos, FIIs logísticos, engenharia: ESFR, J4, pé-direito, docas, pisos).

Responda em português, em tom executivo, claro e direto, com formatação markdown quando útil (listas, negrito, tabelas curtas).

Quando o usuário citar uma cidade/região, contextualize com dados de mercado plausíveis e mencione fontes típicas (SiiLA, ANTAQ, Comex Stat, IBGE, Boletim Focus). Quando citar conceitos técnicos (Cap Rate, Yield, J4, ESFR, BTS), explique de forma concisa e prática.

Nunca invente números como se fossem oficiais — quando não tiver certeza, diga "estimativa de mercado" ou "valor de referência".`;

const MODEL_PROMPTS: Record<string, string> = {
  "analista-senior": "Atue como Analista Sênior generalista, cruzando dados de mercado, portos, BTS, valuation e logística.",
  "corretor-industrial": "Atue como Corretor Industrial sênior. Foque em prospecção, scripts de captação, parâmetros de negociação (R$/m², carência, reajuste), análise de demanda e estratégia comercial.",
  "especialista-bts": "Atue como especialista em BTS / Built-to-Suit. Foque em estrutura contratual atípica, cap rate alvo, prazos típicos, garantias, multa rescisória, CRI e funding.",
  "especialista-portos": "Atue como especialista em portos e terminais. Use referencial ANTAQ, Comex Stat, Receita Federal. Foque em TEUs, ranking de terminais, retroporto, cabotagem.",
  "especialista-logistico": "Atue como especialista em supply chain. Foque em last-mile, cross-docking, fulfillment, regionalização de estoques, rotas, custos de frete.",
  "especialista-juridico": "Atue como especialista jurídico imobiliário. Foque em matrícula, due diligence, contratos típicos/atípicos (Lei 8.245/91), garantias, ITBI, riscos.",
  "especialista-investimentos": "Atue como especialista em investimentos imobiliários logísticos. Foque em FIIs, cap rate, dividend yield, P/VP, alavancagem, CRI.",
  "especialista-engenharia": "Atue como especialista em engenharia de galpões. Foque em ESFR, J4, pé-direito útil, docas, resistência de piso (t/m²), padrões AAA.",
  "especialista-mercado": "Atue como pesquisador de mercado. Use referencial SiiLA, JLL, Cushman. Foque em vacância, absorção líquida, prime rent, asking rent, estoque.",
  "especialista-valuation": "Atue como avaliador de ativos. Foque em método de renda (DCF), cap rate de saída, custo de reposição, NBR 14653 e laudos.",
};

const ALLOWED_LLM = new Set([
  "auto",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.5",
  "openai/gpt-5.4-pro",
]);
const DEFAULT_LLM = "google/gemini-3-flash-preview";

type McpDescriptor = {
  fullName: string; // "server.tool"
  server: string;
  tool: string;
  description?: string;
  inputSchema?: unknown;
  serverUrl: string;
  connectionId: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function callMcpTool(
  serverUrl: string,
  bearer: string | undefined,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  try {
    // Initialize a fresh session, then call
    await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "Buy IA", version: "1.0.0" },
        },
      }),
    }).then((r) => r.text().catch(() => ""));

    const res = await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    const ct = res.headers.get("content-type") ?? "";
    let json: unknown;
    if (ct.includes("text/event-stream")) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let parsed: unknown = null;
      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith("data:")) {
            const d = t.slice(5).trim();
            if (d && d !== "[DONE]") {
              try {
                parsed = JSON.parse(d);
                reader.cancel();
                break outer;
              } catch {}
            }
          }
        }
      }
      json = parsed;
    } else {
      json = await res.json();
    }
    const j = json as { result?: unknown; error?: { message?: string } };
    if (j?.error) return { ok: false, error: j.error.message ?? "MCP error" };
    return { ok: true, result: j?.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "MCP call failed" };
  }
}

function buildMetaTools() {
  return [
    {
      type: "function",
      function: {
        name: "tool_search",
        description:
          "Buscar ferramentas disponíveis nos servidores MCP conectados pelo usuário. Use ANTES de invocar qualquer ferramenta externa para descobrir o nome exato e o input schema. Filtre por palavras-chave e opcionalmente por servidor (notion, hubspot, google_drive, gmail, etc).",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Palavras-chave para buscar no nome/descrição" },
            server: { type: "string", description: "Filtro opcional por nome do servidor" },
            limit: { type: "integer", default: 8 },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "tool_invoke",
        description:
          "Invocar uma ferramenta MCP pelo nome EXATO (formato 'server.tool') retornado por tool_search. Passe os argumentos como objeto JSON conforme o input schema descoberto.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome completo retornado por tool_search" },
            arguments: { type: "object", description: "Argumentos JSON" },
          },
          required: ["name"],
        },
      },
    },
  ];
}

async function gatewayCall(
  lovableApiKey: string,
  model: string,
  messages: unknown[],
  tools: unknown[] | null,
  stream: boolean,
): Promise<Response> {
  const body: Record<string, unknown> = { model, messages, stream };
  if (tools && tools.length) body.tools = tools;
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

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
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = (await req.json()) as {
      threadId: string;
      modelKey?: string;
      llmId?: string;
      module?: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!body?.threadId || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Rate limit: 30 mensagens / 5 min por usuário
    const rl = await enforceRateLimit(admin, userId, "buy-ai-chat", 30, 300);
    if (!rl.ok) return rateLimitResponse(rl.retryAfter, corsHeaders);

    const mcpKey = Deno.env.get("MCP_ENCRYPTION_KEY") ?? "";

    const { data: thread } = await admin
      .from("buy_ai_threads")
      .select("id, user_id, title")
      .eq("id", body.threadId)
      .maybeSingle();
    if (!thread || thread.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await admin.from("buy_ai_messages").insert({
        thread_id: body.threadId,
        user_id: userId,
        role: "user",
        content: lastUser.content,
      });
      if (thread.title === "Nova conversa" || thread.title === "Nova análise") {
        const title = lastUser.content.slice(0, 60).replace(/\s+/g, " ").trim();
        await admin.from("buy_ai_threads").update({ title }).eq("id", body.threadId);
      } else {
        await admin
          .from("buy_ai_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", body.threadId);
      }
    }

    // Load enabled MCP connections + build registry (no bearer in memory)
    const { data: conns } = await admin
      .from("mcp_connections")
      .select("id, name, url, auth_type, tools_cache")
      .eq("user_id", userId)
      .eq("enabled", true)
      .eq("state", "ready");

    const registry: McpDescriptor[] = [];
    const serverSummary: string[] = [];
    for (const c of conns ?? []) {
      const slug = slugify(c.name);
      const tools = (c.tools_cache as Array<{ name: string; description?: string; inputSchema?: unknown }> | null) ?? [];
      serverSummary.push(`- ${slug} (${tools.length} ferramentas)`);
      for (const t of tools) {
        registry.push({
          fullName: `${slug}.${t.name}`,
          server: slug,
          tool: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          serverUrl: c.url as string,
          connectionId: c.id as string,
        });
      }
    }

    // Decrypt bearer on demand via SECURITY DEFINER RPC
    const resolveBearer = async (connectionId: string): Promise<string | undefined> => {
      if (!mcpKey) return undefined;
      const { data, error } = await admin.rpc("get_mcp_bearer", {
        p_connection_id: connectionId,
        p_key: mcpKey,
      });
      if (error) { console.error("get_mcp_bearer error", error); return undefined; }
      return (data as string | null) ?? undefined;
    };

    const modelInstruction = MODEL_PROMPTS[body.modelKey ?? ""] ?? MODEL_PROMPTS["analista-senior"];

    let mcpSystem = "";
    if (registry.length > 0) {
      mcpSystem = `

Ferramentas externas:
- Você tem acesso a ferramentas dos servidores MCP que o usuário conectou, MAS elas NÃO são listadas aqui para manter o contexto leve.
- Servidores disponíveis:
${serverSummary.join("\n")}
- Use \`tool_search\` para descobrir o nome exato e o input schema antes de invocar qualquer ferramenta (você pode filtrar por \`server\`).
- Depois use \`tool_invoke\` com o nome completo (formato 'servidor.ferramenta') e um objeto JSON de argumentos.
- Quando o usuário mencionar um serviço pelo nome, busque nesse servidor primeiro.
- Use ferramentas reais quando o usuário pedir dados específicos de seus sistemas; não invente respostas.`;
    }

    // === Knowledge Engine: retrieve grounded context from the Buy Invest library ===
    const lastUserText =
      [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const knowledge = lastUserText
      ? await retrieveKnowledge(admin, lovableApiKey, lastUserText, 8)
      : { intents: ["geral"], chunks: [], sources: [], confidence: 0, contextBlock: "" };
    const knowledgeSystem = buildKnowledgeSystemPrompt(knowledge);

    const systemPrompt = `${BASE_PROMPT}\n\n${modelInstruction}${mcpSystem}${knowledgeSystem}`;
    const requestedLlm = ALLOWED_LLM.has(body.llmId ?? "") ? body.llmId! : DEFAULT_LLM;
    const llmModel = routeModel(
      requestedLlm,
      knowledge.intents,
      lastUserText,
      knowledge.contextBlock.length,
    );
    const tools = registry.length > 0 ? buildMetaTools() : null;

    type OAMessage = {
      role: "system" | "user" | "assistant" | "tool";
      content: string | null;
      tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
      tool_call_id?: string;
      name?: string;
    };

    const conv: OAMessage[] = [
      { role: "system", content: systemPrompt },
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const requestStartedAt = Date.now();
    let usedExternalAI = false;
    const externalAIProviders = new Set<string>();
    const sensitiveAccessed: Array<{
      resource_type: string;
      resource_id: string;
      reason: string;
    }> = [];
    const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
      [/contrato|contract/i, "contrato"],
      [/jur[ií]dico|legal|matric/i, "juridico"],
      [/financ|fatur|invoice|pagamento|payment/i, "financeiro"],
      [/cliente|customer|crm|hubspot|salesforce/i, "cliente"],
      [/im[oó]vel|propert|listing|portfolio/i, "imovel"],
      [/proposta|proposal|offer/i, "proposta"],
      [/estrat[eé]g|strategy|roadmap/i, "estrategico"],
      [/drive|notion|gmail|sheet|calendar|slack|jira/i, "integracao_externa"],
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (s: string) => controller.enqueue(encoder.encode(s));
        let assistantText = "";

        let stepIdx = 0;

        const logToolCall = async (entry: {
          kind: "search" | "invoke";
          tool_name: string;
          server?: string | null;
          status: "ok" | "error";
          duration_ms: number;
          args_preview?: string;
          result_preview?: string;
          error?: string;
        }) => {
          try {
            await admin.from("buy_ai_tool_calls").insert({
              thread_id: body.threadId,
              user_id: userId,
              step: stepIdx,
              kind: entry.kind,
              tool_name: entry.tool_name,
              server: entry.server ?? null,
              status: entry.status,
              duration_ms: entry.duration_ms,
              args_preview: entry.args_preview?.slice(0, 2000) ?? null,
              result_preview: entry.result_preview?.slice(0, 2000) ?? null,
              error: entry.error?.slice(0, 1000) ?? null,
            });
          } catch (_) { /* never break the stream on log failure */ }
        };

        const executeMetaTool = async (
          name: string,
          rawArgs: string,
        ): Promise<string> => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(rawArgs || "{}"); } catch {}
          const started = Date.now();
          if (name === "tool_search") {
            const q = String(args.query ?? "").toLowerCase();
            const srv = args.server ? slugify(String(args.server)) : null;
            const limit = Math.min(Number(args.limit ?? 8) || 8, 20);
            const matches = registry
              .filter((d) => !srv || d.server === srv)
              .filter((d) =>
                d.fullName.toLowerCase().includes(q) ||
                (d.description ?? "").toLowerCase().includes(q),
              )
              .slice(0, limit)
              .map((d) => ({
                name: d.fullName,
                server: d.server,
                description: d.description,
                input_schema: d.inputSchema,
              }));
            const payload = JSON.stringify({ matches });
            await logToolCall({
              kind: "search",
              tool_name: "tool_search",
              server: srv,
              status: "ok",
              duration_ms: Date.now() - started,
              args_preview: rawArgs,
              result_preview: `${matches.length} match(es)`,
            });
            return payload;
          }
          if (name === "tool_invoke") {
            const target = String(args.name ?? "");
            const desc = registry.find((d) => d.fullName === target);
            if (!desc) {
              await logToolCall({
                kind: "invoke",
                tool_name: target || "(unknown)",
                status: "error",
                duration_ms: Date.now() - started,
                args_preview: rawArgs,
                error: "Ferramenta desconhecida",
              });
              return JSON.stringify({ error: `Ferramenta desconhecida: ${target}` });
            }
            const callArgs = (args.arguments as Record<string, unknown>) ?? {};
            emit(`\n\n> 🔧 Invocando \`${target}\`...\n\n`);
            usedExternalAI = true;
            externalAIProviders.add(`mcp:${desc.server}`);
            for (const [re, label] of SENSITIVE_PATTERNS) {
              if (re.test(target) || re.test(JSON.stringify(callArgs))) {
                sensitiveAccessed.push({ resource_type: label, resource_id: target, reason: "tool_invoke" });
                break;
              }
            }
            const bearer = await resolveBearer(desc.connectionId);
            const r = await callMcpTool(desc.serverUrl, bearer, desc.tool, callArgs);

            const duration = Date.now() - started;
            if (!r.ok) {
              await logToolCall({
                kind: "invoke",
                tool_name: target,
                server: desc.server,
                status: "error",
                duration_ms: duration,
                args_preview: JSON.stringify(callArgs),
                error: r.error,
              });
              await logAudit(admin, {
                userId, action: "mcp.tool_invoke", resourceType: "mcp_tool",
                resourceId: target,
                metadata: { server: desc.server, status: "error", error: r.error, duration_ms: duration },
              }, req);
              return JSON.stringify({ error: r.error });
            }
            const resultStr = JSON.stringify({ result: r.result }).slice(0, 30000);
            await logToolCall({
              kind: "invoke",
              tool_name: target,
              server: desc.server,
              status: "ok",
              duration_ms: duration,
              args_preview: JSON.stringify(callArgs),
              result_preview: resultStr,
            });
            await logAudit(admin, {
              userId, action: "mcp.tool_invoke", resourceType: "mcp_tool",
              resourceId: target,
              metadata: { server: desc.server, status: "ok", duration_ms: duration },
            }, req);
            return resultStr;
          }
          }
          return JSON.stringify({ error: `Meta-tool desconhecida: ${name}` });
        };


        let loopError: string | null = null;
        try {
          const MAX_STEPS = 6;
          for (let step = 0; step < MAX_STEPS; step++) {
            stepIdx = step;
            // Non-streaming JSON to detect tool_calls
            const probe = await gatewayCall(lovableApiKey, llmModel, conv, tools, false);
            if (!probe.ok) {
              const errText = await probe.text().catch(() => "");
              loopError = `gateway ${probe.status}: ${errText.slice(0, 200)}`;
              if (probe.status === 429) { emit("\n\n_Limite de requisições atingido. Tente novamente em instantes._"); break; }
              if (probe.status === 402) { emit("\n\n_Créditos da IA esgotados. Adicione créditos no workspace._"); break; }
              emit(`\n\n_Erro da IA ${probe.status}: ${errText.slice(0, 300)}_`);
              break;
            }
            const json = await probe.json();
            const choice = json?.choices?.[0]?.message;
            const calls = choice?.tool_calls as Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }> | undefined;

            if (calls && calls.length > 0) {
              conv.push({
                role: "assistant",
                content: choice?.content ?? null,
                tool_calls: calls,
              });
              for (const tc of calls) {
                const out = await executeMetaTool(tc.function.name, tc.function.arguments);
                conv.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  content: out,
                });
              }
              continue; // next step
            }

            // No tool calls — produce the final streamed answer
            const finalStream = await gatewayCall(lovableApiKey, llmModel, conv, tools, true);
            if (!finalStream.ok || !finalStream.body) {
              const t = await finalStream.text().catch(() => "");
              loopError = `stream ${finalStream.status}: ${t.slice(0, 200)}`;
              emit(`\n\n_Erro ${finalStream.status}: ${t.slice(0, 200)}_`);
              if (choice?.content) {
                assistantText += choice.content;
                emit(choice.content);
              }
              break;
            }
            const reader = finalStream.body.getReader();
            let buffer = "";
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let idx: number;
              while ((idx = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line.startsWith("data:")) continue;
                const data = line.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  const j = JSON.parse(data);
                  const delta = j.choices?.[0]?.delta?.content;
                  if (delta) {
                    assistantText += delta;
                    emit(delta);
                  }
                } catch {}
              }
            }
            break;
          }
        } catch (e) {
          console.error("buy-ai-chat loop error", e);
          loopError = e instanceof Error ? e.message : "desconhecido";
          emit(`\n\n_Erro: ${loopError}_`);
        } finally {
          const totalDuration = Date.now() - requestStartedAt;
          if (assistantText) {
            await admin.from("buy_ai_messages").insert({
              thread_id: body.threadId,
              user_id: userId,
              role: "assistant",
              content: assistantText,
            });
          }
          // ─── Buy IA memory / logs / metrics ─────────────────────────────
          try {
            const intent = knowledge.intents?.[0] ?? "geral";
            const libDocs = (knowledge.sources ?? []).map((s: { slug?: string; title?: string }) => ({
              slug: s.slug,
              title: s.title,
            }));
            const { data: logRow } = await admin
              .from("buy_ai_response_logs")
              .insert({
                thread_id: body.threadId,
                user_id: userId,
                module: body.module ?? null,
                question: lastUser?.content ?? "",
                answer: assistantText || null,
                question_category: intent,
                intent,
                model: llmModel,
                confidence_score: knowledge.confidence ?? null,
                response_time_ms: totalDuration,
                library_documents: libDocs,
                internal_sources: knowledge.sources ?? [],
                used_external_ai: usedExternalAI,
                external_ai_provider: usedExternalAI ? Array.from(externalAIProviders).join(",") : null,
                had_error: !!loopError,
                error_message: loopError,
                metadata: { modelKey: body.modelKey ?? null },
              })
              .select("id")
              .maybeSingle();

            const logId = logRow?.id ?? null;

            if (sensitiveAccessed.length > 0) {
              await admin.from("buy_ai_sensitive_access_audit").insert(
                sensitiveAccessed.map((s) => ({
                  user_id: userId,
                  thread_id: body.threadId,
                  response_log_id: logId,
                  resource_type: s.resource_type,
                  resource_id: s.resource_id,
                  action: "read",
                  reason: s.reason,
                  allowed: true,
                })),
              );
            }

            // Upsert thread context memory
            const { data: existingCtx } = await admin
              .from("buy_ai_thread_context")
              .select("intent_history, consulted_documents, consulted_sources, message_count, avg_confidence")
              .eq("thread_id", body.threadId)
              .maybeSingle();
            const newIntents = [...((existingCtx?.intent_history as unknown[]) ?? []), intent].slice(-12);
            const mergedDocs = [
              ...((existingCtx?.consulted_documents as Array<{ slug?: string }>) ?? []),
              ...libDocs,
            ]
              .filter((d, i, arr) => arr.findIndex((x) => x.slug === d.slug) === i)
              .slice(-30);
            const mergedSources = [
              ...((existingCtx?.consulted_sources as unknown[]) ?? []),
              ...(knowledge.sources ?? []),
            ].slice(-30);
            const prevCount = (existingCtx?.message_count as number) ?? 0;
            const prevAvg = (existingCtx?.avg_confidence as number) ?? 0;
            const newCount = prevCount + 1;
            const newAvg = knowledge.confidence != null
              ? (prevAvg * prevCount + knowledge.confidence) / newCount
              : prevAvg;
            await admin
              .from("buy_ai_thread_context")
              .upsert(
                {
                  thread_id: body.threadId,
                  user_id: userId,
                  module: body.module ?? null,
                  current_intent: intent,
                  intent_history: newIntents,
                  consulted_documents: mergedDocs,
                  consulted_sources: mergedSources,
                  last_model: llmModel,
                  avg_confidence: newAvg,
                  message_count: newCount,
                },
                { onConflict: "thread_id" },
              );
          } catch (logErr) {
            console.error("buy-ai-chat memory/log error", logErr);
          }
          controller.close();
        }
      },
    });


    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    console.error("buy-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
