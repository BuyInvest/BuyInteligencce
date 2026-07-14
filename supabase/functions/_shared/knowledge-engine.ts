// Buy IA · Knowledge Engine helpers (intent + embeddings + retrieval + routing)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMBED_MODEL = "openai/text-embedding-3-small";

export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  doc_title: string;
  doc_slug: string;
  doc_summary: string | null;
  doc_tags: string[] | null;
  category_id: string | null;
};

export type KnowledgeContext = {
  intents: string[];
  chunks: RetrievedChunk[];
  sources: Array<{ title: string; slug: string; similarity: number }>;
  confidence: number; // 0..1
  contextBlock: string;
};

const INTENT_KEYWORDS: Record<string, string[]> = {
  institucional: ["buy invest", "quem somos", "institucional", "missao", "missão", "valores", "fundador"],
  comercial: ["script", "captação", "captacao", "prospecção", "prospeccao", "corretor", "broker", "negociação", "negociacao", "playbook comercial"],
  mercado: ["mercado", "vacância", "vacancia", "absorção", "absorcao", "asking rent", "prime rent", "siila", "estoque", "pipeline"],
  industrial: ["industrial", "indústria", "industria", "fabril", "manufatura"],
  logistica: ["logística", "logistica", "supply chain", "operador logístico", "operador logistico", "last mile", "fulfillment", "cross-docking", "cd ", "armazenagem"],
  portos: ["porto", "portuário", "portuaria", "antaq", "teu", "cabotagem", "retroporto", "terminal", "itajaí", "santos"],
  financeiro: ["cap rate", "noi", "yield", "roi", "tir", "valuation", "dcf", "p/vp", "dividend"],
  juridico: ["jurídico", "juridico", "contrato", "due diligence", "matrícula", "matricula", "itbi", "8245", "atípico", "atipico"],
  engenharia: ["esfr", "j4", "pé-direito", "pe direito", "piso", "doca", "sprinkler", "aaa", "classe a", "galpão", "galpao"],
  bts: ["bts", "built to suit", "built-to-suit", "sale leaseback", "sale-leaseback"],
  investimentos: ["fii", "fundo imobiliário", "fundo imobiliario", "investidor", "alavancagem", "cri"],
};

const SYNONYMS: Record<string, string[]> = {
  galpao: ["galpão", "galpao", "warehouse", "centro de distribuição", "centro de distribuicao", "cd"],
  bts: ["bts", "built to suit", "built-to-suit"],
  caprate: ["cap rate", "yield", "noi", "roi"],
  porto: ["porto", "terminal portuário", "antaq"],
};

export function classifyIntent(query: string): string[] {
  const q = query.toLowerCase();
  const hits: string[] = [];
  for (const [intent, kws] of Object.entries(INTENT_KEYWORDS)) {
    if (kws.some((k) => q.includes(k))) hits.push(intent);
  }
  return hits.length > 0 ? hits : ["geral"];
}

function expandWithSynonyms(query: string): string {
  const q = query.toLowerCase();
  const adds: string[] = [];
  for (const variants of Object.values(SYNONYMS)) {
    if (variants.some((v) => q.includes(v))) adds.push(...variants);
  }
  return adds.length ? `${query}\n\nTermos relacionados: ${[...new Set(adds)].join(", ")}` : query;
}

export async function embedQuery(apiKey: string, query: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: expandWithSynonyms(query),
        dimensions: 1536,
      }),
    });
    if (!res.ok) {
      console.error("embedQuery failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = await res.json();
    return j?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("embedQuery error", e);
    return null;
  }
}

