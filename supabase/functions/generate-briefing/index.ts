import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roles } = await callerClient.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const today = new Date().toISOString().split("T")[0];

    // Check if briefing already exists for today
    const { data: existing } = await supabase
      .from("daily_briefings")
      .select("id")
      .eq("briefing_date", today)
      .maybeSingle();

    // Get today's top articles
    const startOfDay = `${today}T00:00:00.000Z`;
    const { data: articles } = await supabase
      .from("news_articles")
      .select("id, title, executive_summary_pt, relevance_score, adherence_score, importance_level, geographic_scope, source_id, news_sources(name)")
      .eq("is_classified", true)
      .eq("is_duplicate", false)
      .gte("fetched_at", startOfDay)
      .order("relevance_score", { ascending: false })
      .limit(20);

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No articles for briefing today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const articlesSummary = articles.map((a, i) => 
      `${i + 1}. [${(a as any).news_sources?.name}] ${a.title} (Relevância: ${a.relevance_score}/5)\n   ${a.executive_summary_pt || ""}`
    ).join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é um analista sênior de inteligência de mercado do setor imobiliário industrial e logístico. Gere briefings executivos diários concisos e estratégicos."
          },
          {
            role: "user",
            content: `Gere o briefing diário executivo para ${today} com base nas seguintes notícias:\n\n${articlesSummary}\n\nO briefing deve conter:\n1. Título do dia\n2. Resumo geral (3-5 parágrafos)\n3. Destaques em Santa Catarina\n4. Destaques de portos\n5. Destaques de galpões/logística industrial\n6. Tendências observadas\n7. Possíveis impactos para investidores`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_briefing",
            description: "Cria o briefing diário executivo",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título do briefing do dia" },
                summary: { type: "string", description: "Resumo executivo completo em markdown" },
              },
              required: ["title", "summary"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "create_briefing" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI error ${response.status}: ${errText}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const briefing = JSON.parse(toolCall.function.arguments);
    const topArticlesJson = articles.slice(0, 10).map(a => ({
      id: a.id,
      title: a.title,
      relevance_score: a.relevance_score,
      source: (a as any).news_sources?.name,
    }));

    if (existing) {
      await supabase
        .from("daily_briefings")
        .update({
          title: briefing.title,
          summary: briefing.summary,
          top_articles_json: topArticlesJson,
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("daily_briefings")
        .insert({
          briefing_date: today,
          title: briefing.title,
          summary: briefing.summary,
          top_articles_json: topArticlesJson,
        });
    }

    return new Response(
      JSON.stringify({ success: true, briefing_date: today }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
