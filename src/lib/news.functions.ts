import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type NewsArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  category: string;
  language: string;
  author_name: string | null;
  is_featured: boolean;
  published_at: string | null;
};

export const NEWS_CATEGORIES: Record<string, string> = {
  negocios: "Negocios",
  comercio: "Comercio internacional",
  logistica: "Logística Haití",
  oportunidades: "Oportunidades mayoristas",
  emprendimiento: "Emprendimiento",
  diaspora: "Diáspora",
};

const COLS = "id, slug, title, excerpt, content, cover_image, category, language, author_name, is_featured, published_at";

function publicClient() {
  const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } });
}

/** Public list of published news articles (newest first). */
export const listPublishedNews = createServerFn({ method: "GET" })
  .validator((input: { category?: string } | undefined) => ({ category: String(input?.category ?? "").slice(0, 40) }))
  .handler(async ({ data }): Promise<NewsArticle[]> => {
    const sb = publicClient();
    if (!sb) return [];
    let q = sb.from("news_articles").select(COLS).eq("status", "published").order("published_at", { ascending: false }).limit(60);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows } = await q;
    return (rows ?? []) as NewsArticle[];
  });

/** Public single article by slug, plus up to 3 related articles. */
export const getNewsBySlug = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => ({ slug: String(input.slug ?? "").slice(0, 160) }))
  .handler(async ({ data }): Promise<{ article: NewsArticle; related: NewsArticle[] } | null> => {
    const sb = publicClient();
    if (!sb || !data.slug) return null;
    const { data: article } = await sb.from("news_articles").select(COLS).eq("status", "published").eq("slug", data.slug).maybeSingle();
    if (!article) return null;
    const { data: related } = await sb
      .from("news_articles")
      .select(COLS)
      .eq("status", "published")
      .neq("id", (article as NewsArticle).id)
      .order("published_at", { ascending: false })
      .limit(3);
    return { article: article as NewsArticle, related: (related ?? []) as NewsArticle[] };
  });