export async function retrieveKnowledge(
  admin: SupabaseClient,
  apiKey: string,
  query: string,
  matchCount = 8,
): Promise<KnowledgeContext> {
  const intents = classifyIntent(query);
  const empty: KnowledgeContext = {
    intents,
    chunks: [],
    sources: [],
    confidence: 0,
    contextBlock: "",
  };

  const vec = await embedQuery(apiKey, query);
  if (!vec) return empty;

  const { data, error } = await admin.rpc("match_library_chunks", {
    query_embedding: vec as unknown as string,
    match_count: matchCount,
    similarity_threshold: 0.45,
  });
  if (error) {
    console.error("match_library_chunks error", error);
    return empty;
  }
  const chunks = (data ?? []) as RetrievedChunk[];
  if (chunks.length === 0) return { ...empty, intents };

  // Group by document (best chunk per doc), keep top-N
  const byDoc = new Map<string, RetrievedChunk>();
  for (const c of chunks) {
    const prev = byDoc.get(c.document_id);
    if (!prev || c.similarity > prev.similarity) byDoc.set(c.document_id, c);
  }
  const sources = [...byDoc.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 6)
    .map((c) => ({ title: c.doc_title, slug: c.doc_slug, similarity: c.similarity }));

  const top = chunks.slice(0, matchCount);
  const block = top
    .map(
      (c, i) =>
        `[Fonte ${i + 1} · ${c.doc_title} · sim ${(c.similarity * 100).toFixed(0)}%]\n${c.content}`,
    )
    .join("\n\n---\n\n");

  const avg = top.reduce((s, c) => s + c.similarity, 0) / top.length;
  const confidence = Math.min(1, Math.max(0, avg));

  return {
    intents,
    chunks: top,
    sources,
    confidence,
    contextBlock: block,
  };
}

export function buildKnowledgeSystemPrompt(ctx: KnowledgeContext): string {
  if (!ctx.contextBlock) {
    return `\n\n[Knowledge Engine] Nenhum trecho relevante foi encontrado na Biblioteca Buy Invest para esta pergunta. Responda usando seu conhecimento, deixando claro quando for estimativa ou referência geral, e sugira que o usuário consulte/insira documentação institucional se for tema sensível.`;
  }
  return `\n\n[Knowledge Engine — Biblioteca Buy Invest]
Você recebeu trechos verificados da Biblioteca Buy Invest. Trate-os como FONTE PRIMÁRIA — eles têm precedência sobre seu conhecimento prévio.

Regras obrigatórias:
1. Sempre que os trechos abaixo cobrirem a pergunta, base sua resposta neles.
2. Cite as fontes ao final usando a seção "Fontes consultadas:" em formato de lista. Use apenas os títulos abaixo.
3. Se complementar com conhecimento externo, sinalize discretamente ("complemento de mercado:").
4. Nunca invente dados como se viessem da Biblioteca; só atribua à Buy Invest o que estiver nos trechos.
5. Intenções detectadas: ${ctx.intents.join(", ")}.
6. Confiança da recuperação: ${(ctx.confidence * 100).toFixed(0)}%.

Trechos (ordenados por relevância):
${ctx.contextBlock}

Fontes disponíveis para citação:
${ctx.sources.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}`;
}

// ---------- Multi-model orchestration ----------
// Picks the best model per task when llmId === 'auto'. Otherwise honours user pick.
const AUTO_LLM_DEFAULT = "google/gemini-3-flash-preview";

export function routeModel(
  requested: string | undefined,
  intents: string[],
  query: string,
  contextChars: number,
): string {
  if (requested && requested !== "auto") return requested;

  const q = query.toLowerCase();
  const longContext = contextChars > 6000 || q.length > 1200;
  const legalish = intents.includes("juridico") || /contrato|cláusul|clausul|due diligence/.test(q);
  const heavyReasoning = /valuation|dcf|cap rate|modelagem|projeção|projecao|estrutura|analise comparativa/.test(q);
  const multimodal = /imagem|foto|planta|layout|mapa|gráfico|grafico|tabela/.test(q);

  if (legalish || longContext) return "openai/gpt-5.4-pro"; // long, careful reasoning
  if (heavyReasoning) return "openai/gpt-5.5";
  if (multimodal) return "google/gemini-2.5-pro";
  return AUTO_LLM_DEFAULT;
}
