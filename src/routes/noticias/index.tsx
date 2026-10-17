import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPublishedNews, NEWS_CATEGORIES, type NewsArticle } from "@/lib/news.functions";
import { NewsShell, formatNewsDate, LANG_LABEL } from "@/components/news/NewsShell";
import { Badge } from "@/components/ui/badge";
import { Newspaper } from "lucide-react";

const newsListQuery = (category: string) =>
  queryOptions({ queryKey: ["news", "list", category], queryFn: () => listPublishedNews({ data: { category } }) });

const TITLE = "Noticias de negocios para Haití y la diáspora | Kizkka";
const DESC = "Actualidad de negocios, comercio internacional, importación y logística para emprendedores haitianos en Haití y el mundo.";

export const Route = createFileRoute("/noticias/")({
  validateSearch: (s: Record<string, unknown>) => ({ cat: typeof s.cat === "string" ? s.cat : "" }),
  loaderDeps: ({ search }) => ({ cat: search.cat }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(newsListQuery(deps.cat)),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://kizkka.com/noticias" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://kizkka.com/noticias" }],
  }),
  component: NewsIndex,
  errorComponent: ({ error }) => <NewsShell><p className="p-8 text-center">{error instanceof Error ? error.message : "Error"}</p></NewsShell>,
  notFoundComponent: () => <NewsShell><p className="p-8 text-center">Sin noticias.</p></NewsShell>,
});

function Card({ a, big }: { a: NewsArticle; big?: boolean }) {
  return (
    <Link to="/noticias/$slug" params={{ slug: a.slug }} className="group block rounded-xl overflow-hidden border bg-card hover:shadow-lg transition">
      <div className={`${big ? "aspect-[16/9]" : "aspect-[16/10]"} bg-muted overflow-hidden`}>
        {a.cover_image ? (
          <img src={a.cover_image} alt={a.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Newspaper className="h-10 w-10" /></div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary">{NEWS_CATEGORIES[a.category] ?? a.category}</Badge>
          <span className="text-muted-foreground">{LANG_LABEL[a.language] ?? a.language}</span>
        </div>
        <h2 className={`${big ? "text-2xl" : "text-lg"} font-bold leading-tight group-hover:text-primary`}>{a.title}</h2>
        {a.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{a.excerpt}</p>}
        <p className="text-xs text-muted-foreground">{formatNewsDate(a.published_at)}</p>
      </div>
    </Link>
  );
}

function NewsIndex() {
  const { cat } = Route.useSearch();
  const navigate = useNavigate({ from: "/noticias/" });
  const { data: news } = useSuspenseQuery(newsListQuery(cat));
  const featured = news.find((n) => n.is_featured) ?? news[0];
  const rest = news.filter((n) => n.id !== featured?.id);

  return (
    <NewsShell>
      <section className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-10">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide">Kizkka Noticias</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-1">Negocios para Haití y la diáspora</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{DESC}</p>
          <div className="flex flex-wrap gap-2 mt-6">
            <button onClick={() => navigate({ search: { cat: "" } })} className={`px-3 py-1.5 rounded-full text-sm border ${!cat ? "bg-primary text-primary-foreground" : "bg-background"}`}>Todas</button>
            {Object.entries(NEWS_CATEGORIES).map(([k, v]) => (
              <button key={k} onClick={() => navigate({ search: { cat: k } })} className={`px-3 py-1.5 rounded-full text-sm border ${cat === k ? "bg-primary text-primary-foreground" : "bg-background"}`}>{v}</button>
            ))}
          </div>
        </div>
      </section>
      <div className="container mx-auto px-4 py-8">
        {!featured ? (
          <div className="text-center py-20 text-muted-foreground">
            <Newspaper className="h-12 w-12 mx-auto mb-3" />
            Pronto publicaremos noticias en esta sección.
          </div>
        ) : (
          <>
            <Card a={featured} big />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
              {rest.map((a) => <Card key={a.id} a={a} />)}
            </div>
          </>
        )}
      </div>
    </NewsShell>
  );
}
