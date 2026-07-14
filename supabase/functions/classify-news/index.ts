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

    // Require authenticated admin caller
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

    const { data: articles, error: fetchErr } = await supabase
      .from("news_articles")
      .select("*, news_sources(name, language)")
      .eq("is_classified", false)
      .eq("is_duplicate", false)
      .order("fetched_at", { ascending: false })
      .limit(5);

    if (fetchErr) throw fetchErr;
    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No articles to classify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: keywords } = await supabase
      .from("monitoring_keywords")
      .select("keyword, keyword_group, priority_level")
      .eq("is_active", true);

    let processed = 0;

    for (const article of articles) {
      try {
        const content = article.cleaned_content || article.raw_content || article.title;
        const sourceLang = (article as any).news_sources?.language || "pt";

        const systemPrompt = `Você é um analista sênior de inteligência de mercado do setor imobiliário industrial e logístico brasileiro (Buy Invest Intelligence). Analise a notícia com profundidade estratégica, considerando impactos para investidores, ocupantes e desenvolvedores de ativos logísticos.`;

        const userPrompt = `Analise esta notícia e classifique com visão estratégica:

TÍTULO: ${article.title}
CONTEÚDO: ${content.substring(0, 3000)}
FONTE: ${(article as any).news_sources?.name || "Desconhecida"}
IDIOMA ORIGINAL: ${sourceLang}

Retorne a classificação completa usando a função fornecida. Seja específico na análise estratégica — ela deve ser acionável para tomada de decisão.`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "classify_article",
                description: "Classifica, resume e analisa estrategicamente um artigo de notícia do setor logístico/industrial",
                parameters: {
                  type: "object",
                  properties: {
                    executive_summary_pt: {
                      type: "string",
                      description: "Resumo executivo em português (3-5 linhas). Inclua: o que aconteceu, por que importa, impacto no mercado logístico."
                    },
                    translated_content_pt: {
                      type: "string",
                      description: "Se o texto original for em inglês, traduza para português. Se já for em português, retorne o texto limpo."
                    },
                    tags: {
                      type: "array",
                      items: { type: "string" },
                      description: "Tags de classificação. Use entre: Galpões logísticos, Mercado industrial, Portos, Shipping, Supply chain, Transporte, Armazenagem, Intermodal, Infraestrutura, Investimentos, BTS, Locação, Venda de ativos, Brasil, Internacional, Santa Catarina, Sudeste, Sul, Portos brasileiros, Condomínios logísticos"
                    },
                    relevance_score: {
                      type: "integer",
                      description: "Score de relevância de 1 a 5 para o setor logístico/industrial. 5 = impacto direto em decisões de investimento.",
                      minimum: 1, maximum: 5
                    },
                    adherence_score: {
                      type: "integer",
                      description: "Score de aderência ao mercado imobiliário logístico Buy Invest de 1 a 5",
                      minimum: 1, maximum: 5
                    },
                    importance_level: {
                      type: "string",
                      enum: ["baixa", "normal", "alta", "critica"],
                      description: "Nível de importância da notícia"
                    },
                    sentiment_label: {
                      type: "string",
                      enum: ["positivo", "neutro", "negativo"],
                      description: "Sentimento geral da notícia para o mercado"
                    },
                    market_impact_label: {
                      type: "string",
                      enum: ["ocupação", "locação", "investimento", "expansão", "infraestrutura", "regulação", "tecnologia", "operação portuária", "custo logístico", "demanda de mercado"],
                      description: "Tipo de impacto no mercado"
                    },
                    geographic_scope: {
                      type: "string",
                      enum: ["local", "regional", "nacional", "internacional"],
                      description: "Alcance geográfico da notícia"
                    },
                    is_featured: {
                      type: "boolean",
                      description: "true se a notícia merece destaque (alta relevância + alta aderência)"
                    },
                    strategic_analysis: {
                      type: "object",
                      description: "Análise estratégica Buy Invest completa",
                      properties: {
                        why_it_matters: {
                          type: "string",
                          description: "Por que essa notícia é relevante para o setor logístico/industrial (2-3 frases)"
                        },
                        investor_impact: {
                          type: "string",
                          description: "Impacto direto para investidores de ativos logísticos (2-3 frases)"
                        },
                        occupant_impact: {
                          type: "string",
                          description: "Impacto para ocupantes e operadores logísticos (2-3 frases)"
                        },
                        developer_impact: {
                          type: "string",
                          description: "Impacto para desenvolvedores e incorporadores de galpões (2-3 frases)"
                        },
                        market_trend: {
                          type: "string",
                          description: "Tendência de mercado identificada (1-2 frases)"
                        }
                      },
                      required: ["why_it_matters", "investor_impact", "occupant_impact", "developer_impact"]
                    }
                  },
                  required: ["executive_summary_pt", "tags", "relevance_score", "adherence_score", "importance_level", "sentiment_label", "geographic_scope", "is_featured", "strategic_analysis"],
                  additionalProperties: false
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "classify_article" } },
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.error("Rate limited, stopping batch");
            break;
          }
          console.error(`AI error for article ${article.id}: ${response.status}`);
          continue;
        }

        const aiResult = await response.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.error("No tool call in AI response for article", article.id);
          continue;
        }

        const classification = JSON.parse(toolCall.function.arguments);

        await supabase
          .from("news_articles")
          .update({
            executive_summary_pt: classification.executive_summary_pt,
            translated_content_pt: classification.translated_content_pt || null,
            relevance_score: classification.relevance_score,
            adherence_score: classification.adherence_score,
            importance_level: classification.importance_level,
            sentiment_label: classification.sentiment_label,
            market_impact_label: classification.market_impact_label || null,
            geographic_scope: classification.geographic_scope,
            is_featured: classification.is_featured,
            strategic_analysis_json: classification.strategic_analysis || null,
            is_classified: true,
          })
          .eq("id", article.id);

        if (classification.tags && classification.tags.length > 0) {
          const tagRows = classification.tags.map((tag: string) => ({
            article_id: article.id,
            tag_name: tag,
          }));
          await supabase.from("article_tags").upsert(tagRows, { onConflict: "article_id,tag_name" });
        }

        // Check for alerts
        if (keywords && keywords.length > 0) {
          const textToCheck = `${article.title} ${classification.executive_summary_pt || ""} ${content}`.toLowerCase();
          const matchedKeywords = keywords.filter(k => textToCheck.includes(k.keyword.toLowerCase()));
          const highPriorityMatches = matchedKeywords.filter(k => k.priority_level >= 4);

          if (highPriorityMatches.length > 0 || classification.importance_level === "critica") {
            await supabase.from("alerts").insert({
              article_id: article.id,
              alert_type: "keyword_match",
              alert_reason: `Palavras-chave: ${highPriorityMatches.map(k => k.keyword).join(", ")}. Importância: ${classification.importance_level}`,
              priority: classification.importance_level === "critica" ? "critical" : "high",
            });
          }
        }

        processed++;
      } catch (e) {
        console.error(`Error classifying article ${article.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("classify-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
