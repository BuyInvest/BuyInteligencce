// Buy IA · Knowledge Engine — Library indexer (chunks + embeddings)
// Drains library_indexing_queue in small batches, chunks documents and
// generates embeddings via the Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const CHUNK_MAX_CHARS = 1400;
const CHUNK_OVERLAP = 200;
const BATCH_DOCS = 5;
const MAX_ATTEMPTS = 5;

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(raw: string): string[] {
  const text = stripMarkdown(raw);
  if (!text) return [];
  if (text.length <= CHUNK_MAX_CHARS) return [text];
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).length > CHUNK_MAX_CHARS) {
      if (cur) out.push(cur.trim());
      // overlap tail
      const tail = cur.slice(Math.max(0, cur.length - CHUNK_OVERLAP));
      cur = (tail ? tail + " " : "") + s;
    } else {
      cur = cur ? cur + " " + s : s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function embedBatch(apiKey: string, inputs: string[]): Promise<number[][]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
      dimensions: 1536,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Embeddings ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return (j.data ?? []).map((d: { embedding: number[] }) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Pull pending batch
    const { data: queue } = await admin
      .from("library_indexing_queue")
      .select("document_id, attempts")
      .eq("status", "pending")
      .lt("attempts", MAX_ATTEMPTS)
      .order("queued_at", { ascending: true })
      .limit(BATCH_DOCS);

    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "queue empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = queue.map((q) => q.document_id);
    await admin
      .from("library_indexing_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("document_id", ids);

    const results: Array<{ id: string; ok: boolean; chunks?: number; error?: string }> = [];

    for (const item of queue) {
      const docId = item.document_id as string;
      try {
        const { data: doc, error: docErr } = await admin
          .from("library_documents")
          .select("id, title, summary, content, tags, status")
          .eq("id", docId)
          .maybeSingle();
        if (docErr || !doc) throw new Error(docErr?.message ?? "document not found");

        // wipe previous chunks
        await admin.from("library_document_chunks").delete().eq("document_id", docId);

        // Build canonical text (header + body)
        const header = [doc.title, doc.summary, (doc.tags ?? []).join(", ")]
          .filter(Boolean)
          .join("\n");
        const body = String(doc.content ?? "");
        const fullText = `${header}\n\n${body}`;
        const parts = chunkText(fullText);

        if (parts.length === 0) {
          await admin
            .from("library_indexing_queue")
            .update({
              status: "done",
              attempts: (item.attempts ?? 0) + 1,
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("document_id", docId);
          results.push({ id: docId, ok: true, chunks: 0 });
          continue;
        }

        // Embed in sub-batches of 16
        const SUB = 16;
        const vectors: number[][] = [];
        for (let i = 0; i < parts.length; i += SUB) {
          const slice = parts.slice(i, i + SUB);
          const vecs = await embedBatch(apiKey, slice);
          vectors.push(...vecs);
        }

        const rows = parts.map((content, idx) => ({
          document_id: docId,
          chunk_index: idx,
          content,
          token_estimate: Math.ceil(content.length / 4),
          embedding: vectors[idx] as unknown as string,
          embedding_model: EMBED_MODEL,
        }));

        const { error: insErr } = await admin
          .from("library_document_chunks")
          .insert(rows);
        if (insErr) throw new Error(insErr.message);

        await admin
          .from("library_indexing_queue")
          .update({
            status: "done",
            attempts: (item.attempts ?? 0) + 1,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("document_id", docId);

        results.push({ id: docId, ok: true, chunks: parts.length });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        await admin
          .from("library_indexing_queue")
          .update({
            status: "pending",
            attempts: (item.attempts ?? 0) + 1,
            last_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("document_id", docId);
        results.push({ id: docId, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("index-library error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
