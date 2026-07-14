import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known RSS feed paths per source domain
const RSS_PATHS: Record<string, string[]> = {
  "porttechnology.org": ["/feed", "/rss-feeds/", "/feed/rss2"],
  "supplychaindive.com": ["/feeds/news/"],
  "seatrade-maritime.com": ["/feed", "/rss"],
  "ajot.com": ["/feed", "/rss"],
  "freightwaves.com": ["/feed", "/rss"],
  "datamarnews.com": ["/feed", "/rss"],
  "inboundlogistics.com": ["/feed", "/rss"],
  "mundologistica.com.br": ["/feed", "/rss", "/feed.xml"],
  "portosenavios.com.br": ["/feed", "/rss"],
  "revistametroquadrado.com.br": ["/feed", "/rss"],
  "joc.com": ["/feed", "/rss"],
  "worldcargonews.com": ["/feed", "/rss"],
  "lloydslist.com": ["/feed", "/rss"],
  "logweb.com.br": ["/feed", "/rss"],
  "tecnologistica.com.br": ["/feed", "/rss", "/br/feed"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: sources, error: srcErr } = await supabase
      .from("news_sources")
      .select("*")
      .eq("is_active", true);

    if (srcErr) throw srcErr;

    let totalFetched = 0;
    let totalNew = 0;
    const errors: string[] = [];

    for (const source of sources || []) {
      try {
        const articles = await fetchFromSource(source);
        totalFetched += articles.length;

        for (const article of articles) {
          // Dedup by URL
          const { data: existing } = await supabase
            .from("news_articles")
            .select("id")
            .eq("original_url", article.original_url)
            .maybeSingle();

          if (!existing) {
            // Dedup by title similarity (exact match)
            const { data: titleDup } = await supabase
              .from("news_articles")
              .select("id")
              .eq("title", article.title)
              .maybeSingle();

            const { error: insertErr } = await supabase
              .from("news_articles")
              .insert({
                source_id: source.id,
                title: article.title,
                subtitle: article.subtitle || null,
                original_url: article.original_url,
                original_category: article.category || null,
                author_name: article.author || null,
                published_at: article.published_at || new Date().toISOString(),
                image_url: article.image_url || null,
                raw_content: article.content || null,
                cleaned_content: article.content || null,
                is_duplicate: !!titleDup,
                duplicate_group_id: titleDup?.id || null,
              });

            if (!insertErr) totalNew++;
          }
        }

        // Update last_fetch_at
        await supabase
          .from("news_sources")
          .update({ last_fetch_at: new Date().toISOString() })
          .eq("id", source.id);
      } catch (e) {
        const msg = `Error fetching ${source.name}: ${e instanceof Error ? e.message : String(e)}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return new Response(
      JSON.stringify({ success: true, totalFetched, totalNew, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface Article {
  title: string;
  subtitle?: string;
  original_url: string;
  category?: string;
  author?: string;
  published_at?: string;
  image_url?: string;
  content?: string;
}

function getDomainKey(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return Object.keys(RSS_PATHS).find(d => hostname.includes(d)) || null;
  } catch { return null; }
}

async function fetchFromSource(source: any): Promise<Article[]> {
  const domainKey = getDomainKey(source.base_url);
  const rssPaths = domainKey ? RSS_PATHS[domainKey] : ["/feed", "/rss", "/feed.xml", "/rss.xml"];

  // Try each RSS path
  for (const path of rssPaths) {
    try {
      const url = source.base_url.replace(/\/$/, "") + path;
      console.log(`Trying RSS: ${url}`);
      const resp = await fetch(url, {
        headers: { "User-Agent": "BuyInvest-Radar/1.0" },
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text.includes("<rss") || text.includes("<feed") || text.includes("<channel") || text.includes("<entry")) {
          console.log(`✅ RSS found for ${source.name}: ${path}`);
          return parseRSS(text, source.base_url);
        }
      }
    } catch { /* continue */ }
  }

  // Fallback: try scraping the news page for links
  console.log(`⚠️ No RSS for ${source.name}, trying page scrape`);
  return await scrapeNewsPage(source);
}

async function scrapeNewsPage(source: any): Promise<Article[]> {
  const articles: Article[] = [];
  const paths = ["/noticias", "/news", "/categoria/noticias", "/category/news", ""];

  for (const path of paths) {
    try {
      const url = source.base_url.replace(/\/$/, "") + path;
      const resp = await fetch(url, {
        headers: { "User-Agent": "BuyInvest-Radar/1.0" },
      });
      if (!resp.ok) continue;

      const html = await resp.text();
      // Extract article links and titles from HTML
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/a][^>]*>[^<]*)*)<\/a>/gi;
      let match;
      const seen = new Set<string>();

      while ((match = linkRegex.exec(html)) !== null && articles.length < 20) {
        const href = match[1];
        const rawTitle = cleanHtml(match[2]).trim();

        // Filter: must be article-like URL and have a meaningful title
        if (rawTitle.length < 15 || rawTitle.length > 300) continue;
        if (!href.includes("/") || href.includes("#") || href.endsWith(".pdf")) continue;
        if (href.includes("login") || href.includes("cadastr") || href.includes("assin")) continue;

        const fullUrl = href.startsWith("http") ? href : source.base_url.replace(/\/$/, "") + (href.startsWith("/") ? href : "/" + href);
        if (seen.has(fullUrl)) continue;
        seen.add(fullUrl);

        // Must be from same domain
        try {
          const linkDomain = new URL(fullUrl).hostname;
          const sourceDomain = new URL(source.base_url).hostname;
          if (!linkDomain.includes(sourceDomain.replace("www.", ""))) continue;
        } catch { continue; }

        articles.push({
          title: rawTitle,
          original_url: fullUrl,
          content: "",
          published_at: new Date().toISOString(),
        });
      }

      if (articles.length > 0) {
        console.log(`📄 Scraped ${articles.length} articles from ${source.name}`);
        return articles;
      }
    } catch { /* continue */ }
  }

  return articles;
}

function parseRSS(xml: string, baseUrl: string): Article[] {
  const articles: Article[] = [];
  let match;

  // RSS items
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractTag(item, "title");
    const link = extractTag(item, "link") || extractTag(item, "guid");
    const description = extractTag(item, "description") || extractTag(item, "content:encoded");
    const pubDate = extractTag(item, "pubDate") || extractTag(item, "dc:date");
    const author = extractTag(item, "dc:creator") || extractTag(item, "author");
    const category = extractTag(item, "category");

    let imageUrl = extractAttribute(item, "media:content", "url") ||
                   extractAttribute(item, "enclosure", "url");
    if (!imageUrl) {
      const imgMatch = item.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    if (title && link) {
      const fullUrl = link.startsWith("http") ? link : baseUrl + link;
      articles.push({
        title: cleanHtml(title),
        original_url: fullUrl,
        content: cleanHtml(description || ""),
        published_at: pubDate ? new Date(pubDate).toISOString() : undefined,
        author: author ? cleanHtml(author) : undefined,
        category: category ? cleanHtml(category) : undefined,
        image_url: imageUrl || undefined,
      });
    }
  }

  // Atom entries
  if (articles.length === 0) {
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const title = extractTag(entry, "title");
      const link = extractAttribute(entry, "link", "href");
      const summary = extractTag(entry, "summary") || extractTag(entry, "content");
      const published = extractTag(entry, "published") || extractTag(entry, "updated");

      if (title && link) {
        articles.push({
          title: cleanHtml(title),
          original_url: link.startsWith("http") ? link : baseUrl + link,
          content: cleanHtml(summary || ""),
          published_at: published ? new Date(published).toISOString() : undefined,
        });
      }
    }
  }

  return articles;
}

function extractTag(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(regex);
  return m ? m[1].trim() : null;
}

function extractAttribute(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, "i");
  const m = xml.match(regex);
  return m ? m[1] : null;
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}
