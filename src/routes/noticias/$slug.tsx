import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getNewsBySlug, NEWS_CATEGORIES } from "@/lib/news.functions";
import { NewsShell, formatNewsDate, LANG_LABEL } from "@/components/news/NewsShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingBag, Store } from "lucide-react";

const articleQuery = (slug: string) =>
  queryOptions({
    queryKey: ["news", "article", slug],
    queryFn: async () => {
      const res = await getNewsBySlug({ data: { slug } });
      if (!res) throw notFound();
      return res;
    },
  });

export const Route = createFileRoute("/noticias/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(articleQuery(params.slug)),
  head: ({ loaderData, params }) => {
    const url = `https://kizkka.com/noticias/${params.slug}`;
    if (!loaderData) return { meta: [{ title: "Noticia no disponible | Kizkka" }, { name: "robots", content: "noindex" }] };
    const a = loaderData.article;
    const desc = (a.excerpt || a.content).replace(/\s+/g, " ").slice(0, 180);
    const meta: Array<Record<string, string>> = [
      { title: `${a.title} | Kizkka Noticias` },
      { name: "description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:title", content: a.title },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (a.cover_image && /^https:\/\//.test(a.cover_image)) {
      meta.push({ property: "og:image", content: a.cover_image }, { name: "twitter:image", content: a.cover_image });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: a.title,
          datePublished: a.published_at,
          image: a.cover_image ? [a.cover_image] : undefined,
          author: { "@type": "Organization", name: a.author_name || "Kizkka" },
          publisher: { "@type": "Organization", name: "Kizkka" },
          inLanguage: a.language,
        }),
      }],
    };
  },
  component: ArticlePage,
  errorComponent: ({ error }) => <NewsShell><p className="p-8 text-center">{error instanceof Error ? error.message : "Error"}</p></NewsShell>,
  notFoundComponent: () => (
    <NewsShell>
      <div className="p-12 text-center space-y-4">
        <p>Esta noticia no existe o fue retirada.</p>
        <Link to="/noticias" search={{ cat: "" }} className="text-primary underline">Ver todas las noticias</Link>
      </div>
    </NewsShell>
  ),
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(articleQuery(slug));
  const { article: a, related } = data;

  return (
    <NewsShell>
      <article className="container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/noticias" search={{ cat: "" }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> Noticias
        </Link>
        <div className="flex items-center gap-2 text-xs mb-3">
          <Badge variant="secondary">{NEWS_CATEGORIES[a.category] ?? a.category}</Badge>
          <span className="text-muted-foreground">{LANG_LABEL[a.language] ?? a.language}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold leading-tight">{a.title}</h1>
        <p className="text-sm text-muted-foreground mt-3">{a.author_name || "Kizkka"} · {formatNewsDate(a.published_at)}</p>
        {a.excerpt && <p className="text-lg text-muted-foreground mt-6 font-medium">{a.excerpt}</p>}
        {a.cover_image && <img src={a.cover_image} alt={a.title} className="w-full rounded-xl mt-6 aspect-[16/9] object-cover" />}
        <div className="mt-8 space-y-4 text-base leading-relaxed">
          {a.content.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>

        <aside className="mt-12 rounded-2xl border bg-muted/40 p-6 space-y-3">
          <h2 className="text-xl font-bold">Haz crecer tu negocio con Kizkka</h2>
          <p className="text-muted-foreground text-sm">Compra al por mayor directo de fábrica, vende en tu propia tienda en línea y recibe tus pedidos en Haití.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link to="/marketplace"><ShoppingBag className="h-4 w-4 mr-2" />Ver catálogo</Link></Button>
            <Button asChild variant="outline"><Link to="/registro-vendedor"><Store className="h-4 w-4 mr-2" />Abrir mi tienda</Link></Button>
          </div>
        </aside>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold mb-4">Más noticias</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link key={r.id} to="/noticias/$slug" params={{ slug: r.slug }} className="block rounded-lg border overflow-hidden hover:shadow">
                  {r.cover_image && <img src={r.cover_image} alt={r.title} loading="lazy" className="aspect-[16/10] w-full object-cover" />}
                  <p className="p-3 text-sm font-semibold line-clamp-3">{r.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </NewsShell>
  );
}
